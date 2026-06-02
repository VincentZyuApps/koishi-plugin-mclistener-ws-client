## 20260602 `/exec <cmd>` 扩展方案（中文草案）

### 一、目标

希望在 Koishi 侧增加一个类似：

```text
/exec list
/exec say hello
```

的指令，把聊天平台上的命令请求通过 WebSocket 发到 MCDR 服务端插件，由服务端执行，再把执行结果返回给 Koishi。

这条链路本质上是：

```text
Koishi 指令 -> Koishi WS 客户端 -> MCDR WS 服务端 -> MCDR 插件侧调度执行服务器命令 -> 返回 command_result -> Koishi 回复结果
```

---

### 二、当前现状

#### 2.1 Koishi 客户端现状

当前 `mclistener-ws-client` 只做了两类事：

1. 接收 MC 服务端广播的：
   - `player_join`
   - `player_leave`
   - `player_chat`

2. 向 MC 服务端发送：
   - `chat_platform_to_server`

也就是说，当前客户端协议里**没有正式定义** `command` / `command_result`。

相关落点：

- `src/types.ts`
- `src/client.ts`
- `src/messageHandler.ts`
- `src/index.ts`

其中 `src/index.ts` 当前也还**没有注册 Koishi 指令**，只有聊天消息转发中间件。

#### 2.2 MCDR 服务端现状

服务端 `ws_server.py` 里其实已经有一个半成品分支：

- 收到 `type == 'command'`
- 调用 `self.server.rcon_query(data['command'])`
- 返回 `command_result`

但这段实现不完整，主要问题：

1. 它当前挂了一个 `self.server.is_on_executor_thread()` 条件，是否能稳定命中值得怀疑。
2. 没有 request id / correlation id，客户端如果并发发多条命令，不好匹配响应。
3. 没有权限、白名单、来源限制。
4. 没有超时、异常结构化返回。
5. 当前 Koishi 客户端并没有接这个能力。

这里要特别说明一下：

- **代码当前写成 `rcon_query()`，不等于这条能力在设计上就应该叫“RCON 执行”。**
- 从 MCDR 使用习惯和你的项目语境看，更自然的理解应该是：
  - 由 MCDR 插件接收 WS 请求
  - 再通过 MCDR / 服务端接口把命令转发到 Minecraft 服务端侧

也就是说，`rcon_query()` 更像当前半成品实现里的一个历史选择，不该直接当成最终方案文案。

所以这条能力目前更像“曾经想做过，但还没正式闭环”。

---

### 三、我建议的设计方向

建议把它做成一个**显式、受限、可关闭**的扩展能力，而不是默认裸开。

核心原则：

1. 默认关闭。
2. 指令权限单独控制。
3. 服务端执行范围明确。
4. 协议有 request id。
5. 返回结果长度可控。
6. 出错时有结构化错误响应。
7. WS 层 token 鉴权和 command 能力开关要分开考虑。

---

### 四、推荐协议

#### 4.1 客户端 -> 服务端

```json
{
  "type": "command",
  "request_id": "1717267200123-1",
  "command": "list",
  "sender": {
    "platform": "qq",
    "channel_id": "123456",
    "user_id": "10001",
    "nickname": "Vincent"
  }
}
```

建议点：

- `request_id`
  用于把响应和请求对应起来。
- `request_id` 建议由 **Koishi 客户端生成**，服务端原样回传即可。
- 比起 UUID，我觉得这里直接用：

```text
{unix_ms}-{count}
```

就够用了。

例如：

```text
1717267200123-1
1717267200456-2
```

建议这里的 `count` 是 **Koishi 客户端当前进程内的递增计数器**，而不是服务端收到的第几个包。  
原因很简单：请求 id 的职责是让**发起方**能在本地 `pendingRequests` 里做匹配，所以更适合由客户端自己生成。

- `token`
  不建议只挂在 `command` 包体里，因为你这次的需求已经变成了：
  - **所有 WS 发包 / 收包都应受 token 约束**
  - 也就是说，它更适合作为 **连接级鉴权**，而不是某一种 message type 的字段
- `sender`
  方便服务端日志记录、后续权限判断、审计。
- `command`
  纯字符串，不要在协议层做复杂拆分。

#### 4.1.1 token 建议放在 WS 连接层

你提到的这种方式我觉得是可行的：

```text
ws://ip:port?token=xxx
```

例如：

```text
ws://127.0.0.1:60601?token=test12345
```

我当前对这个方案的看法：

优点：

1. 简单直接
2. Koishi 客户端实现成本低
3. MCDR 服务端在握手阶段就能判断是否放行
4. 不需要每种消息体都重复带 `token`

缺点：

1. token 暴露在 URL 里，日志里如果直接打印完整连接地址，容易带出来
2. 如果后面做更复杂的多客户端鉴权，URL query 参数扩展性一般

但就你现在这个插件体量和用途来说，我认为它是**完全可以接受的第一阶段方案**。

建议规则：

- `token` 留空：表示不启用 token 校验
- `token` 非空：表示握手时必须校验 query 中的 `token`

也就是说，服务端配置项如果是空字符串，就不验；如果有值，就验。

#### 4.2 服务端 -> 客户端

成功：

```json
{
  "type": "command_result",
  "request_id": "1717267200123-1",
  "command": "list",
  "ok": true,
  "result": "There are 2 of a max of 20 players online: ..."
}
```

失败：

```json
{
  "type": "command_result",
  "request_id": "1717267200123-1",
  "command": "list",
  "ok": false,
  "error": "command execution failed"
}
```

如果后面想继续扩展，也可以再补：

- `elapsed_ms`
- `truncated`
- `source`

---

### 五、Koishi 侧建议改法

#### 5.1 在 `src/types.ts` 中补类型

建议新增：

- `CommandRequestMessage`
- `CommandResultMessage`
- 扩展服务端消息联合类型

这样后面 `client.ts` / `messageHandler.ts` 不会再靠裸 `any`。

#### 5.2 在 `src/client.ts` 中补请求-响应能力

建议新增能力：

1. `sendCommand(command: string, meta?: ...)`
2. 内部维护 `pendingRequests: Map<request_id, resolver>`
3. 收到 `command_result` 时按 `request_id` resolve / reject
4. 做一个超时，比如 `10s`

也就是说，`client.ts` 不再只是“单向转发消息”，而是开始承担一个很轻量的 RPC 职责。

#### 5.3 是否要单独新增 `src/command.ts`

我现在更倾向于：**是，单独拆一个 `command.ts` 比较合适。**

原因：

1. `src/index.ts` 当前主要负责：
   - 生命周期
   - 创建 / 销毁 WS 客户端
   - 注册聊天转发中间件

2. `/exec <cmd>` 这套逻辑如果继续塞在 `index.ts`，会把“中间件转发”和“Koishi 指令执行”两条职责混在一起。

3. 单独拆一个 `src/command.ts` 后，结构会更清楚：

```text
src/index.ts
  -> 初始化插件
  -> 创建 client
  -> 注册 middleware
  -> 调用 registerCommands(...)

src/command.ts
  -> 注册 exec / mc.exec 命令
  -> 做权限检查
  -> 处理回复格式
  -> 调 client.sendCommand(...)
```

所以如果正式做，我建议新增：

- `src/command.ts`

然后在 `src/index.ts` 里只负责调用它。

#### 5.4 在 `src/index.ts` 中注册 Koishi 指令

建议加一个显式命令，例如：

```text
exec <cmd:text>
```

或者：

```text
minecraft.exec <cmd:text>
```

更建议第二种，原因：

1. `exec` 太短，容易和别的插件撞名。
2. 从可维护性看，命令空间更清晰。

结合你现在的想法，我觉得默认值直接设成：

```text
mcws.exec <cmd:text>
```

会更合适。

原因：

1. 比 `exec` 更不容易撞名
2. 比 `minecraft.exec` 更短
3. 和这个插件的 ws 定位比较一致

#### 5.5 指令名做成可配置

这个需求是合理的，而且跟当前 `config.ts` 的组织方式是兼容的。

建议新增配置项：

```ts
execCommandName: string
```

默认值：

```ts
mcws.exec
```

也就是说，默认注册的是：

```text
mcws.exec <cmd:text>
```

如果用户想改，也可以在配置里换成：

- `mc.exec`
- `exec`
- `mcdr-exec`
- `runmc`

等等。

我建议这里注意一个实现细节：

1. **配置项名**叫 `execCommandName`
2. **默认值**是 `exec`
3. 真正注册命令时，用这个配置值拼出来

这样后面如果要再加别的命令，不会和 `/exec` 这个动作本身混淆。

#### 5.6 指令回复是否启用引用

你提到的 `awa-quote-image` 做法我觉得可以直接借鉴。

建议新增配置项：

```ts
enableQuote: boolean
```

默认值：

```ts
true
```

适用范围建议明确成：

- **所有由这个 Koishi 指令触发的回复消息都应用**

也就是说，下面这些都要统一带上：

1. 权限不足提示
2. WS 未连接提示
3. “正在执行命令...” 提示
4. 执行成功结果
5. 执行失败结果
6. 超时提示
7. 参数为空提示

推荐统一写法和 `awa-quote-image` 一样：

```ts
${config.enableQuote ? h.quote(session.messageId) : ''}
```

这样交互体验会比较统一，也比较符合你现在插件生态里的风格。

#### 5.7 指令行为建议

流程建议如下：

1. 用户输入命令
2. Koishi 检查本地配置权限
3. 若 WS 未连接，直接回复“当前未连接服务器”
4. 发送 `command` 请求
5. 等待 `command_result`
6. 把结果回复到当前会话

回复风格建议：

成功：

```text
[MC命令执行成功]
> list
There are 2 of a max of 20 players online: ...
```

失败：

```text
[MC命令执行失败]
> list
command execution failed
```

#### 5.8 Koishi 配置建议

建议新增几个配置项：

- `enableExecCommand: boolean`
  是否启用这项能力，默认 `false`

- `execCommandName: string`
  Koishi 指令名，默认 `mcws.exec`

- `enableQuote: boolean`
  是否给由指令触发的回复自动带引用，默认 `true`

- `wsToken: string`
  WebSocket 连接 token。不是只给 command 用，而是整个 WS 连接层都用。默认先写 `test12345`

- `execCommandPrefixList: string[]`
  允许谁能触发，或者说在哪些频道启用

- `execCommandAdminUserIdList: Array<{ platform, userId, enable }>`
  哪些用户允许执行

- `execCommandTimeoutMs: number`
  等待服务端返回多久，默认 `10000`

- `execCommandMaxReplyLength: number`
  回复最大长度，避免刷屏，默认比如 `1500`

如果做最小可用版，我建议最少先上这些：

- `enableExecCommand`
- `execCommandName`
- `enableQuote`
- `wsToken`
- `execCommandAdminUserIdList`

#### 5.9 `src/config.ts` 里的推荐放置位置

当前 `src/config.ts` 已经分了 9 组：

1. WS 连接
2. 报告
3. 转发目的地
4. 来源平台
5. 玩家加入
6. 玩家离开
7. 玩家聊天
8. 平台消息转发到服务器
9. 调试

我建议新加一个独立分组：

```text
🔐 第十组：远程命令执行配置
```

里面放：

- `enableExecCommand`
- `execCommandName`
- `enableQuote`
- `wsToken`
- `execCommandAdminUserIdList`
- `execCommandTimeoutMs`
- `execCommandMaxReplyLength`

这样不会和“普通聊天转发配置”混在一起，用户也更容易在 Koishi 控制台里找到。

---

### 六、MCDR 服务端建议改法

#### 6.1 修正 `ws_server.py` 的 command 分支

当前那段逻辑不能直接拿来当正式实现。

建议改成：

1. 去掉不稳定的 `is_on_executor_thread()` 限制
2. 在 MCDR 合适线程里调度执行
3. 接收 `request_id`
4. 返回结构化 `command_result`
5. 统一 try/except

伪流程：

```text
收到 command
-> 校验 enable / 权限 / 白名单
-> 执行命令
-> 组装 command_result
-> safe_send 回去
```

#### 6.2 服务端配置建议

建议也加几个配置项：

- `enable_remote_exec_command: bool = false`
- `ws_token: str = "test12345"`
- `remote_exec_command_whitelist: list[str] = []`
- `remote_exec_command_timeout_sec: int = 10`
- `remote_exec_result_max_length: int = 4000`

如果你暂时不想做太复杂，最小可行版本至少要有：

- `enable_remote_exec_command`
- `ws_token`

这样不至于默认裸开一个远程执行入口。

#### 6.2.1 服务端配置项的位置建议

你提到想把 token 放在：

- `host`
- `port`

后面

我觉得这个安排是合理的。

也就是说，服务端这边配置文件的高层顺序可以优先写成：

1. `host`
2. `port`
3. `ws_token`
4. `enable_remote_exec_command`

这样“连接相关配置”和“远程执行能力开关”会放在最前面，比较好找。

#### 6.3 执行方式要想清楚

这里有一个关键问题：

当前代码写的是：

```python
self.server.rcon_query(data['command'])
```

但这并不一定是你真正想要的“执行 MCDR / 服务器命令”的最终方式。

更准确地说：

- 这只是**当前半成品代码里的实现方式**
- 不代表最终方案必须定义成“RCON 命令能力”
- 从你的项目背景看，更像是“由 MCDR 插件代为向服务端侧提交命令”

你需要先明确：

1. 是只执行 Minecraft 服务器命令？
2. 还是希望能执行 MCDR 命令？
3. 还是两者分开？

我建议第一阶段只做：

- **只允许执行 Minecraft 服务器命令**

理由：

1. 范围最清晰。
2. 风险更低。
3. 返回值模型相对单纯。

如果以后还想执行 MCDR 命令，可以另做：

- `mc_command`
- `mcdr_command`

分成两类，而不是一个 `command` 全吞。

---

### 七、权限与安全

这个功能最大的问题不是“能不能做”，而是“做出来之后会不会太危险”。

至少要考虑：

1. 聊天平台上的普通用户不能直接拿到执行权。
2. 某些频道不能执行。
3. 敏感命令是否要拦截。
4. 执行日志要能追溯是谁发起的。

建议最少做这些限制：

#### 7.1 Koishi 侧限制

- 只有配置白名单用户能触发
- 只有指定平台 / 指定频道能触发

#### 7.2 服务端侧限制

- 默认关闭
- 可选命令前缀白名单

例如只允许：

- `list`
- `say `
- `time `
- `weather `

而不是让它能随便发：

- `op`
- `stop`
- `reload`

如果你后面准备把它做成“自己私用的运维入口”，那也建议至少给命令白名单。

---

### 八、推荐实现顺序

建议按下面顺序推进：

#### 阶段 1：先补协议与最小闭环

Koishi：

1. `types.ts` 加 `command` / `command_result`
2. `client.ts` 增加 request-response 映射
3. `index.ts` 注册一个受限命令

MCDR：

1. `ws_server.py` 修正 command 分支
2. 增加 `request_id`
3. 返回 `ok/result/error`

这一阶段先不做复杂权限，只做最小可跑通版本，但也要**默认关闭**。

#### 阶段 2：补权限和配置

Koishi：

1. 增加启用开关
2. 增加管理员白名单
3. 增加超时 / 输出长度配置

MCDR：

1. 增加服务端启用开关
2. 增加命令白名单
3. 增加日志记录

#### 阶段 3：补文档与交互

1. README 增加协议说明
2. README 增加安全警告
3. 优化 Koishi 回复格式
4. 长输出做截断提示

---

### 九、我当前的倾向

我觉得这个功能是能做的，而且你现在这个项目形态挺适合加：

1. MCDR 服务端已经有半成品分支
2. Koishi 客户端结构也不复杂
3. 只要补一个轻量的 request-response 就能闭环

但我**不建议**直接做成“默认开放的远程执行”。

我更推荐的落地方式是：

- Koishi 侧：`mcws.exec <cmd:text>`
- 默认关闭
- 只允许白名单用户
- 服务端只允许执行受限命令，或者至少先开关控制

---

### 十、下一步实施时会改到哪些文件

如果下一步正式开干，大概率会动这些文件：

#### Koishi 客户端

- `src/types.ts`
- `src/client.ts`
- `src/index.ts`
- `src/command.ts`
- `src/config.ts`
- 可能还会动 `readme.md`

#### MCDR 服务端

- `mcdr_listener_ws_server/ws_server.py`
- `mcdr_listener_ws_server/config.py`
- `resources/default_config.yml`
- 可能还会动 README

另外，下一步正式实现时，配置层我建议同步补：

#### Koishi

- `src/config.ts`
  - `wsToken`
  - `enableExecCommand`
  - `execCommandName`
  - `enableQuote`

#### MCDR

- `mcdr_listener_ws_server/config.py`
  - `ws_token`
  - `enable_remote_exec_command`

- `resources/default_config.yml`
  - `ws_token: test12345`
  - `enable_remote_exec_command: false`

---

### 十一、一个更保守的替代方案

如果你觉得“远程执行命令”太危险，也可以先做一个更保守版本：

- Koishi 指令只支持固定动作

例如：

```text
/mc-list
/mc-tps
/mc-say <text>
```

优点：

1. 风险小很多
2. 不需要开放任意命令执行
3. 对外行为更可控

缺点：

1. 不够灵活
2. 每个功能都要单独补协议或命令映射

---

### 十二、结论

这件事可以做，而且现有代码基础已经够了，但应该把它从“半残留分支”升级成“正式、受限、可配置”的能力。

最合理的第一步不是直接乱改，而是：

1. 在 Koishi 侧补 request-response
2. 在服务端补结构化 `command_result`
3. 默认关闭
4. 补最小权限控制

这样做出来才比较像一个能长期保留的能力，而不是临时拼起来的危险后门。

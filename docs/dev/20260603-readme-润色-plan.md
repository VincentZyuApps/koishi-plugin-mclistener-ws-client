# README 润色改进计划

> 日期: 2026-06-03
> 涉及项目:
> - `koishi-plugin-mclistener-ws-client`（Koishi 客户端插件）→ `readme.md`
> - `mcdr_listener_ws_server`（MCDR 服务端插件）→ `README.md` + `README.en-us.md`

---

## 优先级 P0：协议一致性修正（先做，收益最大）

### 1. [服务端] WebSocket 事件格式文档更新

**文件**: `mcdr_listener_ws_server/README.md` L189-226, `README.en-us.md` L189-226

**问题**: 远程命令请求/响应示例还是旧格式，实际代码已变更。

**改动**:

- `external_command_to_server` 示例补充 `request_id` 和 `sender` 字段:
  ```json
  {
      "type": "external_command_to_server",
      "request_id": "1717000000000-1",
      "command": "list",
      "sender": {
          "platform": "onebot",
          "user_id": "1830540513",
          "nickname": "Admin"
      }
  }
  ```

- `command_result` 示例补充 `request_id`、`ok`、`error` 字段:
  ```json
  {
      "type": "command_result",
      "request_id": "1717000000000-1",
      "command": "list",
      "ok": true,
      "result": "There are 3 of a max of 20 players online: ..."
  }
  ```
  失败时:
  ```json
  {
      "type": "command_result",
      "request_id": "1717000000000-1",
      "command": "stop",
      "ok": false,
      "error": "Command not in whitelist: stop"
  }
  ```

**代码参考**: `ws_server.py:127` `_handle_command()`

---

### 2. [服务端] 图片入站消息 `images` 字段示例修正

**文件**: `mcdr_listener_ws_server/README.md` L189-207, `README.en-us.md` L189-207

**问题**: 示例用 `{ url, name }`，但客户端实际发 `{ idx, url, summary? }`，`name` 从未被服务端使用。

**改动**: 将 `images` 示例改为:
```json
"images": [
    {
        "idx": 0,
        "url": "https://example.com/image.png",
        "summary": "一张截图"
    }
]
```
并说明 `summary` 为可选字段（图片描述/alt文本），`idx` 为图片在消息中的索引（用于替换 `<img:N>` 占位符）。

**代码参考**: 客户端 `types.ts:98`, `messageHandler.ts:103`

---

### 3. [服务端] 配置表补充 `view_image_cooldown_ms`

**文件**: `mcdr_listener_ws_server/README.md` L117-131, `README.en-us.md` L117-131

**问题**: 配置表缺少 `view_image_cooldown_ms` 字段。

**改动**: 在 `image_cache_ttl_sec` 行之后添加:

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `view_image_cooldown_ms` | ⏳ `!!view_image` 全服共享冷却时间（毫秒） | `5555` |

**代码参考**: `config.py:47`, `default_config.yml:59`

---

### 4. [客户端] 白名单前缀示例与默认值统一

**文件**: `mclistener-ws-client/readme.md` L88, L186-187

**问题**: 功能说明处举例白名单前缀为 `!!`，但配置默认值是 `['#']`。`config.ts:133` Schema 描述也残留了"默认值是 `!!`"的旧说法。

**改动**:
- `readme.md:88` 白名单前缀举例从 `!!` 改为 `#`（与默认值一致），或改为更中性的描述
- `config.ts:133` Schema description 中"默认值是 `!!`"修正为"默认值是 `#`"

---

## 优先级 P1：内容补充（减少用户困惑）

### 5. [客户端] 新增"命令"章节

**文件**: `mclistener-ws-client/readme.md` 配置章节之后

**问题**: README 写了远程命令执行能力，但没有告诉用户具体怎么用。

**改动**: 在配置章节后、调试章节前，新增:

```markdown
## 🖥️ 命令

### `mcws.exec <cmd>`

在 MC 服务器上远程执行命令，结果回传到聊天平台。

- **默认指令名**: `mcws.exec`（可通过 `execCommandName` 配置修改）
- **使用示例**: 在聊天平台发送 `mcws.exec list`
- **权限控制**: 默认仅白名单用户可执行（`enableExecCommandWhitelist`），白名单通过 `execCommandAdminUserIdList` 配置
- **前置条件**:
  - 客户端: `enableExecCommand` 设为 `true`
  - 服务端: `enable_remote_exec_command` 设为 `true`
  - 服务端: RCON 已启用（见 [RCON 配置](#️-前置条件启用-rcon)）
- **输出**: 超过 `execCommandMaxReplyLength`（默认1500字符）的结果会被截断
```

**代码参考**: `command.ts:21`

---

### 6. [服务端] 补充图片消息广播机制说明

**文件**: `mcdr_listener_ws_server/README.md` "它能做什么" 章节

**问题**: 当前描述容易让人误解图片是单人查看（类似 `!!view_image`），实际平台发来的图片消息走 `tellraw @a` 广播给所有在线玩家。

**改动**: 在 "聊天平台 → MC 服务器" 部分补充说明:
> 图片消息会以 tellraw 可点击文本的形式广播给**所有在线玩家**，玩家点击后触发 `!!view_image` 渲染图片。这与单人手动执行 `!!view_image` 不同。

**代码参考**: `ws_server.py:323`

---

### 7. [客户端] 补充富文本降级处理说明

**文件**: `mclistener-ws-client/readme.md` 功能或配置章节

**问题**: 用户可能期望所有平台消息元素都能优雅转发到游戏内，但实际只处理了文本、@、图片，其他元素退化为 `<type>` 占位文本。

**改动**: 在"平台消息转发到服务器"配置区域补充:
> ⚠️ **富文本支持范围**: 当前仅处理文本、@提及（转为 `<at @userId>`）、图片（转为 `<img:N>` + images 数组）。其他平台特有消息元素（如表情、卡片、文件等）会退化为 `<元素类型>` 占位文本。

**代码参考**: `messageHandler.ts:97`

---

### 8. [客户端] 补充 Bot 消息排除判定逻辑警告

**文件**: `mclistener-ws-client/readme.md` `excludeBotMessages` 配置项说明处

**问题**: `excludeBotMessages` 除了判断 userId 外，还会匹配昵称中包含 `bot` 或 `机器人` 的用户，可能误杀普通用户。

**改动**: 在 `excludeBotMessages` 配置项说明后补充:
> ⚠️ 判定逻辑包含昵称子串匹配：昵称中包含 `bot` 或 `机器人` 的用户消息也会被排除。如有误杀，请关闭此选项并使用前缀过滤替代。

**代码参考**: `messageHandler.ts` bot 消息排除逻辑

---

### 9. [客户端] 补充 `group_name` 实际取值说明

**文件**: `mclistener-ws-client/readme.md` 或协议说明处

**问题**: 客户端发给服务端的 `group_name` 实际填的是 `session.platform`（平台名），不是真实群名/频道名。

**改动**: 如果后续要写协议文档，需注明:
> `group_name` 字段当前填入的是平台标识（如 `onebot`、`discord`），并非真实群名/频道名。真实来源 ID 在 `group_id` 字段。

**代码参考**: `messageHandler.ts:88`

---

## 优先级 P2：结构优化与润色

### 10. [双端] 新增"3 分钟快速上手"章节

**文件**: 两个项目的 README

**建议位置**: 简介之后、详细配置之前

**内容大纲**:
```
## 🚀 3 分钟快速上手

### Step 1: 配置服务端（MCDR 插件）
1. 将插件放入 MCDR 插件目录
2. 安装依赖: `uv pip install -r requirements.txt`
3. 加载插件，编辑生成的 `config/mcdr_listener_ws_server/config.yml`
4. 修改 `ws_token` 为你自己的密码

### Step 2: 配置客户端（Koishi 插件）
1. 在 Koishi 插件市场安装 `mclistener-ws-client`
2. 配置 `wsServerUrl` 指向服务端地址
3. 配置 `wsToken` 与服务端一致
4. 配置 `sourcePlatformList` 和 `targetPlatformChannelList` 为你的群/频道

### Step 3: 验证
- 在群里发消息，检查游戏内是否收到
- 在游戏里说话，检查群里是否收到

> 💡 图片渲染和远程命令需要额外配置 RCON，见下方详细说明。
```

---

### 11. [客户端] 新增"最小可用配置"示例

**文件**: `mclistener-ws-client/readme.md` 配置章节

**内容**:
```yaml
# 最小可用配置示例（Koishi 配置界面 → 切换到 YAML 模式）
wsServerUrl: ws://你的服务器IP:60601
wsToken: 你的Token
sourcePlatformList:
  - platform: onebot
    channelId: 你的QQ群号
    enable: true
targetPlatformChannelList:
  - platform: onebot
    channelId: 你的QQ群号
    enable: true
```

---

### 12. [双端] 新增"限制与边界条件"汇总

**文件**: 两个项目的 README 末尾或 FAQ 区域

**内容**:
```markdown
## ⚠️ 已知限制

- 图片域名必须在服务端 `image_host_whitelist` 中，否则不会下载/渲染
- `!!view_image` 有全服共享冷却（默认 5.5 秒）
- 非文本消息元素（表情、卡片、文件等）会降级为占位文本
- 远程命令需要**同时**开启客户端和服务端的配置开关
- Windows 下 MCDR 建议将 encoding 设为 GBK，避免 emoji 编码问题
- 昵称包含 `bot` 或 `机器人` 的用户消息可能被误排除（客户端）
```

---

### 13. [客户端] 补充技术细节

**文件**: `mclistener-ws-client/readme.md`

- 重连间隔: 固定 5 秒
- 插件支持多实例（`reusable = true`）
- 依赖 `http` 服务（需安装 `@koishijs/plugin-http` 或 Koishi 内置 HTTP 服务）
- `wsToken` 通过 URL query `?token=xxx` 传递
- 每个列表配置项（sourcePlatformList 等）的每个条目都有独立的 `enable` 开关

---

### 14. [服务端] 补充事件日志功能说明

**文件**: `mcdr_listener_ws_server/README.md`

**问题**: `PlayerLogger` 会将进出事件写入 `logs/{date}/player_come_go/` JSON 文件，完全没文档化。

**改动**: 简要说明日志目录结构和格式即可。

---

### 15. [服务端] `lang/zh_cn.yml` 翻译修正

**问题**: `player.leave_broadcast` 中文文件仍是 `"Bye {player}"`，未翻译。

**改动**: 改为中文，如 `"{player} 离开了服务器"` 或保持原样但说明这是设计选择。

---

### 16. [服务端] CHANGELOG 版本断层

**问题**: CHANGELOG 最新是 `0.4.0-beta.5`，但 plugin.json 已是 `0.6.3-beta.2`。

**改动**: 补全中间版本的变更记录。

---

## 执行顺序建议

1. **P0 协议一致性修正**（#1-#4）→ 确保文档和代码行为一致
2. **P1 内容补充**（#5-#9）→ 减少用户困惑和重复提问
3. **P2 结构优化**（#10-#16）→ 提升新用户上手体验

> 每改完一组，记得同步中英文 README（服务端）和 Schema 描述（客户端 config.ts）。

---

## 优先级 P3：日志格式优化 + usage.ts 同步（2026-06-02 追加）

### 17. [服务端] 日志标签格式优化：`【】` → `【-- --】`

**文件**: `mcdr_listener_ws_server/` 下 6 个 Python 文件

**问题**: 当前日志标签如 `【 Plugin unloading 】`，在大量终端日志中不够醒目。

**改动**: 所有 `【 xxx 】` 改为 `【-- xxx --】`，两侧加 `--` 分隔符以增强可视辨识度。

**涉及文件与匹配数**:

| 文件 | 匹配数 |
|------|--------|
| `__init__.py` | 6 处 |
| `image_cache.py` | 5 处 |
| `ws_server.py` | 11 处 |
| `image_handler.py` | 3 处 |
| `image_renderer.py` | 8 处 |
| `config.py` | 2 处 |
| `events.py` | 6 处 |

**替换示例**:
- `【 Plugin unloading 】` → `【-- Plugin unloading --】`
- `【 Image cache 】` → `【-- Image cache --】`
- `【 WS auth failed 】` → `【-- WS auth failed --】`
- `【 Platform -> Server 】` → `【-- Platform -> Server --】`
- `【 Image render 】` → `【-- Image render --】`

**风险**: 纯字符串替换，不影响逻辑行为。在 Python 的 f-string / 普通字符串中均安全。

---

### 18. [客户端] `usage.ts` 内容同步

**文件**: `mclistener-ws-client/src/usage.ts`

**问题**: Koishi 插件市场展示的 HTML 使用说明与 readme.md 有不同步之处：

1. **L90 白名单前缀举例仍为 `!!`**: 应改为 `#`（与 readme.md P0 #4 同批修正，保持一致）
2. **缺少命令说明**: readme.md 在 P1 #5 新增了 `mcws.exec` 命令章节，usage.ts 未同步
3. **缺少已知限制提示**: readme.md 在 P2 #12 新增了已知限制，usage.ts 未同步
4. **缺少富文本降级说明**: readme.md 在 P1 #7 已补充，usage.ts 未同步

**改动**:

1. **L90**: `白名单前缀（如 <code>!!</code>）` → `白名单前缀（如 <code>#</code>）`
2. **在 `</details>` 前新增命令章节**:
   ```html
   <h3>🖥️ 远程命令执行</h3>
   <ul>
     <li>默认指令名: <code>mcws.exec</code>（可通过 <code>execCommandName</code> 配置修改）</li>
     <li>使用示例: 在聊天平台发送 <code>mcws.exec list</code></li>
     <li>需同时开启客户端 <code>enableExecCommand</code> 和服务端 <code>enable_remote_exec_command</code></li>
     <li>默认仅白名单用户可执行（通过 <code>execCommandAdminUserIdList</code> 配置）</li>
   </ul>
   ```
3. **在 `</details>` 前新增已知限制**:
   ```html
   <h3>⚠️ 已知限制</h3>
   <ul>
     <li>图片 URL 的域名必须在服务端 <code>image_host_whitelist</code> 中</li>
     <li><code>!!view_image</code> 有全服共享冷却（默认 5.5 秒）</li>
     <li>非文本消息元素（表情、卡片、文件等）会退化为 <code>&lt;元素类型&gt;</code> 占位文本</li>
     <li>昵称含 <code>bot</code> 或 <code>机器人</code> 的用户消息可能被 <code>excludeBotMessages</code> 误排除</li>
     <li>远程命令需同时开启客户端和服务端的配置</li>
   </ul>
   ```
4. **在双向消息转发部分补充富文本范围提示**:
   ```html
   <li>⚠️ 当前仅处理文本、@提及、图片，其他元素退化为占位文本</li>
   ```

**代码参考**: readme.md 中 P1 #5、P1 #7、P2 #12 的改动

---

## 执行顺序建议（更新版）

1. **P0 协议一致性修正**（#1-#4）→ 确保文档和代码行为一致
2. **P1 内容补充**（#5-#9）→ 减少用户困惑和重复提问
3. **P2 结构优化**（#10-#16）→ 提升新用户上手体验
4. **P3 日志格式 + usage 同步**（#17-#18）→ 终端可读性 + 插件市场展示同步

> 每改完一组，记得同步中英文 README（服务端）和 Schema 描述（客户端 config.ts）。

---


## `/mcws.exec <cmd>` 扩展方案（简洁版）

### 目标

在 Koishi 侧增加 `/mcws.exec list`、`/mcws.exec say hello` 等指令，通过 WebSocket 发到 MCDR 服务端执行，返回结果。

链路：`Koishi 指令 -> Koishi WS 客户端 -> MCDR WS 服务端 -> MCDR 执行服务器命令 -> 返回 command_result -> Koishi 回复`

---

### 协议

#### 客户端 -> 服务端

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

- `request_id`：由客户端生成，格式 `{unix_ms}-{递增计数器}`，用于匹配响应
- `sender`：用于服务端日志、权限、审计
- `token`：放在 WS 连接层 `ws://ip:port?token=xxx`，不做在消息体里

#### 服务端 -> 客户端

成功：
```json
{ "type": "command_result", "request_id": "...", "command": "list", "ok": true, "result": "There are 2 of a max of 20 players online: ..." }
```

失败：
```json
{ "type": "command_result", "request_id": "...", "command": "list", "ok": false, "error": "command execution failed" }
```

---

### Koishi 侧改动

| 文件 | 改动 |
|---|---|
| `src/types.ts` | 新增 `CommandRequestMessage`、`CommandResultMessage`，扩展服务端消息联合类型 |
| `src/client.ts` | 新增 `sendCommand()`，内部维护 `pendingRequests: Map<request_id, resolver>`，收到 `command_result` 时按 `request_id` resolve/reject，超时默认 10s |
| `src/command.ts` | **新增文件**，注册 `{execCommandName} <cmd:text>` 指令，做权限检查、调 `client.sendCommand()`、处理回复格式 |
| `src/index.ts` | 调用 `registerCommands()`，不再直接塞指令逻辑 |
| `src/config.ts` | 新增配置组：`enableExecCommand`(默认false)、`execCommandName`(默认`mcws.exec`)、`enableQuote`(默认true)、`wsToken`、`execCommandAdminUserIdList`、`execCommandTimeoutMs`、`execCommandMaxReplyLength` |

指令流程：
1. 用户输入 → 2. Koishi 检查本地权限 → 3. WS 未连接则回复提示 → 4. 发送 `command` 请求 → 5. 等待 `command_result` → 6. 回复结果到当前会话

---

### MCDR 侧改动

| 文件 | 改动 |
|---|---|
| `ws_server.py` | 修正 command 分支：去掉 `is_on_executor_thread()` 限制，接收 `request_id`，返回结构化 `command_result`，统一 try/except |
| `config.py` | 新增 `ws_token`、`enable_remote_exec_command`(默认false)、`remote_exec_command_whitelist`、`remote_exec_command_timeout_sec`、`remote_exec_result_max_length` |
| `default_config.yml` | 新增 `ws_token: test12345`、`enable_remote_exec_command: false` |

第一阶段只执行 Minecraft 服务器命令（不包含 MCDR 命令）。

---

### 权限与安全

- **默认关闭** — Koishi 侧 `enableExecCommand: false`，服务端 `enable_remote_exec_command: false`
- **WS token** — 连接层鉴权，通过 URL query `?token=xxx`，服务端配置为空则不校验
- **用户白名单** — `execCommandAdminUserIdList`，只允许指定平台/用户触发
- **服务端命令白名单** — 可选限制只允许 `list`、`say `、`time `、`weather ` 等
- **结果长度控制** — `execCommandMaxReplyLength` 避免刷屏

---

### 实现顺序

1. **阶段 1（最小闭环）**：补协议类型 + client.ts request-response 映射 + index.ts 注册命令 + 服务端修正 command 分支，默认关闭
2. **阶段 2（权限配置）**：补启用开关、管理员白名单、超时/长度配置、服务端命令白名单
3. **阶段 3（文档交互）**：README 协议说明、安全警告、长输出截断提示

---

### 配置项参考

#### Koishi 侧新增配置（`src/config.ts`）

| 配置名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `wsToken` | `string` | `""` | WS 连接 token，空字符串表示不校验。通过 URL query 传入 `ws://ip:port?token=xxx` |
| `enableExecCommand` | `boolean` | `false` | 是否启用远程执行命令能力 |
| `execCommandName` | `string` | `"mcws.exec"` | Koishi 指令名，用户可自定义，例如 `exec`、`mc.exec`、`mcdr-exec` |
| `enableQuote` | `boolean` | `true` | 指令触发的回复是否自动带引用（统一使用 `h.quote(session.messageId)`） |
| `execCommandAdminUserIdList` | `Array<{platform: string, userId: string, enable: boolean}>` | `[]` | 允许执行命令的用户白名单，支持按平台和用户粒度控制 |
| `execCommandTimeoutMs` | `number` | `10000` | 等待服务端返回的超时时间（毫秒） |
| `execCommandMaxReplyLength` | `number` | `1500` | 回复到聊天平台的最大字符数，超长截断，避免刷屏 |

`execCommandAdminUserIdList` 示例：
```json
[
  { "platform": "qq", "userId": "10001", "enable": true },
  { "platform": "qq", "userId": "10002", "enable": false }
]
```

#### MCDR 侧新增配置（`config.py` / `default_config.yml`）

| 配置名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `ws_token` | `str` | `""` | WS 连接 token，空字符串表示不校验。客户端 URL query 中传入 |
| `enable_remote_exec_command` | `bool` | `false` | 是否允许远程执行命令 |
| `remote_exec_command_whitelist` | `list[str]` | `[]` | 允许执行的命令前缀白名单，空列表表示不限制。例如 `["list", "say ", "time ", "weather "]` |
| `remote_exec_command_timeout_sec` | `int` | `10` | 命令执行超时秒数 |
| `remote_exec_result_max_length` | `int` | `4000` | 返回结果最大字符数，超长截断 |

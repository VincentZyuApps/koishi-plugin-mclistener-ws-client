import { Schema } from 'koishi';

export const Config = Schema.intersect([

  // ──────────────────────────────────────────────────────────────────────────
  // 💬 第零组：消息设置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableQuote: Schema.boolean()
      .default(true)
      .description('💬 启用回复引用 📎<br>💡 指令触发的回复是否自动带引用'),
    useFirstBotWhenSelfIdEmpty: Schema.boolean()
      .default(true)
      .description('🤖 selfId 留空时是否只使用第一个匹配 platform 的 Bot<br>💡 开启可避免多 Bot 环境下重复转发；关闭则发送给所有匹配 Bot'),
  }).description('💬 消息设置'),

  // ──────────────────────────────────────────────────────────────────────────
  // 🌐 第一组：WebSocket 服务器连接配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    wsServerUrl: Schema.string()
      .default('ws://127.0.0.1:60601')
      .role('link')
      .description('🌐 主 WS 服务器地址；连接断开后会从地址池中的下一个地址继续尝试'),
    wsFallbackServerUrlList: Schema.array(
      Schema.string().role('link')
    )
      .role('table')
      .default([])
      .description('🛟 备用 WS 服务器地址列表；留空表示只使用主地址，空值和重复地址会自动忽略'),
    wsToken: Schema.string()
      .default('test12345')
      .role('textarea', { rows: [2, 5] })
      .description('🔑 WebSocket 连接 Token 🔐<br>💡 空字符串表示不校验，非空时通过 URL query 传入 <code>ws://ip:port?token=xxx</code><br>⚠️ 记得改掉默认的 <code>test12345</code> 哇！正式用一定要换一个自己的！🔑'),
    wsConnectTimeoutMs: Schema.number()
      .min(1000)
      .max(60000)
      .step(1000)
      .default(10000)
      .description('⏱️ WebSocket 握手超时时间（毫秒）；超时后切换到下一个地址'),
    enableWsHeartbeat: Schema.boolean()
      .default(true)
      .description('💓 启用标准 WebSocket Ping/Pong 心跳检测'),
    wsHeartbeatIntervalMs: Schema.number()
      .min(1000)
      .max(300000)
      .step(1000)
      .default(30000)
      .description('💓 Ping 发送间隔（毫秒）'),
    wsHeartbeatTimeoutMs: Schema.number()
      .min(1000)
      .max(600000)
      .step(1000)
      .default(90000)
      .description('💔 最长未收到 Pong 的时间（毫秒）；超时后主动断开并重连'),
    wsReconnectStrategy: Schema.union([
      Schema.const('fixed').description('固定间隔'),
      Schema.const('exponential').description('指数退避'),
    ])
      .role('radio')
      .default('exponential')
      .description('🔁 地址轮询的重连等待策略'),
    wsReconnectJitterRatio: Schema.number()
      .role('slider')
      .min(0)
      .max(0.5)
      .step(0.05)
      .default(0.1)
      .description('🎲 重连等待时间的随机抖动比例；0.1 表示正负 10%，0 表示关闭'),
  }).description('🌐 WebSocket 连接配置（连不上服务器？检查这里！）'),

  Schema.union([
    Schema.object({
      wsReconnectStrategy: Schema.const('fixed').required(false),
      wsReconnectFixedDelayMs: Schema.number()
        .min(0)
        .max(300000)
        .step(1000)
        .default(5000)
        .description('⏲️ 固定重连间隔（毫秒）'),
    }),
    Schema.object({
      wsReconnectStrategy: Schema.const('exponential').required(false),
      wsReconnectInitialDelayMs: Schema.number()
        .min(0)
        .max(300000)
        .step(1000)
        .default(1000)
        .description('🌱 指数退避初始延迟（毫秒）'),
      wsReconnectMultiplier: Schema.number()
        .min(1)
        .max(10)
        .step(0.1)
        .default(2)
        .description('📈 每轮全部地址失败后的延迟倍数'),
      wsReconnectMaxDelayMs: Schema.number()
        .min(0)
        .max(600000)
        .step(1000)
        .default(32000)
        .description('🧢 指数退避最终等待时间硬上限（毫秒）'),
    }),
  ]).description('🔁 WebSocket 重连策略参数'),

  // ──────────────────────────────────────────────────────────────────────────
  // 📊 第二组：事件报告配置（连接/断开/重连等事件通知到哪）
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enablePrivateReport: Schema.boolean()
      .default(false)
      .description('📩 启用私聊报告 👤<br>💡 如果启用，WS的断开/连接等事件将私聊发送给指定的人'),
    privateReportUserIdList: Schema.array(Schema.object({
      platform: Schema.string().description('🏷️ 平台名称（比如 onebot, discord 等）'),
      selfId: Schema.string().default('').description('🤖 Bot 账号 selfId；留空时按 useFirstBotWhenSelfIdEmpty 决定使用第一个或所有同平台 Bot'),
      userId: Schema.string().description('🆔 用户 ID（要接收通知的那个人的 ID）'),
      enable: Schema.boolean().default(true).description('✅ 是否启用（不想收到可以关掉）'),
    })).role('table').description('👤 私聊报告用户 ID 列表（谁需要收到通知~）'),
    enableChannelReport: Schema.boolean()
      .default(false)
      .description('📢 启用频道报告 🏘️<br>💡 如果启用，WS的断开/连接等事件将发送到指定的频道'),
    reportChannelList: Schema.array(Schema.object({
      platform: Schema.string().description('🏷️ 平台名称'),
      selfId: Schema.string().default('').description('🤖 Bot 账号 selfId；留空时按 useFirstBotWhenSelfIdEmpty 决定使用第一个或所有同平台 Bot'),
      channelId: Schema.string().description('🆔 频道 ID（哪个群/频道要收通知）'),
      enable: Schema.boolean().default(true).description('✅ 是否启用'),
    })).role('table').description('📋 报告频道列表（群/频道通知目标）'),
    enableConsoleLogReport: Schema.boolean()
      .default(true)
      .description('🖥️ 启用日志报告 💬<br>💡 如果启用，WS连接/断开/重连等事件将通过 ctx.logger.info() 打印到控制台'),
  }).description('📊 报告配置（连接事件要通知给谁？）'),

  // ──────────────────────────────────────────────────────────────────────────
  // 📤 第三组：转发目的地配置（服务器消息 → 聊天平台）
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableAddDateTimePrefix: Schema.boolean()
      .default(true)
      .description('🕐 启用添加日期时间前缀 📅<br>💡 转发到聊天平台时，消息前面会带上时间戳'),
    targetPlatformChannels: Schema.array(
      Schema.object({
        platform: Schema.string().description('🏷️ 平台名称'),
        selfId: Schema.string().default('').description('🤖 Bot 账号 selfId；留空时按 useFirstBotWhenSelfIdEmpty 决定使用第一个或所有同平台 Bot'),
        channelId: Schema.string().description('🆔 频道 ID（转发到哪个群/频道）'),
        enable: Schema.boolean().default(true).description('✅ 是否启用'),
      })
    ).role('table').default([{
      platform: 'onebot',
      selfId: '',
      channelId: '1085190201',
      enable: true,
    }]).description('🎯 目标平台频道列表（服务器消息要转发到哪些地方？）'),
  }).description('📤 转发目的地配置【🎮 服务器 → 💬 聊天平台】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 📥 第四组：来源平台配置（聊天平台消息 → 服务器）
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    normalizePlatformChatWhitespace: Schema.boolean()
      .default(true)
      .description('🧹 清理消息中的换行和制表符 ✂️<br>💡 将 \\n \\r \\t 替换为空格，压缩连续空格，避免游戏内消息断裂'),
    sourcePlatformChannels: Schema.array(
      Schema.object({
        platform: Schema.string().description('🏷️ 平台名称'),
        selfId: Schema.string().default('').description('🤖 Bot 账号 selfId；留空时按 useFirstBotWhenSelfIdEmpty 决定使用第一个或所有同平台 Bot'),
        channelId: Schema.string().description('🆔 频道 ID（哪个群的聊天要发到服务器）'),
        enable: Schema.boolean().default(true).description('✅ 是否启用'),
      })
    ).role('table').default([{
      platform: 'onebot',
      selfId: '',
      channelId: '1085190201',
      enable: true,
    }]).description('📡 来源平台频道列表（哪些聊天要转发到服务器？）'),
  }).description('📥 来源平台配置【💬 聊天平台 → 🎮 服务器】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 🚪 第五组：玩家加入消息转发配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableServerToPlatformPlayerJoin: Schema.boolean()
      .default(true)
      .description('✅ 启用转发 服务器玩家加入消息 到 聊天平台 🎉<br>⚠️ 会尊重 targetPlatformChannels 配置项，只发到其中已启用的频道~'),
    playerJoinMessageTemplate: Schema.string()
      .role('textarea', { rows: [2, 5] })
      .default('🎉🎉🎉 %PLAYER% 进入了 神秘小服服 ！！✨✨✨')
      .description('✏️ 自定义玩家加入消息 📝<br>🔤 %PLAYER% 会被替换为玩家名称'),
  }).description('🚪 玩家加入消息转发配置（进服通知）【🎮 服务器 → 💬 聊天平台】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 🚶 第六组：玩家离开消息转发配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableServerToPlatformPlayerLeave: Schema.boolean()
      .default(true)
      .description('✅ 启用转发 服务器玩家离开消息 到 聊天平台 😢<br>⚠️ 会尊重 targetPlatformChannels 配置项，只发到其中已启用的频道~'),
    playerLeaveMessageTemplate: Schema.string()
      .role('textarea', { rows: [2, 5] })
      .default('😢😢😢 %PLAYER% 暂时离开 神秘小服服 啦~ 呜——👋👋👋')
      .description('✏️ 自定义玩家离开消息 📝<br>🔤 %PLAYER% 会被替换为玩家名称'),
  }).description('🚶 玩家离开消息转发配置（离服通知）【🎮 服务器 → 💬 聊天平台】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 💬 第七组：玩家聊天消息转发配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableServerToPlatformPlayerChat: Schema.boolean()
      .default(true)
      .description('✅ 启用转发 服务器玩家聊天消息 到 聊天平台 🔈<br>💡 玩家在服里说话会同步到群里~'),
    playerChatMessageTemplate: Schema.string()
      .role('textarea', { rows: [2, 5] })
      .default('🔈🔈🔈%PLAYER%在神秘小服服说: %CONTENT%')
      .description('✏️ 自定义玩家聊天消息 📝<br>🔤 %PLAYER% → 玩家名称，%CONTENT% → 聊天内容'),
    enableServerChatPrefixAllowlist: Schema.boolean()
      .default(false)
      .description('⚪ 启用服务器聊天允许前缀检查 ✅<br>💡 只转发带有指定前缀的服务器聊天消息<br>📌 比如设置 # 后，玩家需要用 # 开头才会转发到聊天平台'),
    serverChatAllowedPrefixes: Schema.array(String)
      .role('table')
      .default(['#'])
      .description('✅ 服务器聊天允许前缀列表 📋<br>💡 启用允许前缀检查后生效<br>🔤 默认值是 # 井号，也可以设置多个'),
    stripServerChatPrefix: Schema.boolean()
      .default(true)
      .description('✂️ 转发服务器聊天时去掉已匹配的允许前缀<br>💡 仅在启用允许前缀检查并成功匹配后生效'),
    enableServerChatPrefixBlocklist: Schema.boolean()
      .default(true)
      .description('⚫ 启用服务器聊天阻止前缀检查 🚫<br>💡 阻止转发带有指定前缀的服务器聊天消息<br>📌 比如不想让服务器的斜杠命令(/)转发到群里，就启用这个'),
    serverChatBlockedPrefixes: Schema.array(String)
      .role('table')
      .default(['/', '!!'])
      .description('❌ 服务器聊天阻止前缀列表 📋<br>💡 启用阻止前缀检查后生效<br>🔤 默认值是 / 和 !!，你可以设置多个'),
    enableServerChatSenderBlocklist: Schema.boolean()
      .default(false)
      .description('🚫 启用服务器聊天发送者阻止列表检查 🚷<br>💡 阻止转发指定玩家的聊天消息<br>📌 比如不想让某个玩家的消息转发到群里面，就可以把他加入阻止列表'),
    serverChatBlockedSenders: Schema.array(String)
      .default(['Server'])
      .description('🚷 服务器聊天阻止发送者列表 📋<br>💡 启用发送者阻止列表检查后生效<br>🔤 默认值是 Server，这样后台 console 执行的指令消息就不会转发到群里'),
  }).description('💬 玩家聊天消息转发配置【🎮 服内聊天 → 💬 聊天平台】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 🐧 第七点五组：QQ 官方 Bot Markdown 配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableQQMarkdownPlayerJoin: Schema.boolean()
      .default(true)
      .description('🐧 玩家加入消息在 QQ 官方 Bot 平台使用 Markdown 主动消息发送'),
    qqMarkdownPlayerJoinTemplate: Schema.string()
      .role('textarea', { rows: [4, 10] })
      .default('# 🎉 玩家进入服务器\n\n- 玩家：%PLAYER%\n- 时间：%TIME%')
      .description('📝 QQ Markdown 玩家加入模板<br>支持 <code>%PLAYER%</code>、<code>%TIME%</code>'),
    enableQQMarkdownPlayerLeave: Schema.boolean()
      .default(true)
      .description('🐧 玩家离开消息在 QQ 官方 Bot 平台使用 Markdown 主动消息发送'),
    qqMarkdownPlayerLeaveTemplate: Schema.string()
      .role('textarea', { rows: [4, 10] })
      .default('# 👋 玩家离开服务器\n\n- 玩家：%PLAYER%\n- 时间：%TIME%')
      .description('📝 QQ Markdown 玩家离开模板<br>支持 <code>%PLAYER%</code>、<code>%TIME%</code>'),
    enableQQMarkdownPlayerChat: Schema.boolean()
      .default(true)
      .description('🐧 玩家聊天消息在 QQ 官方 Bot 平台使用 Markdown 主动消息发送'),
    qqMarkdownPlayerChatTemplate: Schema.string()
      .role('textarea', { rows: [4, 10] })
      .default('# 💬 Minecraft 聊天\n\n**%PLAYER%**\n> %CONTENT%\n\n`%TIME%`')
      .description('📝 QQ Markdown 玩家聊天模板<br>支持 <code>%PLAYER%</code>、<code>%CONTENT%</code>、<code>%TIME%</code>'),
  }).description('🐧 QQ 官方 Bot Markdown 配置【仅 platform=qq 生效】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 🔄 第八组：聊天平台消息转发到服务器配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enablePlatformToServerChat: Schema.boolean()
      .default(true)
      .description('✅ 启用转发 聊天平台信息 到 服务器 🔄<br>💡 群里说话可以发到服务器里~'),
    enablePlatformChatPrefixAllowlist: Schema.boolean()
      .default(false)
      .description('🔍 启用平台聊天允许前缀检查 🏷️<br>💡 只转发带有指定前缀的消息到服务器<br>📌 比如设置 # 开头才转发，避免所有聊天平台消息都刷进服'),
    platformChatAllowedPrefixes: Schema.array(String)
      .role('table')
      .default(['#'])
      .description('📝 平台聊天允许前缀列表 📋<br>💡 启用允许前缀检查后生效<br>🔤 默认值是 # 井号'),
    stripPlatformChatPrefix: Schema.boolean()
      .default(true)
      .description('✂️ 转发平台聊天时去掉已匹配的允许前缀<br>💡 仅在启用允许前缀检查并成功匹配后生效'),
    excludeBotMessages: Schema.boolean()
      .default(true)
      .description('🤖 排除机器人自己发送的消息 🚫<br>💡 避免机器人说的话又被自己转发到服务器，死循环啦~'),
  }).description('🔄 聊天平台消息转发到服务器配置【💬 聊天平台 → 🎮 服务器】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 🔐 第九组：远程命令执行配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableExecCommand: Schema.boolean()
      .default(false)
      .description('✅ 启用远程执行命令能力 ⚡<br>⚠️ 默认关闭，开启后可通过 Koishi 指令在 MC 服务器上执行命令'),
    execCommandName: Schema.string()
      .default('mcws.exec')
      .description('📝 Koishi 指令名 🏷️<br>💡 用户可自定义，例如 <code>exec</code>、<code>mc.exec</code>、<code>mcdr-exec</code>'),
    enableExecCommandWhitelist: Schema.boolean()
      .default(true)
      .description('✅ 启用指令执行用户白名单 🛡️<br>💡 关闭后所有用户均可使用远程指令，请谨慎操作'),
    execCommandAdminUserIdList: Schema.array(Schema.object({
      platform: Schema.string().description('🏷️ 平台名称'),
      selfId: Schema.string().default('').description('🤖 Bot 账号 selfId；留空时按 useFirstBotWhenSelfIdEmpty 决定使用第一个或所有同平台 Bot'),
      userId: Schema.string().description('🆔 用户 ID'),
      enable: Schema.boolean().default(true).description('✅ 是否启用'),
    })).role('table').default([{
      platform: 'onebot',
      selfId: '',
      userId: '1830540513',
      enable: true,
    }]).description('👤 允许执行命令的用户白名单 🛡️<br>💡 支持按平台和用户粒度控制'),
    execCommandTimeoutMs: Schema.number()
      .default(10000)
      .description('⏱️ 命令执行超时时间（毫秒）⏰<br>💡 等待服务端返回的最长时间'),
    execCommandMaxReplyLength: Schema.number()
      .default(1500)
      .description('📏 回复最大字符数 ✂️<br>💡 超长截断，避免刷屏'),
    deduplicateCommandResults: Schema.boolean()
      .experimental()
      .default(true)
      .description('🔄 指令执行结果去重，同一请求只处理第一条 command_result 📨<br> <i> 💡 关闭后每条结果都会立即返回，可用于调试 CSS 服务端插件的 execCommandMode:both 双路径执行情况 </i>'),
  }).description('🔐 远程命令执行配置【🤖 Koishi → 🎮 MC 服务器】<br>⚠️ 请谨慎配置，确保安全'),

  // ──────────────────────────────────────────────────────────────────────────
  // 🐛 第十组：调试配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    verboseConsoleOutput: Schema.boolean()
      .default(false)
      .description('🔧 启用详细的控制台输出 📋<br>💡 用于调试和问题排查，平时别开哦~'),
  }).description('🐛 调试配置（出问题了再来开这个）'),
]);


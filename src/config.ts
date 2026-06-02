import { Schema } from 'koishi';

export const Config = Schema.intersect([

  // ──────────────────────────────────────────────────────────────────────────
  // 💬 第零组：消息设置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableQuote: Schema.boolean()
      .default(true)
      .description('💬 启用回复引用 📎<br>💡 指令触发的回复是否自动带引用'),
  }).description('💬 消息设置'),

  // ──────────────────────────────────────────────────────────────────────────
  // 🌐 第一组：WebSocket 服务器连接配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    wsServerUrl: Schema.string()
      .default('ws://127.0.0.1:60601')
      .role('link')
      .description('🌐 WS服务器地址（你的 Mcdreforged 服务端 WebSocket 链接地址哦~）'),
    wsToken: Schema.string()
      .default('test12345')
      .role('textarea', { rows: [2, 5] })
      .description('🔑 WebSocket 连接 Token 🔐<br>💡 空字符串表示不校验，非空时通过 URL query 传入 <code>ws://ip:port?token=xxx</code><br>⚠️ 记得改掉默认的 <code>test12345</code> 哇！正式用一定要换一个自己的！🔑'),
  }).description('🌐 WebSocket 连接配置（连不上服务器？检查这里！）'),

  // ──────────────────────────────────────────────────────────────────────────
  // 📊 第二组：事件报告配置（连接/断开/重连等事件通知到哪）
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enablePrivateReport: Schema.boolean()
      .default(false)
      .description('📩 启用私聊报告 👤<br>💡 如果启用，WS的断开/连接等事件将私聊发送给指定的人'),
    privateReportUserIdList: Schema.array(Schema.object({
      platform: Schema.string().description('🏷️ 平台名称（比如 onebot, discord 等）'),
      userId: Schema.string().description('🆔 用户 ID（要接收通知的那个人的 ID）'),
      enable: Schema.boolean().default(true).description('✅ 是否启用（不想收到可以关掉）'),
    })).role('table').description('👤 私聊报告用户 ID 列表（谁需要收到通知~）'),
    enableChannelReport: Schema.boolean()
      .default(false)
      .description('📢 启用频道报告 🏘️<br>💡 如果启用，WS的断开/连接等事件将发送到指定的频道'),
    reportChannelList: Schema.array(Schema.object({
      platform: Schema.string().description('🏷️ 平台名称'),
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
    targetPlatformChannelList: Schema.array(
      Schema.object({
        platform: Schema.string().description('🏷️ 平台名称'),
        channelId: Schema.string().description('🆔 频道 ID（转发到哪个群/频道）'),
        enable: Schema.boolean().default(true).description('✅ 是否启用'),
      })
    ).role('table').default([{
      platform: 'onebot',
      channelId: '1085190201',
      enable: true,
    }]).description('🎯 目标平台频道列表（服务器消息要转发到哪些地方？）'),
  }).description('📤 转发目的地配置【🎮 服务器 → 💬 聊天平台】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 📥 第四组：来源平台配置（聊天平台消息 → 服务器）
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    sourcePlatformList: Schema.array(
      Schema.object({
        platform: Schema.string().description('🏷️ 平台名称'),
        channelId: Schema.string().description('🆔 频道 ID（哪个群的聊天要发到服务器）'),
        enable: Schema.boolean().default(true).description('✅ 是否启用'),
      })
    ).role('table').default([{
      platform: 'onebot',
      channelId: '1085190201',
      enable: true,
    }]).description('📡 来源平台频道列表（哪些聊天要转发到服务器？）'),
  }).description('📥 来源平台配置【💬 聊天平台 → 🎮 服务器】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 🚪 第五组：玩家加入消息转发配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableForwardPlayerJoin: Schema.boolean()
      .default(true)
      .description('✅ 启用转发 服务器玩家加入消息 到 聊天平台 🎉<br>⚠️ 会尊重 targetPlatformChannelList 配置项，只发到其中已启用的频道~'),
    customizePlayerJoinMsg: Schema.string()
      .role('textarea', { rows: [2, 5] })
      .default('🎉🎉🎉 %PLAYER% 进入了神秘小服服！！✨✨✨')
      .description('✏️ 自定义玩家加入消息 📝<br>🔤 %PLAYER% 会被替换为玩家名称'),
  }).description('🚪 玩家加入消息转发配置（进服通知）【🎮 服务器 → 💬 聊天平台】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 🚶 第六组：玩家离开消息转发配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableForwardPlayerLeave: Schema.boolean()
      .default(true)
      .description('✅ 启用转发 服务器玩家离开消息 到 聊天平台 😢<br>⚠️ 会尊重 targetPlatformChannelList 配置项，只发到其中已启用的频道~'),
    customizePlayerLeaveMsg: Schema.string()
      .role('textarea', { rows: [2, 5] })
      .default('😢😢😢 %PLAYER% 暂时离开啦~呜——👋👋👋')
      .description('✏️ 自定义玩家离开消息 📝<br>🔤 %PLAYER% 会被替换为玩家名称'),
  }).description('🚶 玩家离开消息转发配置（离服通知）【🎮 服务器 → 💬 聊天平台】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 💬 第七组：玩家聊天消息转发配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableForwardPlayerChat: Schema.boolean()
      .default(true)
      .description('✅ 启用转发 服务器玩家聊天消息 到 聊天平台 🔈<br>💡 玩家在服里说话会同步到群里~'),
    customizePlayerChatMsg: Schema.string()
      .role('textarea', { rows: [2, 5] })
      .default('🔈🔈🔈%PLAYER%在神秘小服服说: %CONTENT%')
      .description('✏️ 自定义玩家聊天消息 📝<br>🔤 %PLAYER% → 玩家名称，%CONTENT% → 聊天内容'),
    enableFowardMsgPrefixWhitelistCheck: Schema.boolean()
      .default(false)
      .description('⚪ 启用聊天消息前缀白名单检查 ✅<br>💡 只转发指定前缀的聊天消息<br>📌 比如不想让服里所有聊天都刷到群里，可以告诉玩家用 "!!" 开头才会转发'),
    fowardMsgPrefixWhitelistList: Schema.array(String)
      .role('table')
      .default(['#'])
      .description('✅ 聊天消息前缀白名单列表 📋<br>💡 启用前缀检查后生效<br>🔤 默认值是 !! 两个英文感叹号，你也可以设置多个'),
    enableForwardMsgPrefixBlacklistCheck: Schema.boolean()
      .default(true)
      .description('⚫ 启用聊天消息前缀黑名单检查 🚫<br>💡 阻止转发指定前缀的聊天消息<br>📌 比如不想让服务器的斜杠命令(/)转发到群里，就启用这个'),
    fowardMsgPrefixBlacklistList: Schema.array(String)
      .role('table')
      .default(['/', '!!'])
      .description('❌ 聊天消息前缀黑名单列表 📋<br>💡 启用前缀黑名单检查后生效<br>🔤 默认值是 / 斜杠，你可以设置多个'),
    enableSenderBlacklistCheck: Schema.boolean()
      .default(false)
      .description('🚫 启用发送者黑名单检查 🚷<br>💡 阻止转发指定玩家的聊天消息<br>📌 比如不想让某个玩家的消息转发到群里面，就可以把他拉黑'),
    senderBlacklistList: Schema.array(String)
      .default(['Server'])
      .description('🚷 发送者黑名单列表 📋<br>💡 启用发送者黑名单检查后生效<br>🔤 默认值是 Server，这样后台 console 执行的指令消息就不会转发到群里'),
  }).description('💬 玩家聊天消息转发配置【🎮 服内聊天 → 💬 聊天平台】'),

  // ──────────────────────────────────────────────────────────────────────────
  // 🔄 第八组：聊天平台消息转发到服务器配置
  // ──────────────────────────────────────────────────────────────────────────
  Schema.object({
    enableFowardPlatformChat: Schema.boolean()
      .default(true)
      .description('✅ 启用转发 聊天平台信息 到 服务器 🔄<br>💡 群里说话可以发到服务器里~'),
    platformChatPrefixCheck: Schema.boolean()
      .default(false)
      .description('🔍 启用平台聊天消息前缀检查 🏷️<br>💡 只转发指定前缀的消息到服务器<br>📌 比如设置 # 开头才转发，避免所有聊天平台都刷进服'),
    platformChatPrefixList: Schema.array(String)
      .role('table')
      .default(['#'])
      .description('📝 平台聊天消息前缀列表 📋<br>💡 启用前缀检查后生效<br>🔤 默认值是 # 井号'),
    excludeBotMessages: Schema.boolean()
      .default(true)
      .description('🤖 排除机器人自己发送的消息 🚫<br>💡 避免机器人说的话又被自己转发到服务器，死循环啦~'),
  }).description('🔄 平台消息转发到服务器配置【💬 聊天平台 → 🎮 服务器】'),

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
      userId: Schema.string().description('🆔 用户 ID'),
      enable: Schema.boolean().default(true).description('✅ 是否启用'),
    })).role('table').default([{
      platform: 'onebot',
      userId: '1830540513',
      enable: true,
    }]).description('👤 允许执行命令的用户白名单 🛡️<br>💡 支持按平台和用户粒度控制'),
    execCommandTimeoutMs: Schema.number()
      .default(10000)
      .description('⏱️ 命令执行超时时间（毫秒）⏰<br>💡 等待服务端返回的最长时间'),
    execCommandMaxReplyLength: Schema.number()
      .default(1500)
      .description('📏 回复最大字符数 ✂️<br>💡 超长截断，避免刷屏'),
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

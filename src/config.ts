import { Schema } from 'koishi';

export const Config = Schema.intersect([
  Schema.object({
    wsServerUrl: Schema.string()
      .role('link')
      .default('ws://localhost:8765')
      .description('ws服务器地址'),
  }).description('ws配置'),

  Schema.object({
    enablePrivateReport: Schema.boolean()
      .default(false)
      .description('启用私聊报告. 如果启用，那么ws的断开和链接将不会发到群里，而是私聊发送给指定的人'),
    privateReportUserIdList: Schema.array(Schema.object({
      platform: Schema.string().description('平台名称'),
      userId: Schema.string().description('用户 ID'),
    })).role('table').description('私聊报告用户 ID 列表'),
  }).description('私聊报告配置'),

  Schema.object({
    enableAddDateTimePrefix: Schema.boolean()
      .default(true)
      .description('转发到聊天平台时，是否启用添加日期时间前缀'),
    targetPlatformChannelList: Schema.array(
      Schema.object({
        platform: Schema.string().description('平台名称'),
        channelId: Schema.string().description('频道 ID'),
        enable: Schema.boolean().description('是否启用'),
      })
    ).role('table').description('目标平台频道列表'),
  }).description('转发 目的地 配置'),

  Schema.object({
    sourcePlatformList: Schema.array(
      Schema.object({
        platform: Schema.string().description('平台名称'),
        channelId: Schema.string().description('频道 ID'),
        enable: Schema.boolean().description('是否启用'),
      })
    ).role('table').description('来源平台频道列表'),
  }).description('转发 聊天平台信息 到 服务器 配置'),

  Schema.object({
    enableForwardPlayerJoin: Schema.boolean()
      .default(true)
      .description('启用转发 服务器玩家加入消息 到 聊天平台'),
    customizePlayerJoinMsg: Schema.string()
      .default('🎉🎉🎉 %PLAYER% 进入了神秘小服服！！✨✨✨')
      .description('自定义玩家加入消息，%PLAYER% 会被替换为玩家名称'),
  }).description('转发 服务器玩家加入 到 聊天平台 配置'),

  Schema.object({
    enableForwardPlayerLeave: Schema.boolean()
      .default(true)
      .description('启用转发 服务器玩家离开消息 到 聊天平台'),
    customizePlayerLeaveMsg: Schema.string()
      .default('😢😢😢 %PLAYER% 暂时离开啦~呜——👋👋👋')
      .description('自定义玩家离开消息，%PLAYER% 会被替换为玩家名称'),
  }).description('转发 服务器玩家离开 到 聊天平台 配置'),

  Schema.object({
    enableForwardPlayerChat: Schema.boolean()
      .default(true)
      .description('启用转发 服务器玩家聊天消息 到 聊天平台'),
    customizePlayerChatMsg: Schema.string()
      .default('🔈🔈🔈%PLAYER%在神秘小服服说: %CONTENT%')
      .description('自定义玩家聊天消息，%PLAYER% 会被替换为玩家名称，%CONTENT% 会被替换为聊天内容'),
    enableFowardMsgPrefixWhitelistCheck: Schema.boolean()
      .default(true)
      .description('启用聊天消息前缀检查，只转发指定前缀的聊天消息 <br> 比如如果你不想让 服务器里面转发到群里面的消息太多，可以向玩家告知，只有以 "!!" 开头的消息才会被转发'),
    fowardMsgPrefixWhitelistList: Schema.array(String)
      .default(['!!'])
      .description('聊天消息前缀列表，启用前缀检查后生效 <br> 默认值是!! 两个英文感叹号，当然你也可以设置多个'),
    enableForwardMsgPrefixBlacklistCheck: Schema.boolean()
      .default(false)
      .description('启用聊天消息前缀黑名单检查，阻止转发指定前缀的聊天消息 <br> 比如你不想让服务器的 斜杠开头的命令转发到这个 就应该启用 '),
    fowardMsgPrefixBlacklistList: Schema.array(String)
      .default(['/'])
      .description('聊天消息前缀黑名单列表，启用前缀黑名单检查后生效 <br> 默认值是/ 斜杠，当然你也可以设置多个'),
    enableSenderBlacklistCheck: Schema.boolean()
      .default(false)
      .description('启用发送者黑名单检查，阻止转发指定玩家的聊天消息 <br> 比如你不想让某个玩家的消息转发到群里面，就可以把他拉黑'),
    senderBlacklistList: Schema.array(String)
      .default(['Server'])
      .description('发送者黑名单列表，启用发送者黑名单检查后生效 <br> 默认值是Server，这样的好处是: 比如管理员服务器后台console执行指令， 那么Server用户就会输出：Command: /execute at @p run tellraw @a "Bye VincentZyu"'),
  }).description('转发 服务器玩家聊天信息 到 聊天平台 配置'),

  Schema.object({
    enableFowardPlatformChat: Schema.boolean() 
      .default(true)
      .description('启用转发 聊天平台信息 到 服务器'),
    platformChatPrefixCheck: Schema.boolean()
      .default(false)
      .description('启用平台聊天消息前缀检查，只转发指定前缀的消息到服务器'),
    platformChatPrefixList: Schema.array(String)
      .default(['#'])
      .description('平台聊天消息前缀列表，启用前缀检查后生效'),
    excludeBotMessages: Schema.boolean()
      .default(true)
      .description('排除机器人自己发送的消息'),
  }).description('转发 聊天平台信息 到 服务器 配置'),

  Schema.object({
    verboseConsoleOutput: Schema.boolean()
      .default(false)
      .description('启用详细的控制台输出，用于调试和问题排查'),
  }).description('调试配置'),
]);

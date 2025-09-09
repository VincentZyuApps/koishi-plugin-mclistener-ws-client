import { Context, Schema, Logger, h } from 'koishi';
import { platform } from 'os';
import { config } from 'process';

export const name = 'mclistener-ws-client';

export const inject = {
  required: ['http'],
};

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
      })
    ).role('table').description('目标平台频道列表'),
  }).description('转发 目的地 配置'),

  Schema.object({
    sourcePlatformList: Schema.array(
      Schema.object({
        platform: Schema.string().description('平台名称'),
        channelId: Schema.string().description('频道 ID'),
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

]);

const logger = new Logger('mclistener-ws-client');

export function apply(ctx: Context, config: any) {
  const client = new MclistenerWsClient(ctx, config);

  ctx.on('ready', () => {
    client.connect();
  });

  ctx.on('dispose', () => {
    client.shutdown();
  });

  // 注册中间件来处理聊天平台消息转发到服务器
  if (config.enableFowardPlatformChat) {
    ctx.middleware((session, next) => {
      // 检查是否为目标来源平台和频道
      const isSourcePlatform = config.sourcePlatformList.some(
        (source) => source.platform === session.platform && source.channelId === session.channelId
      );

      if (!isSourcePlatform) {
        return next(); // 不是来源平台，继续处理其他中间件
      }

      // 排除机器人自己的消息
      if (config.excludeBotMessages && session.userId === session.bot.selfId) {
        return next();
      }

      // 检查前缀
      if (config.platformChatPrefixCheck) {
        const hasPrefix = config.platformChatPrefixList.some((prefix) => 
          session.content.startsWith(prefix)
        );
        if (!hasPrefix) {
          return next();
        }
      }

      // 转发消息到服务器
      client.forwardPlatformMessageToServer(session);
      
      return next(); // 继续处理其他中间件
    });
  }
}

class MclistenerWsClient {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private ctx: Context, private config: any) {}

  public connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    this.isConnecting = true;
    logger.info(`尝试连接到 WS 服务器: ${this.config.wsServerUrl}`);

    try {
      this.ws = this.ctx.http.ws(this.config.wsServerUrl);
      this.setupListeners();
    } catch (e) {
      this.isConnecting = false;
      logger.error(`连接失败: ${e.message}`);
      this.scheduleReconnect();
    }
  }

  private setupListeners() {
    this.ws.onopen = () => {
      this.isConnecting = false;
      logger.success('成功连接到 WS 服务器');
      if (this.reconnectTimer) {
        clearInterval(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      if (this.config.enablePrivateReport) {
        this.sendPrivateMessages(`[mclistener-ws-client]\n成功连接到WS: ${this.config.wsServerUrl}`);
      } else {
        this.sendMessageToChannels(`[mclistener-ws-client]\n成功连接到WS: ${this.config.wsServerUrl}`);
      }
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data as string);
    };

    this.ws.onclose = (event) => {
      this.isConnecting = false;
      logger.warn(`WS 连接已关闭，代码: ${event.code}, 原因: ${event.reason}`);
      
      if (this.config.enablePrivateReport) {
        this.sendPrivateMessages(`[mclistener-ws-client]\nWS连接已断开，正在尝试重连...`);
      } else {
        this.sendMessageToChannels(`[mclistener-ws-client]\nWS连接已断开，正在尝试重连...`);
      }
      
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      logger.error(`WS 连接错误: ${JSON.stringify(error)}`);
      
      if (this.config.enablePrivateReport) {
        this.sendPrivateMessages(`[mclistener-ws-client]\nWS连接发生错误: ${JSON.stringify(error)}`);
      } else {
        this.sendMessageToChannels(`[mclistener-ws-client]\nWS连接发生错误: ${JSON.stringify(error)}`);
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    logger.info('5s 后尝试重连...');
    this.reconnectTimer = setTimeout(() => {
      this.connect();
      this.reconnectTimer = null;
    }, 5000);
  }

  private handleMessage(message: string) {
    try {
      const data = JSON.parse(message);
      const { type, player_name, content } = data;

      let msg = '';
      if (type === 'player_join' && this.config.enableForwardPlayerJoin) {
        msg = this.config.customizePlayerJoinMsg.replace('%PLAYER%', player_name);
      } else if (type === 'player_leave' && this.config.enableForwardPlayerLeave) {
        msg = this.config.customizePlayerLeaveMsg.replace('%PLAYER%', player_name);
      } else if (type === 'player_msg' && this.config.enableForwardPlayerChat) {
        if (this.config.enableFowardMsgPrefixWhitelistCheck) {
          const prefixWhitelistMatch = this.config.fowardMsgPrefixWhitelistList.some((prefix) => content.startsWith(prefix));
          if (!prefixWhitelistMatch) {
            logger.info(`忽略不符合前缀白名单的消息: ${content}`);
            return;
          }
        }
        if (this.config.enableForwardMsgPrefixBlacklistCheck) {
          const prefixBlacklistMatch = this.config.fowardMsgPrefixBlacklistList.some((prefix) => content.startsWith(prefix));
          if (prefixBlacklistMatch) {
            logger.info(`忽略符合前缀黑名单的消息: ${content}`);
            return;
          }
        }
        msg = this.config.customizePlayerChatMsg
          .replace('%PLAYER%', player_name)
          .replace('%CONTENT%', content);
      }

      if ( this.config.enableAddDateTimePrefix ) 
        msg = `[${new Date().toLocaleString()}]\n\n${msg}`;
      this.sendMessageToChannels(msg);
    } catch (e) {
      logger.error(`消息处理失败: ${e.message}`);
    }
  }

  // 新增：转发聊天平台消息到服务器
  public forwardPlatformMessageToServer(session: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket 未连接，无法转发消息到服务器');
      return;
    }

    try {
      // 获取平台信息
      const platformName = session.platform;
      const channelName = session.channelId;
      const nickname = session.author?.nickname || session.author?.username || session.username || '未知用户';

      // let messageContent = session.content;
      let messageContent = '';
      const elements = h.parse(session.content);
      for (let i = 0; i < elements.length; i++) {
        const e = elements[i];
        if (e.type === "text") {
          messageContent += e.attrs.content;
        } else if (e.type === "at"){
          messageContent += `<at @${e.attrs.id}>`;
        } else {
          messageContent += `<${e.type}>`;
        }
 
      }

      // 如果启用了前缀检查，去掉前缀
      if (this.config.platformChatPrefixCheck) {
        for (const prefix of this.config.platformChatPrefixList) {
          if (messageContent.startsWith(prefix)) {
            messageContent = messageContent.substring(prefix.length).trim();
            break;
          }
        }
      }

      // 构造发送到MC服务器的消息
      const wsMessage = {
        type: 'group_to_server',
        group_id: channelName,
        group_name: platformName,
        nickname: nickname,
        message: messageContent
      };

      this.ws.send(JSON.stringify(wsMessage));
      logger.info(`转发平台消息到服务器: [${platformName}] ${nickname}: ${messageContent}`);

    } catch (e) {
      logger.error(`转发平台消息到服务器失败: ${e.message}`);
    }
  }

  private async sendMessageToChannels(message: string) {
    for (const bot of this.ctx.bots) {
      for (const target of this.config.targetPlatformChannelList) {
        if (bot.platform === target.platform) {
          try {
            await bot.sendMessage(target.channelId, message);
            logger.info(`成功向 ${target.platform}:${target.channelId} 发送消息。`);
          } catch (e) {
            logger.error(`向 ${target.platform}:${target.channelId} 发送消息失败: ${e.message}`);
          }
        }
      }
    }
  }

  private async sendPrivateMessages(message: string) {
    for (const bot of this.ctx.bots) {
      for (const target of this.config.privateReportUserIdList) {
        if (bot.platform === target.platform) {
          try {
            await bot.sendPrivateMessage(target.userId, message);
            logger.info(`成功向 ${target.platform}:${target.userId} 发送私聊消息。`);
          } catch (e) {
            logger.error(`向 ${target.platform}:${target.userId} 发送私聊消息失败: ${e.message}`);
          }
        }
      }
    }
  }

  public shutdown() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      logger.info('已关闭 WebSocket 连接');
    }
  }
}
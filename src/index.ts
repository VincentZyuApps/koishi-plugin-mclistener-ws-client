import { Context, Logger } from 'koishi';
import { Config } from './config';
import { PluginConfig } from './types';
import { MclistenerWsClient } from './client';
import { registerCommands } from './command';

export const name = 'mclistener-ws-client';

export const reusable = true; // 声明此插件可重用

export const inject = {
  required: ['http'],
};

export { Config };

export { usage } from './usage';

const logger = new Logger('mclistener-ws-client');

export function apply(ctx: Context, config: PluginConfig) {
  let client: MclistenerWsClient | null = null;

  if (config.verboseConsoleOutput) {
    logger.info(`[DEBUG] 插件开始初始化，config: ${JSON.stringify(config, null, 2)}`);
  }

  ctx.on('ready', () => {
    if (config.verboseConsoleOutput) {
      logger.info(`[DEBUG] 收到ready事件，创建并连接WS客户端`);
    }
    client = new MclistenerWsClient(ctx, config);
    client.connect();
  });

  if (config.enableExecCommand) {
    registerCommands(ctx, config, () => client);
  }

  ctx.on('dispose', () => {
    if (config.verboseConsoleOutput) {
      logger.info(`[DEBUG] 收到dispose事件，销毁WS客户端`);
    }
    // 在dispose时销毁客户端实例
    if (client) {
      client.shutdown(); // 清理内部资源（包含实例ID日志）
      client = null;     // 清空引用，允许垃圾回收
      if (config.verboseConsoleOutput) {
        logger.info(`[DEBUG] 客户端实例引用已从apply作用域中移除`);
      }
    }
  });

  // 注册中间件来处理聊天平台消息转发到服务器
  if (config.enableFowardPlatformChat) {
    if (config.verboseConsoleOutput) {
      logger.info(`[DEBUG] 注册中间件处理聊天平台消息转发`);
    }
    const middlewareDispose = ctx.middleware((session, next) => {
      if (config.verboseConsoleOutput) {
        logger.info(`[DEBUG] 📨 中间件收到消息: ${session.content} from ${session.platform}:${session.channelId}`);
        logger.info(`[DEBUG] 消息详情: userId=${session.userId}, botId=${session.bot.selfId}, authorId=${session.author?.userId}, nickname=${session.author?.nickname}`);
      }

      // 检查客户端是否存在
      if (!client) {
        if (config.verboseConsoleOutput) {
          logger.info(`[DEBUG] ⚠️ 客户端实例不存在，跳过处理`);
        }
        return next();
      }

      // 检查是否为目标来源平台和频道
      // const isSourcePlatform = config.sourcePlatformList.some(
      //   (source) => source.platform === session.platform && source.channelId === session.channelId
      // );
      const matchedSource = config.sourcePlatformList.find(
        (source) => source.platform === session.platform && source.channelId === session.channelId
      );

      if ( matchedSource && matchedSource.enable===false ){
        config.verboseConsoleOutput && logger.info(`[DEBUG] ⚠️ 是目标平台，但未启用，跳过处理`);
        return next(); // 不是来源平台，继续处理其他中间件
      }

      if (!matchedSource) {
        config.verboseConsoleOutput && logger.info(`[DEBUG] ⚠️ 不是目标来源平台，跳过处理`);
        return next(); // 不是来源平台，继续处理其他中间件
      }

      // 排除机器人自己的消息 - 多重检查
      if (config.excludeBotMessages) {
        const isBotMessage = session.userId === session.bot.selfId || 
                           session.author?.userId === session.bot.selfId ||
                           session.author?.nickname?.includes('bot') ||
                           session.author?.nickname?.includes('机器人');
        
        if (isBotMessage) {
          if (config.verboseConsoleOutput) {
            logger.info(`[DEBUG] 🤖 排除机器人消息: userId=${session.userId}, botId=${session.bot.selfId}, authorId=${session.author?.userId}, nickname=${session.author?.nickname}`);
          }
          return next();
        }
      }

      // 检查前缀
      if (config.platformChatPrefixCheck) {
        const hasPrefix = config.platformChatPrefixList.some((prefix) => 
          session.content.startsWith(prefix)
        );
        if (!hasPrefix) {
          if (config.verboseConsoleOutput) {
            logger.info(`[DEBUG] ⚠️ 消息不符合前缀要求，跳过转发`);
          }
          return next();
        }
      }

      if (config.verboseConsoleOutput) {
        logger.info(`[DEBUG] 🔄 准备转发消息到服务器`);
      }
      // 转发消息到服务器
      client.forwardPlatformMessageToServer(session);
      
      return next(); // 继续处理其他中间件
    });

    // 在插件dispose时清理中间件
    ctx.on('dispose', () => {
      if (config.verboseConsoleOutput) {
        logger.info(`[DEBUG] 清理中间件`);
      }
      middlewareDispose();
    });
  }
}
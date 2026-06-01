import { Context, Logger, h } from 'koishi';
import { PluginConfig, McServerMessage, PlatformToServerMessage } from './types';

const logger = new Logger('mclistener-ws-client:handler');

export class MessageHandler {
  constructor(
    private ctx: Context,
    private config: PluginConfig
  ) {}

  /**
   * 处理来自 MC 服务器的消息
   */
  public handleServerMessage(message: string): string | null {
    try {
      const data: McServerMessage = JSON.parse(message);
      const { type, player_name, content } = data;

      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] 处理消息: type=${type}, player=${player_name}, content=${content}`);
      }

      let msg = '';
      
      if (type === 'player_join' && this.config.enableForwardPlayerJoin) {
        msg = this.config.customizePlayerJoinMsg.replace('%PLAYER%', player_name);
      } else if (type === 'player_leave' && this.config.enableForwardPlayerLeave) {
        msg = this.config.customizePlayerLeaveMsg.replace('%PLAYER%', player_name);
      } else if (type === 'player_chat' && this.config.enableForwardPlayerChat) {
        // 白名单检查
        if (this.config.enableFowardMsgPrefixWhitelistCheck) {
          const prefixWhitelistMatch = this.config.fowardMsgPrefixWhitelistList.some(
            (prefix) => content?.startsWith(prefix)
          );
          if (!prefixWhitelistMatch) {
            logger.info(`忽略不符合前缀白名单的消息: ${content}`);
            return null;
          }
        }

        // 黑名单检查
        if (this.config.enableForwardMsgPrefixBlacklistCheck) {
          const prefixBlacklistMatch = this.config.fowardMsgPrefixBlacklistList.some(
            (prefix) => content?.startsWith(prefix)
          );
          if (prefixBlacklistMatch) {
            logger.info(`忽略符合前缀黑名单的消息: ${content}`);
            return null;
          }
        }

        // 发送者黑名单检查
        if (this.config.enableSenderBlacklistCheck) {
          const senderBlacklistMatch = this.config.senderBlacklistList.some(
            (name) => player_name === name
          );
          if (senderBlacklistMatch) {
            logger.info(`忽略黑名单玩家的消息: ${player_name}: ${content}`);
            return null;
          }
        }

        msg = this.config.customizePlayerChatMsg
          .replace('%PLAYER%', player_name)
          .replace('%CONTENT%', content || '');
      }

      if (!msg) return null;

      // 添加时间前缀
      if (this.config.enableAddDateTimePrefix) {
        msg = `[${new Date().toLocaleString()}]\n\n${msg}`;
      }

      return msg;
    } catch (e) {
      logger.error(`消息处理失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 将聊天平台的消息转换为发送到服务器的格式
   */
  public createPlatformToServerMessage(session: any): PlatformToServerMessage | null {
    try {
      const platformName = session.platform;
      const channelName = session.channelId;
      const nickname = session.author?.nickname || session.author?.username || session.username || '未知用户';

      // 解析消息内容，提取图片信息
      let messageContent = '';
      const images: Array<{ idx: number; url: string; summary?: string }> = [];
      let imageIndex = 0;
      
      const elements = h.parse(session.content);
      for (const e of elements) {
        if (e.type === 'text') {
          messageContent += e.attrs.content;
        } else if (e.type === 'at') {
          messageContent += `<at @${e.attrs.id}>`;
        } else if (e.type === 'img') {
          // 处理图片：记录URL并插入标记
          const imageUrl = e.attrs.src || e.attrs.url;
          if (imageUrl) {
            images.push({
              idx: imageIndex,
              url: imageUrl,
              summary: e.attrs.summary
            });
            messageContent += `<img:${imageIndex}>`;
            imageIndex++;
          } else {
            // 没有URL的图片，显示为普通标记
            messageContent += `<img>`;
          }
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

      const result: PlatformToServerMessage = {
        type: 'group_to_server',
        group_id: channelName,
        group_name: platformName,
        nickname: nickname,
        message: messageContent
      };

      // 只有在有图片时才添加 images 字段
      if (images.length > 0) {
        result.images = images;
      }

      return result;
    } catch (e) {
      logger.error(`构造平台消息失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 发送消息到配置的频道
   */
  public async sendMessageToChannels(message: string): Promise<void> {
    for (const bot of this.ctx.bots) {
      for (const target of this.config.targetPlatformChannelList) {
        if (target.enable !== true) {
          if (this.config.verboseConsoleOutput) {
            logger.info(`跳过未启用的目标频道: ${target.platform}:${target.channelId}`);
          }
          continue;
        }
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

  /**
   * 发送私聊消息
   */
  public async sendPrivateMessages(message: string): Promise<void> {
    for (const bot of this.ctx.bots) {
      for (const target of this.config.privateReportUserIdList) {
        if (target.enable === false) continue;
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

  /**
   * 发送报告消息到指定频道
   */
  public async sendReportToChannels(message: string): Promise<void> {
    for (const bot of this.ctx.bots) {
      for (const target of this.config.reportChannelList) {
        if (target.enable === false) continue;
        if (bot.platform === target.platform) {
          try {
            await bot.sendMessage(target.channelId, message);
            logger.info(`成功向报告频道 ${target.platform}:${target.channelId} 发送消息。`);
          } catch (e) {
            logger.error(`向报告频道 ${target.platform}:${target.channelId} 发送消息失败: ${e.message}`);
          }
        }
      }
    }
  }
}

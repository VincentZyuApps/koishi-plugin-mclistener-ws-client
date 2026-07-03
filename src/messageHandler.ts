import { Context, Logger, h } from 'koishi';
import { PluginConfig, McServerMessage, PlatformToServerMessage, RenderedServerMessage } from './types';
import { sendQQMarkdown } from './qq';
import { renderTemplate, TemplateVars } from './template';
import { resolveBots } from './bot';

const logger = new Logger('mclistener-ws-client:handler');

export class MessageHandler {
  constructor(
    private ctx: Context,
    private config: PluginConfig
  ) {}

  /**
   * 处理来自 MC 服务器的消息
   */
  public handleServerMessage(message: string): RenderedServerMessage | null {
    try {
      const data: McServerMessage = JSON.parse(message);
      const { type, player_name, content } = data;
      const time = new Date().toLocaleString();
      const vars: TemplateVars = {
        player: player_name,
        content: content || '',
        time,
      };

      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] 处理消息: type=${type}, player=${player_name}, content=${content}`);
      }

      let msg = '';
      let markdown = '';
      
      if (type === 'player_join' && this.config.enableForwardPlayerJoin) {
        msg = renderTemplate(this.config.customizePlayerJoinMsg, vars);
        if (this.config.enableQQMarkdownPlayerJoin) {
          markdown = renderTemplate(this.config.qqMarkdownPlayerJoinTemplate, vars);
        }
      } else if (type === 'player_leave' && this.config.enableForwardPlayerLeave) {
        msg = renderTemplate(this.config.customizePlayerLeaveMsg, vars);
        if (this.config.enableQQMarkdownPlayerLeave) {
          markdown = renderTemplate(this.config.qqMarkdownPlayerLeaveTemplate, vars);
        }
      } else if (type === 'player_chat' && this.config.enableForwardPlayerChat) {
        // 白名单检查
        if (this.config.enableFowardMsgPrefixWhitelistCheck) {
          const prefixWhitelistMatch = this.config.fowardMsgPrefixWhitelistList.some(
            (prefix) => content?.startsWith(prefix)
          );
          if (!prefixWhitelistMatch) {
            logger.info(`⚠️ 忽略不符合前缀白名单的消息: ${content}`);
            return null;
          }
        }

        // 黑名单检查
        if (this.config.enableForwardMsgPrefixBlacklistCheck) {
          const prefixBlacklistMatch = this.config.fowardMsgPrefixBlacklistList.some(
            (prefix) => content?.startsWith(prefix)
          );
          if (prefixBlacklistMatch) {
            logger.info(`🚫 忽略符合前缀黑名单的消息: ${content}`);
            return null;
          }
        }

        // 发送者黑名单检查
        if (this.config.enableSenderBlacklistCheck) {
          const senderBlacklistMatch = this.config.senderBlacklistList.some(
            (name) => player_name === name
          );
          if (senderBlacklistMatch) {
            logger.info(`🚫 忽略黑名单玩家的消息: ${player_name}: ${content}`);
            return null;
          }
        }

        msg = renderTemplate(this.config.customizePlayerChatMsg, vars);
        if (this.config.enableQQMarkdownPlayerChat) {
          markdown = renderTemplate(this.config.qqMarkdownPlayerChatTemplate, vars);
        }
      }

      if (!msg) return null;

      // 添加时间前缀
      if (this.config.enableAddDateTimePrefix) {
        msg = `[${time}]\n\n${msg}`;
      }

      return {
        type,
        text: msg,
        markdown: markdown || undefined,
      };
    } catch (e) {
      logger.error(`❌ 消息处理失败: ${e.message}`);
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

      if (this.config.stripMessageWhitespace) {
        messageContent = messageContent.replace(/[\r\n\t]+/g, ' ').replace(/ +/g, ' ').trim();
      }

      const result: PlatformToServerMessage = {
        type: 'chat_platform_to_server',
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
      logger.error(`❌ 构造平台消息失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 发送消息到配置的频道
   */
  public async sendMessageToChannels(message: RenderedServerMessage): Promise<void> {
    for (const target of this.config.targetPlatformChannelList) {
      if (target.enable !== true) {
        if (this.config.verboseConsoleOutput) {
          logger.info(`⚠️ 跳过未启用的目标频道: ${target.platform}:${target.channelId}`);
        }
        continue;
      }
      const bots = this.resolveTargetBots(target);
      for (const bot of bots) {
        try {
          if (bot.platform === 'qq' && message.markdown) {
            const result = await sendQQMarkdown(bot, target.channelId, message.markdown, logger, this.config.verboseConsoleOutput);
            logger.info(`📢 成功向 ${target.platform}:${target.channelId} 发送 QQ Markdown 消息: ${result.messageIds.join(', ') || '(no message id)'} via ${result.method}`);
          } else {
            await bot.sendMessage(target.channelId, message.text);
            logger.info(`📢 成功向 ${target.platform}:${target.channelId} 发送消息。`);
          }
        } catch (e) {
          logger.error(`❌ 向 ${target.platform}:${target.channelId} 发送消息失败: ${e.message}`);
        }
      }
      if (bots.length === 0) {
        logger.warn(`⚠️ 未找到目标 Bot: ${target.platform}${target.selfId ? `:${target.selfId}` : ''}`);
      }
    }
  }

  /**
   * 发送私聊消息
   */
  public async sendPrivateMessages(message: string): Promise<void> {
    for (const target of this.config.privateReportUserIdList) {
      if (target.enable === false) continue;
      for (const bot of this.resolveTargetBots(target)) {
        try {
          await bot.sendPrivateMessage(target.userId, message);
          logger.info(`💌 成功向 ${target.platform}:${target.userId} 发送私聊消息。`);
        } catch (e) {
          logger.error(`❌ 向 ${target.platform}:${target.userId} 发送私聊消息失败: ${e.message}`);
        }
      }
    }
  }

  /**
   * 发送报告消息到指定频道
   */
  public async sendReportToChannels(message: string): Promise<void> {
    for (const target of this.config.reportChannelList) {
      if (target.enable === false) continue;
      for (const bot of this.resolveTargetBots(target)) {
        try {
          await bot.sendMessage(target.channelId, message);
          logger.info(`📡 成功向报告频道 ${target.platform}:${target.channelId} 发送消息。`);
        } catch (e) {
          logger.error(`❌ 向报告频道 ${target.platform}:${target.channelId} 发送消息失败: ${e.message}`);
        }
      }
    }
  }

  private resolveTargetBots(target: { platform: string; selfId?: string }) {
    const bots = resolveBots(this.ctx, target);
    return !target.selfId && this.config.useFirstBotWhenSelfIdEmpty ? bots.slice(0, 1) : bots;
  }
}

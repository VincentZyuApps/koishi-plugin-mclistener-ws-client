import { Context, Logger, h } from 'koishi';
import { PluginConfig, McServerMessage, PlatformToServerMessage, RenderedServerMessage } from './types';
import { sendQQMarkdown } from './qq';
import { renderTemplate, TemplateVars } from './template';
import { resolveBots } from './bot';

const logger = new Logger('mclistener-ws-client:handler');

function findLongestMatchingPrefix(content: string, prefixes: string[]): string | undefined {
  let matchedPrefix: string | undefined;

  for (const prefix of prefixes) {
    if (!prefix || !content.startsWith(prefix)) continue;
    if (!matchedPrefix || prefix.length > matchedPrefix.length) {
      matchedPrefix = prefix;
    }
  }

  return matchedPrefix;
}

function stripMatchedPrefix(content: string, prefix: string): string {
  return content.substring(prefix.length).trimStart();
}

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
      
      if (type === 'player_join' && this.config.enableServerToPlatformPlayerJoin) {
        msg = renderTemplate(this.config.playerJoinMessageTemplate, vars);
        if (this.config.enableQQMarkdownPlayerJoin) {
          markdown = renderTemplate(this.config.qqMarkdownPlayerJoinTemplate, vars);
        }
      } else if (type === 'player_leave' && this.config.enableServerToPlatformPlayerLeave) {
        msg = renderTemplate(this.config.playerLeaveMessageTemplate, vars);
        if (this.config.enableQQMarkdownPlayerLeave) {
          markdown = renderTemplate(this.config.qqMarkdownPlayerLeaveTemplate, vars);
        }
      } else if (type === 'player_chat' && this.config.enableServerToPlatformPlayerChat) {
        const originalContent = content || '';
        let allowedPrefix: string | undefined;

        // 允许前缀检查
        if (this.config.enableServerChatPrefixAllowlist) {
          allowedPrefix = findLongestMatchingPrefix(
            originalContent,
            this.config.serverChatAllowedPrefixes
          );
          if (!allowedPrefix) {
            logger.info(`⚠️ 忽略不符合服务器聊天允许前缀要求的消息: ${content}`);
            return null;
          }
        }

        // 阻止前缀检查
        if (this.config.enableServerChatPrefixBlocklist) {
          const blockedPrefix = findLongestMatchingPrefix(
            originalContent,
            this.config.serverChatBlockedPrefixes
          );
          if (blockedPrefix) {
            logger.info(`🚫 忽略符合服务器聊天阻止前缀的消息: ${content}`);
            return null;
          }
        }

        // 发送者阻止列表检查
        if (this.config.enableServerChatSenderBlocklist) {
          const blockedSenderMatch = this.config.serverChatBlockedSenders.some(
            (name) => player_name === name
          );
          if (blockedSenderMatch) {
            logger.info(`🚫 忽略服务器聊天阻止列表中的发送者消息: ${player_name}: ${content}`);
            return null;
          }
        }

        const forwardedContent = this.config.enableServerChatPrefixAllowlist
          && this.config.stripServerChatPrefix
          && allowedPrefix
          ? stripMatchedPrefix(originalContent, allowedPrefix)
          : originalContent;
        const chatVars: TemplateVars = {
          ...vars,
          content: forwardedContent,
        };

        msg = renderTemplate(this.config.playerChatMessageTemplate, chatVars);
        if (this.config.enableQQMarkdownPlayerChat) {
          markdown = renderTemplate(this.config.qqMarkdownPlayerChatTemplate, chatVars);
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

      // 允许前缀检查和可选剥离
      if (this.config.enablePlatformChatPrefixAllowlist) {
        const allowedPrefix = findLongestMatchingPrefix(
          messageContent,
          this.config.platformChatAllowedPrefixes
        );
        if (!allowedPrefix) {
          if (this.config.verboseConsoleOutput) {
            logger.info(`[DEBUG] ⚠️ 消息不符合平台聊天允许前缀要求，跳过转发`);
          }
          return null;
        }
        if (this.config.stripPlatformChatPrefix) {
          messageContent = stripMatchedPrefix(messageContent, allowedPrefix);
        }
      }

      if (this.config.normalizePlatformChatWhitespace) {
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
    for (const target of this.config.targetPlatformChannels) {
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
    return target.selfId || this.config.useFirstBotWhenSelfIdEmpty ? bots.slice(0, 1) : bots;
  }
}

import { Bot, Logger, h } from 'koishi';

export interface QQMarkdownPayload {
  msg_type: 2;
  markdown: {
    content: string;
  };
}

export interface QQMarkdownSendResult {
  messageIds: string[];
  method: 'encoder' | 'internal-fallback';
}

export function buildQQMarkdownPayload(content: string): QQMarkdownPayload {
  return {
    msg_type: 2,
    markdown: {
      content: content || ' ',
    },
  };
}

export async function sendQQMarkdown(
  bot: Bot,
  channelId: string,
  content: string,
  logger: Logger,
  verbose = false,
): Promise<QQMarkdownSendResult> {
  const markdown = content || ' ';
  const payload = buildQQMarkdownPayload(markdown);

  if (verbose) {
    logger.info('QQ Markdown encoder attempt: channelId=%s contentPreview=%s', channelId, markdown.slice(0, 120));
  }

  try {
    const messageIds = await bot.sendMessage(channelId, h('qq:rawmarkdown-without-keyboard', { content: markdown }));
    if (messageIds.length) {
      return { messageIds, method: 'encoder' };
    }
    logger.warn('⚠️ QQ Markdown encoder returned no message id; falling back to bot.internal.sendMessage().');
  } catch (error) {
    logger.warn('⚠️ QQ Markdown encoder failed; falling back to bot.internal.sendMessage(): %s',
      error instanceof Error ? error.message : String(error));
  }

  const internal = (bot as any).internal;
  if (!internal?.sendMessage) {
    throw new Error('current qq bot does not expose internal.sendMessage for QQ Markdown fallback');
  }

  if (verbose) logger.info('QQ Markdown internal fallback payload: channelId=%s payload=%o', channelId, payload);
  const response = await internal.sendMessage(channelId, payload);
  return { messageIds: response?.id ? [response.id] : [], method: 'internal-fallback' };
}

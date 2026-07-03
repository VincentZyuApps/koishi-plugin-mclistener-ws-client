import type { Bot, Context } from 'koishi';

export interface BotSelector {
  platform: string;
  selfId?: string;
}

export function resolveBots(ctx: Context, selector: BotSelector): Bot[] {
  if (!selector.platform) return [];
  return ctx.bots.filter((bot) => {
    if (bot.platform !== selector.platform) return false;
    if (selector.selfId && bot.selfId !== selector.selfId) return false;
    return true;
  });
}


import { Universal, type Bot, type Context } from 'koishi';

export interface BotSelector {
  platform: string;
  selfId?: string;
}

export function resolveBots(ctx: Context, selector: BotSelector): Bot[] {
  if (!selector.platform) return [];

  const latestByIdentity = new Map<string, Bot>();
  for (const bot of ctx.bots) {
    if (bot.platform !== selector.platform) continue;
    if (selector.selfId && bot.selfId !== selector.selfId) continue;
    if (bot.status !== Universal.Status.ONLINE || !bot.ctx.scope.isActive) continue;

    const identity = `${bot.platform}\u0000${bot.selfId}`;
    const current = latestByIdentity.get(identity);
    if (!current || bot.sn > current.sn) latestByIdentity.set(identity, bot);
  }

  return [...latestByIdentity.values()];
}

import { Context, Logger, h } from 'koishi';
import { PluginConfig, CommandSender } from './types';
import { MclistenerWsClient } from './client';

const logger = new Logger('mclistener-ws-client:command');

export function registerCommands(
  ctx: Context,
  config: PluginConfig,
  getClient: () => MclistenerWsClient | null
) {

  /**
   * ⚡ 注册远程命令执行指令
   *
   * @description 在聊天平台执行 MC 服务器命令
   * @usage       <指令名> <命令>, 比如 /mcws.exec list
   * @permission  受 execCommandAdminUserIdList 白名单控制
   * @remarks     通过 WebSocket 发送命令到 MCDR 服务端并返回执行结果
   */
  ctx.command(`${config.execCommandName} <cmd:text>`, '在 Minecraft 服务器上执行命令')
    .action(async ({ session }, cmd) => {
      const quote = config.enableQuote ? h.quote(session?.messageId) : '';

      if (!cmd || cmd.trim() === '') {
        return `${quote}⚠️ 请输入要执行的命令`;
      }

      const isAdmin = !config.enableExecCommandWhitelist || config.execCommandAdminUserIdList.some(
        (item) =>
          item.enable &&
          item.platform === session?.platform &&
          item.userId === session?.userId
      );

      if (!isAdmin) {
        return `${quote}🚫 你没有权限执行此命令`;
      }

      const client = getClient();
      if (!client || !client.isConnected()) {
        return `${quote}❌ 当前未连接到 Minecraft 服务器`;
      }

      const sender: CommandSender = {
        platform: session?.platform,
        channel_id: session?.channelId,
        user_id: session?.userId,
        nickname: session?.author?.nickname || session?.author?.username || session?.username || '未知用户',
      };

      try {
        const result = await client.sendCommand(cmd.trim(), sender);

        if (result.ok) {
          let output = result.result || '(无输出)';
          if (output.length > config.execCommandMaxReplyLength) {
            output = output.substring(0, config.execCommandMaxReplyLength) + '\n...(输出过长，已截断)';
          }
          return `${quote}✅ [MC命令执行成功]\n> ${cmd}\n${output}`;
        } else {
          return `${quote}❌ [MC命令执行失败]\n> ${cmd}\n${result.error || '未知错误'}`;
        }
      } catch (e) {
        logger.error(`❌ 命令执行失败: ${e.message}`);
        return `${quote}❌ 命令执行失败: ${e.message}`;
      }
    });
}

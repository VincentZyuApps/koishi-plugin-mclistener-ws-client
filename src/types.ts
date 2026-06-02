// ============================================================
// ⚙️ 插件配置接口（PluginConfig）
// ============================================================
export interface PluginConfig {
  // ---- 💬 消息设置 ----
  enableQuote: boolean;

  // ---- 🌐 WebSocket 连接配置 ----
  wsServerUrl: string;
  wsToken: string;

  // ---- 📊 报告配置 ----
  enablePrivateReport: boolean;
  privateReportUserIdList: Array<{
    platform: string;
    userId: string;
    enable: boolean;
  }>;
  enableChannelReport: boolean;
  reportChannelList: Array<{
    platform: string;
    channelId: string;
    enable: boolean;
  }>;
  enableConsoleLogReport: boolean;

  // ---- 📤 转发目的地配置 ----
  enableAddDateTimePrefix: boolean;
  targetPlatformChannelList: Array<{
    platform: string;
    channelId: string;
    enable: boolean;
  }>;

  // ---- 📥 转发来源配置 ----
  stripMessageWhitespace: boolean;
  sourcePlatformList: Array<{
    platform: string;
    channelId: string;
    enable: boolean;
  }>;

  // ---- 🚪 玩家加入消息 ----
  enableForwardPlayerJoin: boolean;
  customizePlayerJoinMsg: string;

  // ---- 🚶 玩家离开消息 ----
  enableForwardPlayerLeave: boolean;
  customizePlayerLeaveMsg: string;

  // ---- 💬 玩家聊天消息 ----
  enableForwardPlayerChat: boolean;
  customizePlayerChatMsg: string;
  enableFowardMsgPrefixWhitelistCheck: boolean;
  fowardMsgPrefixWhitelistList: string[];
  enableForwardMsgPrefixBlacklistCheck: boolean;
  fowardMsgPrefixBlacklistList: string[];
  enableSenderBlacklistCheck: boolean;
  senderBlacklistList: string[];

  // ---- 🔄 平台消息转发 ----
  enableFowardPlatformChat: boolean;
  platformChatPrefixCheck: boolean;
  platformChatPrefixList: string[];
  excludeBotMessages: boolean;

  // ---- 🔐 远程命令执行配置 ----
  enableExecCommand: boolean;
  execCommandName: string;
  enableExecCommandWhitelist: boolean;
  execCommandAdminUserIdList: Array<{
    platform: string;
    userId: string;
    enable: boolean;
  }>;
  execCommandTimeoutMs: number;
  execCommandMaxReplyLength: number;

  // ---- 🐛 调试配置 ----
  verboseConsoleOutput: boolean;
}



// ============================================================
// 📦 WebSocket 消息类型
// ============================================================

// ---- 🎮 Minecraft 服务器消息 ----
export interface McServerMessage {
  type: 'player_join' | 'player_leave' | 'player_chat';
  player_name: string;
  content?: string;
}

export type McServerIncomingMessage = McServerMessage | CommandResultMessage;

// ---- 🖼️ 图片信息 ----
export interface ImageInfo {
  idx: number;
  url: string;
  summary?: string;
}

// ---- 📤 平台 → 服务器消息 ----
export interface PlatformToServerMessage {
  type: 'chat_platform_to_server';
  group_id: string;
  group_name: string;
  nickname: string;
  message: string;
  images?: ImageInfo[];
}

// ---- 👤 命令发送者 ----
export interface CommandSender {
  platform: string;
  channel_id: string;
  user_id: string;
  nickname: string;
}

// ---- 📨 命令请求 ----
export interface CommandRequestMessage {
  type: 'external_command_to_server';
  request_id: string;
  command: string;
  sender: CommandSender;
}

// ---- 📨 命令结果 ----
export interface CommandResultMessage {
  type: 'command_result';
  request_id: string;
  command: string;
  ok: boolean;
  result?: string;
  error?: string;
}

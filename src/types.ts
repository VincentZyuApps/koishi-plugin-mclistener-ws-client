export interface PluginConfig {
  // WS配置
  wsServerUrl: string;

  // 报告配置
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

  // 日志报告配置
  enableConsoleLogReport: boolean;

  // 转发目的地配置
  enableAddDateTimePrefix: boolean;
  targetPlatformChannelList: Array<{
    platform: string;
    channelId: string;
    enable: boolean;
  }>;

  // 转发来源配置
  sourcePlatformList: Array<{
    platform: string;
    channelId: string;
    enable: boolean;
  }>;

  // 服务器玩家加入配置
  enableForwardPlayerJoin: boolean;
  customizePlayerJoinMsg: string;

  // 服务器玩家离开配置
  enableForwardPlayerLeave: boolean;
  customizePlayerLeaveMsg: string;

  // 服务器玩家聊天配置
  enableForwardPlayerChat: boolean;
  customizePlayerChatMsg: string;
  enableFowardMsgPrefixWhitelistCheck: boolean;
  fowardMsgPrefixWhitelistList: string[];
  enableForwardMsgPrefixBlacklistCheck: boolean;
  fowardMsgPrefixBlacklistList: string[];
  enableSenderBlacklistCheck: boolean;
  senderBlacklistList: string[];

  // 平台聊天转发配置
  enableFowardPlatformChat: boolean;
  platformChatPrefixCheck: boolean;
  platformChatPrefixList: string[];
  excludeBotMessages: boolean;

  // 调试配置
  verboseConsoleOutput: boolean;
}

export interface McServerMessage {
  type: 'player_join' | 'player_leave' | 'player_msg';
  player_name: string;
  content?: string;
}

export interface ImageInfo {
  idx: number;
  url: string;
  summary?: string;
}

export interface PlatformToServerMessage {
  type: 'group_to_server';
  group_id: string;
  group_name: string;
  nickname: string;
  message: string;
  images?: ImageInfo[];  // add：图片信息数组
}

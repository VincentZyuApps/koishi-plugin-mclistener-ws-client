import { Context, Logger } from 'koishi';
import { PluginConfig } from './types';
import { MessageHandler } from './messageHandler';

const logger = new Logger('mclistener-ws-client:client');

export class MclistenerWsClient {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private instanceId: string;
  private isDisposed = false;
  private messageHandler: MessageHandler;

  constructor(
    private ctx: Context,
    private config: PluginConfig
  ) {
    this.instanceId = Math.random().toString(36).substring(7);
    this.messageHandler = new MessageHandler(ctx, config);
    
    if (this.config.verboseConsoleOutput) {
      logger.info(`[DEBUG] 创建WS客户端实例: ${this.instanceId}`);
    }
  }

  public connect(): void {
    if (this.isDisposed) {
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 实例已disposed，跳过连接`);
      }
      return;
    }
    
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 跳过连接: isConnecting=${this.isConnecting}, readyState=${this.ws?.readyState}`);
      }
      return;
    }

    this.isConnecting = true;
    if (this.config.verboseConsoleOutput) {
      logger.info(`[DEBUG] [${this.instanceId}] 开始连接到WS服务器`);
    }
    logger.info(`尝试连接到 WS 服务器: ${this.config.wsServerUrl}`);

    try {
      this.ws = this.ctx.http.ws(this.config.wsServerUrl);
      this.setupListeners();
    } catch (e) {
      this.isConnecting = false;
      logger.error(`连接失败: ${e.message}`);
      this.scheduleReconnect();
    }
  }

  private setupListeners(): void {
    if (this.config.verboseConsoleOutput) {
      logger.info(`[DEBUG] [${this.instanceId}] 设置WS事件监听器`);
    }

    this.ws!.onopen = () => {
      this.isConnecting = false;
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] WS连接已打开`);
      }
      logger.success('成功连接到 WS 服务器');
      
      if (this.reconnectTimer) {
        clearInterval(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      const connectMsg = `[mclistener-ws-client]\n成功连接到WS: ${this.config.wsServerUrl}`;
      this.sendReport(connectMsg);
    };

    this.ws!.onmessage = (event) => {
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 收到WS消息: ${event.data}`);
      }
      this.handleMessage(event.data as string);
    };

    this.ws!.onclose = (event) => {
      this.isConnecting = false;
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] WS连接关闭事件: code=${event.code}, reason=${event.reason}`);
      }
      logger.warn(`WS 连接已关闭，代码: ${event.code}, 原因: ${event.reason}`);
      
      const disconnectMsg = `[mclistener-ws-client]\nWS连接已断开 (服务器: ${this.config.wsServerUrl})，正在尝试重连...`;
      this.sendReport(disconnectMsg);
      
      this.scheduleReconnect();
    };

    this.ws!.onerror = (error) => {
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] WS连接错误: ${JSON.stringify(error)}`);
      }
      logger.error(`WS 连接错误: ${JSON.stringify(error)}`);
      
      const errorMsg = `[mclistener-ws-client]\nWS连接发生错误 (服务器: ${this.config.wsServerUrl}): ${JSON.stringify(error)}`;
      this.sendReport(errorMsg);
    };
  }

  private scheduleReconnect(): void {
    if (this.isDisposed) {
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 实例已disposed，取消重连`);
      }
      return;
    }
    
    if (this.reconnectTimer) {
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 重连定时器已存在，跳过创建`);
      }
      return;
    }

    if (this.config.verboseConsoleOutput) {
      logger.info(`[DEBUG] [${this.instanceId}] 设置重连定时器`);
    }
    const reconnectMsg = `[mclistener-ws-client]\n5s 后尝试重连 WS 服务器: ${this.config.wsServerUrl}`;
    if (this.config.enableConsoleLogReport) {
      logger.info(reconnectMsg);
    }
    
    this.reconnectTimer = setTimeout(() => {
      if (!this.isDisposed) {
        this.connect();
      } else {
        if (this.config.verboseConsoleOutput) {
          logger.info(`[DEBUG] [${this.instanceId}] 重连定时器触发时实例已disposed，取消重连`);
        }
      }
      this.reconnectTimer = null;
    }, 5000);
  }

  /**
   * 统一发送报告消息（console / 私聊 / 指定频道，各自独立判断）
   */
  private sendReport(msg: string): void {
    if (this.config.enableConsoleLogReport) {
      logger.info(msg);
    }
    if (this.config.enablePrivateReport) {
      this.messageHandler.sendPrivateMessages(msg);
    }
    if (this.config.enableChannelReport) {
      this.messageHandler.sendReportToChannels(msg);
    }
  }

  private handleMessage(message: string): void {
    const msg = this.messageHandler.handleServerMessage(message);
    if (msg) {
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 准备发送消息: ${msg}`);
      }
      this.messageHandler.sendMessageToChannels(msg);
    }
  }

  /**
   * 转发聊天平台消息到服务器
   */
  public forwardPlatformMessageToServer(session: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket 未连接，无法转发消息到服务器');
      return;
    }

    const wsMessage = this.messageHandler.createPlatformToServerMessage(session);
    if (!wsMessage) return;

    try {
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 发送WS消息: ${JSON.stringify(wsMessage)}`);
      }

      this.ws.send(JSON.stringify(wsMessage));
      logger.info(`转发平台消息到服务器: [${wsMessage.group_name}] ${wsMessage.nickname}: ${wsMessage.message}`);
    } catch (e) {
      logger.error(`转发平台消息到服务器失败: ${e.message}`);
    }
  }

  /**
   * 关闭并销毁客户端
   */
  public shutdown(): void {
    if (this.config.verboseConsoleOutput) {
      logger.info(`[DEBUG] [${this.instanceId}] 开始销毁WS客户端实例`);
    }
    
    this.isDisposed = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 已清理重连定时器`);
      }
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 已关闭WebSocket连接`);
      }
    }
    
    logger.info(`[${this.instanceId}] WS客户端实例已销毁`);
  }
}

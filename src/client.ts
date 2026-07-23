import { Context, Logger } from 'koishi';
import { PluginConfig, CommandRequestMessage, CommandResultMessage, CommandSender } from './types';
import { MessageHandler } from './message';

const logger = new Logger('mclistener-ws-client:client');
type ClientWebSocket = ReturnType<Context['http']['ws']> & {
  on(event: 'pong', listener: () => void): void;
  ping(): void;
  terminate(): void;
};

export class MclistenerWsClient {
  private ws: ClientWebSocket | null = null;
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastPongAt = 0;
  private connectionStable = false;
  private serverUrls: string[];
  private currentServerIndex = 0;
  private consecutiveFailures = 0;
  private instanceId: string;
  private isDisposed = false;
  private messageHandler: MessageHandler;
  private pendingRequests: Map<string, { resolve: (value: CommandResultMessage) => void; reject: (reason: Error) => void; timer: NodeJS.Timeout }> = new Map();
  private pendingAllResultCallbacks: Map<string, { callback: (r: CommandResultMessage | null) => void; timer: NodeJS.Timeout }> = new Map();
  private requestCounter = 0;

  constructor(
    private ctx: Context,
    private config: PluginConfig
  ) {
    this.instanceId = Math.random().toString(36).substring(7);
    this.messageHandler = new MessageHandler(ctx, config);
    this.serverUrls = this.buildServerUrlList();
    
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
    
    if (this.isConnecting || (this.ws && this.ws.readyState === this.ws.OPEN)) {
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 跳过连接: isConnecting=${this.isConnecting}, readyState=${this.ws?.readyState}`);
      }
      return;
    }

    const serverUrl = this.serverUrls[this.currentServerIndex];
    if (!serverUrl) {
      logger.error('❌ 没有可用的 WebSocket 服务器地址，请检查 wsServerUrl 配置');
      return;
    }

    this.isConnecting = true;
    this.connectionStable = false;
    if (this.config.verboseConsoleOutput) {
      logger.info(`[DEBUG] [${this.instanceId}] 开始连接到WS服务器`);
    }
    logger.info(`🔌 尝试连接到 WS 服务器: ${serverUrl}`);

    try {
      const wsUrl = this.withToken(serverUrl);
      const socket = this.ctx.http.ws(wsUrl, {
        timeout: this.config.wsConnectTimeoutMs ?? 10000,
      }) as ClientWebSocket;
      this.ws = socket;
      this.setupListeners(socket, serverUrl);
    } catch (e) {
      this.isConnecting = false;
      this.ws = null;
      logger.error(`❌ 连接失败: ${e instanceof Error ? e.message : String(e)}`);
      this.handleConnectionFailure(false);
    }
  }

  private setupListeners(socket: ClientWebSocket, serverUrl: string): void {
    if (this.config.verboseConsoleOutput) {
      logger.info(`[DEBUG] [${this.instanceId}] 设置WS事件监听器`);
    }

    let opened = false;

    socket.onopen = () => {
      if (socket !== this.ws || this.isDisposed) return;
      opened = true;
      this.isConnecting = false;
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] WS连接已打开`);
      }
      logger.success(`✅ 成功连接到 WS 服务器: ${serverUrl}`);
      this.startHeartbeat(socket, serverUrl);
      if (!this.config.enableWsHeartbeat) this.markConnectionStable();

      const connectMsg = `[mclistener-ws-client]\n✅ 成功连接到WS: ${serverUrl}`;
      this.sendReport(connectMsg);
    };

    socket.onmessage = (event) => {
      if (socket !== this.ws || this.isDisposed) return;
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 收到WS消息: ${event.data}`);
      }
      this.handleMessage(event.data as string);
    };

    socket.onclose = (event) => {
      if (socket !== this.ws) return;
      this.ws = null;
      this.isConnecting = false;
      this.stopHeartbeat();
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] WS连接关闭事件: code=${event.code}, reason=${event.reason}`);
      }
      logger.warn(`🔌 WS 连接已关闭，代码: ${event.code}, 原因: ${event.reason}`);

      const disconnectMsg = `[mclistener-ws-client]\n🔌 WS连接已断开 (服务器: ${serverUrl})，正在尝试重连...`;
      this.sendReport(disconnectMsg);

      if (!this.isDisposed) this.handleConnectionFailure(opened);
    };

    socket.onerror = (error) => {
      if (socket !== this.ws || this.isDisposed) return;
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] WS连接错误: ${JSON.stringify(error)}`);
      }
      logger.error(`❌ WS 连接错误: ${JSON.stringify(error)}`);

      const errorMsg = `[mclistener-ws-client]\n❌ WS连接发生错误 (服务器: ${serverUrl}): ${JSON.stringify(error)}`;
      this.sendReport(errorMsg);
    };
  }

  private buildServerUrlList(): string[] {
    const candidates = [this.config.wsServerUrl, ...(this.config.wsFallbackServerUrlList ?? [])]
      .map(url => url?.trim())
      .filter((url): url is string => !!url);
    return [...new Set(candidates)];
  }

  private withToken(serverUrl: string): string {
    if (!this.config.wsToken) return serverUrl;
    const url = new URL(serverUrl);
    url.searchParams.set('token', this.config.wsToken);
    return url.toString();
  }

  private startHeartbeat(socket: ClientWebSocket, serverUrl: string): void {
    this.stopHeartbeat();
    if (!this.config.enableWsHeartbeat) return;

    const intervalMs = Math.max(1000, this.config.wsHeartbeatIntervalMs ?? 30000);
    const timeoutMs = Math.max(intervalMs, this.config.wsHeartbeatTimeoutMs ?? 90000);
    this.lastPongAt = Date.now();

    socket.on('pong', () => {
      if (socket !== this.ws || this.isDisposed) return;
      this.lastPongAt = Date.now();
      this.markConnectionStable();
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 收到 WS Pong: ${serverUrl}`);
      }
    });

    const heartbeat = () => {
      if (socket !== this.ws || socket.readyState !== socket.OPEN || this.isDisposed) return;
      const silenceMs = Date.now() - this.lastPongAt;
      if (silenceMs >= timeoutMs) {
        logger.warn(`💔 WS 心跳超时 (${silenceMs}ms): ${serverUrl}`);
        socket.terminate();
        return;
      }
      try {
        socket.ping();
        if (this.config.verboseConsoleOutput) {
          logger.info(`[DEBUG] [${this.instanceId}] 发送 WS Ping: ${serverUrl}`);
        }
      } catch (e) {
        logger.warn(`💔 WS Ping 发送失败: ${e instanceof Error ? e.message : String(e)}`);
        socket.terminate();
      }
    };

    heartbeat();
    this.heartbeatTimer = setInterval(heartbeat, intervalMs);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private markConnectionStable(): void {
    if (this.connectionStable) return;
    this.connectionStable = true;
    this.consecutiveFailures = 0;
    if (this.config.verboseConsoleOutput) {
      logger.info(`[DEBUG] [${this.instanceId}] WS连接已稳定，重连退避状态已清零`);
    }
  }

  private handleConnectionFailure(immediate: boolean): void {
    if (this.isDisposed || this.serverUrls.length === 0) return;
    this.consecutiveFailures++;
    this.currentServerIndex = (this.currentServerIndex + 1) % this.serverUrls.length;
    this.scheduleReconnect(immediate ? 0 : this.calculateReconnectDelay());
  }

  private calculateReconnectDelay(): number {
    let baseDelay: number;
    if (this.config.wsReconnectStrategy === 'fixed') {
      baseDelay = Math.max(0, this.config.wsReconnectFixedDelayMs ?? 5000);
    } else {
      const initialDelay = Math.max(0, this.config.wsReconnectInitialDelayMs ?? 1000);
      const multiplier = Math.max(1, this.config.wsReconnectMultiplier ?? 2);
      const maxDelay = Math.max(0, this.config.wsReconnectMaxDelayMs ?? 32000);
      const endpointCount = Math.max(1, this.serverUrls.length);
      const exponent = endpointCount === 1
        ? Math.max(0, this.consecutiveFailures - 1)
        : Math.floor(this.consecutiveFailures / endpointCount);
      baseDelay = Math.min(maxDelay, initialDelay * multiplier ** exponent);
    }

    const jitterRatio = Math.min(0.5, Math.max(0, this.config.wsReconnectJitterRatio ?? 0.1));
    const jitteredDelay = baseDelay * (1 + (Math.random() * 2 - 1) * jitterRatio);
    const hardMax = this.config.wsReconnectStrategy === 'exponential'
      ? Math.max(0, this.config.wsReconnectMaxDelayMs ?? 32000)
      : Number.POSITIVE_INFINITY;
    return Math.round(Math.min(hardMax, Math.max(0, jitteredDelay)));
  }

  private scheduleReconnect(delayMs: number): void {
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

    const nextServerUrl = this.serverUrls[this.currentServerIndex];
    const reconnectMsg = delayMs === 0
      ? `[mclistener-ws-client]\n🔌 立即尝试下一个 WS 服务器: ${nextServerUrl}`
      : `[mclistener-ws-client]\n🔌 ${(delayMs / 1000).toFixed(2)}s 后尝试 WS 服务器: ${nextServerUrl}`;
    if (this.config.enableConsoleLogReport) {
      logger.info(reconnectMsg);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDisposed) {
        this.connect();
      } else {
        if (this.config.verboseConsoleOutput) {
          logger.info(`[DEBUG] [${this.instanceId}] 重连定时器触发时实例已disposed，取消重连`);
        }
      }
    }, delayMs);
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
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'command_result') {
        const result = parsed as CommandResultMessage;
        const pending = this.pendingRequests.get(result.request_id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(result.request_id);
          pending.resolve(result);
        }
        const allResults = this.pendingAllResultCallbacks.get(result.request_id);
        if (allResults) {
          allResults.callback(result);
        }
        return;
      }
    } catch {}

    const msg = this.messageHandler.handleServerMessage(message);
    if (msg) {
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 📤 准备发送消息: type=${msg.type}, text=${msg.text}, hasMarkdown=${!!msg.markdown}`);
      }
      this.messageHandler.sendMessageToChannels(msg);
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === this.ws.OPEN;
  }

  public sendCommand(command: string, sender: CommandSender): Promise<CommandResultMessage> {
    if (!this.isConnected()) {
      return Promise.reject(new Error('WebSocket 未连接'));
    }

    this.requestCounter++;
    const request_id = `${Date.now()}-${this.requestCounter}`;

    const request: CommandRequestMessage = {
      type: 'external_command_to_server',
      request_id,
      command,
      sender,
    };

    return new Promise<CommandResultMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request_id);
        reject(new Error('命令执行超时'));
      }, this.config.execCommandTimeoutMs || 10000);

      this.pendingRequests.set(request_id, { resolve, reject, timer });

      try {
        this.ws!.send(JSON.stringify(request));
        if (this.config.verboseConsoleOutput) {
          logger.info(`[DEBUG] [${this.instanceId}] ⚡ 发送命令: ${command}, request_id: ${request_id}`);
        }
      } catch (e) {
        clearTimeout(timer);
        this.pendingRequests.delete(request_id);
        reject(e);
      }
    });
  }

  /**
   * 发送命令（不去重模式）—— 每条 command_result 都回调，超时回调 null
   */
  public sendCommandForAllResults(command: string, sender: CommandSender, onResult: (r: CommandResultMessage | null) => void): void {
    if (!this.isConnected()) {
      onResult(null);
      return;
    }

    this.requestCounter++;
    const request_id = `${Date.now()}-${this.requestCounter}`;

    const request: CommandRequestMessage = {
      type: 'external_command_to_server',
      request_id,
      command,
      sender,
    };

    const timer = setTimeout(() => {
      const entry = this.pendingAllResultCallbacks.get(request_id);
      if (entry) {
        this.pendingAllResultCallbacks.delete(request_id);
        entry.callback(null);
      }
    }, this.config.execCommandTimeoutMs || 10000);

    this.pendingAllResultCallbacks.set(request_id, { callback: onResult, timer });

    try {
      this.ws!.send(JSON.stringify(request));
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] ⚡ 发送命令(allResults): ${command}, request_id: ${request_id}`);
      }
    } catch (e) {
      clearTimeout(timer);
      this.pendingAllResultCallbacks.delete(request_id);
      onResult(null);
    }
  }

  /**
   * 转发聊天平台消息到服务器
   */
  public forwardPlatformMessageToServer(session: any): void {
    const wsMessage = this.messageHandler.createPlatformToServerMessage(session);
    if (!wsMessage) return;

    if (!this.ws || this.ws.readyState !== this.ws.OPEN) {
      logger.warn('❌ WebSocket 未连接，无法转发消息到服务器');
      return;
    }

    try {
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 🔄 发送WS消息: ${JSON.stringify(wsMessage)}`);
      }

      this.ws.send(JSON.stringify(wsMessage));
      logger.info(`🔄 转发平台消息到服务器: [${wsMessage.group_name}] ${wsMessage.nickname}: ${wsMessage.message}`);
    } catch (e) {
      logger.error(`❌ 转发平台消息到服务器失败: ${e.message}`);
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

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('WS客户端已销毁'));
    }
    this.pendingRequests.clear();

    for (const pending of this.pendingAllResultCallbacks.values()) {
      clearTimeout(pending.timer);
      pending.callback(null);
    }
    this.pendingAllResultCallbacks.clear();

    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 已清理重连定时器`);
      }
    }
    
    const socket = this.ws;
    this.ws = null;
    if (socket) {
      try {
        socket.close(1000, 'plugin disposed');
      } catch {
        socket.terminate();
      }
      if (this.config.verboseConsoleOutput) {
        logger.info(`[DEBUG] [${this.instanceId}] 已关闭WebSocket连接`);
      }
    }
    
    logger.info(`🔌 [${this.instanceId}] WS客户端实例已销毁`);
  }
}

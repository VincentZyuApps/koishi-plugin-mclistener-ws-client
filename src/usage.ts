const pkg = require('../package.json')

export const usage = `
<h2>🌐 mclistener-ws-client <small>v${pkg.version}</small></h2>

<p>连接 MCDR 端 WebSocket 服务，将 Minecraft 服务器消息与 Koishi 平台频道互通。</p>

<ul>
  <li><b>服务器 → 平台</b>：转发玩家聊天、加入、离开等事件。</li>
  <li><b>平台 → 服务器</b>：将指定频道消息转发到游戏内。</li>
  <li><b>远程执行</b>：可选启用 <code>mcws.exec</code> 执行服务端命令。</li>
</ul>

<p><b>接入前置：</b>先部署并配置 MCDR 服务端插件，保持 WebSocket 地址和 Token 一致。图片查看与远程命令需要服务端启用 RCON。</p>

<p><b>关键配置：</b>WebSocket 地址、Token、转发目标频道、来源频道、消息过滤、远程命令白名单。</p>

<p>
  文档：
  <a href="https://github.com/VincentZyuApps/koishi-plugin-mclistener-ws-client" target="_blank">GitHub</a>
  /
  <a href="https://gitee.com/vincent-zyu/koishi-plugin-mclistener-ws-client" target="_blank">Gitee</a>
</p>
`

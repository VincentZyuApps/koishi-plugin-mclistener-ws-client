const pkg = require('../package.json')

export const usage = `
<h1>Koishi 插件：mclistener-ws-client</h1>
<h2>🌐 插件版本：v${pkg.version}</h2>

<p>
  <a href="https://www.npmjs.com/package/koishi-plugin-mclistener-ws-client" target="_blank">
    <img src="https://img.shields.io/npm/v/koishi-plugin-mclistener-ws-client?style=flat-square" alt="npm version">
  </a>
  <a href="https://github.com/VincentZyuApps/koishi-plugin-mclistener-ws-client" target="_blank">
    <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
  </a>
  <a href="https://gitee.com/vincent-zyu/koishi-plugin-mclistener-ws-client" target="_blank">
    <img src="https://img.shields.io/badge/Gitee-C71D23?style=for-the-badge&logo=gitee&logoColor=white" alt="Gitee">
  </a>
  <a href="https://qm.qq.com/q/4vjto4V7Di" target="_blank">
    <img src="https://img.shields.io/badge/QQ群-1085190201-12B7F5?style=flat-square&logo=qq&logoColor=white" alt="QQ群">
  </a>
</p>

<p>💬 插件使用问题 / 🐛 Bug反馈 / 👨‍💻 插件开发交流，欢迎加入QQ群：<b>1085190201</b> 🎉</p>
<p>💡 在群里直接艾特我，回复的更快哦~ ✨</p>

<p><b>💡 提示：</b>
  <a href="https://gitee.com/vincent-zyu/koishi-plugin-mclistener-ws-client" target="_blank">
    前往 Gitee README 获得更佳观感 →
    <i>https://gitee.com/vincent-zyu/koishi-plugin-mclistener-ws-client</i>
  </a>
</p>

<hr>

<style>
  .rcon-alert {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 12px 0;
    color: #333;
  }
  @media (prefers-color-scheme: dark) {
    .rcon-alert {
      background: #3a3000;
      border-color: #8b7000;
      color: #ffd700;
    }
  }
</style>
<div class="rcon-alert">
  <strong>⚠️ 前置条件：启用 RCON</strong>
  <p style="margin:8px 0 0 0">
    图片渲染（<code>!!view_image</code>）和远程命令执行功能，需要 Minecraft 服务器启用 RCON。
    <br>
    📖 详见 <a href="https://github.com/VincentZyuApps/mcdr_listener_ws_server#%EF%B8%8F-%E5%89%8D%E7%BD%AE%E6%9D%A1%E4%BB%B6%E5%90%AF%E7%94%A8-rcon" target="_blank">## 服务端MCDR插件 RCON配置文档</a>
  </p>
</div>

<details>
<summary><h2>📖 插件详细说明（点击展开）</h2></summary>

<h2>🎯 功能简介</h2>
<p>🌐 作为 WebSocket 客户端对接 MCDR 插件，实现 Minecraft 服务器与聊天平台之间的双向消息互通。</p>

<h3>🌐 WebSocket 连接</h3>
<ul>
  <li>作为 WebSocket 客户端连接 MCDR 端的 WebSocket 服务端</li>
  <li>支持自动重连，连接状态可通知到私聊/频道/控制台</li>
  <li>🔑 支持 Token 认证，连接时需与服务端 Token 匹配</li>
</ul>

<h3>📤 双向消息转发</h3>
<ul>
  <li><b>服务器 → 聊天平台</b>：玩家在服里聊天自动同步到 QQ/Discord 群</li>
  <li><b>聊天平台 → 服务器</b>：群里发的消息自动转发到游戏内</li>
  <li>支持多平台多频道同时转发</li>
</ul>

<h3>🚪 玩家进出通知</h3>
<ul>
  <li>🎉 玩家加入服务器自动在群里播报</li>
  <li>😢 玩家离开服务器自动在群里播报</li>
  <li>支持自定义消息模板（%PLAYER% 占位符）</li>
</ul>

<h3>💬 消息过滤</h3>
<table>
  <tr><th>过滤方式</th><th>说明</th></tr>
  <tr><td>✅ 白名单前缀</td><td>只转发指定前缀的消息（如 <code>!!</code>）</td></tr>
  <tr><td>❌ 黑名单前缀</td><td>阻止转发指定前缀的消息（如 <code>/</code> 命令）</td></tr>
  <tr><td>🚫 发送者黑名单</td><td>阻止转发指定玩家的消息</td></tr>
  <tr><td>🔍 平台消息前缀检查</td><td>只转发群里指定前缀的消息到服务器</td></tr>
</table>

<h3>✏️ 自定义消息模板</h3>
<ul>
  <li>玩家加入/离开消息模板可自由定制</li>
  <li>聊天消息转发格式可自由定制</li>
  <li>支持 <code>%PLAYER%</code>（玩家名）、<code>%CONTENT%</code>（聊天内容）占位符</li>
</ul>

<h3>🕐 日期时间前缀</h3>
<ul>
  <li>转发到聊天平台时可自动添加日期时间前缀</li>
</ul>

<h3>⚙️ 配置一览</h3>
<table>
  <tr><th>配置分组</th><th>说明</th></tr>
  <tr><td>💬 消息设置</td><td>回复引用开关</td></tr>
  <tr><td>🌐 WebSocket 连接</td><td>服务器地址 + Token 配置</td></tr>
  <tr><td>📊 事件报告</td><td>私聊/频道/控制台通知配置</td></tr>
  <tr><td>📤 转发目的地</td><td>服务器消息要发到哪些平台/频道</td></tr>
  <tr><td>📥 来源平台</td><td>哪些平台/频道的消息要发到服务器</td></tr>
  <tr><td>🚪 玩家加入</td><td>进服通知开关 + 自定义模板</td></tr>
  <tr><td>🚶 玩家离开</td><td>离服通知开关 + 自定义模板</td></tr>
  <tr><td>💬 玩家聊天</td><td>聊天转发开关 + 过滤规则 + 自定义模板</td></tr>
  <tr><td>🔄 平台消息 → 服务器</td><td>聊天平台 转发到 服务器的开关 + 过滤规则</td></tr>
  <tr><td>🔐 远程命令执行</td><td>远程 MC 命令 + 白名单 + 超时控制</td></tr>
  <tr><td>🐛 调试</td><td>详细日志输出</td></tr>
</table>

</details>

<hr>
`

const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.GUN_DATA_DIR ? path.resolve(process.env.GUN_DATA_DIR) : path.join(__dirname, 'data');
const GUN_FILE = path.join(DATA_DIR, 'gun-data.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback（排除 /gun 路径 — Gun WebSocket 和 HTTP API 用这个路径）
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/gun')) {
    // Gun 中继处理：返回空 JSON，Gun 客户端通过 WebSocket 通信
    // HTTP GET /gun 主要用于调试，Gun 实际数据交换走 WebSocket
    res.setHeader('Content-Type', 'application/json');
    res.end('{}');
    return;
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 创建 HTTP server（Express 先注册，Gun 后注册拦截 WebSocket upgrade）
const server = require('http').createServer(app);

// 加载 Gun（必须在 server 创建之后）
const Gun = require('gun');

// 配置 Gun 中继
const peers = [];
const RELAY1 = process.env.GUN_RELAY_1;
const RELAY2 = process.env.GUN_RELAY_2;
if (RELAY1) peers.push(RELAY1);
if (RELAY2) peers.push(RELAY2);

const gun = Gun({
  web: server,
  file: GUN_FILE,
  peers: peers,
  localStorage: false,
  radisk: true,
  axe: false,
});

// 启动后统计节点数（仅用于日志）
gun.on('hi', peer => console.log('[gun] peer connected:', peer.id || peer.wire && peer.wire.url));
gun.on('bye', peer => console.log('[gun] peer disconnected:', peer.id || peer.wire && peer.wire.url));

server.listen(PORT, () => {
  console.log(`[gun-crm] HTTP server listening on http://localhost:${PORT}`);
  console.log(`[gun-crm] Gun relay: ws://localhost:${PORT}/gun`);
  console.log(`[gun-crm] Data file: ${GUN_FILE}`);
  console.log(`[gun-crm] Peers: ${peers.length > 0 ? peers.join(', ') : 'none'}`);
});

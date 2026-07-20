const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.GUN_DATA_DIR ? path.resolve(process.env.GUN_DATA_DIR) : path.join(__dirname, 'data');
const GUN_FILE = path.join(DATA_DIR, 'gun-data.json');
const SEED_FILE = path.join(__dirname, 'data', 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();

// ========== Gun.serve 中间件（处理 CORS 和静态资源） ==========

const Gun = require('gun');
app.use(Gun.serve);

// ========== 关键：拦截 /gun 路径的 HTTP 请求 ==========

// GET /gun → 返回空 JSON（Gun 数据交换走 WebSocket，HTTP GET 仅用于调试）
app.get('/gun', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end('{}');
});
app.get('/gun/*', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end('{}');
});

// POST /gun → 收集请求体后交给 Gun 处理（不由 Express 直接响应）
// Gun.js 注册了 server 上的 request handler，在 Express 处理完后再调用
// 这里用 next('route') 跳过 SPA fallback，让请求体自然流转到 Gun
app.post('/gun', express.raw({ type: '*/*' }), (req, res, next) => {
  next('route'); // 跳过后续匹配，让 Gun 内部 handler 处理
});
app.post('/gun/*', express.raw({ type: '*/*' }), (req, res, next) => {
  next('route');
});

// ========== 静态文件和 SPA fallback ==========

app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — 所有其他 GET 请求返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== 创建 HTTP server + Gun 中继 ==========

const server = require('http').createServer(app);

// 配置 Gun 中继
const peers = [];
const RELAY1 = process.env.GUN_RELAY_1;
const RELAY2 = process.env.GUN_RELAY_2;
if (RELAY1) peers.push(`https://${RELAY1}/gun`);
if (RELAY2) peers.push(`https://${RELAY2}/gun`);

const gun = Gun({
  web: server,
  file: GUN_FILE,
  peers: peers,
  localStorage: false,
  radisk: true,
  axe: false,
});

// ========== 启动时加载种子数据（解决 Render 冷启动无数据问题） ==========

async function loadSeedData() {
  // 如果 radisk 持久化目录已有足够数据，跳过种子加载
  const radiskDir = path.join(__dirname, process.env.GUN_DATA_DIR || 'radata');
  // Gun radisk 默认存储在 GUN_FILE 的同级目录
  // 实际目录名取决于 Gun 内部逻辑，检查多个可能位置
  const possibleRadDirs = [
    path.join(DATA_DIR, 'gun-data.json'),  // Gun radisk 用 file 参数作为目录
    path.join(__dirname, 'radata'),
  ];

  for (const dir of possibleRadDirs) {
    if (fs.existsSync(dir)) {
      try {
        const stat = fs.statSync(dir);
        if (stat.isDirectory()) {
          const files = fs.readdirSync(dir);
          if (files.length > 2) {
            console.log(`[seed] ${dir} 已有持久化数据 (${files.length} 文件)，跳过种子加载`);
            return;
          }
        } else if (stat.isFile() && stat.size > 100) {
          console.log(`[seed] ${dir} 已有持久化数据 (${stat.size} 字节)，跳过种子加载`);
          return;
        }
      } catch (e) { /* ignore, proceed with seed loading */ }
    }
  }

  if (!fs.existsSync(SEED_FILE)) {
    console.log('[seed] 种子文件不存在，跳过');
    return;
  }

  try {
    const raw = fs.readFileSync(SEED_FILE, 'utf8');
    const seed = JSON.parse(raw);
    console.log('[seed] 开始加载种子数据到 Gun 中继...');

    const usersNode = gun.get('jwpz-crm-users-v1');
    const systemNode = gun.get('jwpz-crm-system-v1');

    // 数组序列化为 __JSON__ 前缀字符串（Gun 不支持数组）
    function toGun(obj) {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v)) {
          out[k] = '__JSON__' + JSON.stringify(v);
        } else if (v && typeof v === 'object' && !(v instanceof Date)) {
          out[k] = '__JSON__' + JSON.stringify(v);
        } else {
          out[k] = v === undefined ? '' : v;
        }
      }
      return out;
    }

    // 加载用户
    if (seed.users && seed.users.length > 0) {
      for (const user of seed.users) {
        usersNode.get(user.id).put(toGun(user));
        console.log(`[seed] 用户: ${user.username} (${user.name})`);
      }
    }

    // 加载客户
    if (seed.customers && seed.customers.length > 0) {
      for (const customer of seed.customers) {
        systemNode.get('customers').get(customer.id).put(toGun(customer));
      }
      console.log(`[seed] 客户: ${seed.customers.length} 条`);
    }

    // 加载跟进
    if (seed.followups && seed.followups.length > 0) {
      for (const followup of seed.followups) {
        systemNode.get('followups').get(followup.id).put(toGun(followup));
      }
      console.log(`[seed] 跟进: ${seed.followups.length} 条`);
    }

    // 加载报告
    if (seed.reports && seed.reports.length > 0) {
      for (const report of seed.reports) {
        systemNode.get('reports').get(report.id).put(toGun(report));
      }
      console.log(`[seed] 报告: ${seed.reports.length} 条`);
    }

    // 加载下周计划
    if (seed.nextPlans) {
      for (const [key, plan] of Object.entries(seed.nextPlans)) {
        if (plan) systemNode.get('nextPlans').get(key).put(toGun(plan));
      }
    }

    console.log('[seed] ✅ 种子数据加载完成！');
    // 等待 Gun 把数据写入 radisk 持久化
    await new Promise(r => setTimeout(r, 3000));
    console.log('[seed] 数据已持久化');

  } catch (err) {
    console.error('[seed] ❌ 加载种子数据失败:', err.message);
  }
}

// ========== 启动服务器 ==========

server.listen(PORT, async () => {
  console.log(`[gun-crm] HTTP server listening on http://localhost:${PORT}`);
  console.log(`[gun-crm] Gun relay: ws://localhost:${PORT}/gun`);
  console.log(`[gun-crm] Data file: ${GUN_FILE}`);
  console.log(`[gun-crm] Seed file: ${SEED_FILE}`);
  console.log(`[gun-crm] Peers: ${peers.length > 0 ? peers.join(', ') : 'none (standalone)'}`);

  // 启动后立即加载种子数据（确保首次启动有数据可供登录）
  await loadSeedData();
});

// Gun peer 事件日志
gun.on('hi', peer => console.log('[gun] peer connected:', peer.id || (peer.wire && peer.wire.url)));
gun.on('bye', peer => console.log('[gun] peer disconnected:', peer.id || (peer.wire && peer.wire.url)));

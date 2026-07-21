const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.GUN_DATA_DIR ? path.resolve(process.env.GUN_DATA_DIR) : path.join(__dirname, 'data');
const GUN_FILE = path.join(DATA_DIR, 'gun-data.json');
const SEED_FILE = path.join(__dirname, 'data', 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(express.json()); // 解析 JSON 请求体（REST API 需要）

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

// ========== REST API 端点（供小程序 wx.request 调用） ==========

// fromGun: 将 Gun 序列化数据还原为 JS 对象
function fromGun(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    // 过滤 Gun 内部元数据字段
    if (k === '_' || k === '#') continue;
    if (typeof v === 'string' && v.startsWith('__JSON__')) {
      try { out[k] = JSON.parse(v.slice(8)); } catch { out[k] = v; }
    } else {
      out[k] = v === undefined ? '' : v;
    }
  }
  return out;
}

// toGun: 将 JS 对象序列化为 Gun 存储格式
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

// Gun 数据读取辅助函数（Promise 封装）
function gunOnce(nodePath) {
  return new Promise((resolve) => {
    gun.get(nodePath).once((data) => {
      if (!data) { resolve(null); return; }
      const result = fromGun(data);
      resolve(result);
    }, { wait: 500 }); // 等500ms让Gun读取完成
  });
}

function gunMap(nodePath) {
  return new Promise((resolve) => {
    const items = [];
    gun.get(nodePath).map().once((data, id) => {
      if (data && data !== null) {
        const item = fromGun(data);
        if (item) { item.id = item.id || id; items.push(item); }
      }
    });
    // 等1秒让所有map回调执行完
    setTimeout(() => resolve(items), 1000);
  });
}

// 认证中间件
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: '未登录' });
  }
  // 简易token验证（token = username:timestamp:hash）
  try {
    const parts = token.split(':');
    if (parts.length < 2) return res.status(401).json({ message: 'token无效' });
    req.username = parts[0];
    next();
  } catch {
    res.status(401).json({ message: 'token无效' });
  }
}

// POST /api/login — 登录
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '请输入账号和密码' });
  }

  try {
    // 从 Gun 中查找用户
    const usersData = await gunMap('jwpz-crm-users-v1');
    const user = usersData.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ message: '账号不存在' });
    }
    if (user.password !== password) {
      return res.status(401).json({ message: '密码错误' });
    }

    // 生成简易 token
    const timestamp = Date.now();
    const token = `${username}:${timestamp}:crm`;

    // 加载全量数据
    const customers = await gunMap('jwpz-crm-system-v1/customers');
    const followups = await gunMap('jwpz-crm-system-v1/followups');
    const reports = await gunMap('jwpz-crm-system-v1/reports');
    const users = usersData.map(u => ({ ...u, password: undefined })); // 不返回密码

    res.json({
      token,
      user: { ...user, password: undefined },
      data: { customers, followups, reports, users }
    });
  } catch (err) {
    console.error('[api] login error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/data — 刷新全量数据
app.get('/api/data', authMiddleware, async (req, res) => {
  try {
    const customers = await gunMap('jwpz-crm-system-v1/customers');
    const followups = await gunMap('jwpz-crm-system-v1/followups');
    const reports = await gunMap('jwpz-crm-system-v1/reports');
    const usersData = await gunMap('jwpz-crm-users-v1');
    const users = usersData.map(u => ({ ...u, password: undefined }));

    res.json({ customers, followups, reports, users });
  } catch (err) {
    console.error('[api] data error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/customers — 新建客户
app.post('/api/customers', authMiddleware, async (req, res) => {
  try {
    const data = req.body;
    if (!data.id) data.id = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    data.createdAt = data.createdAt || new Date().toISOString().slice(0, 10);
    data.updatedAt = data.updatedAt || new Date().toISOString().slice(0, 10);

    gun.get('jwpz-crm-system-v1/customers').get(data.id).put(toGun(data));
    res.json({ success: true, id: data.id });
  } catch (err) {
    console.error('[api] create customer error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PUT /api/customers/:id — 更新客户
app.put('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    data.updatedAt = new Date().toISOString().slice(0, 10);

    gun.get('jwpz-crm-system-v1/customers').get(id).put(toGun(data));
    res.json({ success: true });
  } catch (err) {
    console.error('[api] update customer error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// DELETE /api/customers/:id — 删除客户
app.delete('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    gun.get('jwpz-crm-system-v1/customers').get(id).put(null);
    res.json({ success: true });
  } catch (err) {
    console.error('[api] delete customer error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/followups — 新建跟进
app.post('/api/followups', authMiddleware, async (req, res) => {
  try {
    const data = req.body;
    if (!data.id) data.id = 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    data.createdAt = data.createdAt || new Date().toISOString();

    gun.get('jwpz-crm-system-v1/followups').get(data.id).put(toGun(data));
    res.json({ success: true, id: data.id });
  } catch (err) {
    console.error('[api] create followup error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/reports — 新建/更新报告
app.post('/api/reports', authMiddleware, async (req, res) => {
  try {
    const data = req.body;
    if (!data.id) data.id = 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    data.createdAt = data.createdAt || new Date().toISOString();
    data.updatedAt = data.updatedAt || new Date().toISOString();

    gun.get('jwpz-crm-system-v1/reports').get(data.id).put(toGun(data));
    res.json({ success: true, id: data.id });
  } catch (err) {
    console.error('[api] create report error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

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

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const DATA_DIR = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---- helpers ---- */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function uid() { return 'id_' + Date.now() + Math.random().toString(36).slice(2, 7); }
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = seedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { const initial = seedData(); fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2)); return initial; }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/* ---- seed ---- */
function seedData() {
  const today = '2026-07-17';
  return {
    users: [
      { id: 'u_admin', username: 'admin', password: 'admin123', name: '管理员', role: 'admin', businessLine: '', phone: '', monthlyTarget: 0, hireDate: '' },
      { id: 'u_lijun', username: 'lijun', password: '123456', name: '李俊', role: 'sales', businessLine: '预付款包房', phone: '13800000001', monthlyTarget: 100, hireDate: '2026-03-15' },
      { id: 'u_youjun', username: 'youjun', password: '123456', name: '有俊', role: 'sales', businessLine: '智能体平台', phone: '13800000002', monthlyTarget: 50, hireDate: '2026-06-20' },
      { id: 'u_zhang', username: 'zhang', password: '123456', name: '张磊', role: 'sales', businessLine: '品牌加盟', phone: '13800000003', monthlyTarget: 80, hireDate: '2026-01-10' }
    ],
    customers: [
      { id: 'c1', name: '东莞嘉映玥酒店', contactName: '王总', contactPhone: '-', businessLine: '预付款包房', status: 'valid', salesId: 'u_lijun', salesName: '李俊', remark: '从侧面了解到酒店欠了房租，具体还在沟通看差多久的房租。差房租缴纳证明。', intendedAmount: 0, contracts: [], fundUsage: '预付款（房租缴纳）', docsCompletedDate: '', createdAt: '2026-07-15', updatedAt: today },
      { id: 'c2', name: '米兰特酒店', contactName: '负责人', contactPhone: '-', businessLine: '预付款包房', status: 'valid', salesId: 'u_lijun', salesName: '李俊', remark: '和负责人沟通预付款事项，想要20万。老板欠了房产税没有交，还需了解酒店经营情况。', intendedAmount: 20, contracts: [], fundUsage: '预付款（房产税+经营周转）', docsCompletedDate: '', createdAt: '2026-07-16', updatedAt: today },
      { id: 'c3', name: '武汉城市精品酒店', contactName: '老板', contactPhone: '-', businessLine: '预付款包房', status: 'signed', salesId: 'u_lijun', salesName: '李俊', remark: '已打款30万。同时已启动代运营服务（7月13日）。', intendedAmount: 0, contracts: [{ type: '预付款包房', amount: 30, discount: 0.9, date: '2026-07-13' }, { type: '代运营', amount: 5, discount: 1, date: '2026-07-13' }], fundUsage: '预付款（酒店经营）', docsCompletedDate: '2026-07-10', createdAt: '2026-07-05', updatedAt: '2026-07-13' },
      { id: 'c4', name: '城市快捷酒店', contactName: '老板', contactPhone: '-', businessLine: '预付款包房', status: 'signed', salesId: 'u_lijun', salesName: '李俊', remark: '已打款20万。', intendedAmount: 0, contracts: [{ type: '预付款包房', amount: 20, discount: 0.85, date: '2026-07-13' }], fundUsage: '预付款（经营周转）', docsCompletedDate: '2026-07-08', createdAt: '2026-07-08', updatedAt: '2026-07-13' },
      { id: 'c5', name: '章丘城市快捷酒店', contactName: '老板', contactPhone: '-', businessLine: '智能体平台', status: 'valid', salesId: 'u_youjun', salesName: '有俊', remark: '初步沟通拿到方案，和老板在沟通。代运营需求。', intendedAmount: 0, contracts: [], fundUsage: '代运营服务费', docsCompletedDate: '', createdAt: '2026-07-14', updatedAt: today },
      { id: 'c6', name: '某意向酒店A', contactName: '李总', contactPhone: '-', businessLine: '预付款包房', status: 'intent', salesId: 'u_lijun', salesName: '李俊', remark: '30日内有望成交，意向18万。', intendedAmount: 18, contracts: [], fundUsage: '预付款（装修周转）', docsCompletedDate: '', createdAt: '2026-07-10', updatedAt: '2026-07-16' }
    ],
    followups: [
      { id: 'f1', customerId: 'c1', customerName: '东莞嘉映玥酒店', salesId: 'u_lijun', salesName: '李俊', businessLine: '预付款包房', followDate: today, content: '差房租缴纳证明，从侧面了解到酒店欠了房租。', statusChange: 'valid', nextAction: '跟进房租拖欠时长', createdAt: today + ' 18:30' },
      { id: 'f2', customerId: 'c2', customerName: '米兰特酒店', salesId: 'u_lijun', salesName: '李俊', businessLine: '预付款包房', followDate: today, content: '拜访米兰特酒店，和负责人沟通预付款事项。', statusChange: 'valid', nextAction: '了解酒店经营情况', createdAt: today + ' 17:00' },
      { id: 'f3', customerId: 'c5', customerName: '章丘城市快捷酒店', salesId: 'u_youjun', salesName: '有俊', businessLine: '智能体平台', followDate: '2026-07-16', content: '初步沟通拿到方案。', statusChange: 'valid', nextAction: '等老板反馈', createdAt: '2026-07-16 16:00' }
    ],
    reports: [
      { id: 'r1', salesId: 'u_lijun', salesName: '李俊', date: today, businessLine: '预付款包房', todayNewCount: 0, todayHistoryCount: 2, todayValidCount: 1, weekValidCount: 2, weekIntentCount: 1, weekIntentAmount: 38, weekReview: '', signedCustomers: [{ name: '武汉城市精品酒店', amount: 35, discount: 0.9, types: ['预付款包房', '代运营'] }, { name: '城市快捷酒店', amount: 20, discount: 0.85, types: ['预付款包房'] }], problems: '暂无', needHelp: '暂无', summary: '本周签约2家共55万；2家有效客户推进中。', createdAt: today + ' 19:00', updatedAt: today + ' 19:00' }
    ],
    nextPlans: {},
    seed_ver: 'v7'
  };
}

/* ---- auth tokens ---- */
const tokens = {}; // token -> userId

/* ---- API: Login ---- */
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.json({ success: false, msg: '用户名或密码错误' });
  const token = crypto.randomUUID();
  tokens[token] = user.id;
  res.json({
    success: true, token, user,
    data: { users: db.users, customers: db.customers, followups: db.followups, reports: db.reports, nextPlans: db.nextPlans || {} }
  });
});

/* ---- Auth middleware ---- */
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token || !tokens[token]) return res.status(401).json({ error: '未登录' });
  req.userId = tokens[token];
  req.token = token;
  next();
}

/* ---- API: Refresh all data ---- */
app.get('/api/data', auth, (req, res) => {
  const db = readDB();
  res.json({ users: db.users, customers: db.customers, followups: db.followups, reports: db.reports, nextPlans: db.nextPlans || {} });
});

/* ---- API: Customer CRUD ---- */
app.post('/api/customers', auth, (req, res) => {
  const db = readDB();
  const c = req.body;
  if (!c.id) c.id = uid();
  if (!c.createdAt) c.createdAt = todayStr();
  c.updatedAt = todayStr();
  db.customers.push(c);
  writeDB(db);
  res.json({ success: true, customer: c, customers: db.customers });
});

/* ---- API: Customer Bulk Import ---- */
app.post('/api/customers/bulk', auth, (req, res) => {
  const db = readDB();
  const { customers } = req.body;
  if (!Array.isArray(customers) || customers.length === 0) return res.json({ success: false, msg: '无数据' });
  const today = todayStr();
  let added = 0;
  customers.forEach(c => {
    if (!c.name) return; // 跳过无名称
    if (!c.id) c.id = uid();
    if (!c.createdAt) c.createdAt = today;
    c.updatedAt = today;
    if (!c.contracts) c.contracts = [];
    db.customers.push(c);
    added++;
  });
  writeDB(db);
  res.json({ success: true, imported: added, customers: db.customers });
});

app.put('/api/customers/:id', auth, (req, res) => {
  const db = readDB();
  const i = db.customers.findIndex(c => c.id === req.params.id);
  if (i === -1) return res.json({ success: false, msg: '客户不存在' });
  const body = req.body;
  /* handle business line change - reassign sales */
  const oldBiz = db.customers[i].businessLine;
  if (body.businessLine && oldBiz !== body.businessLine) {
    const target = db.users.find(u => u.role === 'sales' && u.businessLine === body.businessLine);
    if (target) { body.salesId = target.id; body.salesName = target.name; }
  }
  db.customers[i] = { ...db.customers[i], ...body, updatedAt: todayStr() };
  writeDB(db);
  res.json({ success: true, customer: db.customers[i], customers: db.customers });
});

app.delete('/api/customers/:id', auth, (req, res) => {
  const db = readDB();
  db.customers = db.customers.filter(c => c.id !== req.params.id);
  db.followups = db.followups.filter(f => f.customerId !== req.params.id);
  writeDB(db);
  res.json({ success: true, customers: db.customers, followups: db.followups });
});

/* ---- API: Followup ---- */
app.post('/api/followups', auth, (req, res) => {
  const db = readDB();
  const f = req.body;
  if (!f.id) f.id = uid();
  db.followups.push(f);
  /* update customer status if changed */
  if (f.statusChange) {
    const ci = db.customers.findIndex(c => c.id === f.customerId);
    if (ci !== -1) { db.customers[ci].status = f.statusChange; db.customers[ci].updatedAt = todayStr(); }
  }
  writeDB(db);
  res.json({ success: true, followup: f, customers: db.customers, followups: db.followups });
});

/* ---- API: Report ---- */
app.post('/api/reports', auth, (req, res) => {
  const db = readDB();
  const r = req.body;
  if (!r.id) r.id = uid();
  const existing = db.reports.findIndex(x => x.id === r.id);
  if (existing !== -1) { db.reports[existing] = { ...db.reports[existing], ...r }; }
  else { db.reports.push(r); }
  writeDB(db);
  res.json({ success: true, reports: db.reports });
});

app.put('/api/reports/:id', auth, (req, res) => {
  const db = readDB();
  const i = db.reports.findIndex(r => r.id === req.params.id);
  if (i === -1) return res.json({ success: false, msg: '报告不存在' });
  db.reports[i] = { ...db.reports[i], ...req.body };
  writeDB(db);
  res.json({ success: true, report: db.reports[i], reports: db.reports });
});

/* ---- API: Next Week Plan ---- */
app.get('/api/nextPlan/:key', auth, (req, res) => {
  const db = readDB();
  res.json({ plan: (db.nextPlans || {})[req.params.key] || '' });
});

app.post('/api/nextPlan/:key', auth, (req, res) => {
  const db = readDB();
  if (!db.nextPlans) db.nextPlans = {};
  db.nextPlans[req.params.key] = req.body.plan;
  writeDB(db);
  res.json({ success: true });
});

/* ---- API: Change Password ---- */
app.post('/api/changePassword', auth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.json({ success: false, msg: '请填写完整' });
  if (newPassword.length < 4) return res.json({ success: false, msg: '新密码至少4位' });
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.json({ success: false, msg: '用户不存在' });
  if (user.password !== oldPassword) return res.json({ success: false, msg: '当前密码不正确' });
  if (oldPassword === newPassword) return res.json({ success: false, msg: '新密码不能与当前密码相同' });
  user.password = newPassword;
  writeDB(db);
  res.json({ success: true });
});

/* ---- API: Export ---- */
app.get('/api/export', auth, (req, res) => {
  const db = readDB();
  res.json({ ...db, exportedAt: new Date().toISOString() });
});

/* ---- API: Reset seed (admin only) ---- */
app.post('/api/reset', auth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '仅管理员可重置' });
  const initial = seedData();
  writeDB(initial);
  res.json({ success: true, data: { users: initial.users, customers: initial.customers, followups: initial.followups, reports: initial.reports, nextPlans: initial.nextPlans } });
});

/* ---- Start server ---- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`久窝朋赞 CRM server running on http://localhost:${PORT}`);
});

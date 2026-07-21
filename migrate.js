// 迁移脚本 — 连接到 Gun 中继推送种子数据
// 用法：node migrate.js [RELAY_URL]
// 默认连接 http://localhost:3000/gun
// 部署后可用：node migrate.js https://jwpz-crm-1.onrender.com/gun
const path = require('path');
const fs = require('fs');
const Gun = require('gun');

const DB_FILE = path.join(__dirname, 'data', 'db.json');
const RELAY = process.argv[2] || 'http://localhost:3000/gun';

if (!fs.existsSync(DB_FILE)) {
  console.error('db.json not found at', DB_FILE);
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

const gun = Gun({
  peers: [RELAY],
  localStorage: false,
  radisk: false,
  file: false
});

function toGun(obj) {
  if (Array.isArray(obj)) {
    return '__JSON__' + JSON.stringify(obj);
  }
  if (obj && typeof obj === 'object') {
    const copy = {};
    for (const [k, v] of Object.entries(obj)) copy[k] = toGun(v);
    return copy;
  }
  return obj;
}

const usersNode = gun.get('jwpz-crm-users-v1');
const systemNode = gun.get('jwpz-crm-system-v1');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log(`Connecting to relay: ${RELAY} ...`);
  await wait(2000);

  console.log('Importing users...');
  for (const u of db.users || []) {
    const id = u.id || 'u_' + u.username;
    usersNode.get(id).put(toGun(u));
    console.log('  user:', u.username, u.name);
    await wait(100);
  }

  console.log('Importing customers...');
  for (const c of db.customers || []) {
    const id = c.id || 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    systemNode.get('customers').get(id).put(toGun(c));
    console.log('  customer:', c.name, c.status);
    await wait(100);
  }

  console.log('Importing followups...');
  for (const f of db.followups || []) {
    const id = f.id || 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    systemNode.get('followups').get(id).put(toGun(f));
    await wait(100);
  }

  console.log('Importing reports...');
  for (const r of db.reports || []) {
    const id = r.id || 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    systemNode.get('reports').get(id).put(toGun(r));
    await wait(100);
  }

  if (db.nextPlans) {
    console.log('Importing nextPlans...');
    for (const [key, val] of Object.entries(db.nextPlans)) {
      systemNode.get('nextPlans').get(key).put(val);
    }
  }

  systemNode.get('meta').put({
    version: '2.0.0',
    importedFrom: 'db.json',
    importedAt: new Date().toISOString()
  });

  console.log('Waiting for data to sync...');
  await wait(5000);
  console.log('Migration complete!');
  process.exit(0);
})();

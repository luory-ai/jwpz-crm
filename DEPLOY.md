# 久窝朋赞 CRM 部署指南

## 方案一：Render 部署（推荐，免费起步）

### 前置条件
- GitHub 账号（没有就注册 https://github.com）
- Render 账号（用 GitHub 登录 https://render.com）

### 步骤

1. **推送代码到 GitHub**
   ```bash
   # 在本目录下
   git remote add origin https://github.com/你的用户名/jwpz-crm.git
   git push -u origin master
   ```
   （需先在 GitHub 新建仓库 jwpz-crm，不要勾选 README）

2. **在 Render 创建服务**
   - 登录 https://dashboard.render.com
   - 点 `New +` → `Blueprint`
   - 选择刚推送的 GitHub 仓库
   - Render 会自动读取 `render.yaml` 配置
   - 点 `Apply` 开始部署

3. **部署完成后**
   - Render 会给一个 URL，如 `https://jwpz-crm.onrender.com`
   - 所有销售用这个 URL 访问，数据实时同步
   - 默认账号：admin / admin123（首次登录请改密码）

### 数据持久化说明
- **免费套餐**：服务 15 分钟无访问会休眠（首次访问慢约 30 秒），重启后数据会重置为种子数据
- **Starter 套餐（$7/月）**：不休眠 + 可加持久磁盘（数据永久保存）
  - 升级后在 `render.yaml` 取消 `disk` 配置的注释

---

## 方案二：Railway 部署（有持久卷，免费 $5/月额度）

1. 访问 https://railway.app 用 GitHub 登录
2. `New Project` → `Deploy from GitHub repo` 选仓库
3. Railway 自动检测 Node.js，执行 `npm install` + `node server.js`
4. 在 `Variables` 加 `DB_PATH=/data`，在 `Volumes` 创建持久卷挂载到 `/data`
5. 部署完成后获得公网 URL

---

## 方案三：自有云服务器（阿里云/腾讯云轻量）

```bash
# 服务器上
git clone https://github.com/你的用户名/jwpz-crm.git
cd jwpz-crm
npm install
# 用 pm2 守护进程
npm install -g pm2
pm2 start server.js --name jwpz-crm
pm2 save && pm2 startup
# 配置 nginx 反向代理 + 域名 + HTTPS
```

---

## 本地开发

```bash
cd crm-system
npm install
node server.js
# 访问 http://localhost:3000
```

## 演示账号
- 管理员：admin / admin123
- 销售：lijun / 123456（预付款包房）
- 销售：youjun / 123456（智能体平台）
- 销售：zhang / 123456（品牌加盟）

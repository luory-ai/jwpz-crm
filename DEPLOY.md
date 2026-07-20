# 久窝朋赞 CRM — Gun.js 对等同步版 部署指南

## 架构说明

本版本使用 Gun.js 对等同步架构，无主从关系：
- 任何一端写入数据立即生效，异步同步到所有在线节点
- 中继服务器只做转发 + 持久化，不决定数据对错
- 本地和公网访问同一组中继、同一数据节点 ID

## Render 部署（推荐）

### 前置条件
- GitHub 账号
- Render 账号（用 GitHub 登录 https://render.com）

### 步骤

1. **推送代码到 GitHub**
   ```bash
   git remote add origin https://github.com/luory-ai/jwpz-crm.git
   git push -u origin main
   ```

2. **在 Render 创建服务**
   - 登录 https://dashboard.render.com
   - 点 `New +` → `Blueprint`
   - 选择 GitHub 仓库 `luory-ai/jwpz-crm`
   - Render 自动读取 `render.yaml` 配置
   - 点 `Apply` 开始部署

3. **部署完成后**
   - Render 给一个 URL，如 `https://jwpz-crm-1.onrender.com`
   - 前端 GUN_PEERS 已配置该 URL，自动连接
   - 默认账号：admin / admin123

4. **数据初始化**
   - 首次部署后，Render 中继数据为空
   - 打开前端页面 → 登录（admin/admin123）
   - 数据会从其他在线节点（如本地浏览器缓存）自动同步
   - 或运行迁移：`node migrate.js`（需本地服务器运行中）

### 数据持久化说明
- **免费套餐**：服务 15 分钟无访问会休眠，重启后 radisk 数据清空
- **Gun 对等架构优势**：重启后任何在线客户端会自动将数据同步回中继
- **Starter 套餐（$7/月）**：不休眠 + 可加持久磁盘（取消 render.yaml 中 disk 注释）

## 本地开发

```bash
cd gun-crm
npm install
node server.js
# 访问 http://localhost:3000
```

## 数据迁移

```bash
# 确保服务器在运行，然后执行迁移脚本
node migrate.js
# 脚本会连接 localhost:3000 推送 data/db.json 中的种子数据
```

## 演示账号
- 管理员：admin / admin123
- 销售：lijun / 123456（预付款包房）
- 销售：youjun / 123456（智能体平台）
- 销售：zhang / 123456（品牌加盟）

## Gun 数据节点
- `jwpz-crm-users-v1`：用户数据
- `jwpz-crm-system-v1`：业务数据（客户、跟进、报告、计划）
- 数组字段序列化为 `__JSON__` 前缀字符串（Gun 不支持原生数组）

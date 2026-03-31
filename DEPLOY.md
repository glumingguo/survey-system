# 问卷系统部署指南（方案一：Vercel + Render）

## 部署架构

```
用户浏览器 → Vercel (前端) → Render (后端 API)
```

## 前置条件

- GitHub 账号
- Vercel 账号（可用 GitHub 登录）
- Render 账号（可用 GitHub 登录）

---

## 步骤一：推送代码到 GitHub

```bash
cd survey-system

# 初始化 Git（如果尚未初始化）
git init

# 添加所有文件
git add .

# 提交代码
git commit -m "Prepare for deployment"

# 在 GitHub 创建仓库后，添加远程地址
git remote add origin https://github.com/<你的用户名>/<仓库名>.git

# 推送
git push -u origin main
```

---

## 步骤二：部署后端到 Render

1. 登录 [Render](https://render.com/)
2. 点击 **New +** → **Web Service**
3. 选择 **Build and deploy from a Git repository**
4. 选择你的 GitHub 仓库
5. 配置如下：
   - **Name**: `survey-system-api`
   - **Root Directory**: `survey-system`（或保持空）
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
6. 点击 **Create Web Service**
7. 等待部署完成，复制生成的 URL（如 `https://survey-system-api.onrender.com`）

---

## 步骤三：更新 Vercel 配置

编辑 `vercel.json`，将 `destination` 替换为你的 Render URL：

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://你的-render-url/api/:path*" },
    { "source": "/uploads/:path*", "destination": "https://你的-render-url/uploads/:path*" }
  ]
}
```

---

## 步骤四：部署前端到 Vercel

1. 登录 [Vercel](https://vercel.com/)
2. 点击 **Add New...** → **Project**
3. 选择你推送的 GitHub 仓库
4. 配置如下：
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. 点击 **Deploy**

---

## 步骤五：验证部署

部署完成后，访问 Vercel 提供的 URL（如 `https://survey-system.vercel.app`）

测试以下功能：
- [ ] 问卷列表页面正常加载
- [ ] 创建新问卷
- [ ] 分享问卷链接
- [ ] 填写问卷
- [ ] 查看统计数据

---

## 步骤六：配置心跳机制（防止服务休眠）

Render 免费版 15 分钟无流量会休眠。我们配置一个定时访问来保持服务活跃。

### 方案：使用 UptimeRobot 心跳

1. 登录 [UptimeRobot](https://uptimerobot.com/)（免费注册）
2. 点击 **Add New Monitor**
3. 配置：
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `Survey API Heartbeat`
   - **URL**: 你的 Render API 地址（如 `https://survey-system-api.onrender.com/api/surveys`）
   - **Monitoring Interval**: `5 minutes`（5 分钟检查一次）
4. 点击 **Create Monitor**

这样 UptimeRobot 会每 5 分钟自动访问你的 API，保持服务活跃状态。

> **注意**：UptimeRobot 第一次检查时会唤醒服务，之后每 5 分钟访问一次，服务就永远不会休眠了。

---

## 注意事项

1. **服务休眠**：配置心跳机制后，服务将保持 24 小时运行
2. **数据持久化**：免费版重启后数据会丢失！重要数据请定期备份到本地
3. **免费额度**：UptimeRobot 免费版支持 50 个监控，足够使用

---

## 数据备份（重要！）

由于 Render 免费版数据可能丢失，请在本地定期备份：

```bash
# 每次重要操作后，下载 data 目录
# 在 Render 后台 → Files → 下载 data 文件夹
```

---

## 后续迁移到方案二

如果方案一稳定后需要迁移到云服务器，请参考 `DEPLOY_CLOUD_SERVER.md`。

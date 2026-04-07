# 问卷系统 - 本地部署指南

## 环境要求

- Node.js 18+ (推荐 v20)
- PostgreSQL 14+ (推荐 v16)
- npm 或 yarn

---

## 第一步：安装 PostgreSQL

### Windows (使用 PostgreSQL 安装包)

1. 下载 PostgreSQL: https://www.postgresql.org/download/windows/
2. 安装时记住设置的 **sa 密码**
3. 默认端口：5432

### 验证安装

```powershell
psql --version
```

---

## 第二步：创建数据库

1. 打开 pgAdmin 或使用命令行

2. 创建数据库：
```sql
CREATE DATABASE survey_system;
```

3. 创建用户（可选）：
```sql
CREATE USER survey_admin WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE survey_system TO survey_admin;
```

---

## 第三步：配置后端

1. 创建环境变量文件：

在 `survey-system/server/` 目录下创建 `.env` 文件：

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/survey_system
JWT_SECRET=your-secret-key-change-in-production
PORT=3002
```

**注意**：将 `your_password` 替换为你的 PostgreSQL sa 密码。

---

## 第四步：安装依赖

### 安装后端依赖

```powershell
cd c:\Users\lumin\WorkBuddy\20260317140121\survey-system\server
npm install
```

### 安装前端依赖

```powershell
cd c:\Users\lumin\WorkBuddy\20260317140121\survey-system
npm install
```

---

## 第五步：启动后端

```powershell
cd c:\Users\lumin\WorkBuddy\20260317140121\survey-system\server
npm start
```

应该看到：
```
问卷系统后端服务运行在 http://localhost:3002
```

---

## 第六步：启动前端

```powershell
cd c:\Users\lumin\WorkBuddy\20260317140121\survey-system
npm run dev
```

应该看到类似：
```
VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

---

## 第七步：配置前端 API 地址

如果前端无法连接到后端，创建一个 `.env.local` 文件在项目根目录：

```env
VITE_API_BASE=http://localhost:3002
```

然后重启前端开发服务器。

---

## 访问应用

打开浏览器访问：http://localhost:5173

---

## 常见问题

### 1. 数据库连接失败

检查：
- PostgreSQL 服务是否运行
- `.env` 文件中的 `DATABASE_URL` 是否正确
- 密码是否正确

### 2. 端口被占用

修改 `.env` 中的 `PORT`：
```env
PORT=3003
```

### 3. 前端无法连接后端

检查浏览器控制台的网络请求，确认 API 请求地址是否正确。

---

## 停止服务

- 后端：`Ctrl + C`
- 前端：`Ctrl + C`

---

## 生产环境准备（将来迁移到阿里云时）

1. 设置环境变量（不要放在代码仓库中）
2. 使用 PM2 或类似工具管理进程
3. 配置 Nginx 反向代理
4. 使用 HTTPS

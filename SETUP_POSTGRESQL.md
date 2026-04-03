# PostgreSQL 持久化改造 - 操作指南

## 一、推送代码到 GitHub

网络恢复后执行：
```bash
cd c:/Users/lumin/WorkBuddy/20260317140121/survey-system
git push origin main
```

## 二、Railway 上添加 PostgreSQL 数据库

1. 登录 https://railway.app
2. 进入项目 `survey-system-api`
3. 点击 **「+ New」** → **「Database」** → **「Add PostgreSQL」**
4. 等待数据库创建完成

## 三、配置 DATABASE_URL 环境变量

1. 点击后端服务 `survey-system-api` → **「Variables」**
2. 添加变量：
   - Key: `DATABASE_URL`
   - Value: 引用 PostgreSQL 的 `DATABASE_URL`（点击 Variables 输入框右侧的引用按钮）
3. 保存后 Railway 自动重新部署

## 四、部署完成后初始化管理员（PowerShell）

```powershell
# 注册管理员账号（S驯养灵魂 会自动获得 admin 权限）
Invoke-RestMethod -Uri "https://survey-system-api-production.up.railway.app/api/auth/register" `
  -Method Post -ContentType "application/json" `
  -Body '{"username":"S驯养灵魂","email":"admin@survey.com","password":"guo340015"}'

# 验证登录
Invoke-RestMethod -Uri "https://survey-system-api-production.up.railway.app/api/auth/login" `
  -Method Post -ContentType "application/json" `
  -Body '{"username":"S驯养灵魂","password":"guo340015"}'
```

## 数据持久化说明

| 之前 | 之后 |
|------|------|
| LowDB (db.json 文件) | PostgreSQL 数据库 |
| 每次部署被重置 | 数据永久保存 |
| 单文件 JSON | 关系型数据库 |

## 数据库表结构

- `users` - 用户账号
- `surveys` - 问卷（data 字段存 JSONB）
- `responses` - 答卷
- `settings` - 系统设置（邮件配置等）
- `short_links` - 短链接

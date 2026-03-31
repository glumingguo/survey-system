# 云服务器部署指南（方案二）

> 本文档为方案二（云服务器部署）预留。方案一测试稳定后，可按此文档迁移。

## 服务器要求

- **系统**：Ubuntu 20.04+ / CentOS 8+
- **配置**：1核2G 以上
- **带宽**：2M 以上

## 部署步骤

### 1. 初始化服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Nginx
sudo apt install -y nginx

# 安装 Git
sudo apt install -y git
```

### 2. 上传项目

```bash
# 克隆项目（或通过 FTP 上传）
git clone <your-repo-url> /var/www/survey-system
cd /var/www/survey-system

# 安装依赖
npm install
```

### 3. 配置 Nginx

创建 `/etc/nginx/sites-available/survey-system`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/survey-system/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3002/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 上传文件
    location /uploads/ {
        proxy_pass http://127.0.0.1:3002/uploads/;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/survey-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. 配置 Systemd 服务

创建 `/etc/systemd/system/survey-api.service`：

```ini
[Unit]
Description=Survey System API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/survey-system
ExecStart=/usr/bin/node server/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable survey-api
sudo systemctl start survey-api
```

### 5. 配置 HTTPS（可选）

使用 Let's Encrypt 免费证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 6. 数据备份

建议定期备份 `/var/www/survey-system/data` 目录。

---

## 迁移 Checklist

从方案一迁移到方案二时：

- [ ] 导出方案一的数据文件（`data/` 目录）
- [ ] 在新服务器创建相同目录结构
- [ ] 导入数据文件
- [ ] 更新 `vercel.json` 中的 API 指向新服务器
- [ ] 重新部署前端到 Vercel（或一并部署到服务器）

## 常用命令

```bash
# 查看 API 日志
sudo journalctl -u survey-api -f

# 重启 API 服务
sudo systemctl restart survey-api

# 查看 API 状态
sudo systemctl status survey-api
```

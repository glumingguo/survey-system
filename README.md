# 自建问卷系统

一个完全自主可控的问卷调查系统，支持数据安全、隐私保护。

## 功能特性

### ✅ 已实现功能

1. **多题型支持**
   - 单选题（支持设置必填）
   - 多选题
   - 填空题
   - 问答题
   - 文件上传（支持图片、文档）

2. **题目增强**
   - 支持题目描述
   - 支持插入示例图片
   - 支持必填项设置

3. **数据统计与分析**
   - 实时数据统计
   - 图表展示（柱状图、饼图）
   - 答卷列表查看
   - 详细答卷内容查看

4. **分享功能**
   - 短链接生成
   - 二维码生成
   - 支持扫码填写

5. **邮件通知**
   - 问卷提交后自动发送邮件
   - 支持自定义 SMTP 服务器
   - 支持发送测试邮件

6. **文件管理**
   - 答题者可上传图片和文档
   - 文件大小限制（10MB）
   - 文件列表查看和下载

7. **用户界面**
   - 现代化 UI 设计
   - 响应式布局
   - 中文界面

## 技术栈

- **前端**: React + TypeScript + Vite + Ant Design + Recharts
- **后端**: Node.js + Express
- **数据库**: LowDB (JSON 文件数据库)
- **文件存储**: 本地存储（可扩展为云存储）
- **邮件**: Nodemailer
- **二维码**: qrcode

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
# 启动后端服务器
npm run server

# 启动前端开发服务器（新终端）
npm run client

# 或者同时启动前后端
npm run dev
```

### 访问应用

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001

## 使用指南

### 1. 创建问卷

1. 访问后台管理系统
2. 点击"创建新问卷"
3. 填写问卷标题和描述
4. 添加问题（支持多种题型）
5. 保存草稿或发布问卷

### 2. 分享问卷

创建问卷后，可以：
- 生成二维码，供用户扫码填写
- 生成短链接，方便分享
- 复制问卷链接

### 3. 查看统计

- 在问卷列表中点击"统计分析"
- 查看图表化的数据统计
- 查看详细的答卷列表

### 4. 配置邮件

1. 进入"邮件配置"页面
2. 填写 SMTP 服务器信息
3. 测试邮件发送
4. 保存配置

## 数据安全

- **数据主权**: 所有数据存储在本地服务器
- **隐私保护**: 不依赖第三方服务
- **文件安全**: 上传文件存储在本地
- **备份支持**: 数据库为 JSON 文件，易于备份

## 项目结构

```
survey-system/
├── server/              # 后端代码
│   ├── index.js        # 主服务器文件
│   ├── uploads/        # 文件上传目录
│   └── data/          # 数据存储目录
├── src/               # 前端代码
│   ├── components/    # React 组件
│   ├── App.tsx       # 主应用组件
│   └── main.tsx      # 应用入口
├── package.json       # 项目配置
└── vite.config.ts    # Vite 配置
```

## API 接口

### 问卷管理
- `GET /api/surveys` - 获取问卷列表
- `GET /api/surveys/:id` - 获取问卷详情
- `POST /api/surveys` - 创建问卷
- `PUT /api/surveys/:id` - 更新问卷
- `DELETE /api/surveys/:id` - 删除问卷

### 答卷管理
- `GET /api/surveys/:id/responses` - 获取答卷列表
- `POST /api/surveys/:id/responses` - 提交答卷
- `GET /api/surveys/:id/statistics` - 获取统计数据

### 分享功能
- `GET /api/surveys/:id/qrcode` - 获取二维码
- `POST /api/shortlink` - 生成短链接

### 文件上传
- `POST /api/upload` - 上传文件

### 邮件配置
- `GET /api/settings/email` - 获取邮件配置
- `POST /api/settings/email` - 更新邮件配置

## 部署建议

### 开发环境
直接运行 `npm run dev` 即可。

### 生产环境

1. **构建前端**
```bash
npm run build
```

2. **使用 PM2 启动后端**
```bash
pm2 start server/index.js --name survey-system
```

3. **配置 Nginx**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/survey-system/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        proxy_pass http://localhost:3001;
    }
}
```

## 注意事项

1. **文件上传**: 默认限制单文件 10MB，可在代码中调整
2. **数据备份**: 定期备份 `server/data/db.json` 文件
3. **邮件配置**: 使用邮箱授权码而非密码
4. **端口占用**: 确保端口 3001（后端）和 5173（前端）未被占用

## 扩展功能建议

- [ ] 用户认证和权限管理
- [ ] 问卷模板功能
- [ ] 数据导出（Excel、CSV）
- [ ] 问卷逻辑跳转
- [ ] 多语言支持
- [ ] 移动端 App

## 许可证

MIT License

## 技术支持

如有问题，请查看代码注释或联系开发者。

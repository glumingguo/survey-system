# Node.js 基础镜像
FROM node:22-alpine

# 设置工作目录为 /app
WORKDIR /app

# 复制 server 目录的 package 文件
COPY server/package*.json ./

# 安装依赖
RUN npm install

# 复制 server 源码
COPY server/ ./

# Railway 会自动设置 PORT 环境变量
# 使用 $PORT 如果存在，否则默认 3000
ENV PORT=${PORT:-3000}

# 暴露端口
EXPOSE $PORT

# 启动命令
CMD ["node", "index.js"]

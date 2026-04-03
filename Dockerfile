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

# 暴露端口
EXPOSE 3000

# 启动命令 - 直接使用 node index.js
CMD ["node", "index.js"]

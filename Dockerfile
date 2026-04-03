# Node.js 基础镜像
FROM node:22-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 到工作目录
COPY server/package*.json ./

# 安装依赖（包括 pg）
RUN npm install

# 复制服务端代码
COPY server/ ./

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "index.js"]

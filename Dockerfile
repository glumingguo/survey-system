# Node.js 基础镜像
FROM node:22-alpine

# 设置工作目录
WORKDIR /app

# 复制整个项目
COPY . ./

# 进入 server 目录并安装依赖
WORKDIR /app/server
RUN npm install

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "index.js"]

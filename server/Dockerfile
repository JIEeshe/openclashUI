# 卡密验证API服务器 Docker镜像
FROM node:18-alpine

WORKDIR /app

# 安装依赖
RUN apk add --no-cache libc6-compat

# 复制依赖文件
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 创建用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# 创建数据和日志目录
RUN mkdir -p /app/data /app/logs && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "license-api-server.js"]

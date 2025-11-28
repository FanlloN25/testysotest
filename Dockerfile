# Multi-stage Dockerfile для защищенной системы аутентификации
# Этап 1: Сборка зависимостей
FROM node:18-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Этап 2: Production образ
FROM node:18-alpine AS production

# Устанавливаем дополнительные пакеты для безопасности
RUN apk add --no-cache \
    dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Создаем рабочую директорию
WORKDIR /app

# Копируем node_modules из builder этапа
COPY --from=builder /app/node_modules ./node_modules

# Копируем исходный код
COPY . .

# Устанавливаем правильные права доступа
RUN chown -R nodejs:nodejs /app
USER nodejs

# Создаем необходимые директории
RUN mkdir -p logs ssl config

# Настройка health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Экспортируем порт
EXPOSE 3000

# Настройка переменных окружения по умолчанию
ENV NODE_ENV=production
ENV PORT=3000

# Запуск приложения
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "account-api.js"]

# Метаданные образа
LABEL maintainer="SoftAI Security Team" \
      version="1.0.0" \
      description="Продвинутая система аутентификации и управления аккаунтами" \
      security.level="high" \
      security.features="2fa,jwt,rate-limiting,input-sanitization"

# === АЛЬТЕРНАТИВНЫЕ ВАРИАНТЫ РАЗВЕРТЫВАНИЯ ===

# Вариант для development (раскомментируйте для разработки)
# FROM node:18-alpine
# WORKDIR /app
# COPY package*.json ./
# RUN npm install
# COPY . .
# EXPOSE 3000
# CMD ["npm", "run", "dev"]

# Вариант для testing
# FROM node:18-alpine AS testing
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci
# COPY . .
# CMD ["npm", "test"]
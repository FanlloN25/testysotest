#!/bin/bash

# VibeCord Secure Authentication System - Production Startup Script
# Для бизнес использования

set -e

echo "🚀 Запуск VibeCord Secure Authentication System..."
echo "📅 $(date)"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода цветных сообщений
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Проверка Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js не установлен! Установите Node.js 18+ и попробуйте снова."
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="18.0.0"

if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION'))" 2>/dev/null || [ $? -eq 1 ]; then
    print_error "Node.js версия $NODE_VERSION слишком старая! Требуется 18.0.0+"
    exit 1
fi

print_status "Node.js версия $NODE_VERSION OK"

# Проверка .env файла
if [ ! -f ".env" ]; then
    print_warning ".env файл не найден!"
    print_warning "Скопируйте .env.example в .env и заполните Firebase данными:"
    print_warning "cp .env.example .env"
    exit 1
fi

print_status ".env файл найден"

# Проверка Firebase настроек
if grep -q "YOUR_PROJECT_ID" .env || grep -q "YOUR_SERVICE_ACCOUNT" .env; then
    print_error "НЕ ЗАПОЛНЕНЫ FIREBASE НАСТРОЙКИ!"
    echo ""
    echo "📋 ИНСТРУКЦИЯ ПО НАСТРОЙКЕ FIREBASE:"
    echo "1. Перейдите на https://console.firebase.google.com"
    echo "2. Создайте новый проект или выберите существующий"
    echo "3. Включите Authentication и Firestore Database"
    echo "4. Перейдите в Project Settings > Service Accounts"
    echo "5. Нажмите 'Generate new private key'"
    echo "6. Сохраните файл как config/firebase-service-account.json"
    echo "7. Скопируйте данные из файла в .env"
    echo ""
    exit 1
fi

print_status "Firebase настройки заполнены"

# Проверка JWT секрета
if grep -q "vibecord_production_super_secret_2024_business_security_key_change_immediately" .env; then
    print_warning "JWT_SECRET не изменен! Используйте уникальный секрет для production"
fi

print_status "JWT секрет настроен"

# Создание директорий
mkdir -p logs ssl config

# Установка зависимостей
echo ""
echo "📦 Установка зависимостей..."
if npm install; then
    print_status "Зависимости установлены успешно"
else
    print_error "Ошибка установки зависимостей"
    exit 1
fi

# Запуск в зависимости от режима
echo ""
echo "🎯 Выберите режим запуска:"
echo "1. Development (для тестирования)"
echo "2. Production с Docker (рекомендуется для бизнеса)"
echo "3. Production без Docker"
read -p "Введите номер (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🛠️  Запуск в development режиме..."
        print_warning "Development режим - НЕ ДЛЯ ПРОДАКШН!"
        npm run dev
        ;;
    2)
        echo ""
        echo "🐳 Запуск с Docker..."
        if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
            print_warning "Убедитесь что .env настроен корректно"
            docker-compose up -d
            echo ""
            print_status "Docker контейнеры запущены!"
            print_status "Проверьте статус: docker-compose ps"
            print_status "Просмотр логов: docker-compose logs -f auth-api"
        else
            print_error "Docker или Docker Compose не установлен!"
            echo "Установите Docker: https://docs.docker.com/get-docker/"
        fi
        ;;
    3)
        echo ""
        echo "🚀 Запуск production режима..."
        if command -v pm2 &> /dev/null; then
            pm2 start account-api.js --name vibecord-auth --env production
            pm2 startup
            pm2 save
            print_status "PM2 демон запущен!"
            print_status "Управление: pm2 status | pm2 logs | pm2 restart vibecord-auth"
        else
            print_warning "PM2 не найден, запуск через node..."
            NODE_ENV=production npm start
        fi
        ;;
    *)
        print_error "Неверный выбор!"
        exit 1
        ;;
esac

echo ""
print_status "🎉 VibeCord Secure Authentication System готова к работе!"
echo ""
echo "📊 Статус системы:"
echo "🌐 API: http://localhost:3000/api/system/status"
echo "❤️  Health: http://localhost:3000/api/health"
echo ""
echo "🔐 API Endpoints:"
echo "POST /api/auth/register - Регистрация"
echo "POST /api/auth/login - Вход"
echo "GET  /api/account/profile - Профиль (требует авторизацию)"
echo ""
echo "📚 Документация: SECURITY-DOCS.md"
echo "🐛 Issues: https://github.com/your-org/vibecord-secure-auth/issues"
echo ""

# Тест запуска
echo "🧪 Тестирование системы..."
sleep 2

if curl -s http://localhost:3000/api/health > /dev/null; then
    print_status "✅ Система отвечает корректно!"
else
    print_warning "⚠️  Система может еще запускаться, подождите немного..."
fi

echo ""
echo "🚀 СИСТЕМА ГОТОВА К BUSINESS ИСПОЛЬЗОВАНИЮ!"
echo "📞 Поддержка: security@vibecord.com"
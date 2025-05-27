#!/bin/bash

# Скрипт деплоя HSE Portfolio Bot на VPS
# Использование: ./deploy.sh

set -e

echo "🚀 Начинаю деплой HSE Portfolio Bot..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода цветного текста
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ]; then
    print_error "package.json не найден. Убедитесь, что вы в корневой директории проекта."
    exit 1
fi

# Проверяем наличие .env файла
if [ ! -f ".env" ]; then
    print_warning ".env файл не найден. Создайте его на сервере после деплоя."
fi

print_status "Устанавливаем системные зависимости для Chrome/Puppeteer..."
# Обновляем список пакетов
sudo apt-get update

# Устанавливаем зависимости для Chrome
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

print_status "Обновляем зависимости..."
npm install --production

print_status "Создаем необходимые директории..."
mkdir -p logs
mkdir -p data
mkdir -p assets/generated

print_status "Устанавливаем PM2 глобально (если не установлен)..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    print_status "PM2 уже установлен"
fi

print_status "Останавливаем предыдущую версию бота (если запущена)..."
pm2 stop hse-portfolio-bot 2>/dev/null || true
pm2 delete hse-portfolio-bot 2>/dev/null || true

print_status "Очищаем старые временные файлы..."
chmod +x cleanup.sh
./cleanup.sh

print_status "Запускаем бота через PM2..."
pm2 start ecosystem.config.js

print_status "Сохраняем конфигурацию PM2..."
pm2 save

print_status "Настраиваем автозапуск PM2..."
pm2 startup

print_status "Показываем статус..."
pm2 status

echo ""
print_status "✅ Деплой завершен успешно!"
echo ""
echo "📋 Полезные команды:"
echo "  pm2 status           - статус процессов"
echo "  pm2 logs             - просмотр логов"
echo "  pm2 restart all      - перезапуск всех процессов"
echo "  pm2 stop all         - остановка всех процессов"
echo "  pm2 monit            - мониторинг в реальном времени"
echo ""
echo "📁 Логи сохраняются в директории ./logs/"
echo "📊 Данные пользователей в ./data/users.json"
echo ""
print_warning "Не забудьте создать .env файл с токенами!" 
#!/bin/bash

# Скрипт для установки зависимостей Chrome/Puppeteer на Linux сервере
# Использование: ./fix-chrome-deps.sh

set -e

echo "🔧 Устанавливаю зависимости для Chrome/Puppeteer..."

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

# Проверяем права sudo
if ! sudo -n true 2>/dev/null; then
    print_error "Этот скрипт требует права sudo для установки системных пакетов."
    exit 1
fi

print_status "Обновляем список пакетов..."
sudo apt-get update

print_status "Устанавливаем зависимости для Chrome..."
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

print_status "Устанавливаю дополнительные шрифты..."
sudo apt-get install -y \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    fonts-liberation \
    fonts-noto-color-emoji

print_status "Проверяю установку Puppeteer..."
if [ -d "node_modules/puppeteer" ]; then
    print_status "Переустанавливаю Puppeteer для загрузки Chrome..."
    npm rebuild puppeteer
else
    print_warning "Puppeteer не найден в node_modules. Убедитесь, что npm install был выполнен."
fi

print_status "✅ Зависимости установлены успешно!"
echo ""
print_status "Теперь перезапустите бота:"
echo "  pm2 restart hse-portfolio-bot"
echo ""
print_status "Или если бот не запущен:"
echo "  pm2 start ecosystem.config.js" 
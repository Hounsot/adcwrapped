# 🚀 Быстрый деплой на VPS

## Подготовка сервера (Ubuntu)

```bash
# 1. Обновляем систему
sudo apt update && sudo apt upgrade -y

# 2. Устанавливаем Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git

# 3. Устанавливаем зависимости для Puppeteer
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

# 4. Устанавливаем PM2
sudo npm install -g pm2
```

## Деплой бота

```bash
# 1. Клонируем репозиторий
git clone https://github.com/YOUR_USERNAME/hse-portfolio-bot.git
cd hse-portfolio-bot

# 2. Создаем .env файл
cp env.example .env
nano .env  # Заполните TELEGRAM_BOT_TOKEN и ADMIN_ID

# 3. Запускаем деплой
chmod +x deploy.sh
./deploy.sh
```

## Управление ботом

```bash
# Статус
pm2 status

# Логи
pm2 logs hse-portfolio-bot

# Перезапуск
pm2 restart hse-portfolio-bot

# Остановка
pm2 stop hse-portfolio-bot

# Мониторинг
pm2 monit
```

## Обновление

```bash
cd hse-portfolio-bot
git pull origin main
npm install --production
pm2 restart hse-portfolio-bot
```

---

📖 **Подробная инструкция**: [server-setup.md](server-setup.md) 
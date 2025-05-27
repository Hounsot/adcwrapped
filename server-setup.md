# 🖥️ Настройка VPS Ubuntu для HSE Portfolio Bot

Пошаговая инструкция по деплою бота на Ubuntu сервер.

## 📋 Требования

- Ubuntu 20.04+ (рекомендуется 22.04)
- Минимум 1GB RAM
- 10GB свободного места
- Доступ по SSH

## 🔧 Подготовка сервера

### 1. Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Установка Node.js (версия 18+)
```bash
# Добавляем репозиторий NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Устанавливаем Node.js
sudo apt-get install -y nodejs

# Проверяем версии
node --version
npm --version
```

### 3. Установка дополнительных зависимостей
```bash
# Для Puppeteer и генерации изображений
sudo apt-get install -y \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
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
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget

# Установка Git
sudo apt-get install -y git

# Установка PM2 глобально
sudo npm install -g pm2
```

### 4. Создание пользователя для бота (рекомендуется)
```bash
# Создаем пользователя
sudo adduser botuser

# Добавляем в группу sudo (опционально)
sudo usermod -aG sudo botuser

# Переключаемся на пользователя
sudo su - botuser
```

## 📦 Деплой бота

### 1. Клонирование репозитория
```bash
# Переходим в домашнюю директорию
cd ~

# Клонируем репозиторий
git clone https://github.com/YOUR_USERNAME/hse-portfolio-bot.git

# Переходим в директорию проекта
cd hse-portfolio-bot
```

### 2. Создание .env файла
```bash
# Копируем пример
cp env.example .env

# Редактируем файл
nano .env
```

Заполните следующие переменные:
```env
# Telegram Bot Token (получить у @BotFather)
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE

# ID администратора для доступа к статистике
ADMIN_ID=YOUR_TELEGRAM_ID

# Настройки парсинга
PARSE_DELAY_MS=500
MAX_CONCURRENT_REQUESTS=3

# Настройки логирования
LOG_LEVEL=info
```

### 3. Запуск деплоя
```bash
# Делаем скрипт исполняемым
chmod +x deploy.sh

# Запускаем деплой
./deploy.sh
```

## 🔍 Мониторинг и управление

### Основные команды PM2:
```bash
# Статус всех процессов
pm2 status

# Просмотр логов
pm2 logs hse-portfolio-bot

# Просмотр логов в реальном времени
pm2 logs hse-portfolio-bot --lines 50

# Перезапуск бота
pm2 restart hse-portfolio-bot

# Остановка бота
pm2 stop hse-portfolio-bot

# Мониторинг ресурсов
pm2 monit

# Просмотр детальной информации
pm2 show hse-portfolio-bot
```

### Просмотр логов системы:
```bash
# Логи бота
tail -f logs/combined.log

# Ошибки
tail -f logs/err.log

# Вывод программы
tail -f logs/out.log
```

## 🔒 Безопасность

### 1. Настройка файрвола (UFW)
```bash
# Включаем UFW
sudo ufw enable

# Разрешаем SSH
sudo ufw allow ssh

# Разрешаем HTTP/HTTPS (если нужно)
sudo ufw allow 80
sudo ufw allow 443

# Проверяем статус
sudo ufw status
```

### 2. Настройка автоматических обновлений
```bash
# Устанавливаем unattended-upgrades
sudo apt install unattended-upgrades

# Настраиваем автообновления
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 3. Защита SSH
Отредактируйте `/etc/ssh/sshd_config`:
```bash
sudo nano /etc/ssh/sshd_config
```

Рекомендуемые настройки:
```
Port 2222                    # Изменить порт SSH
PermitRootLogin no          # Запретить вход под root
PasswordAuthentication no   # Только ключи SSH
```

Перезапустите SSH:
```bash
sudo systemctl restart ssh
```

## 📊 Резервное копирование

### Создание скрипта бэкапа:
```bash
nano backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/botuser/backups"
BOT_DIR="/home/botuser/hse-portfolio-bot"

mkdir -p $BACKUP_DIR

# Бэкап данных пользователей
cp $BOT_DIR/data/users.json $BACKUP_DIR/users_$DATE.json

# Бэкап логов
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz $BOT_DIR/logs/

# Удаляем старые бэкапы (старше 30 дней)
find $BACKUP_DIR -name "*.json" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

### Настройка автоматического бэкапа:
```bash
# Делаем скрипт исполняемым
chmod +x backup.sh

# Добавляем в crontab (каждый день в 3:00)
crontab -e

# Добавляем строку:
0 3 * * * /home/botuser/hse-portfolio-bot/backup.sh
```

## 🚀 Обновление бота

### Автоматическое обновление:
```bash
# Создаем скрипт обновления
nano update.sh
```

```bash
#!/bin/bash
cd /home/botuser/hse-portfolio-bot

echo "🔄 Обновляю бота..."

# Получаем последние изменения
git pull origin main

# Устанавливаем зависимости
npm install --production

# Перезапускаем бота
pm2 restart hse-portfolio-bot

echo "✅ Обновление завершено!"
```

```bash
# Делаем исполняемым
chmod +x update.sh

# Запускаем обновление
./update.sh
```

## 🆘 Решение проблем

### Бот не запускается:
```bash
# Проверяем логи
pm2 logs hse-portfolio-bot

# Проверяем статус
pm2 status

# Проверяем .env файл
cat .env
```

### Проблемы с Puppeteer:
```bash
# Переустанавливаем Puppeteer
npm uninstall puppeteer
npm install puppeteer

# Или используем системный Chromium
sudo apt-get install chromium-browser
```

### Нехватка памяти:
```bash
# Создаем swap файл
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Добавляем в /etc/fstab для постоянного использования
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `pm2 logs hse-portfolio-bot`
2. Проверьте статус: `pm2 status`
3. Перезапустите бота: `pm2 restart hse-portfolio-bot`
4. Проверьте системные ресурсы: `htop` или `pm2 monit` 
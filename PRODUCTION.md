# 🏭 Продакшен деплой HSE Portfolio Bot

Полная инструкция по настройке бота в продакшене с мониторингом, автоматическими проверками и резервным копированием.

## 🚀 Быстрый старт

### 1. Подготовка сервера Ubuntu
```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Устанавливаем зависимости для Puppeteer
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

# Устанавливаем PM2 и дополнительные утилиты
sudo npm install -g pm2
sudo apt-get install -y htop ufw fail2ban
```

### 2. Деплой бота
```bash
# Клонируем репозиторий
git clone https://github.com/YOUR_USERNAME/hse-portfolio-bot.git
cd hse-portfolio-bot

# Настраиваем окружение
cp env.example .env
nano .env  # Заполните TELEGRAM_BOT_TOKEN и ADMIN_ID

# Запускаем автоматический деплой
chmod +x deploy.sh
./deploy.sh
```

## 🔧 Настройка мониторинга

### 1. Автоматическая проверка здоровья
```bash
# Делаем скрипт исполняемым
chmod +x healthcheck.js

# Тестируем проверку
./healthcheck.js

# Настраиваем автоматическую проверку каждые 5 минут
crontab -e

# Добавляем строку:
*/5 * * * * cd /home/botuser/hse-portfolio-bot && ./healthcheck.js >> logs/cron.log 2>&1
```

### 2. Настройка логирования
```bash
# Создаем директории для логов
mkdir -p logs

# Настраиваем ротацию логов
sudo nano /etc/logrotate.d/hse-bot
```

Содержимое файла `/etc/logrotate.d/hse-bot`:
```
/home/botuser/hse-portfolio-bot/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 botuser botuser
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. Резервное копирование
```bash
# Создаем скрипт бэкапа
nano backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/botuser/backups"
BOT_DIR="/home/botuser/hse-portfolio-bot"

mkdir -p $BACKUP_DIR

# Бэкап данных пользователей
if [ -f "$BOT_DIR/data/users.json" ]; then
    cp $BOT_DIR/data/users.json $BACKUP_DIR/users_$DATE.json
    echo "Backup users.json: $DATE"
fi

# Бэкап логов
if [ -d "$BOT_DIR/logs" ]; then
    tar -czf $BACKUP_DIR/logs_$DATE.tar.gz $BOT_DIR/logs/
    echo "Backup logs: $DATE"
fi

# Удаляем старые бэкапы (старше 30 дней)
find $BACKUP_DIR -name "*.json" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
# Делаем исполняемым
chmod +x backup.sh

# Настраиваем автоматический бэкап (каждый день в 3:00)
crontab -e

# Добавляем строки:
0 3 * * * /home/botuser/hse-portfolio-bot/backup.sh
*/30 * * * * cd /home/botuser/hse-portfolio-bot && ./cleanup.sh >> logs/cleanup.log 2>&1
```

## 🔒 Безопасность

### 1. Настройка файрвола
```bash
# Включаем UFW
sudo ufw enable

# Разрешаем только SSH
sudo ufw allow ssh

# Проверяем статус
sudo ufw status
```

### 2. Защита SSH
```bash
# Редактируем конфигурацию SSH
sudo nano /etc/ssh/sshd_config
```

Рекомендуемые настройки:
```
Port 2222                    # Изменить порт SSH
PermitRootLogin no          # Запретить вход под root
PasswordAuthentication no   # Только ключи SSH
MaxAuthTries 3              # Максимум попыток входа
ClientAliveInterval 300     # Таймаут соединения
ClientAliveCountMax 2
```

```bash
# Перезапускаем SSH
sudo systemctl restart ssh

# Обновляем правила файрвола
sudo ufw delete allow ssh
sudo ufw allow 2222
```

### 3. Настройка Fail2Ban
```bash
# Создаем конфигурацию для SSH
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 2222
logpath = /var/log/auth.log
maxretry = 3
```

```bash
# Перезапускаем Fail2Ban
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
```

## 📊 Мониторинг и алерты

### 1. Настройка уведомлений
Бот автоматически отправляет уведомления администратору при:
- Перезапуске бота
- Ошибках в работе
- Превышении лимитов памяти
- Проблемах с API

### 2. Команды мониторинга
```bash
# Статус всех процессов
pm2 status

# Мониторинг ресурсов в реальном времени
pm2 monit

# Просмотр логов
pm2 logs hse-portfolio-bot --lines 100

# Статистика использования
tail -f logs/combined.log

# Проверка здоровья
./healthcheck.js

# Системные ресурсы
htop
df -h
free -h
```

### 3. Настройка алертов по email (опционально)
```bash
# Устанавливаем mailutils
sudo apt-get install mailutils

# Создаем скрипт для email уведомлений
nano email-alert.sh
```

```bash
#!/bin/bash
SUBJECT="HSE Bot Alert"
EMAIL="your-email@example.com"
MESSAGE="$1"

echo "$MESSAGE" | mail -s "$SUBJECT" "$EMAIL"
```

## 🚀 Обновление и деплой

### 1. Автоматическое обновление
```bash
# Создаем скрипт обновления
nano update.sh
```

```bash
#!/bin/bash
cd /home/botuser/hse-portfolio-bot

echo "🔄 Начинаю обновление бота..."

# Создаем бэкап перед обновлением
./backup.sh

# Получаем последние изменения
git pull origin main

# Устанавливаем зависимости
npm install --production

# Перезапускаем бота
pm2 restart hse-portfolio-bot

# Проверяем статус
sleep 5
pm2 status

echo "✅ Обновление завершено!"
```

```bash
# Делаем исполняемым
chmod +x update.sh
```

### 2. CI/CD с GitHub Actions (опционально)
Создайте `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /home/botuser/hse-portfolio-bot
          ./update.sh
```

## 📈 Оптимизация производительности

### 1. Настройка PM2
```bash
# Оптимизированная конфигурация PM2
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'hse-portfolio-bot',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 2. Оптимизация системы
```bash
# Увеличиваем лимиты файлов
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Настраиваем swap (если нужно)
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 🆘 Решение проблем

### Частые проблемы и решения:

1. **Бот не отвечает**
   ```bash
   pm2 restart hse-portfolio-bot
   pm2 logs hse-portfolio-bot
   ```

2. **Ошибки Puppeteer**
   ```bash
   sudo apt-get install chromium-browser
   npm rebuild puppeteer
   ```

3. **Нехватка памяти**
   ```bash
   pm2 restart hse-portfolio-bot
   # Проверить настройки max_memory_restart
   ```

4. **Проблемы с правами**
   ```bash
   sudo chown -R botuser:botuser /home/botuser/hse-portfolio-bot
   chmod +x *.sh
   ```

### Логи для диагностики:
- PM2 логи: `pm2 logs hse-portfolio-bot`
- Системные логи: `tail -f /var/log/syslog`
- Логи бота: `tail -f logs/combined.log`
- Логи healthcheck: `tail -f logs/healthcheck.log`

## 📞 Поддержка

При возникновении проблем:
1. Проверьте статус: `pm2 status`
2. Просмотрите логи: `pm2 logs hse-portfolio-bot`
3. Запустите проверку здоровья: `./healthcheck.js`
4. Проверьте системные ресурсы: `htop`
5. Перезапустите бота: `pm2 restart hse-portfolio-bot`

Бот настроен для автоматического восстановления и уведомления администратора о проблемах. 
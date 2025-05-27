# HSE Portfolio Telegram Bot

Telegram бот для анализа портфолио студентов ВШЭ и создания статистики в стиле "Spotify Wrapped".

## Возможности

- 📊 Парсинг данных с портфолио ВШЭ
- 🔗 Получение статистики лайков с HseDesign через API
- 👁️ Получение количества просмотров проектов через API
- 🖼️ Генерация красивых изображений со статистикой
- 📱 Удобный интерфейс через Telegram
- 📈 **Система аналитики пользователей** - автоматический сбор статистики использования

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env`:
```bash
cp env.example .env
```

3. Получите токен бота у [@BotFather](https://t.me/BotFather) и добавьте его в `.env`

4. Получите ваш Telegram ID (например, у [@userinfobot](https://t.me/userinfobot)) и добавьте в `.env` как `ADMIN_ID`

5. Запустите бота:
```bash
npm start
```

## Использование

1. Найдите бота: [@AdcHubBot](https://t.me/AdcHubBot)
2. Отправьте `/start` для начала работы
3. Отправьте ссылку на ваше портфолио ВШЭ

## Команды

- `/start` - Приветствие и инструкции
- `/stats` - Просмотр статистики использования (только для администраторов)
- `/broadcast <сообщение>` - Рассылка всем пользователям (только для администраторов)
- `/broadcast_active <сообщение>` - Рассылка активным пользователям (только для администраторов)

## Структура проекта

- `index.js` - Основной файл бота
- `portfolioParser.js` - Парсер данных портфолио с API интеграцией
- `imageGenerator.js` - Генератор изображений статистики
- `userLogger.js` - Система логирования пользователей
- `templates/` - HTML шаблоны для изображений
- `cleanup.sh` - Скрипт очистки временных файлов
- `test.js` - Тестирование парсера

## 🚀 Деплой на сервер

### Быстрый деплой на Ubuntu VPS:
```bash
# Подготовка сервера
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git pm2

# Деплой бота
git clone https://github.com/YOUR_USERNAME/hse-portfolio-bot.git
cd hse-portfolio-bot
cp env.example .env
nano .env  # Заполните токены
chmod +x deploy.sh
./deploy.sh
```

📖 **Подробные инструкции**: [DEPLOY.md](DEPLOY.md) | [server-setup.md](server-setup.md)

## Технические особенности

### API интеграция
Бот использует прямые API запросы для получения данных:
- **Лайки**: `https://api.mediiia.ru/qualities/api/LikeStatistics/GetByEntity`
- **Просмотры**: `https://api.mediiia.ru/qualities/api/View/UpdateView`

### Требуемые заголовки
Для работы с API просмотров необходим заголовок:
```
Application-Context: hsedesign
```

### Fallback механизм
При недоступности API используется браузерный парсинг через Puppeteer.

## 🔧 Устранение неполадок

### Ошибка Chrome/Puppeteer на Linux сервере

Если вы видите ошибку:
```
Error: Failed to launch the browser process!
libatk-1.0.so.0: cannot open shared object file: No such file or directory
```

**Решение 1** - Запустите скрипт исправления:
```bash
chmod +x fix-chrome-deps.sh
./fix-chrome-deps.sh
pm2 restart hse-portfolio-bot
```

**Решение 2** - Установите зависимости вручную:
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils
```

### Проверка логов
```bash
pm2 logs hse-portfolio-bot
# или
tail -f logs/err-0.log
``` 
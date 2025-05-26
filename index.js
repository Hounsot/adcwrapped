require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const PortfolioParser = require('./portfolioParser');
const ImageGenerator = require('./imageGenerator');
const fs = require('fs');
const path = require('path');

// Создаем экземпляр бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const parser = new PortfolioParser();
const imageGenerator = new ImageGenerator();



// Команда /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    // Формируем обращение к пользователю
    let greeting = "Добро пожаловать";
    if (user.first_name) {
        greeting = `Привет, ${user.first_name}!`;
    } else if (user.username) {
        greeting = `Привет, @${user.username}!`;
    }
    
    const welcomeMessage = `
🎓 ${greeting}

Этот бот сгенерирует тебе статистику твоего обучения в ВШЭ.

🔗 Отправь ссылку на твое старое портфолио ВШЭ:

Пример: https://portfolio.hse.ru/Student/17647

Убедись, что твоя ссылка выглядит именно так!
    `;
    
    // Путь к GIF файлу
    const gifPath = path.join(__dirname, 'assets', 'images', 'welcome.gif');
    
    try {
        // Проверяем, существует ли файл
        if (fs.existsSync(gifPath)) {
            // Отправляем GIF с подписью
            await bot.sendAnimation(chatId, fs.createReadStream(gifPath), {
                caption: welcomeMessage,
                filename: 'welcome.gif',
                contentType: 'image/gif'
            });
        } else {
            // Если файла нет, отправляем обычное сообщение
            console.log('GIF файл не найден, отправляю текстовое сообщение');
            bot.sendMessage(chatId, welcomeMessage);
        }
    } catch (error) {
        console.error('Ошибка при отправке GIF:', error);
        // В случае ошибки отправляем обычное сообщение
        bot.sendMessage(chatId, welcomeMessage);
    }
});

// Обработка текстовых сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Игнорируем команды
    if (text && text.startsWith('/')) {
        return;
    }
    
    // Проверяем, что это ссылка на портфолио ВШЭ
    const portfolioUrlRegex = /https?:\/\/portfolio\.hse\.ru\/Student\/\d+/i;
    
    if (!portfolioUrlRegex.test(text)) {
        bot.sendMessage(chatId, `
❌ Неверный формат ссылки!

Пожалуйста, отправьте ссылку в формате:
https://portfolio.hse.ru/Student/XXXXX

Где XXXXX - это ваш ID студента.
        `);
        return;
    }
    
    // Отправляем сообщение о начале парсинга
    const processingMsg = await bot.sendMessage(chatId, `
⏳ Начинаю анализ вашего портфолио...

Это может занять несколько минут. Пожалуйста, подождите!
    `);
    
    try {
        // Парсим данные портфолио
        console.log(`Начинаю парсинг портфолио: ${text}`);
        const studentData = await parser.parseStudentData(text);
        
        // Обновляем сообщение
        try {
            await bot.editMessageText(`
✅ Анализ завершен!

Создаю красивые изображения...
            `, {
                chat_id: chatId,
                message_id: processingMsg.message_id
            });
        } catch (editError) {
            console.log('Не удалось отредактировать сообщение:', editError.message);
        }
        
        // Генерируем изображения
        let images = [];
        try {
            images = await imageGenerator.generateStudentStats(studentData);
        } catch (imageError) {
            console.error('Ошибка при генерации изображений:', imageError);
            // Отправляем только текстовую статистику, если изображения не удалось создать
            await bot.sendMessage(chatId, '⚠️ Не удалось создать изображения, но вот ваша статистика:');
        }
        
        // Удаляем сообщение о процессе
        try {
            await bot.deleteMessage(chatId, processingMsg.message_id);
        } catch (deleteError) {
            console.log('Не удалось удалить сообщение:', deleteError.message);
        }
        
        // Отправляем изображения группой (media group)
        if (images.length > 0) {
            const mediaGroup = images.map((imagePath, index) => ({
                type: 'photo',
                media: fs.createReadStream(imagePath),
                caption: index === 0 ? '🎓 Твоя статистика HSE Portfolio Wrapped' : undefined
            }));
            
            try {
                await bot.sendMediaGroup(chatId, mediaGroup);
            } catch (mediaError) {
                console.error('Ошибка при отправке media group:', mediaError);
                // Отправляем изображения по отдельности как fallback
                for (const imagePath of images) {
                    try {
                        await bot.sendPhoto(chatId, fs.createReadStream(imagePath), {
                            filename: path.basename(imagePath),
                            contentType: 'image/png'
                        });
                    } catch (photoError) {
                        console.error('Ошибка при отправке фото:', photoError);
                    }
                }
            }
        }
        
        // Отправляем текстовую статистику как дополнение
        const statsMessage = formatStudentStats(studentData);
        await bot.sendMessage(chatId, `📊 Подробная статистика:\n\n${statsMessage}`, { parse_mode: 'HTML' });
        
    } catch (error) {
        console.error('Ошибка при парсинге:', error);
        
        try {
            await bot.editMessageText(`
❌ Произошла ошибка при анализе портфолио!

Возможные причины:
• Портфолио недоступно или приватное
• Проблемы с сетью
• Неверная ссылка

Попробуйте еще раз, отправив ссылку на портфолио!
            `, {
                chat_id: chatId,
                message_id: processingMsg.message_id
            });
        } catch (editError) {
            // Если не удалось отредактировать, отправляем новое сообщение
            await bot.sendMessage(chatId, `
❌ Произошла ошибка при анализе портфолио!

Возможные причины:
• Портфолио недоступно или приватное
• Проблемы с сетью
• Неверная ссылка

Попробуйте еще раз, отправив ссылку на портфолио!
            `);
        }
    }
});

// Функция форматирования статистики
function formatStudentStats(data) {
    const stats = data.statistics;
    
    let message = `
🎓 <b>${data.studentName}</b>

📊 <b>СТАТИСТИКА ПОРТФОЛИО</b>

🗂️ <b>Проекты:</b> ${stats.totalProjects}
🎨 <b>На HseDesign:</b> ${stats.projectsWithHseDesign}
⭐ <b>Средняя оценка:</b> ${stats.averageMark.toFixed(1)}
📈 <b>Средний рейтинг:</b> ${stats.averageRating.toFixed(1)}
❤️ <b>Общие лайки:</b> ${stats.totalLikes}

🤝 <b>Групповые проекты:</b> ${stats.teamProjects}
${stats.teammatesList ? `👥 <b>Соавторы:</b> ${stats.teammatesList}` : ''}

🏆 <b>ЛУЧШИЙ ПРОЕКТ</b>
${stats.bestProject.title}
Оценка: ${stats.bestProject.totalMark} | Рейтинг: ${stats.bestProject.rating}
`;

    if (stats.mostLikedProject && stats.mostLikedProject.hseDesignLikes > 0) {
        message += `
🔥 <b>САМЫЙ ПОПУЛЯРНЫЙ</b>
${stats.mostLikedProject.title}
❤️ ${stats.mostLikedProject.hseDesignLikes} лайков
`;
    }

    // Добавляем распределение по оценкам
    message += `
📊 <b>РАСПРЕДЕЛЕНИЕ ОЦЕНОК</b>
`;
    
    Object.entries(stats.markDistribution)
        .sort(([a], [b]) => parseInt(b) - parseInt(a))
        .forEach(([grade, count]) => {
            const percentage = ((count / stats.totalProjects) * 100).toFixed(1);
            message += `${grade} баллов: ${count} (${percentage}%)\n`;
        });

    return message;
}

// Обработка ошибок
bot.on('error', (error) => {
    console.error('Ошибка бота:', error);
});

bot.on('polling_error', (error) => {
    console.error('Ошибка polling:', error);
});

console.log('🤖 Telegram бот запущен!');
console.log('Ожидаю сообщений...'); 
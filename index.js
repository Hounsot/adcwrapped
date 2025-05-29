require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const PortfolioParser = require('./portfolioParser');
const ImageGenerator = require('./imageGenerator');
const UserLogger = require('./userLogger');
const fs = require('fs');
const path = require('path');

// Создаем экземпляр бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const parser = new PortfolioParser();
const imageGenerator = new ImageGenerator();
const userLogger = new UserLogger();

// Система очередей и ограничений
const processingQueue = new Map(); // chatId -> timestamp
const userCooldowns = new Map(); // chatId -> timestamp
const MAX_CONCURRENT_REQUESTS = 3; // Максимум одновременных запросов
const COOLDOWN_TIME = 30000; // 30 секунд между запросами от одного пользователя
const REQUEST_TIMEOUT = 120000; // 2 минуты таймаут на обработку

// Функция проверки, можно ли обработать запрос
function canProcessRequest(chatId) {
    // Проверяем кулдаун пользователя
    const lastRequest = userCooldowns.get(chatId);
    if (lastRequest && Date.now() - lastRequest < COOLDOWN_TIME) {
        return { canProcess: false, reason: 'cooldown', timeLeft: Math.ceil((COOLDOWN_TIME - (Date.now() - lastRequest)) / 1000) };
    }
    
    // Проверяем количество активных запросов
    const activeRequests = processingQueue.size;
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        return { canProcess: false, reason: 'queue_full', queuePosition: activeRequests + 1 };
    }
    
    return { canProcess: true };
}

// Функция добавления в очередь
function addToQueue(chatId) {
    processingQueue.set(chatId, Date.now());
    userCooldowns.set(chatId, Date.now());
}

// Функция удаления из очереди
function removeFromQueue(chatId) {
    processingQueue.delete(chatId);
}

// Команда /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    // Логируем старт бота
    userLogger.logStart(user, chatId);
    
    // Формируем обращение к пользователю
    let greeting = "Добро пожаловать";
    if (user.first_name) {
        greeting = `Привет, ${user.first_name}!`;
    } else if (user.username) {
        greeting = `Привет, @${user.username}!`;
    }
    
    const welcomeMessage = `
🎓 ${greeting}

Этот бот сгенерирует тебе статистику твоего обучения во ВШЭ.

🔗 Отправь ссылку на твое старое портфолио ВШЭ:

Пример: https://portfolio.hse.ru/Student/17647

Убедись, что твоя ссылка выглядит именно так!
    `;
    
    // Путь к MP4 файлу
    const videoPath = path.join(__dirname, 'assets', 'images', 'welcome.mp4');
    
    try {
        // Проверяем, существует ли файл
        if (fs.existsSync(videoPath)) {
            // Отправляем MP4 видео с подписью
            await bot.sendVideo(chatId, fs.createReadStream(videoPath), {
                caption: welcomeMessage,
                filename: 'welcome.mp4',
                contentType: 'video/mp4'
            });
        } else {
            // Если файла нет, отправляем обычное сообщение
            console.log('MP4 файл не найден, отправляю текстовое сообщение');
            bot.sendMessage(chatId, welcomeMessage);
        }
    } catch (error) {
        console.error('Ошибка при отправке MP4:', error);
        // В случае ошибки отправляем обычное сообщение
        bot.sendMessage(chatId, welcomeMessage);
    }
});

// Функция проверки прав администратора
function isAdmin(userId) {
    const adminIds = [process.env.ADMIN_ID]; // Можно добавить несколько ID через запятую
    return adminIds.includes(userId.toString());
}

// Команда /stats (только для администраторов)
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    if (!isAdmin(user.id)) {
        await bot.sendMessage(chatId, '❌ У вас нет прав для просмотра статистики.');
        return;
    }
    
    try {
        const stats = userLogger.formatStats();
        await bot.sendMessage(chatId, stats);
    } catch (error) {
        console.error('Ошибка при получении статистики:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при получении статистики.');
    }
});

// Команда /broadcast (только для администраторов)
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const message = match[1];
    
    if (!isAdmin(user.id)) {
        await bot.sendMessage(chatId, '❌ У вас нет прав для рассылки.');
        return;
    }
    
    try {
        // Получаем всех пользователей
        const users = userLogger.getUsersForBroadcast();
        
        if (users.length === 0) {
            await bot.sendMessage(chatId, '📭 Нет пользователей для рассылки.');
            return;
        }
        
        // Подтверждение рассылки
        const confirmMsg = await bot.sendMessage(chatId, 
            `📢 Готов отправить сообщение ${users.length} пользователям:\n\n"${message}"\n\n` +
            `Отправьте "ДА" для подтверждения или любое другое сообщение для отмены.`
        );
        
        // Ждем подтверждения
        const confirmHandler = async (confirmMsg) => {
            if (confirmMsg.chat.id !== chatId || confirmMsg.from.id !== user.id) return;
            
            bot.removeListener('message', confirmHandler);
            
            if (confirmMsg.text?.toUpperCase() === 'ДА') {
                await sendBroadcast(chatId, message, users, 'manual');
            } else {
                await bot.sendMessage(chatId, '❌ Рассылка отменена.');
            }
        };
        
        bot.on('message', confirmHandler);
        
        // Автоматическая отмена через 30 секунд
        setTimeout(() => {
            bot.removeListener('message', confirmHandler);
        }, 30000);
        
    } catch (error) {
        console.error('Ошибка при подготовке рассылки:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при подготовке рассылки.');
    }
});

// Команда /broadcast_active (только для администраторов) - рассылка активным пользователям
bot.onText(/\/broadcast_active (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const message = match[1];
    
    if (!isAdmin(user.id)) {
        await bot.sendMessage(chatId, '❌ У вас нет прав для рассылки.');
        return;
    }
    
    try {
        // Получаем активных пользователей за последние 7 дней
        const users = userLogger.getActiveUsers(7);
        
        if (users.length === 0) {
            await bot.sendMessage(chatId, '📭 Нет активных пользователей для рассылки.');
            return;
        }
        
        await bot.sendMessage(chatId, 
            `📢 Отправляю сообщение ${users.length} активным пользователям (за последние 7 дней)...`
        );
        
        await sendBroadcast(chatId, message, users, 'active_users');
        
    } catch (error) {
        console.error('Ошибка при рассылке активным пользователям:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при рассылке.');
    }
});

// Функция отправки рассылки
async function sendBroadcast(adminChatId, message, users, broadcastType) {
    let sentCount = 0;
    let failedCount = 0;
    
    const progressMsg = await bot.sendMessage(adminChatId, 
        `📤 Отправка: 0/${users.length} (0%)`
    );
    
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        
        try {
            await bot.sendMessage(user.chatId, message);
            sentCount++;
        } catch (error) {
            console.error(`Ошибка отправки пользователю ${user.chatId}:`, error.message);
            failedCount++;
        }
        
        // Обновляем прогресс каждые 10 сообщений или в конце
        if ((i + 1) % 10 === 0 || i === users.length - 1) {
            const progress = Math.round(((i + 1) / users.length) * 100);
            try {
                await bot.editMessageText(
                    `📤 Отправка: ${i + 1}/${users.length} (${progress}%)\n✅ Успешно: ${sentCount}\n❌ Ошибок: ${failedCount}`,
                    {
                        chat_id: adminChatId,
                        message_id: progressMsg.message_id
                    }
                );
            } catch (editError) {
                // Игнорируем ошибки редактирования
            }
        }
        
        // Небольшая задержка между отправками
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Логируем рассылку
    userLogger.logBroadcast(broadcastType, sentCount, users.length);
    
    // Финальное сообщение
    await bot.sendMessage(adminChatId, 
        `✅ Рассылка завершена!\n\n📊 Статистика:\n` +
        `👥 Всего пользователей: ${users.length}\n` +
        `✅ Успешно отправлено: ${sentCount}\n` +
        `❌ Ошибок: ${failedCount}\n` +
        `📈 Успешность: ${((sentCount / users.length) * 100).toFixed(1)}%`
    );
}

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
    
    // ПРОВЕРЯЕМ ОЧЕРЕДЬ И ОГРАНИЧЕНИЯ
    const queueCheck = canProcessRequest(chatId);
    if (!queueCheck.canProcess) {
        if (queueCheck.reason === 'cooldown') {
            await bot.sendMessage(chatId, `
⏰ Подождите ${queueCheck.timeLeft} секунд перед следующим запросом.

Это помогает боту работать стабильно для всех пользователей!
            `);
            return;
        } else if (queueCheck.reason === 'queue_full') {
            await bot.sendMessage(chatId, `
🚦 Сейчас очень много запросов! 

Вы в очереди на позиции ${queueCheck.queuePosition}. 
Попробуйте через 1-2 минуты.
            `);
            return;
        }
    }
    
    // Добавляем в очередь
    addToQueue(chatId);
    
    // Отправляем сообщение о начале парсинга
    const processingMsg = await bot.sendMessage(chatId, `
⏳ Начинаю анализ вашего портфолио...

Это может занять несколько минут. Пожалуйста, подождите!
    `);
    
    // Устанавливаем таймаут на обработку
    const timeoutId = setTimeout(() => {
        removeFromQueue(chatId);
        bot.sendMessage(chatId, `
⏰ Время обработки истекло!

Попробуйте еще раз через минуту. Если проблема повторяется, возможно портфолио недоступно.
        `);
    }, REQUEST_TIMEOUT);
    
    try {
        // Логируем запрос портфолио
        userLogger.logPortfolioRequest(msg.from, text);
        
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
            // Логируем ошибку генерации изображений
            userLogger.logFailedRequest(msg.from, 'image_generation_error');
            // Если изображения не удалось создать, сообщаем об ошибке
            await bot.sendMessage(chatId, '⚠️ Не удалось создать изображения. Попробуйте еще раз позже.');
            
            // Очищаем частично созданные файлы при ошибке
            if (images && images.length > 0) {
                for (const imagePath of images) {
                    try {
                        if (fs.existsSync(imagePath)) {
                            fs.unlinkSync(imagePath);
                            console.log(`Удален частично созданный файл: ${path.basename(imagePath)}`);
                        }
                    } catch (deleteError) {
                        console.error(`Ошибка удаления файла ${imagePath}:`, deleteError.message);
                    }
                }
            }
            return;
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
                caption: index === 0 ? '🎓 Твоя статистика HSE Wrapped' : undefined
            }));
            
            try {
                await bot.sendMediaGroup(chatId, mediaGroup);
                // Логируем успешную отправку
                userLogger.logSuccessfulRequest(msg.from, images.length, studentData);
            } catch (mediaError) {
                console.error('Ошибка при отправке media group:', mediaError);
                // Отправляем изображения по отдельности как fallback
                let sentImages = 0;
                for (const imagePath of images) {
                    try {
                        await bot.sendPhoto(chatId, fs.createReadStream(imagePath), {
                            filename: path.basename(imagePath),
                            contentType: 'image/png'
                        });
                        sentImages++;
                    } catch (photoError) {
                        console.error('Ошибка при отправке фото:', photoError);
                    }
                }
                // Логируем успешную отправку (хотя бы частичную)
                if (sentImages > 0) {
                    userLogger.logSuccessfulRequest(msg.from, sentImages, studentData);
                }
            }
            
            // Удаляем временные файлы после отправки
            for (const imagePath of images) {
                try {
                    if (fs.existsSync(imagePath)) {
                        fs.unlinkSync(imagePath);
                        console.log(`Удален временный файл: ${path.basename(imagePath)}`);
                    }
                } catch (deleteError) {
                    console.error(`Ошибка удаления файла ${imagePath}:`, deleteError.message);
                }
            }
        }
        
        // Текстовая статистика убрана - отправляем только изображения
        
    } catch (error) {
        console.error('Ошибка при парсинге:', error);
        
        // Логируем ошибку парсинга
        userLogger.logFailedRequest(msg.from, 'parsing_error');
        
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
    } finally {
        // ОБЯЗАТЕЛЬНО удаляем из очереди и отменяем таймаут
        clearTimeout(timeoutId);
        removeFromQueue(chatId);
    }
});

// Функция formatStudentStats удалена - теперь отправляем только изображения

// Обработка ошибок
bot.on('error', (error) => {
    console.error('Ошибка бота:', error);
});

bot.on('polling_error', (error) => {
    console.error('Ошибка polling:', error);
});

console.log('🤖 Telegram бот запущен!');
console.log('Ожидаю сообщений...'); 
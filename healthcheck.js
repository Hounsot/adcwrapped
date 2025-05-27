#!/usr/bin/env node

/**
 * Скрипт проверки здоровья HSE Portfolio Bot
 * Проверяет статус бота и перезапускает при необходимости
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Конфигурация
const CONFIG = {
  botName: 'hse-portfolio-bot',
  maxMemoryMB: 1024, // Максимальное потребление памяти в MB
  logFile: path.join(__dirname, 'logs', 'healthcheck.log'),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  adminId: process.env.ADMIN_ID
};

/**
 * Логирование с временной меткой
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  console.log(logMessage);
  
  // Записываем в файл
  try {
    fs.appendFileSync(CONFIG.logFile, logMessage + '\n');
  } catch (error) {
    console.error('Ошибка записи в лог файл:', error.message);
  }
}

/**
 * Выполнение команды с промисом
 */
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr });
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Получение статуса процесса PM2
 */
async function getPM2Status() {
  try {
    const output = await execPromise('pm2 jlist');
    const processes = JSON.parse(output);
    const botProcess = processes.find(p => p.name === CONFIG.botName);
    
    if (!botProcess) {
      return { status: 'not_found', process: null };
    }
    
    return {
      status: botProcess.pm2_env.status,
      memory: Math.round(botProcess.pm2_env.memory / 1024 / 1024), // MB
      cpu: botProcess.pm2_env.cpu,
      uptime: botProcess.pm2_env.pm_uptime,
      restarts: botProcess.pm2_env.restart_time,
      process: botProcess
    };
  } catch (error) {
    log(`Ошибка получения статуса PM2: ${error.error?.message || error}`, 'ERROR');
    return { status: 'error', process: null };
  }
}

/**
 * Проверка доступности Telegram API
 */
async function checkTelegramAPI() {
  if (!CONFIG.telegramToken) {
    return { status: 'no_token', error: 'Токен не настроен' };
  }
  
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.telegramToken}/getMe`, {
      timeout: 10000
    });
    
    if (response.ok) {
      const data = await response.json();
      return { status: 'ok', botInfo: data.result };
    } else {
      return { status: 'error', error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

/**
 * Перезапуск бота
 */
async function restartBot(reason) {
  try {
    log(`Перезапускаю бота. Причина: ${reason}`, 'WARN');
    await execPromise(`pm2 restart ${CONFIG.botName}`);
    log('Бот успешно перезапущен', 'INFO');
    return true;
  } catch (error) {
    log(`Ошибка перезапуска бота: ${error.error?.message || error}`, 'ERROR');
    return false;
  }
}

/**
 * Отправка уведомления администратору
 */
async function notifyAdmin(message) {
  if (!CONFIG.telegramToken || !CONFIG.adminId) {
    return false;
  }
  
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.adminId,
        text: `🤖 HSE Portfolio Bot\n\n${message}`,
        parse_mode: 'HTML'
      })
    });
    
    return response.ok;
  } catch (error) {
    log(`Ошибка отправки уведомления: ${error.message}`, 'ERROR');
    return false;
  }
}

/**
 * Основная функция проверки здоровья
 */
async function healthCheck() {
  log('Начинаю проверку здоровья бота...');
  
  // Создаем директорию для логов если её нет
  const logsDir = path.dirname(CONFIG.logFile);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  let needsRestart = false;
  let restartReason = '';
  
  // 1. Проверяем статус PM2
  const pm2Status = await getPM2Status();
  log(`Статус PM2: ${pm2Status.status}`);
  
  if (pm2Status.status === 'not_found') {
    log('Процесс бота не найден в PM2', 'ERROR');
    await notifyAdmin('❌ Процесс бота не найден в PM2. Требуется ручной запуск.');
    return;
  }
  
  if (pm2Status.status === 'error') {
    log('Ошибка при получении статуса PM2', 'ERROR');
    return;
  }
  
  if (pm2Status.status === 'stopped') {
    needsRestart = true;
    restartReason = 'Процесс остановлен';
  }
  
  if (pm2Status.status === 'errored') {
    needsRestart = true;
    restartReason = 'Процесс в состоянии ошибки';
  }
  
  // 2. Проверяем потребление памяти
  if (pm2Status.memory && pm2Status.memory > CONFIG.maxMemoryMB) {
    needsRestart = true;
    restartReason = `Превышено потребление памяти: ${pm2Status.memory}MB > ${CONFIG.maxMemoryMB}MB`;
  }
  
  // 3. Проверяем доступность Telegram API
  const telegramStatus = await checkTelegramAPI();
  log(`Статус Telegram API: ${telegramStatus.status}`);
  
  if (telegramStatus.status === 'error') {
    log(`Проблема с Telegram API: ${telegramStatus.error}`, 'WARN');
    // Не перезапускаем из-за проблем с API, это может быть временно
  }
  
  // 4. Проверяем количество перезапусков
  if (pm2Status.restarts && pm2Status.restarts > 10) {
    log(`Слишком много перезапусков: ${pm2Status.restarts}`, 'WARN');
    await notifyAdmin(`⚠️ Бот перезапускался ${pm2Status.restarts} раз. Возможны проблемы.`);
  }
  
  // 5. Выводим статистику
  if (pm2Status.status === 'online') {
    const uptimeHours = Math.round((Date.now() - pm2Status.uptime) / 1000 / 60 / 60);
    log(`Статистика: память ${pm2Status.memory}MB, CPU ${pm2Status.cpu}%, uptime ${uptimeHours}ч, перезапусков ${pm2Status.restarts}`);
  }
  
  // 6. Перезапускаем если нужно
  if (needsRestart) {
    const restarted = await restartBot(restartReason);
    if (restarted) {
      await notifyAdmin(`🔄 Бот перезапущен\n\nПричина: ${restartReason}`);
    } else {
      await notifyAdmin(`❌ Не удалось перезапустить бота\n\nПричина: ${restartReason}`);
    }
  } else {
    log('Бот работает нормально');
  }
}

// Запускаем проверку
if (require.main === module) {
  healthCheck().catch(error => {
    log(`Критическая ошибка: ${error.message}`, 'ERROR');
    process.exit(1);
  });
} 
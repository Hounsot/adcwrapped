const fs = require('fs');
const path = require('path');

class UserLogger {
  constructor() {
    this.logFile = path.join(__dirname, 'data', 'users.json');
    this.ensureDataDirectory();
    this.ensureLogFile();
  }

  /**
   * Создает директорию data если её нет
   */
  ensureDataDirectory() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Создает файл логов если его нет
   */
  ensureLogFile() {
    if (!fs.existsSync(this.logFile)) {
      const initialData = {
        users: {},
        totalUsers: 0,
        totalRequests: 0,
        createdAt: new Date().toISOString()
      };
      fs.writeFileSync(this.logFile, JSON.stringify(initialData, null, 2));
    }
  }

  /**
   * Читает данные из файла логов
   * @returns {Object} Данные пользователей
   */
  readUserData() {
    try {
      const data = fs.readFileSync(this.logFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Ошибка при чтении файла логов:', error);
      return {
        users: {},
        totalUsers: 0,
        totalRequests: 0,
        createdAt: new Date().toISOString()
      };
    }
  }

  /**
   * Записывает данные в файл логов
   * @param {Object} data - Данные для записи
   */
  writeUserData(data) {
    try {
      fs.writeFileSync(this.logFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Ошибка при записи файла логов:', error);
    }
  }

  /**
   * Логирует старт бота пользователем
   * @param {Object} user - Объект пользователя Telegram
   * @param {number} chatId - ID чата
   */
  logStart(user, chatId) {
    const data = this.readUserData();
    const userId = user.id.toString();
    const now = new Date().toISOString();

    if (!data.users[userId]) {
      // Новый пользователь
      data.users[userId] = {
        id: user.id,
        username: user.username || null,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        chatId: chatId,
        firstSeen: now,
        lastSeen: now,
        startCount: 1,
        portfolioRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalImages: 0
      };
      data.totalUsers++;
    } else {
      // Существующий пользователь
      data.users[userId].lastSeen = now;
      data.users[userId].startCount++;
      
      // Обновляем информацию о пользователе (может измениться)
      data.users[userId].username = user.username || data.users[userId].username;
      data.users[userId].firstName = user.first_name || data.users[userId].firstName;
      data.users[userId].lastName = user.last_name || data.users[userId].lastName;
      data.users[userId].chatId = chatId;
    }

    this.writeUserData(data);
    console.log(`📊 Пользователь ${user.first_name || user.username || user.id} запустил бота`);
  }

  /**
   * Логирует запрос портфолио
   * @param {Object} user - Объект пользователя Telegram
   * @param {string} portfolioUrl - URL портфолио
   */
  logPortfolioRequest(user, portfolioUrl) {
    const data = this.readUserData();
    const userId = user.id.toString();
    const now = new Date().toISOString();

    if (data.users[userId]) {
      data.users[userId].portfolioRequests++;
      data.users[userId].lastSeen = now;
      data.users[userId].lastPortfolioUrl = portfolioUrl;
      data.users[userId].lastRequestTime = now;
    }

    data.totalRequests++;
    this.writeUserData(data);
    console.log(`📊 Пользователь ${user.first_name || user.username || user.id} запросил анализ портфолио`);
  }

  /**
   * Логирует успешную генерацию изображений
   * @param {Object} user - Объект пользователя Telegram
   * @param {number} imageCount - Количество созданных изображений
   * @param {Object} studentData - Данные студента
   */
  logSuccessfulRequest(user, imageCount, studentData) {
    const data = this.readUserData();
    const userId = user.id.toString();
    const now = new Date().toISOString();

    if (data.users[userId]) {
      data.users[userId].successfulRequests++;
      data.users[userId].totalImages += imageCount;
      data.users[userId].lastSeen = now;
      data.users[userId].lastSuccessTime = now;
      data.users[userId].lastStudentName = studentData.studentName;
      data.users[userId].lastStudentStats = {
        totalProjects: studentData.totalProjects,
        totalLikes: studentData.statistics.totalLikes,
        totalViews: studentData.statistics.totalViews,
        averageMark: studentData.statistics.averageMark
      };
    }

    this.writeUserData(data);
    console.log(`📊 Пользователь ${user.first_name || user.username || user.id} успешно получил ${imageCount} изображений`);
  }

  /**
   * Логирует неудачный запрос
   * @param {Object} user - Объект пользователя Telegram
   * @param {string} errorType - Тип ошибки
   */
  logFailedRequest(user, errorType) {
    const data = this.readUserData();
    const userId = user.id.toString();
    const now = new Date().toISOString();

    if (data.users[userId]) {
      data.users[userId].failedRequests++;
      data.users[userId].lastSeen = now;
      data.users[userId].lastError = errorType;
      data.users[userId].lastErrorTime = now;
    }

    this.writeUserData(data);
    console.log(`📊 Пользователь ${user.first_name || user.username || user.id} получил ошибку: ${errorType}`);
  }

  /**
   * Получает статистику использования бота
   * @returns {Object} Общая статистика
   */
  getStats() {
    const data = this.readUserData();
    const users = Object.values(data.users);
    
    const activeUsers = users.filter(user => {
      const lastSeen = new Date(user.lastSeen);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return lastSeen > weekAgo;
    }).length;

    const successfulUsers = users.filter(user => user.successfulRequests > 0).length;
    const totalImages = users.reduce((sum, user) => sum + user.totalImages, 0);
    const totalSuccessful = users.reduce((sum, user) => sum + user.successfulRequests, 0);
    const totalFailed = users.reduce((sum, user) => sum + user.failedRequests, 0);

    return {
      totalUsers: data.totalUsers,
      activeUsers,
      successfulUsers,
      totalRequests: data.totalRequests,
      totalSuccessful,
      totalFailed,
      totalImages,
      successRate: data.totalRequests > 0 ? ((totalSuccessful / data.totalRequests) * 100).toFixed(1) : 0,
      averageImagesPerUser: successfulUsers > 0 ? (totalImages / successfulUsers).toFixed(1) : 0
    };
  }

  /**
   * Получает топ пользователей по активности
   * @param {number} limit - Количество пользователей в топе
   * @returns {Array} Массив топ пользователей
   */
  getTopUsers(limit = 10) {
    const data = this.readUserData();
    const users = Object.values(data.users);
    
    return users
      .sort((a, b) => b.portfolioRequests - a.portfolioRequests)
      .slice(0, limit)
      .map(user => ({
        name: user.firstName || user.username || `User ${user.id}`,
        portfolioRequests: user.portfolioRequests,
        successfulRequests: user.successfulRequests,
        totalImages: user.totalImages,
        lastSeen: user.lastSeen
      }));
  }

  /**
   * Форматирует статистику для отображения
   * @returns {string} Отформатированная статистика
   */
  formatStats() {
    const stats = this.getStats();
    const topUsers = this.getTopUsers(5);
    
    let message = `📊 СТАТИСТИКА БОТА\n\n`;
    message += `👥 Всего пользователей: ${stats.totalUsers}\n`;
    message += `🟢 Активных за неделю: ${stats.activeUsers}\n`;
    message += `✅ Успешно использовали: ${stats.successfulUsers}\n\n`;
    
    message += `📈 ЗАПРОСЫ\n`;
    message += `📋 Всего запросов: ${stats.totalRequests}\n`;
    message += `✅ Успешных: ${stats.totalSuccessful}\n`;
    message += `❌ Неудачных: ${stats.totalFailed}\n`;
    message += `📊 Успешность: ${stats.successRate}%\n\n`;
    
    message += `🖼️ ИЗОБРАЖЕНИЯ\n`;
    message += `📸 Всего создано: ${stats.totalImages}\n`;
    message += `📊 В среднем на пользователя: ${stats.averageImagesPerUser}\n\n`;
    
    if (topUsers.length > 0) {
      message += `🏆 ТОП ПОЛЬЗОВАТЕЛЕЙ\n`;
      topUsers.forEach((user, index) => {
        message += `${index + 1}. ${user.name}: ${user.portfolioRequests} запросов\n`;
      });
    }
    
    return message;
  }

  /**
   * Получает список всех пользователей для рассылки
   * @param {Object} filters - Фильтры для отбора пользователей
   * @returns {Array} Массив пользователей с chatId
   */
  getUsersForBroadcast(filters = {}) {
    const data = this.readUserData();
    const users = Object.values(data.users);
    
    let filteredUsers = users;
    
    // Фильтр по активности (дни)
    if (filters.activeDays) {
      const cutoffDate = new Date(Date.now() - filters.activeDays * 24 * 60 * 60 * 1000);
      filteredUsers = filteredUsers.filter(user => {
        const lastSeen = new Date(user.lastSeen);
        return lastSeen > cutoffDate;
      });
    }
    
    // Фильтр по успешным запросам
    if (filters.hasSuccessfulRequests) {
      filteredUsers = filteredUsers.filter(user => user.successfulRequests > 0);
    }
    
    // Фильтр по минимальному количеству запросов
    if (filters.minRequests) {
      filteredUsers = filteredUsers.filter(user => user.portfolioRequests >= filters.minRequests);
    }
    
    // Возвращаем только необходимые данные для рассылки
    return filteredUsers.map(user => ({
      chatId: user.chatId,
      firstName: user.firstName,
      username: user.username,
      lastSeen: user.lastSeen,
      portfolioRequests: user.portfolioRequests,
      successfulRequests: user.successfulRequests
    }));
  }

  /**
   * Получает активных пользователей за определенный период
   * @param {number} days - Количество дней (по умолчанию 30)
   * @returns {Array} Массив активных пользователей
   */
  getActiveUsers(days = 30) {
    return this.getUsersForBroadcast({ activeDays: days });
  }

  /**
   * Получает пользователей, которые успешно использовали бота
   * @returns {Array} Массив пользователей с успешными запросами
   */
  getSuccessfulUsers() {
    return this.getUsersForBroadcast({ hasSuccessfulRequests: true });
  }

  /**
   * Получает самых активных пользователей
   * @param {number} minRequests - Минимальное количество запросов
   * @returns {Array} Массив активных пользователей
   */
  getVeryActiveUsers(minRequests = 2) {
    return this.getUsersForBroadcast({ minRequests });
  }

  /**
   * Логирует отправку рассылки
   * @param {string} broadcastType - Тип рассылки
   * @param {number} sentCount - Количество отправленных сообщений
   * @param {number} totalCount - Общее количество пользователей
   */
  logBroadcast(broadcastType, sentCount, totalCount) {
    const data = this.readUserData();
    
    if (!data.broadcasts) {
      data.broadcasts = [];
    }
    
    data.broadcasts.push({
      type: broadcastType,
      sentCount,
      totalCount,
      successRate: ((sentCount / totalCount) * 100).toFixed(1),
      timestamp: new Date().toISOString()
    });
    
    // Оставляем только последние 50 рассылок
    if (data.broadcasts.length > 50) {
      data.broadcasts = data.broadcasts.slice(-50);
    }
    
    this.writeUserData(data);
    console.log(`📢 Рассылка "${broadcastType}": отправлено ${sentCount}/${totalCount} сообщений`);
  }
}

module.exports = UserLogger; 
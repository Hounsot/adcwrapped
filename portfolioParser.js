const axios = require('axios');
const cheerio = require('cheerio');

class PortfolioParser {
  constructor() {
    this.baseUrl = 'https://portfolio.hse.ru';
    this.apiUrl = 'https://api.mediiia.ru/qualities/api/LikeStatistics/GetByEntity';
    this.viewsApiUrl = 'https://api.mediiia.ru/qualities/api/View/UpdateView';
    this.browser = null;
  }

  /**
   * Инициализирует браузер для парсинга просмотров
   */
  async initBrowser() {
    if (!this.browser) {
      const puppeteer = require('puppeteer');
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  /**
   * Закрывает браузер
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Извлекает ID студента из ссылки на портфолио
   * @param {string} portfolioUrl - Ссылка на портфолио студента
   * @returns {string|null} ID студента
   */
  extractStudentId(portfolioUrl) {
    const match = portfolioUrl.match(/\/Student\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Получает список проектов студента
   * @param {string} studentId - ID студента
   * @returns {Promise<Object>} Данные о проектах
   */
  async getStudentProjects(studentId) {
    try {
      const url = `${this.baseUrl}/Project/ProjectsDataWithDebts?type=1&disciplineType=&disciplineId=&groupId=&year=&moduleId=&course=&searchString=&maxTotalMark=&sortType=5&sortDirection=1&page=1&authorId=${studentId}&curatorId=`;
      
      console.log(`Получаю проекты для студента ${studentId}...`);
      const response = await axios.get(url);
      
      if (!response.data || !response.data.projects) {
        throw new Error('Неверный формат ответа API');
      }

      return response.data;
    } catch (error) {
      console.error('Ошибка при получении проектов:', error.message);
      throw error;
    }
  }

  /**
   * Получает детальную информацию о проекте и ссылку на HseDesign
   * @param {number} projectId - ID проекта
   * @returns {Promise<Object|null>} Информация о проекте
   */
  async getProjectDetails(projectId) {
    try {
      const url = `${this.baseUrl}/Project/${projectId}`;
      console.log(`Получаю детали проекта ${projectId}...`);
      
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      // Ищем ссылку на HseDesign в блоке work-tags
      const hseDesignLink = $('.work-tags a[href*="hsedesign.ru"]').attr('href');
      
      if (hseDesignLink) {
        // Извлекаем ID проекта из ссылки HseDesign
        const hseDesignId = this.extractHseDesignId(hseDesignLink);
        return {
          hasHseDesignLink: true,
          hseDesignId: hseDesignId,
          hseDesignUrl: hseDesignLink
        };
      }
      
      return {
        hasHseDesignLink: false,
        hseDesignId: null,
        hseDesignUrl: null
      };
    } catch (error) {
      console.error(`Ошибка при получении деталей проекта ${projectId}:`, error.message);
      return null;
    }
  }

  /**
   * Извлекает ID проекта из ссылки HseDesign
   * @param {string} hseDesignUrl - Ссылка на проект в HseDesign
   * @returns {string|null} ID проекта в HseDesign
   */
  extractHseDesignId(hseDesignUrl) {
    const match = hseDesignUrl.match(/\/project\/([a-f0-9]+)/);
    return match ? match[1] : null;
  }

  /**
   * Получает статистику лайков для проекта в HseDesign
   * @param {string} hseDesignId - ID проекта в HseDesign
   * @returns {Promise<Object|null>} Статистика лайков
   */
  async getHseDesignLikes(hseDesignId) {
    try {
      const url = `${this.apiUrl}?entityId=${hseDesignId}&entityType=project`;
      console.log(`Получаю лайки для проекта ${hseDesignId}...`);
      
      const response = await axios.get(url);
      
      if (response.data) {
        const totalLikes = (response.data.count || 0) + (response.data.notAuthLikesCount || 0);
        return {
          count: response.data.count || 0,
          notAuthLikesCount: response.data.notAuthLikesCount || 0,
          totalLikes: totalLikes
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Ошибка при получении лайков для ${hseDesignId}:`, error.message);
      return null;
    }
  }

  /**
   * Получает количество просмотров проекта через API
   * @param {string} hseDesignId - ID проекта в HseDesign
   * @param {string} hseDesignUrl - URL проекта (для fallback метода при ошибке)
   * @returns {Promise<number>} Количество просмотров
   */
  async getHseDesignViewsAPI(hseDesignId, hseDesignUrl = null) {
    try {
      console.log(`Получаю просмотры через API для проекта ${hseDesignId}...`);
      
      // Правильная структура запроса (найдена экспериментально!)
      const requestData = {
        entityId: hseDesignId,
        entityType: "project",
        context: "hsedesign"
      };
      
      const response = await axios.post(this.viewsApiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          'Origin': 'https://hsedesign.ru',
          'Referer': 'https://hsedesign.ru/',
          'Application-Context': 'hsedesign'  // Критически важный заголовок!
        }
      });
      
      if (response.data && typeof response.data.count === 'number') {
        const views = response.data.count;
        console.log(`✅ Найдено просмотров через API: ${views}`);
        return views;
      }
      
      console.log('API не вернул данные о просмотрах');
      return 0;
    } catch (error) {
      console.error(`❌ Ошибка при получении просмотров через API для ${hseDesignId}:`, error.message);
      
      // Fallback на браузерный метод, если есть URL
      if (hseDesignUrl) {
        console.log('Используем fallback метод через браузер');
        try {
          return await this.getHseDesignViews(hseDesignUrl);
        } catch (fallbackError) {
          console.error('Fallback метод также не сработал:', fallbackError.message);
        }
      }
      
      return 0;
    }
  }

  /**
   * Получает количество просмотров проекта с HseDesign страницы
   * @param {string} hseDesignUrl - URL проекта в HseDesign
   * @returns {Promise<number>} Количество просмотров
   */
  async getHseDesignViews(hseDesignUrl) {
    try {
      console.log(`Получаю просмотры для ${hseDesignUrl}...`);
      
      // Инициализируем браузер если нужно
      await this.initBrowser();
      
      const page = await this.browser.newPage();
      
      try {
        // Устанавливаем User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Переходим на страницу с коротким таймаутом
        await page.goto(hseDesignUrl, { 
          waitUntil: 'networkidle0',
          timeout: 10000 
        });
        
        // Дополнительная задержка для загрузки JS
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Ждем загрузки элемента с просмотрами (короткий таймаут)
        await page.waitForSelector('.view-count-text', { timeout: 3000 });
        
        // Получаем текст из элемента
        const viewsText = await page.$eval('.view-count-text', el => el.textContent.trim());
        
        if (viewsText) {
          // Парсим число из текста (может быть в формате "377", "1.2к", "2.9к" и т.д.)
          let views = 0;
          if (viewsText.includes('к')) {
            // Если в формате "2.9к"
            const number = parseFloat(viewsText.replace('к', ''));
            views = Math.round(number * 1000);
          } else if (viewsText.includes('м')) {
            // Если в формате "1.2м"
            const number = parseFloat(viewsText.replace('м', ''));
            views = Math.round(number * 1000000);
          } else {
            // Обычное число
            views = parseInt(viewsText.replace(/\s/g, '')) || 0;
          }
          
          console.log(`Найдено просмотров: ${views} (текст: "${viewsText}")`);
          return views;
        }
        
        return 0;
      } finally {
        await page.close();
      }
    } catch (error) {
      console.error(`Ошибка при получении просмотров для ${hseDesignUrl}:`, error.message);
      return 0;
    }
  }

  /**
   * Основная функция для сбора всех данных о студенте
   * @param {string} portfolioUrl - Ссылка на портфолио студента
   * @returns {Promise<Object>} Полные данные о студенте и его проектах
   */
  async parseStudentData(portfolioUrl) {
    try {
      console.log('Начинаю парсинг данных студента...');
      
      // 1. Извлекаем ID студента
      const studentId = this.extractStudentId(portfolioUrl);
      if (!studentId) {
        throw new Error('Не удалось извлечь ID студента из ссылки');
      }
      
      console.log(`ID студента: ${studentId}`);
      
      // 2. Получаем список проектов
      const projectsData = await this.getStudentProjects(studentId);
      const projects = projectsData.projects || [];
      
      console.log(`Найдено проектов: ${projects.length}`);
      
      // 3. Обрабатываем каждый проект
      const enrichedProjects = [];
      
      for (const project of projects) {
        console.log(`Обрабатываю проект: ${project.title}`);
        
        const projectInfo = {
          id: project.id,
          title: project.title,
          totalMark: project.totalMark,
          rating: project.rating,
          moduleName: project.moduleName,
          coverImageUrl: project.coverImageUrl,
          groupName: project.groupName,
          courseNum: project.courseNum,
          views: project.views || 0,
          hseDesignLikes: 0,
          hasHseDesignLink: false,
          authors: project.authors || [],
          teamSize: project.authors ? project.authors.length : 1
        };
        
        // Получаем детали проекта только для проверки ссылки на HseDesign
        const projectDetails = await this.getProjectDetails(project.id);
        
        if (projectDetails && projectDetails.hasHseDesignLink) {
          projectInfo.hasHseDesignLink = true;
          projectInfo.hseDesignId = projectDetails.hseDesignId;
          projectInfo.hseDesignUrl = projectDetails.hseDesignUrl;
          
          // Получаем статистику лайков
          const likesData = await this.getHseDesignLikes(projectDetails.hseDesignId);
          if (likesData) {
            projectInfo.hseDesignLikes = likesData.totalLikes;
            projectInfo.likesBreakdown = likesData;
          }
          
          // Получаем количество просмотров через API
          const hseDesignViews = await this.getHseDesignViewsAPI(projectDetails.hseDesignId, projectDetails.hseDesignUrl);
          projectInfo.hseDesignViews = hseDesignViews;
          
          // Обновляем общее количество просмотров (портфолио + HseDesign)
          projectInfo.views = (project.views || 0) + hseDesignViews;
          
          // Небольшая задержка после получения просмотров
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        enrichedProjects.push(projectInfo);
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 4. Формируем итоговые данные
      const studentData = {
        studentId: studentId,
        studentName: projects[0]?.authors[0]?.name || 'Неизвестно',
        groupName: projects[0]?.groupName || 'Неизвестно',
        learningForm: projects[0]?.learningFormName || 'Неизвестно',
        course: projects[0]?.courseNum || 'Неизвестно',
        totalProjects: projects.length,
        projects: enrichedProjects,
        statistics: this.calculateStatistics(enrichedProjects),
        parsedAt: new Date().toISOString()
      };
      
      console.log('Парсинг завершен успешно!');
      return studentData;
      
    } catch (error) {
      console.error('Ошибка при парсинге данных студента:', error.message);
      throw error;
    } finally {
      // Закрываем браузер после завершения парсинга
      await this.closeBrowser();
    }
  }

  /**
   * Вычисляет статистику по проектам
   * @param {Array} projects - Массив проектов
   * @returns {Object} Статистика
   */
  calculateStatistics(projects) {
    const totalProjects = projects.length;
    const projectsWithHseDesign = projects.filter(p => p.hasHseDesignLink).length;
    const totalLikes = projects.reduce((sum, p) => sum + p.hseDesignLikes, 0);
    const totalViews = projects.reduce((sum, p) => sum + (p.views || 0), 0);
    const averageMark = projects.reduce((sum, p) => sum + p.totalMark, 0) / totalProjects;
    const averageRating = projects.reduce((sum, p) => sum + p.rating, 0) / totalProjects;
    
    // Статистика по командным проектам
    const teamProjects = projects.filter(p => p.teamSize > 1);
    const soloProjects = projects.filter(p => p.teamSize === 1);
    const totalTeamMembers = projects.reduce((sum, p) => sum + (p.teamSize - 1), 0); // Исключаем самого студента
    
    // Уникальные соавторы (исключаем самого студента)
    const studentName = projects[0]?.authors?.[0]?.name; // Получаем имя студента из первого проекта
    const uniqueTeammates = new Set();
    projects.forEach(p => {
      if (p.authors && p.authors.length > 1) {
        p.authors.forEach(author => {
          // Добавляем всех авторов кроме самого студента
          if (author.name && author.name !== studentName) {
            uniqueTeammates.add(author.name);
          }
        });
      }
    });

    // Формируем список соавторов для вывода
    const teammatesArray = Array.from(uniqueTeammates);
    let teammatesList = '';
    if (teammatesArray.length > 0) {
      if (teammatesArray.length <= 3) {
        teammatesList = teammatesArray.join(', ');
      } else {
        const firstThree = teammatesArray.slice(0, 3).join(', ');
        const remaining = teammatesArray.length - 3;
        teammatesList = `${firstThree} и ещё ${remaining}`;
      }
    }
    
    const markDistribution = {};
    projects.forEach(p => {
      markDistribution[p.totalMark] = (markDistribution[p.totalMark] || 0) + 1;
    });
    
    const moduleDistribution = {};
    projects.forEach(p => {
      moduleDistribution[p.moduleName] = (moduleDistribution[p.moduleName] || 0) + 1;
    });
    
    return {
      totalProjects,
      projectsWithHseDesign,
      totalLikes,
      totalViews,
      averageMark: Math.round(averageMark * 100) / 100,
      averageRating: Math.round(averageRating * 100) / 100,
      markDistribution,
      moduleDistribution,
      // Статистика по командной работе
      teamProjects: teamProjects.length,
      soloProjects: soloProjects.length,
      totalTeamMembers: totalTeamMembers,
      uniqueTeammates: uniqueTeammates.size,
      teammatesList: teammatesList,
      teammatesArray: teammatesArray, // Массив имен для ImageGenerator
      averageTeamSize: teamProjects.length > 0 ? 
        Math.round((teamProjects.reduce((sum, p) => sum + p.teamSize, 0) / teamProjects.length) * 10) / 10 : 0,
      bestProject: projects.reduce((best, current) => 
        current.totalMark > best.totalMark ? current : best, projects[0]),
      mostLikedProject: projects.reduce((most, current) => 
        current.hseDesignLikes > most.hseDesignLikes ? current : most, projects[0])
    };
  }
}

module.exports = PortfolioParser; 
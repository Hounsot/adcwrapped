const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class ImageGenerator {
  constructor() {
    this.browser = null;
    this.templatesDir = path.join(__dirname, 'templates');
    this.outputDir = path.join(__dirname, 'assets', 'generated');
  }

  /**
   * Склоняет русские слова в зависимости от числа
   * @param {number} count - Количество
   * @param {Array} forms - Массив форм [1, 2-4, 5+] например: ['лайк', 'лайка', 'лайков']
   * @returns {string} Правильная форма слова
   */
  pluralize(count, forms) {
    const n = Math.abs(count);
    const n10 = n % 10;
    const n100 = n % 100;
    
    if (n100 >= 11 && n100 <= 19) {
      return forms[2]; // 11-19: лайков, просмотров, коллабораций
    }
    
    if (n10 === 1) {
      return forms[0]; // 1, 21, 31...: лайк, просмотр, коллаборация
    }
    
    if (n10 >= 2 && n10 <= 4) {
      return forms[1]; // 2-4, 22-24...: лайка, просмотра, коллаборации
    }
    
    return forms[2]; // 0, 5-20, 25-30...: лайков, просмотров, коллабораций
  }

  /**
   * Инициализация браузера
   */
  async init() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  /**
   * Закрытие браузера
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Генерирует HTML из шаблона с данными
   * @param {string} templateName - Имя шаблона
   * @param {Object} data - Данные для подстановки
   * @returns {string} HTML код
   */
  generateHTML(templateName, data) {
    const templatePath = path.join(this.templatesDir, `${templateName}.html`);
    let html = fs.readFileSync(templatePath, 'utf8');
    
    // Простая замена плейсхолдеров
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`;
      html = html.replace(new RegExp(placeholder, 'g'), data[key]);
    });
    
    return html;
  }

  /**
   * Рендерит HTML в изображение
   * @param {string} html - HTML код
   * @param {string} outputPath - Путь для сохранения
   * @param {Object} options - Опции рендеринга
   */
  async renderToImage(html, outputPath, options = {}) {
    await this.init();
    
    const page = await this.browser.newPage();
    
    // Устанавливаем размер страницы
    await page.setViewport({
      width: options.width || 1080,
      height: options.height || 1920,
      deviceScaleFactor: 2
    });
    
    // Загружаем HTML
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Делаем скриншот
    await page.screenshot({
      path: outputPath,
      type: 'png',
      fullPage: false
    });
    
    await page.close();
  }

  /**
   * Генерирует изображение статистики студента
   * @param {Object} studentData - Данные студента
   * @returns {Array} Массив путей к созданным изображениям
   */
  async generateStudentStats(studentData) {
    const images = [];
    const timestamp = Date.now();
    
    // Слайд 0: Приветствие
    const welcomeData = {
      studentName: studentData.studentName
    };
    
    const welcomeHTML = this.generateHTML('welcome', welcomeData);
    const welcomePath = path.join(this.outputDir, `stats-welcome-${timestamp}.png`);
    await this.renderToImage(welcomeHTML, welcomePath);
    images.push(welcomePath);
    
    // Слайд 1: Самая высокая оценка
    if (studentData.projects && studentData.projects.length > 0) {
      const highestData = this.calculateMarkStatistics(studentData.projects);
      
      // Генерируем слайд только если есть оценки
      if (highestData.highestMark > 0) {
        const highestHTML = this.generateHTML('highest', highestData);
        const highestPath = path.join(this.outputDir, `stats-highest-${timestamp}.png`);
        await this.renderToImage(highestHTML, highestPath);
        images.push(highestPath);
      }
    }
    
    // Слайд 2: Общее количество лайков (если есть лайки)
    if (studentData.statistics.totalLikes > 0) {
      const likesData = {
        totalLikes: studentData.statistics.totalLikes,
        likesWord: this.pluralize(studentData.statistics.totalLikes, ['лайк', 'лайка', 'лайков'])
      };
      
      const likesHTML = this.generateHTML('likes', likesData);
      const likesPath = path.join(this.outputDir, `stats-likes-${timestamp}.png`);
      await this.renderToImage(likesHTML, likesPath);
      images.push(likesPath);
    }
    
    // Слайд 3: Общее количество просмотров (если есть просмотры)
    if (studentData.statistics.totalViews > 0) {
      const viewsData = {
        totalViews: studentData.statistics.totalViews,
        viewsWord: this.pluralize(studentData.statistics.totalViews, ['просмотр', 'просмотра', 'просмотров'])
      };
      
      const viewsHTML = this.generateHTML('views', viewsData);
      const viewsPath = path.join(this.outputDir, `stats-views-${timestamp}.png`);
      await this.renderToImage(viewsHTML, viewsPath);
      images.push(viewsPath);
    }
    
    // Слайд 4: Коллаборации (если есть командные проекты)
    if (studentData.statistics.teamProjects > 0 && studentData.statistics.uniqueTeammates > 0) {
      const collabsData = {
        totalCollabs: studentData.statistics.uniqueTeammates,
        collabsWord: this.pluralize(studentData.statistics.uniqueTeammates, ['коллаборация', 'коллаборации', 'коллабораций']),
        teammatesList: this.formatTeammatesList(studentData.statistics.teammatesArray)
      };
      
      const collabsHTML = this.generateHTML('collabs', collabsData);
      const collabsPath = path.join(this.outputDir, `stats-collabs-${timestamp}.png`);
      await this.renderToImage(collabsHTML, collabsPath);
      images.push(collabsPath);
    }
    
    return images;
  }

  /**
   * Рассчитывает статистику по оценкам
   * @param {Array} projects - Массив проектов студента
   * @returns {Object} Статистика по оценкам
   */
  calculateMarkStatistics(projects) {
    const marks = projects.map(p => p.totalMark).filter(mark => mark && mark > 0);
    
    if (marks.length === 0) {
      return {
        highestMark: 0,
        count10: 0,
        count9: 0,
        count8: 0,
        percent10: 0,
        percent9: 0,
        percent8: 0
      };
    }
    
    const highestMark = Math.max(...marks);
    const count10 = marks.filter(mark => mark === 10).length;
    const count9 = marks.filter(mark => mark === 9).length;
    const count8 = marks.filter(mark => mark === 8).length;
    
    const total = marks.length;
    const percent10 = total > 0 ? Math.round((count10 / total) * 100) : 0;
    const percent9 = total > 0 ? Math.round((count9 / total) * 100) : 0;
    const percent8 = total > 0 ? Math.round((count8 / total) * 100) : 0;
    
    return {
      highestMark,
      count10,
      count9,
      count8,
      percent10,
      percent9,
      percent8
    };
  }

  /**
   * Форматирует список товарищей по команде для отображения
   * @param {Array} teammatesList - Массив имен товарищей по команде
   * @returns {string} HTML с отдельными <p> элементами
   */
  formatTeammatesList(teammatesList) {
    if (!teammatesList || teammatesList.length === 0) {
      return '<p>с ребятами из ВШЭ</p>';
    }
    
    let html = '';
    
    // Показываем первых 3 товарищей
    const displayNames = teammatesList.slice(0, 3);
    displayNames.forEach(name => {
      html += `<p>${name}</p>`;
    });
    
    // Если товарищей больше 3, добавляем "и еще X" с правильным склонением
    if (teammatesList.length > 3) {
      const remaining = teammatesList.length - 3;
      const remainingWord = this.pluralize(remaining, ['человек', 'человека', 'человек']);
      html += `<p class="U_Last">и еще ${remaining} ${remainingWord}</p>`;
    }
    
    return html;
  }
}

module.exports = ImageGenerator; 
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
    
    // Слайд 1: Основная статистика
    const mainStatsData = {
      studentName: studentData.studentName,
      totalProjects: studentData.statistics.totalProjects,
      averageMark: studentData.statistics.averageMark.toFixed(1),
      totalLikes: studentData.statistics.totalLikes,
      projectsWithHseDesign: studentData.statistics.projectsWithHseDesign
    };
    
    const mainStatsHTML = this.generateHTML('main-stats', mainStatsData);
    const mainStatsPath = path.join(this.outputDir, `stats-main-${timestamp}.png`);
    await this.renderToImage(mainStatsHTML, mainStatsPath);
    images.push(mainStatsPath);
    
    // Слайд 2: Командная работа (если есть групповые проекты)
    if (studentData.statistics.teamProjects > 0) {
      const teamStatsData = {
        studentName: studentData.studentName,
        teamProjects: studentData.statistics.teamProjects,
        teammatesList: studentData.statistics.teammatesList,
        uniqueTeammates: studentData.statistics.uniqueTeammates
      };
      
      const teamStatsHTML = this.generateHTML('team-stats', teamStatsData);
      const teamStatsPath = path.join(this.outputDir, `stats-team-${timestamp}.png`);
      await this.renderToImage(teamStatsHTML, teamStatsPath);
      images.push(teamStatsPath);
    }
    
    // Слайд 3: Лучшие проекты
    const bestProjectsData = {
      studentName: studentData.studentName,
      bestProjectTitle: studentData.statistics.bestProject.title,
      bestProjectMark: studentData.statistics.bestProject.totalMark,
      mostLikedProjectTitle: studentData.statistics.mostLikedProject.title,
      mostLikedProjectLikes: studentData.statistics.mostLikedProject.hseDesignLikes
    };
    
    const bestProjectsHTML = this.generateHTML('best-projects', bestProjectsData);
    const bestProjectsPath = path.join(this.outputDir, `stats-projects-${timestamp}.png`);
    await this.renderToImage(bestProjectsHTML, bestProjectsPath);
    images.push(bestProjectsPath);
    
    return images;
  }
}

module.exports = ImageGenerator; 
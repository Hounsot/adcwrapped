const PortfolioParser = require('./portfolioParser');

async function testParser() {
  const parser = new PortfolioParser();
  
  // Тестируем с вашим примером
  const portfolioUrl = 'https://portfolio.hse.ru/Student/17647';
  
  try {
    console.log('🚀 Начинаю тестирование парсера...\n');
    
    const studentData = await parser.parseStudentData(portfolioUrl);
    
    console.log('\n📊 РЕЗУЛЬТАТЫ ПАРСИНГА:');
    console.log('========================');
    console.log(`👤 Студент: ${studentData.studentName}`);
    console.log(`🎓 Группа: ${studentData.groupName}`);
    console.log(`📚 Курс: ${studentData.course}`);
    console.log(`📁 Всего проектов: ${studentData.totalProjects}`);
    console.log(`🔗 Проектов с HseDesign: ${studentData.statistics.projectsWithHseDesign}`);
    console.log(`❤️ Общее количество лайков: ${studentData.statistics.totalLikes}`);
    console.log(`📈 Средняя оценка: ${studentData.statistics.averageMark}`);
    console.log(`⭐ Средний рейтинг: ${studentData.statistics.averageRating}`);
    
    console.log('\n🏆 ЛУЧШИЕ ПРОЕКТЫ:');
    console.log('==================');
    console.log(`🥇 Лучший по оценке: "${studentData.statistics.bestProject.title}" (${studentData.statistics.bestProject.totalMark} баллов)`);
    console.log(`💖 Самый популярный: "${studentData.statistics.mostLikedProject.title}" (${studentData.statistics.mostLikedProject.hseDesignLikes} лайков)`);
    
    console.log('\n📋 СПИСОК ПРОЕКТОВ:');
    console.log('===================');
    studentData.projects.forEach((project, index) => {
      console.log(`${index + 1}. "${project.title}"`);
      console.log(`   📊 Оценка: ${project.totalMark} | ⭐ Рейтинг: ${project.rating} | 📅 ${project.moduleName}`);
      if (project.hasHseDesignLink) {
        console.log(`   🔗 HseDesign: ${project.hseDesignLikes} лайков`);
      }
      console.log('');
    });
    
    // Сохраняем результат в файл для дальнейшего использования
    const fs = require('fs');
    fs.writeFileSync('student_data.json', JSON.stringify(studentData, null, 2));
    console.log('💾 Данные сохранены в student_data.json');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
  }
}

// Запускаем тест
testParser(); 
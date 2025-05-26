const ImageGenerator = require('./imageGenerator');
const studentData = require('./student_data.json');

async function testImageGeneration() {
  console.log('🎨 Начинаю генерацию изображений...');
  
  const generator = new ImageGenerator();
  
  try {
    const images = await generator.generateStudentStats(studentData);
    
    console.log('✅ Изображения созданы успешно!');
    console.log('📁 Созданные файлы:');
    images.forEach((imagePath, index) => {
      console.log(`${index + 1}. ${imagePath}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка при генерации изображений:', error);
  } finally {
    await generator.close();
  }
}

testImageGeneration(); 
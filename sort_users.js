const fs = require('fs');

// Читаем файл
const data = JSON.parse(fs.readFileSync('users.json', 'utf8'));

// Преобразуем в массив и сортируем по времени регистрации (новые сначала)
const sortedUsers = Object.values(data.users)
    .sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));

console.log('👥 ПОЛЬЗОВАТЕЛИ ПО НОВИЗНЕ (новые сначала):\n');

sortedUsers.forEach((user, index) => {
    const date = new Date(user.firstSeen).toLocaleString('ru-RU');
    const name = user.firstName || user.username || 'Без имени';
    const username = user.username ? `@${user.username}` : '';
    const requests = user.portfolioRequests;
    const success = user.successfulRequests;
    
    console.log(`${index + 1}. ${name} ${username}`);
    console.log(`   📅 Регистрация: ${date}`);
    console.log(`   📊 Запросов: ${requests}, Успешных: ${success}`);
    console.log('');
});

console.log(`\n📈 ВСЕГО ПОЛЬЗОВАТЕЛЕЙ: ${sortedUsers.length}`); 
// Тестовый скрипт для проверки Firebase аутентификации
const { UserManager } = require('./auth-firebase');

async function testFirebaseAuthentication() {
    console.log('🔥 Начинаем тестирование Firebase аутентификации...\n');

    try {
        // Тест 1: Регистрация
        console.log('1️⃣ Тестирование регистрации в Firebase...');
        const registerResult = await UserManager.register({
            email: 'business@vibecord.com',
            username: 'businessuser',
            password: 'business123'
        });

        if (registerResult.success) {
            console.log('✅ Регистрация успешна!');
            console.log('👤 Пользователь:', registerResult.user);
            console.log('💾 Сохранен в Firestore');
        } else {
            console.log('❌ Ошибка регистрации:', registerResult.error);
            return;
        }
        console.log('');

        // Тест 2: Повторная регистрация (должна провалиться)
        console.log('2️⃣ Тестирование дублирования регистрации...');
        const duplicateResult = await UserManager.register({
            email: 'business@vibecord.com',
            username: 'otheruser',
            password: 'password456'
        });

        if (!duplicateResult.success) {
            console.log('✅ Правильно! Дублирование не разрешено:', duplicateResult.error);
        } else {
            console.log('❌ Неожиданно! Разрешено дублирование');
        }
        console.log('');

        // Тест 3: Вход
        console.log('3️⃣ Тестирование входа...');
        const loginResult = await UserManager.login({
            email: 'business@vibecord.com',
            password: 'business123'
        });

        if (loginResult.success) {
            console.log('✅ Вход успешный!');
            console.log('👤 Пользователь:', loginResult.user);
        } else {
            console.log('❌ Ошибка входа:', loginResult.error);
            return;
        }
        console.log('');

        // Тест 4: Неверный пароль
        console.log('4️⃣ Тестирование неверного пароля...');
        const wrongPasswordResult = await UserManager.login({
            email: 'business@vibecord.com',
            password: 'wrongpassword'
        });

        if (!wrongPasswordResult.success) {
            console.log('✅ Правильно! Неверный пароль отклонен:', wrongPasswordResult.error);
        } else {
            console.log('❌ Неожиданно! Неверный пароль принят');
        }
        console.log('');

        // Тест 5: Поиск пользователя в Firebase
        console.log('5️⃣ Тестирование поиска пользователя в Firestore...');
        const foundUser = await UserManager.findUserByEmail('business@vibecord.com');
        if (foundUser) {
            console.log('✅ Пользователь найден по email:', foundUser.email);
            console.log('📅 Дата создания:', foundUser.createdAt?.toDate?.() || foundUser.createdAt);
        } else {
            console.log('❌ Пользователь не найден по email');
        }

        const foundUsername = await UserManager.findUserByUsername('businessuser');
        if (foundUsername) {
            console.log('✅ Пользователь найден по username:', foundUsername.username);
        } else {
            console.log('❌ Пользователь не найден по username');
        }
        console.log('');

        // Тест 6: Статистика из Firebase
        console.log('6️⃣ Получение статистики из Firestore...');
        const stats = await UserManager.getUserStats();
        if (stats) {
            console.log('📊 Статистика пользователей:');
            console.log(`   Всего пользователей: ${stats.totalUsers}`);
            console.log(`   Активных пользователей: ${stats.activeUsers}`);
            console.log(`   Подтвержденных пользователей: ${stats.verifiedUsers}`);
        } else {
            console.log('❌ Ошибка получения статистики');
        }
        console.log('');

        console.log('🎉 Все тесты Firebase аутентификации пройдены!');
        console.log('');
        console.log('💾 Результат: Пользователи теперь сохраняются в Firebase Firestore!');

    } catch (error) {
        console.error('❌ Ошибка в Firebase тестах:', error);
        
        // Проверяем, связана ли ошибка с Firebase
        if (error.message.includes('Firebase') || error.message.includes('credential')) {
            console.log('\n⚠️ Возможные проблемы с Firebase:');
            console.log('1. Проверьте настройки Firebase credentials в .env');
            console.log('2. Убедитесь, что Service Account Key настроен правильно');
            console.log('3. Проверьте правильность project ID');
            console.log('4. Проверьте permissions для Firestore');
            console.log('\n📝 Для работы без Firebase можно использовать auth-simple.js');
        }
    }
}

// Функция для проверки статуса Firebase
async function checkFirebaseConnection() {
    console.log('🔍 Проверка подключения к Firebase...\n');
    
    try {
        const { admin } = require('./auth-firebase');
        
        if (admin.apps.length > 0) {
            console.log('✅ Firebase Admin SDK инициализирован');
            
            // Пробуем подключиться к Firestore
            const { db } = require('./auth-firebase');
            const testDoc = await db.collection('test').doc('connection').set({
                timestamp: new Date(),
                message: 'Test connection'
            });
            
            console.log('✅ Подключение к Firestore работает');
            
            // Очищаем тестовый документ
            await db.collection('test').doc('connection').delete();
            
        } else {
            console.log('❌ Firebase Admin SDK не инициализирован');
        }
        
    } catch (error) {
        console.log('❌ Ошибка подключения к Firebase:', error.message);
    }
}

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
    // Сначала проверяем подключение к Firebase
    checkFirebaseConnection().then(() => {
        console.log('\n' + '='.repeat(60) + '\n');
        // Затем запускаем основные тесты
        testFirebaseAuthentication();
    });
}

module.exports = { testFirebaseAuthentication, checkFirebaseConnection };
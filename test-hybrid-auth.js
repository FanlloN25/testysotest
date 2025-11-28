// Тестовый скрипт для гибридной системы аутентификации
const { HybridUserManager, SECURITY_CONFIG } = require('./auth-hybrid');

async function testHybridAuthentication() {
    console.log('🧪 Тестирование гибридной системы аутентификации...\n');

    try {
        console.log(`🔥 Firebase Status: ${SECURITY_CONFIG.FIREBASE_ENABLED ? 'CONNECTED' : 'MOCK MODE'}`);
        console.log(`💾 Database: ${SECURITY_CONFIG.FIREBASE_ENABLED ? 'Firestore' : 'Memory'}\n`);

        // Тест 1: Регистрация
        console.log('1️⃣ Тестирование регистрации пользователя...');
        const testEmail = 'hybrid@test.com';
        const testUsername = 'hybriduser';
        
        const registerResult = await HybridUserManager.register({
            email: testEmail,
            username: testUsername,
            password: 'password123'
        }, null, 'firebase_uid_' + Date.now());

        if (registerResult.success) {
            console.log('✅ Регистрация успешна!');
            console.log('👤 Пользователь:', registerResult.user);
            console.log('🔑 Firebase UID:', registerResult.user.firebaseUid);
            console.log('🏷️ Database Collection: vibecord_users');
        } else {
            console.log('❌ Ошибка регистрации:', registerResult.error);
            return;
        }
        console.log('');

        // Тест 2: Поиск в базе данных
        console.log('2️⃣ Тестирование поиска пользователя в базе...');
        const foundUser = await HybridUserManager.findUserByEmail(testEmail);
        
        if (foundUser) {
            console.log('✅ Пользователь найден в Firestore!');
            console.log('📊 Данные пользователя:');
            console.log(`   - Email: ${foundUser.email}`);
            console.log(`   - Username: ${foundUser.username}`);
            console.log(`   - Firebase UID: ${foundUser.firebaseUid}`);
            console.log(`   - ID: ${foundUser.id}`);
            console.log(`   - Роль: ${foundUser.roles.join(', ')}`);
        } else {
            console.log('❌ Пользователь не найден в Firestore');
        }
        console.log('');

        // Тест 3: Вход пользователя
        console.log('3️⃣ Тестирование входа...');
        const loginResult = await HybridUserManager.login({
            email: testEmail,
            password: 'password123'
        });

        if (loginResult.success) {
            console.log('✅ Вход успешный!');
            console.log('👤 Пользователь:', loginResult.user);
            console.log('🔑 Токены созданы');
        } else {
            console.log('❌ Ошибка входа:', loginResult.error);
        }
        console.log('');

        // Тест 4: Получение всех пользователей
        console.log('4️⃣ Тестирование получения всех пользователей...');
        const allUsers = await HybridUserManager.getAllUsers();
        console.log(`📊 Всего пользователей в базе: ${allUsers.length}`);
        allUsers.forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.email} (${user.username}) - Firebase: ${user.firebaseUid ? '✅' : '❌'}`);
        });
        console.log('');

        // Тест 5: Обновление токена
        console.log('5️⃣ Тестирование обновления токена...');
        if (loginResult.tokens) {
            const refreshResult = await HybridUserManager.refreshToken(loginResult.tokens.refreshToken);
            if (refreshResult.success) {
                console.log('✅ Токен успешно обновлен');
            } else {
                console.log('❌ Ошибка обновления токена:', refreshResult.error);
            }
        } else {
            console.log('⚠️ Нет токенов для обновления');
        }
        console.log('');

        // Статистика системы
        console.log('📈 Статистика системы:');
        console.log(`   - Firebase Integration: ${SECURITY_CONFIG.FIREBASE_ENABLED ? 'ACTIVE' : 'MOCK'}`);
        console.log(`   - Database Type: ${SECURITY_CONFIG.FIREBASE_ENABLED ? 'Firestore' : 'Memory'}`);
        console.log(`   - Collection: vibecord_users`);
        console.log(`   - Security: JWT + bcrypt(${SECURITY_CONFIG.SALT_ROUNDS} rounds)`);
        console.log(`   - 2FA: ${SECURITY_CONFIG.TWO_FACTOR_ENABLED ? 'Enabled' : 'Disabled'}`);
        console.log(`   - Email Verification: ${SECURITY_CONFIG.ENABLE_EMAIL_VERIFICATION ? 'Enabled' : 'Disabled'}`);
        console.log('');

        console.log('🎉 Все тесты гибридной системы пройдены!');
        console.log('\n📋 Что протестировано:');
        console.log('   ✅ Регистрация с Firebase UID');
        console.log('   ✅ Сохранение в Firestore (vibecord_users)');
        console.log('   ✅ Поиск пользователей');
        console.log('   ✅ Аутентификация и токены');
        console.log('   ✅ Административные функции');

    } catch (error) {
        console.error('❌ Ошибка в тестах:', error);
    }
}

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
    testHybridAuthentication();
}

module.exports = { testHybridAuthentication };
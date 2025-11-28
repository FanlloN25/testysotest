// Тестовый скрипт для проверки системы аутентификации
const { UserManager } = require('./auth-simple');

async function testAuthentication() {
    console.log('🧪 Начинаем тестирование системы аутентификации...\n');

    try {
        // Тест 1: Регистрация
        console.log('1️⃣ Тестирование регистрации...');
        const registerResult = await UserManager.register({
            email: 'test@vibecord.com',
            username: 'testuser',
            password: 'password123'
        });

        if (registerResult.success) {
            console.log('✅ Регистрация успешна!');
            console.log('👤 Пользователь:', registerResult.user);
            console.log('🔑 Токены созданы:', Object.keys(registerResult.tokens));
        } else {
            console.log('❌ Ошибка регистрации:', registerResult.error);
            return;
        }
        console.log('');

        // Тест 2: Повторная регистрация (должна провалиться)
        console.log('2️⃣ Тестирование дублирования регистрации...');
        const duplicateResult = await UserManager.register({
            email: 'test@vibecord.com',
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
            email: 'test@vibecord.com',
            password: 'password123'
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
            email: 'test@vibecord.com',
            password: 'wrongpassword'
        });

        if (!wrongPasswordResult.success) {
            console.log('✅ Правильно! Неверный пароль отклонен:', wrongPasswordResult.error);
        } else {
            console.log('❌ Неожиданно! Неверный пароль принят');
        }
        console.log('');

        // Тест 5: Поиск пользователя
        console.log('5️⃣ Тестирование поиска пользователя...');
        const foundUser = UserManager.findUserByEmail('test@vibecord.com');
        if (foundUser) {
            console.log('✅ Пользователь найден по email:', foundUser.email);
        } else {
            console.log('❌ Пользователь не найден по email');
        }

        const foundUsername = UserManager.findUserByUsername('testuser');
        if (foundUsername) {
            console.log('✅ Пользователь найден по username:', foundUsername.username);
        } else {
            console.log('❌ Пользователь не найден по username');
        }
        console.log('');

        // Тест 6: Обновление токена
        console.log('6️⃣ Тестирование обновления токена...');
        const refreshResult = await UserManager.refreshToken(registerResult.tokens.refreshToken);
        if (refreshResult.success) {
            console.log('✅ Токен успешно обновлен');
        } else {
            console.log('❌ Ошибка обновления токена:', refreshResult.error);
        }
        console.log('');

        // Статистика
        console.log('📊 Статистика:');
        console.log(`Всего зарегистрированных пользователей: ${UserManager.users.size}`);
        UserManager.users.forEach((user, email) => {
            console.log(`   - ${email} (${user.username}) - попыток входа: ${user.failedLoginAttempts}`);
        });

        console.log('\n🎉 Все тесты пройдены успешно!');

    } catch (error) {
        console.error('❌ Ошибка в тестах:', error);
    }
}

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
    testAuthentication();
}

module.exports = { testAuthentication };
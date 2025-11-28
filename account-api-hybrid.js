// Гибридный API: Firebase Auth + Firestore + Server API
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { HybridUserManager, SecurityUtils, SECURITY_CONFIG, admin, firebaseConfig } = require('./auth-hybrid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware безопасности
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://www.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://softai-bd22a.firebaseapp.com", "https://www.googleapis.com", "https://firestore.googleapis.com"]
        },
    }
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000', 
        'http://localhost:8080', 
        'https://softai-bd22a.web.app',
        'https://softai-bd22a.firebaseapp.com'
    ],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Слишком много запросов, попробуйте позже',
        retryAfter: '15 минут'
    }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        error: 'Слишком много попыток входа',
        retryAfter: '15 минут'
    }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: {
        error: 'Слишком много попыток регистрации',
        retryAfter: '1 час'
    }
});

app.use(limiter);

// Вспомогательные middleware

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                error: 'Токен доступа отсутствует',
                code: 'TOKEN_MISSING'
            });
        }

        const decoded = SecurityUtils.verifyToken(token);
        const user = await HybridUserManager.findUserById(decoded.userId);

        if (!user || !user.isActive) {
            return res.status(403).json({ 
                error: 'Пользователь не найден или неактивен',
                code: 'USER_INVALID'
            });
        }

        req.user = user;
        req.tokenData = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            error: 'Недействительный токен',
            code: 'TOKEN_INVALID'
        });
    }
};

const sanitizeInput = (req, res, next) => {
    const sanitizeObject = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = SecurityUtils.sanitizeInput(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitizeObject(obj[key]);
            }
        }
    };
    
    sanitizeObject(req.body);
    sanitizeObject(req.query);
    sanitizeObject(req.params);
    
    next();
};

app.use(sanitizeInput);

// === КОНФИГУРАЦИОННЫЕ МАРШРУТЫ ===

// Получение конфигурации Firebase для клиента
app.get('/api/firebase/config', (req, res) => {
    res.json({
        success: true,
        config: firebaseConfig,
        firebaseEnabled: SECURITY_CONFIG.FIREBASE_ENABLED
    });
});

// === МАРШРУТЫ АУТЕНТИФИКАЦИЯ ===

// Регистрация пользователя с созданием в Firebase
app.post('/api/auth/register', registerLimiter, async (req, res) => {
    try {
        const { email, username, password, firebaseUid } = req.body;
        const ip = req.ip;

        // Валидация обязательных полей
        if (!email || !username || !password) {
            return res.status(400).json({
                error: 'Все поля обязательны для заполнения',
                code: 'MISSING_FIELDS'
            });
        }

        // Проверяем уникальность email и username в Firestore
        const existingUser = await HybridUserManager.findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                error: 'Пользователь с таким email уже существует',
                code: 'EMAIL_EXISTS'
            });
        }

        const existingUsername = await HybridUserManager.findUserByUsername(username);
        if (existingUsername) {
            return res.status(400).json({
                error: 'Это имя пользователя уже занято',
                code: 'USERNAME_EXISTS'
            });
        }

        const result = await HybridUserManager.register({ 
            email, 
            username, 
            password 
        }, ip, firebaseUid);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                code: 'REGISTRATION_FAILED'
            });
        }

        console.log(`🔥 Новый пользователь зарегистрирован: ${email} (Firebase UID: ${firebaseUid})`);

        res.status(201).json({
            message: 'Регистрация успешна',
            data: result,
            firebaseStatus: SECURITY_CONFIG.FIREBASE_ENABLED ? 'active' : 'mock'
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Вход пользователя
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const ip = req.ip;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email и пароль обязательны',
                code: 'MISSING_CREDENTIALS'
            });
        }

        const result = await HybridUserManager.login({ email, password }, ip);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                code: 'LOGIN_FAILED'
            });
        }

        console.log(`👤 Пользователь вошел в систему: ${email}`);

        res.json({
            message: 'Вход выполнен успешно',
            data: result,
            firebaseStatus: SECURITY_CONFIG.FIREBASE_ENABLED ? 'active' : 'mock'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Обновление токена
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const ip = req.ip;

        if (!refreshToken) {
            return res.status(400).json({
                error: 'Refresh токен обязателен',
                code: 'REFRESH_TOKEN_MISSING'
            });
        }

        const result = await HybridUserManager.refreshToken(refreshToken, ip);

        if (!result.success) {
            return res.status(401).json({
                error: result.error,
                code: 'REFRESH_FAILED'
            });
        }

        res.json({
            message: 'Токен обновлен',
            data: result
        });

    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Выход пользователя
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        const ip = req.ip;

        const result = await HybridUserManager.logout(token, ip);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                code: 'LOGOUT_FAILED'
            });
        }

        console.log(`👋 Пользователь вышел из системы: ${req.user.email}`);

        res.json({
            message: 'Выход выполнен успешно'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'INTERNAL_ERROR'
        });
    }
});

// === МАРШРУТЫ УПРАВЛЕНИЯ АККАУНТОМ ===

// Получение информации о текущем пользователе
app.get('/api/account/profile', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        
        // Убираем чувствительные данные
        const safeUser = {
            id: user.id,
            email: user.email,
            username: user.username,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            roles: user.roles,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            firebaseUid: user.firebaseUid,
            registrationSource: user.registrationSource
        };

        res.json({
            message: 'Профиль получен',
            data: safeUser
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'INTERNAL_ERROR'
        });
    }
});

// === АДМИНИСТРАТИВНЫЕ МАРШРУТЫ ===

// Получение всех пользователей (только для админов)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        // Проверяем роль администратора
        if (!req.user.roles.includes('admin') && !req.user.roles.includes('super_admin')) {
            return res.status(403).json({
                error: 'Недостаточно прав доступа',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        const users = await HybridUserManager.getAllUsers();
        
        res.json({
            message: 'Список пользователей получен',
            data: {
                users,
                total: users.length,
                firebaseStatus: SECURITY_CONFIG.FIREBASE_ENABLED ? 'active' : 'mock'
            }
        });

    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'INTERNAL_ERROR'
        });
    }
});

// === МАРШРУТЫ ДЛЯ СИСТЕМНОГО МОНИТОРИНГА ===

// Статус системы
app.get('/api/system/status', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '2.0.0-hybrid',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        security: {
            twoFactorEnabled: SECURITY_CONFIG.TWO_FACTOR_ENABLED,
            emailVerification: SECURITY_CONFIG.ENABLE_EMAIL_VERIFICATION,
            rateLimiting: true
        },
        firebase: {
            enabled: SECURITY_CONFIG.FIREBASE_ENABLED,
            projectId: firebaseConfig.projectId,
            databaseURL: firebaseConfig.databaseURL,
            status: SECURITY_CONFIG.FIREBASE_ENABLED ? 'connected' : 'mock'
        },
        database: {
            type: 'firestore',
            collection: 'vibecord_users',
            status: SECURITY_CONFIG.FIREBASE_ENABLED ? 'connected' : 'mock'
        }
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        firebase: SECURITY_CONFIG.FIREBASE_ENABLED ? 'connected' : 'mock'
    });
});

// Firebase Connectivity Test
app.get('/api/firebase/test', async (req, res) => {
    try {
        if (!SECURITY_CONFIG.FIREBASE_ENABLED) {
            return res.json({
                success: true,
                status: 'mock',
                message: 'Firebase в mock режиме'
            });
        }

        // Тест подключения к Firestore
        const testDoc = await db.collection('firebase_test').doc('connectivity').set({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            test: true
        });

        res.json({
            success: true,
            status: 'connected',
            message: 'Firebase подключен успешно',
            projectId: firebaseConfig.projectId
        });

    } catch (error) {
        console.error('Firebase test error:', error);
        res.status(500).json({
            success: false,
            status: 'error',
            message: error.message
        });
    }
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Маршрут не найден',
        code: 'ROUTE_NOT_FOUND',
        path: req.originalUrl,
        availableRoutes: [
            'POST /api/auth/register',
            'POST /api/auth/login',
            'POST /api/auth/refresh',
            'POST /api/auth/logout',
            'GET /api/account/profile',
            'GET /api/admin/users',
            'GET /api/system/status',
            'GET /api/firebase/config',
            'GET /api/firebase/test'
        ]
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error:', error);
    
    res.status(500).json({
        error: 'Внутренняя ошибка сервера',
        code: 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// Запуск сервера
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🔥 VibeCord Hybrid API server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔥 Firebase Status: ${SECURITY_CONFIG.FIREBASE_ENABLED ? 'CONNECTED' : 'MOCK MODE'}`);
        console.log(`🔐 Security features:`);
        console.log(`   - Rate limiting: Yes`);
        console.log(`   - Helmet security: Yes`);
        console.log(`   - 2FA: ${SECURITY_CONFIG.TWO_FACTOR_ENABLED ? 'Yes' : 'No'}`);
        console.log(`   - Email verification: ${SECURITY_CONFIG.ENABLE_EMAIL_VERIFICATION ? 'Yes' : 'No'}`);
        console.log('');
        console.log('📍 Available endpoints:');
        console.log('   POST /api/auth/register        # Регистрация в Firebase + Firestore');
        console.log('   POST /api/auth/login           # Вход через Firestore');
        console.log('   POST /api/auth/refresh         # Обновление токена');
        console.log('   POST /api/auth/logout          # Выход');
        console.log('   GET  /api/account/profile      # Профиль пользователя');
        console.log('   GET  /api/admin/users          # Список пользователей (админ)');
        console.log('   GET  /api/system/status        # Статус системы');
        console.log('   GET  /api/firebase/config      # Firebase конфигурация');
        console.log('   GET  /api/firebase/test        # Тест подключения Firebase');
        console.log('');
        console.log(`🎯 Firebase Collection: vibecord_users`);
        console.log(`💾 Database: ${SECURITY_CONFIG.FIREBASE_ENABLED ? 'Firestore (Production)' : 'Mock (Development)'}`);
    });
}

module.exports = app;
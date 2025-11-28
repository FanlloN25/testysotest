// Упрощенный API для управления аккаунтами с Firebase
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { UserManager, SecurityUtils, SECURITY_CONFIG } = require('./auth-simple');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware безопасности
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://softai-bd22a.firebaseapp.com", "https://www.googleapis.com"]
        },
    }
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
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

// Применяем middleware
app.use(limiter);

// Вспомогательные middleware

// Проверка JWT токена
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
        const user = UserManager.findUserById(decoded.userId);

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

// Санитизация входных данных
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

// === МАРШРУТЫ АУТЕНТИФИКАЦИЯ ===

// Регистрация пользователя
app.post('/api/auth/register', registerLimiter, async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const ip = req.ip;

        // Валидация обязательных полей
        if (!email || !username || !password) {
            return res.status(400).json({
                error: 'Все поля обязательны для заполнения',
                code: 'MISSING_FIELDS'
            });
        }

        const result = await UserManager.register({ email, username, password }, ip);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                code: 'REGISTRATION_FAILED'
            });
        }

        res.status(201).json({
            message: 'Регистрация успешна',
            data: result
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

        const result = await UserManager.login({ email, password }, ip);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                code: 'LOGIN_FAILED'
            });
        }

        res.json({
            message: 'Вход выполнен успешно',
            data: result
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

        const result = await UserManager.refreshToken(refreshToken, ip);

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

        const result = await UserManager.logout(token, ip);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                code: 'LOGOUT_FAILED'
            });
        }

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
            lastLogin: user.lastLogin
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

// === МАРШРУТЫ ДЛЯ СИСТЕМНОГО МОНИТОРИНГА ===

// Статус системы
app.get('/api/system/status', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        security: {
            twoFactorEnabled: SECURITY_CONFIG.TWO_FACTOR_ENABLED,
            emailVerification: SECURITY_CONFIG.ENABLE_EMAIL_VERIFICATION,
            rateLimiting: true
        }
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Маршрут не найден',
        code: 'ROUTE_NOT_FOUND',
        path: req.originalUrl
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
        console.log(`🔥 VibeCord API server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔐 Security features:`);
        console.log(`   - Rate limiting: Yes`);
        console.log(`   - Helmet security: Yes`);
        console.log(`   - 2FA: ${SECURITY_CONFIG.TWO_FACTOR_ENABLED ? 'Yes' : 'No'}`);
        console.log(`   - Email verification: ${SECURITY_CONFIG.ENABLE_EMAIL_VERIFICATION ? 'Yes' : 'No'}`);
        console.log('');
        console.log('📍 Available endpoints:');
        console.log('   POST /api/auth/register');
        console.log('   POST /api/auth/login');
        console.log('   POST /api/auth/refresh');
        console.log('   POST /api/auth/logout');
        console.log('   GET  /api/account/profile');
        console.log('   GET  /api/system/status');
        console.log('   GET  /api/health');
    });
}

module.exports = app;
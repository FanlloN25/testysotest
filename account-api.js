// Защищенный API для управления аккаунтами
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { AuthManager, SecurityUtils, SECURITY_CONFIG } = require('./auth');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware безопасности
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting для защиты от DDoS и брутфорса
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // максимум 100 запросов с IP
    message: {
        error: 'Слишком много запросов, попробуйте позже',
        retryAfter: '15 минут'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // максимум 5 попыток входа
    message: {
        error: 'Слишком много попыток входа',
        retryAfter: '15 минут'
    },
    skipSuccessfulRequests: true,
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 час
    max: 3, // максимум 3 регистрации с IP
    message: {
        error: 'Слишком много попыток регистрации',
        retryAfter: '1 час'
    }
});

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
        const user = await AuthManager.findUserById(decoded.userId);

        if (!user || !user.isActive) {
            return res.status(403).json({ 
                error: 'Пользователь не найден или неактивен',
                code: 'USER_INVALID'
            });
        }

        // Проверяем статус сессии если есть sessionId
        if (decoded.sessionId) {
            const sessionDoc = await admin.firestore()
                .collection('sessions')
                .doc(decoded.sessionId)
                .get();
            
            if (!sessionDoc.exists || !sessionDoc.data().isActive) {
                return res.status(401).json({ 
                    error: 'Сессия истекла',
                    code: 'SESSION_EXPIRED'
                });
            }
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

// Проверка роли администратора
const requireAdmin = (req, res, next) => {
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('super_admin')) {
        return res.status(403).json({ 
            error: 'Недостаточно прав доступа',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }
    next();
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

// Применяем middleware для всех маршрутов
app.use(limiter);
app.use(sanitizeInput);

// === МАРШРУТЫ АУТЕНТИФИКАЦИЯ ===

// Регистрация пользователя
app.post('/api/auth/register', registerLimiter, async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const ip = req.ip;
        const userAgent = req.get('User-Agent');

        // Валидация обязательных полей
        if (!email || !username || !password) {
            return res.status(400).json({
                error: 'Все поля обязательны для заполнения',
                code: 'MISSING_FIELDS'
            });
        }

        const result = await AuthManager.register({ email, username, password }, ip);

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
        const { email, password, twoFactorCode } = req.body;
        const ip = req.ip;
        const userAgent = req.get('User-Agent');

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email и пароль обязательны',
                code: 'MISSING_CREDENTIALS'
            });
        }

        const result = await AuthManager.login(
            { email, password, twoFactorCode }, 
            ip, 
            userAgent
        );

        if (!result.success) {
            if (result.requiresTwoFactor) {
                return res.status(200).json({
                    message: result.message,
                    requiresTwoFactor: true
                });
            }
            
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

        const result = await AuthManager.refreshToken(refreshToken, ip);

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
        const sessionId = req.tokenData.sessionId;
        const ip = req.ip;

        const result = await AuthManager.logout(token, sessionId, ip);

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
            twoFactorEnabled: user.twoFactorEnabled,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            securitySettings: user.securitySettings
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

// Обновление профиля пользователя
app.put('/api/account/profile', authenticateToken, async (req, res) => {
    try {
        const { username, displayName, bio } = req.body;
        const userId = req.user.id;

        const updates = {};
        
        if (username && username !== req.user.username) {
            // Проверяем уникальность нового имени пользователя
            const existingUser = await AuthManager.findUserByUsername(username);
            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({
                    error: 'Это имя пользователя уже занято',
                    code: 'USERNAME_TAKEN'
                });
            }
            updates.username = SecurityUtils.sanitizeInput(username);
        }

        if (displayName) {
            updates.displayName = SecurityUtils.sanitizeInput(displayName);
        }

        if (bio) {
            if (bio.length > 500) {
                return res.status(400).json({
                    error: 'Биография не может превышать 500 символов',
                    code: 'BIO_TOO_LONG'
                });
            }
            updates.bio = SecurityUtils.sanitizeInput(bio);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                error: 'Нет данных для обновления',
                code: 'NO_UPDATES'
            });
        }

        await AuthManager.updateUser(userId, updates);

        res.json({
            message: 'Профиль обновлен успешно',
            data: updates
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Смена пароля
app.put('/api/account/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Текущий и новый пароль обязательны',
                code: 'MISSING_PASSWORDS'
            });
        }

        // Проверяем текущий пароль
        const isCurrentPasswordValid = await SecurityUtils.verifyPassword(
            currentPassword, 
            req.user.password
        );

        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                error: 'Неверный текущий пароль',
                code: 'INVALID_CURRENT_PASSWORD'
            });
        }

        // Валидация нового пароля
        const passwordValidation = SecurityUtils.validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                error: passwordValidation.message,
                code: 'INVALID_NEW_PASSWORD'
            });
        }

        // Хешируем новый пароль
        const hashedPassword = await SecurityUtils.hashPassword(newPassword);

        // Обновляем пароль
        await AuthManager.updateUser(userId, {
            password: hashedPassword,
            passwordChangedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            message: 'Пароль успешно изменен'
        });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Получение QR кода для настройки 2FA
app.post('/api/account/2fa/setup', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        
        if (user.twoFactorEnabled) {
            return res.status(400).json({
                error: 'Двухфакторная аутентификация уже включена',
                code: 'TWO_FA_ALREADY_ENABLED'
            });
        }

        // Генерируем QR код
        const qrCode = SecurityUtils.generateQRCode(user.email, user.twoFactorSecret);

        res.json({
            message: 'QR код для 2FA создан',
            data: {
                qrCode,
                secret: user.twoFactorSecret
            }
        });

    } catch (error) {
        console.error('2FA setup error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Активация 2FA
app.post('/api/account/2fa/enable', authenticateToken, async (req, res) => {
    try {
        const { verificationCode } = req.body;
        const userId = req.user.id;

        if (!verificationCode) {
            return res.status(400).json({
                error: 'Код верификации обязателен',
                code: 'VERIFICATION_CODE_MISSING'
            });
        }

        const result = await AuthManager.enableTwoFactor(userId, verificationCode);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                code: 'TWO_FA_ENABLE_FAILED'
            });
        }

        res.json({
            message: result.message,
            data: { twoFactorEnabled: true }
        });

    } catch (error) {
        console.error('2FA enable error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Отключение 2FA
app.post('/api/account/2fa/disable', authenticateToken, async (req, res) => {
    try {
        const { verificationCode } = req.body;
        const userId = req.user.id;

        if (!verificationCode) {
            return res.status(400).json({
                error: 'Код верификации обязателен',
                code: 'VERIFICATION_CODE_MISSING'
            });
        }

        const result = await AuthManager.disableTwoFactor(userId, verificationCode);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                code: 'TWO_FA_DISABLE_FAILED'
            });
        }

        res.json({
            message: result.message,
            data: { twoFactorEnabled: false }
        });

    } catch (error) {
        console.error('2FA disable error:', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            code: 'INTERNAL_ERROR'
        });
    }
});

// === АДМИНИСТРАТИВНЫЕ МАРШРУТЫ ===

// Получение списка пользователей (только для админов)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const offset = (page - 1) * limit;

        let query = admin.firestore().collection('users');
        
        if (search) {
            query = query.where('username', '>=', search)
                        .where('username', '<=', search + '\uf8ff');
        }

        const usersSnapshot = await query
            .orderBy('username')
            .limit(parseInt(limit))
            .offset(offset)
            .get();

        const users = usersSnapshot.docs.map(doc => {
            const user = doc.data();
            // Убираем чувствительные данные
            delete user.password;
            delete user.twoFactorSecret;
            return { id: doc.id, ...user };
        });

        res.json({
            message: 'Список пользователей получен',
            data: {
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: users.length
                }
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

// Получение логов безопасности (только для админов)
app.get('/api/admin/security-logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, eventType } = req.query;
        const offset = (page - 1) * limit;

        let query = admin.firestore().collection('security_logs');
        
        if (eventType) {
            query = query.where('eventType', '==', eventType);
        }

        const logsSnapshot = await query
            .orderBy('timestamp', 'desc')
            .limit(parseInt(limit))
            .offset(offset)
            .get();

        const logs = logsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({
            message: 'Логи безопасности получены',
            data: {
                logs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: logs.length
                }
            }
        });

    } catch (error) {
        console.error('Security logs error:', error);
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

// === ОБРАБОТКА ОШИБОК ===

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
        console.log(`Account API server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Security features enabled:`);
        console.log(`- 2FA: ${SECURITY_CONFIG.TWO_FACTOR_ENABLED ? 'Yes' : 'No'}`);
        console.log(`- Email verification: ${SECURITY_CONFIG.ENABLE_EMAIL_VERIFICATION ? 'Yes' : 'No'}`);
        console.log(`- Rate limiting: Yes`);
        console.log(`- Helmet security: Yes`);
    });
}

module.exports = app;
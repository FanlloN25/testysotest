// Главный файл конфигурации системы безопасности
require('dotenv').config();

const config = {
    // === FIREBASE ===
    firebase: {
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        credentials: {
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            projectId: process.env.FIREBASE_PROJECT_ID
        }
    },

    // === СЕРВЕР ===
    server: {
        port: parseInt(process.env.PORT) || 3000,
        env: process.env.NODE_ENV || 'development',
        host: process.env.HOST || '0.0.0.0'
    },

    // === JWT ===
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
    },

    // === CORS ===
    cors: {
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
        optionsSuccessStatus: 200
    },

    // === БЕЗОПАСНОСТЬ ===
    security: {
        // Rate Limiting
        rateLimit: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
            maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
            authMaxAttempts: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
            registerMaxAttempts: parseInt(process.env.REGISTER_RATE_LIMIT_MAX) || 3
        },

        // Пароли
        password: {
            minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
            saltRounds: parseInt(process.env.SALT_ROUNDS) || 12
        },

        // 2FA
        twoFactor: {
            enabled: process.env.TWO_FACTOR_ENABLED === 'true',
            issuer: process.env.TOTP_ISSUER || 'VibeCord'
        },

        // Email
        email: {
            verification: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
            smtp: {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
                fromEmail: process.env.FROM_EMAIL,
                fromName: process.env.FROM_NAME
            }
        },

        // Сессии
        sessions: {
            timeout: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000,
            maxActive: parseInt(process.env.MAX_ACTIVE_SESSIONS) || 5
        },

        // Попытки входа
        loginAttempts: {
            maxAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
            lockoutTime: parseInt(process.env.LOGIN_LOCKOUT_TIME) || 15 * 60 * 1000
        }
    },

    // === МОНИТОРИНГ ===
    monitoring: {
        logLevel: process.env.LOG_LEVEL || 'info',
        enableSuspiciousDetection: process.env.ENABLE_SUSPICIOUS_LOG_DETECTION === 'true',
        logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 30,
        
        // Webhooks для уведомлений
        webhooks: {
            security: process.env.SECURITY_WEBHOOK_URL,
            discord: process.env.DISCORD_WEBHOOK_URL
        }
    },

    // === REDIS (опционально) ===
    redis: {
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD,
        enabled: !!process.env.REDIS_URL
    },

    // === SSL/TLS ===
    ssl: {
        enabled: process.env.SSL_ENABLED === 'true',
        certPath: process.env.SSL_CERT_PATH,
        keyPath: process.env.SSL_KEY_PATH
    },

    // === BACKUP ===
    backup: {
        enabled: process.env.BACKUP_ENABLED === 'true',
        schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // каждый день в 2:00
        retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 7,
        s3: {
            bucket: process.env.BACKUP_S3_BUCKET,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    },

    // === РАЗРАБОТКА ===
    development: {
        debug: process.env.DEBUG_AUTH === 'true',
        mockEmail: process.env.MOCK_EMAIL_SERVICE === 'true'
    }
};

// Валидация обязательных настроек
function validateConfig() {
    const errors = [];

    if (!config.firebase.databaseURL) {
        errors.push('FIREBASE_DATABASE_URL обязателен');
    }

    if (!config.jwt.secret) {
        errors.push('JWT_SECRET обязателен');
    }

    if (config.server.env === 'production') {
        if (!config.firebase.credentials.clientEmail || !config.firebase.credentials.privateKey) {
            errors.push('Firebase credentials обязательны для production');
        }

        if (config.jwt.secret === 'your-super-secret-jwt-key-change-in-production-make-it-long-and-random') {
            errors.push('JWT_SECRET должен быть изменен для production');
        }
    }

    if (errors.length > 0) {
        throw new Error(`Ошибки конфигурации:\n${errors.join('\n')}`);
    }
}

// Логирование конфигурации (без чувствительных данных)
function logConfig() {
    const safeConfig = {
        server: config.server,
        security: {
            twoFactorEnabled: config.security.twoFactor.enabled,
            emailVerification: config.security.email.verification,
            rateLimiting: true,
            passwordMinLength: config.security.password.minLength
        },
        monitoring: {
            logLevel: config.monitoring.logLevel,
            suspiciousDetection: config.monitoring.enableSuspiciousDetection
        },
        redis: {
            enabled: config.redis.enabled
        },
        ssl: {
            enabled: config.ssl.enabled
        },
        backup: {
            enabled: config.backup.enabled
        }
    };

    console.log('Конфигурация системы:', JSON.stringify(safeConfig, null, 2));
}

// Инициализация конфигурации
function initConfig() {
    try {
        validateConfig();
        logConfig();
        console.log('✅ Конфигурация успешно загружена');
    } catch (error) {
        console.error('❌ Ошибка загрузки конфигурации:', error.message);
        process.exit(1);
    }
}

// Получение безопасной конфигурации для отправки клиенту
function getSafeConfig() {
    return {
        twoFactorEnabled: config.security.twoFactor.enabled,
        emailVerification: config.security.email.verification,
        passwordMinLength: config.security.password.minLength,
        sessionTimeout: config.security.sessions.timeout,
        maxLoginAttempts: config.security.loginAttempts.maxAttempts
    };
}

// Экспорт конфигурации
if (require.main === module) {
    initConfig();
}

module.exports = {
    config,
    validateConfig,
    logConfig,
    initConfig,
    getSafeConfig
};
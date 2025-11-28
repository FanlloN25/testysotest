// Продвинутая система аутентификации с интеграцией Firebase
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// Инициализация Firebase Admin SDK
if (!admin.apps.length) {
    try {
        // В production используйте service account key
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
}

const db = admin.firestore();

// Конфигурация безопасности
const SECURITY_CONFIG = {
    // Хеширование паролей
    SALT_ROUNDS: 12,
    PASSWORD_MIN_LENGTH: 8,
    
    // JWT токены
    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    JWT_EXPIRES_IN: '15m', // Короткий срок для access token
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    
    // Rate limiting
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_LOCKOUT_TIME: 15 * 60 * 1000, // 15 минут
    REGISTER_COOLDOWN: 5 * 60 * 1000, // 5 минут
    
    // Сессии
    SESSION_EXPIRES_IN: 24 * 60 * 60 * 1000, // 24 часа
    MAX_ACTIVE_SESSIONS: 5,
    
    // 2FA
    TWO_FACTOR_ENABLED: true,
    TOTP_ISSUER: 'VibeCord',
    
    // Безопасность
    ENABLE_EMAIL_VERIFICATION: true,
    ENABLE_SUSPICIOUS_LOGIN_DETECTION: true,
    LOG_SUSPICIOUS_ACTIVITY: true
};

// Вспомогательные функции безопасности
class SecurityUtils {
    
    // Хеширование пароля с солью
    static async hashPassword(password) {
        try {
            const salt = await bcrypt.genSalt(SECURITY_CONFIG.SALT_ROUNDS);
            return await bcrypt.hash(password, salt);
        } catch (error) {
            throw new Error('Ошибка хеширования пароля');
        }
    }
    
    // Проверка пароля
    static async verifyPassword(password, hash) {
        try {
            return await bcrypt.compare(password, hash);
        } catch (error) {
            throw new Error('Ошибка проверки пароля');
        }
    }
    
    // Генерация JWT токена
    static generateToken(payload) {
        try {
            return jwt.sign(payload, SECURITY_CONFIG.JWT_SECRET, {
                expiresIn: SECURITY_CONFIG.JWT_EXPIRES_IN
            });
        } catch (error) {
            throw new Error('Ошибка генерации токена');
        }
    }
    
    // Верификация JWT токена
    static verifyToken(token) {
        try {
            return jwt.verify(token, SECURITY_CONFIG.JWT_SECRET);
        } catch (error) {
            throw new Error('Недействительный токен');
        }
    }
    
    // Генерация TOTP для 2FA
    static generateTOTPSecret() {
        return crypto.randomBytes(32).toString('base64');
    }
    
    // Валидация TOTP
    static validateTOTP(token, secret) {
        const speakeasy = require('speakeasy');
        return speakeasy.totp.verify({
            secret: secret,
            encoding: 'base64',
            token: token,
            window: 2 // Допустимое отклонение во времени
        });
    }
    
    // Генерация QR кода для 2FA
    static generateQRCode(email, secret) {
        const speakeasy = require('speakeasy');
        return speakeasy.otpauthURL({
            secret: secret,
            label: email,
            issuer: SECURITY_CONFIG.TOTP_ISSUER,
            encoding: 'base64'
        });
    }
    
    // Генерация безопасного случайного токена
    static generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    // Валидация email с дополнительными проверками
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const basicCheck = emailRegex.test(email);
        
        // Проверка временных email сервисов
        const tempDomains = [
            'mailinator.com', 'guerrillamail.com', '10minutemail.com',
            'tempmail.org', 'throwaway.email', 'yopmail.com'
        ];
        
        const domain = email.split('@')[1]?.toLowerCase();
        const isTempEmail = tempDomains.some(tempDomain => domain?.includes(tempDomain));
        
        return basicCheck && !isTempEmail && email.length <= 254;
    }
    
    // Валидация пароля с комплексными требованиями
    static validatePassword(password) {
        if (!password || password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
            return { valid: false, message: `Пароль должен содержать минимум ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} символов` };
        }
        
        const checks = {
            length: password.length >= 8 && password.length <= 128,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            numbers: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
            noSequential: !/(.)\1{2,}/.test(password), // Запрет повторяющихся символов
            noCommonPatterns: !/(?:123|abc|password|qwerty|admin)/i.test(password)
        };
        
        const failedChecks = Object.entries(checks)
            .filter(([check, result]) => !result)
            .map(([check]) => check);
        
        return {
            valid: failedChecks.length === 0,
            message: failedChecks.length === 0 ? 'Пароль соответствует требованиям' : `Пароль не прошел проверки: ${failedChecks.join(', ')}`,
            checks
        };
    }
    
    // Санитизация входных данных
    static sanitizeInput(input) {
        if (typeof input === 'string') {
            // Удаляем потенциально опасные символы
            return input.trim()
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/[<>\"']/g, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
        }
        return input;
    }
    
    // Создание хеша для предотвращения тайминг атак
    static secureCompare(a, b) {
        try {
            return crypto.timingSafeEqual(
                Buffer.from(a, 'utf8'), 
                Buffer.from(b, 'utf8')
            );
        } catch (error) {
            return false;
        }
    }
    
    // Генерация хеша IP для логирования
    static hashIP(ip) {
        return crypto.createHash('sha256')
            .update(ip + SECURITY_CONFIG.JWT_SECRET)
            .digest('hex')
            .substring(0, 16);
    }
}

// Менеджер попыток входа с интеграцией Firebase
class LoginAttemptManager {
    
    static async recordAttempt(identifier, ip = null) {
        try {
            const attempt = {
                identifier: identifier.toLowerCase(),
                ip: ip ? SecurityUtils.hashIP(ip) : null,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                userAgent: 'unknown' // Можно получить из headers
            };
            
            // Сохраняем попытку в Firestore
            await db.collection('login_attempts').add(attempt);
            
            // Проверяем количество попыток за последние 15 минут
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
            const attemptsSnapshot = await db.collection('login_attempts')
                .where('identifier', '==', identifier.toLowerCase())
                .where('timestamp', '>=', fifteenMinutesAgo)
                .get();
            
            return attemptsSnapshot.size;
            
        } catch (error) {
            console.error('Error recording login attempt:', error);
            return 0;
        }
    }
    
    static async checkLockout(identifier) {
        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
            const attemptsSnapshot = await db.collection('login_attempts')
                .where('identifier', '==', identifier.toLowerCase())
                .where('timestamp', '>=', fifteenMinutesAgo)
                .get();
            
            return attemptsSnapshot.size >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS;
            
        } catch (error) {
            console.error('Error checking lockout:', error);
            return false;
        }
    }
    
    static async clearAttempts(identifier) {
        try {
            // Удаляем записи о попытках для пользователя
            const batch = db.batch();
            const attemptsSnapshot = await db.collection('login_attempts')
                .where('identifier', '==', identifier.toLowerCase())
                .get();
            
            attemptsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            
        } catch (error) {
            console.error('Error clearing login attempts:', error);
        }
    }
}

// Основной класс аутентификации с Firebase интеграцией
class AuthManager {
    
    // Регистрация пользователя
    static async register(userData, ip = null) {
        try {
            const { email, username, password } = userData;
            
            // Валидация данных
            if (!SecurityUtils.validateEmail(email)) {
                throw new Error('Неверный формат email или запрещенный домен');
            }
            
            const passwordValidation = SecurityUtils.validatePassword(password);
            if (!passwordValidation.valid) {
                throw new Error(passwordValidation.message);
            }
            
            if (username.length < 3 || username.length > 20) {
                throw new Error('Имя пользователя должно содержать от 3 до 20 символов');
            }
            
            // Проверка на запрещенные имена пользователей
            const forbiddenUsernames = ['admin', 'root', 'system', 'guest', 'user'];
            if (forbiddenUsernames.includes(username.toLowerCase())) {
                throw new Error('Это имя пользователя запрещено');
            }
            
            // Проверка уникальности
            const existingUser = await this.findUserByEmail(email);
            if (existingUser) {
                throw new Error('Пользователь с таким email уже существует');
            }
            
            const existingUsername = await this.findUserByUsername(username);
            if (existingUsername) {
                throw new Error('Это имя пользователя уже занято');
            }
            
            // Хеширование пароля
            const hashedPassword = await SecurityUtils.hashPassword(password);
            
            // Генерация секрета для 2FA (если включен)
            let twoFactorSecret = null;
            if (SECURITY_CONFIG.TWO_FACTOR_ENABLED) {
                twoFactorSecret = SecurityUtils.generateTOTPSecret();
            }
            
            // Создание пользователя
            const user = {
                id: SecurityUtils.generateSecureToken(16),
                email: SecurityUtils.sanitizeInput(email.toLowerCase()),
                username: SecurityUtils.sanitizeInput(username),
                password: hashedPassword,
                isActive: true,
                isEmailVerified: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastLogin: null,
                failedLoginAttempts: 0,
                lockedUntil: null,
                roles: ['user'],
                twoFactorEnabled: SECURITY_CONFIG.TWO_FACTOR_ENABLED,
                twoFactorSecret: twoFactorSecret,
                loginHistory: [],
                securitySettings: {
                    loginNotifications: true,
                    twoFactorEnabled: SECURITY_CONFIG.TWO_FACTOR_ENABLED,
                    sessionTimeout: SECURITY_CONFIG.SESSION_EXPIRES_IN
                },
                ip: ip ? SecurityUtils.hashIP(ip) : null
            };
            
            // Сохранение в Firestore
            await db.collection('users').doc(user.id).set(user);
            
            // Генерация токенов
            const tokens = this.generateTokens(user);
            
            // Логирование регистрации
            await this.logSecurityEvent('USER_REGISTERED', {
                userId: user.id,
                email: user.email,
                ip: ip ? SecurityUtils.hashIP(ip) : null
            });
            
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    isEmailVerified: user.isEmailVerified,
                    twoFactorEnabled: user.twoFactorEnabled
                },
                tokens,
                requiresTwoFactor: SECURITY_CONFIG.TWO_FACTOR_ENABLED
            };
            
        } catch (error) {
            // Логирование неудачной регистрации
            await this.logSecurityEvent('REGISTRATION_FAILED', {
                email: userData?.email,
                error: error.message,
                ip: ip ? SecurityUtils.hashIP(ip) : null
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Вход пользователя с 2FA поддержкой
    static async login(credentials, ip = null, userAgent = null) {
        try {
            const { email, password, twoFactorCode } = credentials;
            
            // Проверка блокировки
            if (await LoginAttemptManager.checkLockout(email)) {
                await this.logSecurityEvent('LOGIN_BLOCKED', {
                    email,
                    ip: ip ? SecurityUtils.hashIP(ip) : null,
                    reason: 'TOO_MANY_ATTEMPTS'
                });
                throw new Error('Слишком много неудачных попыток входа. Попробуйте позже.');
            }
            
            // Поиск пользователя
            const user = await this.findUserByEmail(email);
            if (!user) {
                await LoginAttemptManager.recordAttempt(email, ip);
                await this.logSecurityEvent('LOGIN_FAILED', {
                    email,
                    reason: 'USER_NOT_FOUND',
                    ip: ip ? SecurityUtils.hashIP(ip) : null
                });
                throw new Error('Неверный email или пароль');
            }
            
            // Проверка блокировки пользователя
            if (user.lockedUntil && user.lockedUntil.toDate() > new Date()) {
                await this.logSecurityEvent('LOGIN_BLOCKED', {
                    userId: user.id,
                    reason: 'USER_LOCKED',
                    ip: ip ? SecurityUtils.hashIP(ip) : null
                });
                throw new Error('Аккаунт временно заблокирован');
            }
            
            // Проверка пароля
            const isPasswordValid = await SecurityUtils.verifyPassword(password, user.password);
            if (!isPasswordValid) {
                await this.recordFailedLogin(user, ip);
                await LoginAttemptManager.recordAttempt(email, ip);
                await this.logSecurityEvent('LOGIN_FAILED', {
                    userId: user.id,
                    email,
                    reason: 'INVALID_PASSWORD',
                    ip: ip ? SecurityUtils.hashIP(ip) : null
                });
                throw new Error('Неверный email или пароль');
            }
            
            // Проверка 2FA если включен
            if (user.twoFactorEnabled && !twoFactorCode) {
                return {
                    success: false,
                    requiresTwoFactor: true,
                    message: 'Требуется код двухфакторной аутентификации'
                };
            }
            
            if (user.twoFactorEnabled && twoFactorCode) {
                const isValidTOTP = SecurityUtils.validateTOTP(twoFactorCode, user.twoFactorSecret);
                if (!isValidTOTP) {
                    await this.recordFailedLogin(user, ip);
                    await this.logSecurityEvent('LOGIN_FAILED', {
                        userId: user.id,
                        email,
                        reason: 'INVALID_2FA',
                        ip: ip ? SecurityUtils.hashIP(ip) : null
                    });
                    throw new Error('Неверный код двухфакторной аутентификации');
                }
            }
            
            // Очистка попыток при успешном входе
            await LoginAttemptManager.clearAttempts(email);
            await this.recordSuccessfulLogin(user, ip, userAgent);
            
            // Создание сессии
            const sessionId = await this.createSession(user.id, ip, userAgent);
            
            // Генерация токенов
            const tokens = this.generateTokens(user);
            
            await this.logSecurityEvent('LOGIN_SUCCESS', {
                userId: user.id,
                email: user.email,
                sessionId,
                ip: ip ? SecurityUtils.hashIP(ip) : null
            });
            
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    isEmailVerified: user.isEmailVerified,
                    roles: user.roles,
                    twoFactorEnabled: user.twoFactorEnabled
                },
                tokens,
                sessionId
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Обновление токена
    static async refreshToken(refreshToken, ip = null) {
        try {
            const decoded = SecurityUtils.verifyToken(refreshToken);
            const user = await this.findUserById(decoded.userId);
            
            if (!user || !user.isActive) {
                throw new Error('Пользователь не найден или неактивен');
            }
            
            const tokens = this.generateTokens(user);
            
            await this.logSecurityEvent('TOKEN_REFRESHED', {
                userId: user.id,
                ip: ip ? SecurityUtils.hashIP(ip) : null
            });
            
            return {
                success: true,
                tokens
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Недействительный refresh токен'
            };
        }
    }
    
    // Выход пользователя
    static async logout(token, sessionId = null, ip = null) {
        try {
            // Добавление токена в черный список
            await this.blacklistToken(token);
            
            // Деактивация сессии если указан ID
            if (sessionId) {
                await this.deactivateSession(sessionId);
            }
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // Генерация токенов
    static generateTokens(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            roles: user.roles,
            sessionId: SecurityUtils.generateSecureToken(16)
        };
        
        return {
            accessToken: SecurityUtils.generateToken({
                ...payload,
                type: 'access'
            }),
            refreshToken: SecurityUtils.generateToken({
                ...payload,
                type: 'refresh'
            }, SECURITY_CONFIG.REFRESH_TOKEN_EXPIRES_IN)
        };
    }
    
    // Создание сессии
    static async createSession(userId, ip = null, userAgent = null) {
        try {
            const sessionId = SecurityUtils.generateSecureToken(16);
            const expiresAt = new Date(Date.now() + SECURITY_CONFIG.SESSION_EXPIRES_IN);
            
            // Удаляем старые сессии если слишком много
            await this.cleanupOldSessions(userId);
            
            const session = {
                id: sessionId,
                userId: userId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: expiresAt,
                ip: ip ? SecurityUtils.hashIP(ip) : null,
                userAgent: userAgent || 'unknown',
                isActive: true
            };
            
            await db.collection('sessions').doc(sessionId).set(session);
            
            return sessionId;
        } catch (error) {
            console.error('Error creating session:', error);
            return null;
        }
    }
    
    // Деактивация сессии
    static async deactivateSession(sessionId) {
        try {
            await db.collection('sessions').doc(sessionId).update({
                isActive: false,
                deactivatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error deactivating session:', error);
        }
    }
    
    // Очистка старых сессий
    static async cleanupOldSessions(userId) {
        try {
            const sessionsSnapshot = await db.collection('sessions')
                .where('userId', '==', userId)
                .where('isActive', '==', true)
                .orderBy('createdAt', 'desc')
                .limit(SECURITY_CONFIG.MAX_ACTIVE_SESSIONS + 1)
                .get();
            
            if (sessionsSnapshot.size > SECURITY_CONFIG.MAX_ACTIVE_SESSIONS) {
                const sessionsToDeactivate = sessionsSnapshot.docs.slice(SECURITY_CONFIG.MAX_ACTIVE_SESSIONS);
                const batch = db.batch();
                
                sessionsToDeactivate.forEach(doc => {
                    batch.update(doc.ref, {
                        isActive: false,
                        deactivatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                });
                
                await batch.commit();
            }
        } catch (error) {
            console.error('Error cleaning up sessions:', error);
        }
    }
    
    // Запись неудачной попытки входа
    static async recordFailedLogin(user, ip = null) {
        try {
            const failedAttempts = (user.failedLoginAttempts || 0) + 1;
            const updates = { failedLoginAttempts: failedAttempts };
            
            // Блокировка после 5 неудачных попыток
            if (failedAttempts >= 5) {
                updates.lockedUntil = new Date(Date.now() + SECURITY_CONFIG.LOGIN_LOCKOUT_TIME);
            }
            
            await this.updateUser(user.id, updates);
        } catch (error) {
            console.error('Error recording failed login:', error);
        }
    }
    
    // Запись успешного входа
    static async recordSuccessfulLogin(user, ip = null, userAgent = null) {
        try {
            const loginEntry = {
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                ip: ip ? SecurityUtils.hashIP(ip) : null,
                userAgent: userAgent || 'unknown'
            };
            
            const updates = {
                failedLoginAttempts: 0,
                lockedUntil: null,
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
                loginHistory: admin.firestore.FieldValue.arrayUnion(loginEntry)
            };
            
            await this.updateUser(user.id, updates);
        } catch (error) {
            console.error('Error recording successful login:', error);
        }
    }
    
    // Логирование событий безопасности
    static async logSecurityEvent(eventType, details) {
        try {
            if (!SECURITY_CONFIG.LOG_SUSPICIOUS_ACTIVITY) return;
            
            const logEntry = {
                eventType,
                details,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                ip: details.ip || null
            };
            
            await db.collection('security_logs').add(logEntry);
        } catch (error) {
            console.error('Error logging security event:', error);
        }
    }
    
    // Добавление токена в черный список
    static async blacklistToken(token) {
        try {
            const decoded = SecurityUtils.verifyToken(token);
            const blacklistEntry = {
                token: token,
                userId: decoded.userId,
                blacklistedAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(decoded.exp * 1000)
            };
            
            await db.collection('blacklisted_tokens').add(blacklistEntry);
        } catch (error) {
            console.error('Error blacklisting token:', error);
        }
    }
    
    // Поиск пользователя по email
    static async findUserByEmail(email) {
        try {
            const usersSnapshot = await db.collection('users')
                .where('email', '==', email.toLowerCase())
                .limit(1)
                .get();
            
            if (usersSnapshot.empty) return null;
            
            const userDoc = usersSnapshot.docs[0];
            return { id: userDoc.id, ...userDoc.data() };
            
        } catch (error) {
            console.error('Error finding user by email:', error);
            return null;
        }
    }
    
    // Поиск пользователя по username
    static async findUserByUsername(username) {
        try {
            const usersSnapshot = await db.collection('users')
                .where('username', '==', username)
                .limit(1)
                .get();
            
            if (usersSnapshot.empty) return null;
            
            const userDoc = usersSnapshot.docs[0];
            return { id: userDoc.id, ...userDoc.data() };
            
        } catch (error) {
            console.error('Error finding user by username:', error);
            return null;
        }
    }
    
    // Поиск пользователя по ID
    static async findUserById(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            
            if (!userDoc.exists) return null;
            
            return { id: userDoc.id, ...userDoc.data() };
            
        } catch (error) {
            console.error('Error finding user by ID:', error);
            return null;
        }
    }
    
    // Сохранение пользователя
    static async saveUser(user) {
        try {
            await db.collection('users').doc(user.id).set(user);
        } catch (error) {
            console.error('Error saving user:', error);
            throw error;
        }
    }
    
    // Обновление пользователя
    static async updateUser(userId, updates) {
        try {
            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            await db.collection('users').doc(userId).update(updates);
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }
    
    // Активация 2FA
    static async enableTwoFactor(userId, verificationCode) {
        try {
            const user = await this.findUserById(userId);
            if (!user || !user.twoFactorSecret) {
                throw new Error('Пользователь не найден или 2FA не настроен');
            }
            
            // Проверяем код верификации
            const isValid = SecurityUtils.validateTOTP(verificationCode, user.twoFactorSecret);
            if (!isValid) {
                throw new Error('Неверный код верификации');
            }
            
            await this.updateUser(userId, {
                twoFactorEnabled: true,
                twoFactorActivatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return {
                success: true,
                message: 'Двухфакторная аутентификация успешно активирована'
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Отключение 2FA
    static async disableTwoFactor(userId, verificationCode) {
        try {
            const user = await this.findUserById(userId);
            if (!user) {
                throw new Error('Пользователь не найден');
            }
            
            if (user.twoFactorEnabled) {
                // Требуем код для отключения 2FA
                const isValid = SecurityUtils.validateTOTP(verificationCode, user.twoFactorSecret);
                if (!isValid) {
                    throw new Error('Неверный код верификации');
                }
            }
            
            await this.updateUser(userId, {
                twoFactorEnabled: false,
                twoFactorDisabledAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return {
                success: true,
                message: 'Двухфакторная аутентификация отключена'
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = {
    AuthManager,
    SecurityUtils,
    LoginAttemptManager,
    SECURITY_CONFIG,
    admin
};
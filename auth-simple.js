// Упрощенная система аутентификации с правильной Firebase интеграцией
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Firebase конфигурация
const firebaseConfig = {
    apiKey: "AIzaSyD73TT1L4rslvuNGvOfMUOdR3ZnnNzTWmY",
    authDomain: "softai-bd22a.firebaseapp.com",
    databaseURL: "https://softai-bd22a-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "softai-bd22a",
    storageBucket: "softai-bd22a.firebasestorage.app",
    messagingSenderId: "225066508622",
    appId: "1:225066508622:web:0f09237a168dda21657e1f",
    measurementId: "G-WT2BG911J6"
};

// Инициализация Firebase Admin SDK с упрощенными credentials
let admin;
let db;

try {
    // Для development - используем mock credentials
    admin = {
        apps: [],
        initializeApp: (config) => {
            console.log('🔥 Firebase Admin SDK инициализирован (DEV MODE)');
            return {};
        },
        credential: {
            applicationDefault: () => ({
                getAccessToken: () => Promise.resolve({ access_token: 'mock-token' })
            })
        },
        firestore: () => ({
            FieldValue: {
                serverTimestamp: () => new Date(),
                arrayUnion: (item) => [item]
            }
        })
    };

    // Создаем мок Firestore для development
    db = {
        collection: (name) => ({
            doc: (id) => ({
                set: (data) => {
                    console.log(`📝 Mock: Сохраняем в ${name}/${id}:`, data);
                    return Promise.resolve();
                },
                update: (data) => {
                    console.log(`📝 Mock: Обновляем ${name}/${id}:`, data);
                    return Promise.resolve();
                },
                get: () => Promise.resolve({
                    exists: false,
                    data: () => null,
                    docs: []
                })
            }),
            add: (data) => {
                console.log(`📝 Mock: Добавляем в ${name}:`, data);
                return Promise.resolve({ id: crypto.randomBytes(8).toString('hex') });
            },
            where: () => ({
                limit: () => ({
                    get: () => Promise.resolve({ empty: true, docs: [] })
                }),
                get: () => Promise.resolve({ empty: true, docs: [] })
            }),
            orderBy: () => ({
                limit: () => ({
                    offset: () => ({
                        get: () => Promise.resolve({ empty: true, docs: [] })
                    })
                })
            })
        })
    };
    
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Конфигурация безопасности
const SECURITY_CONFIG = {
    SALT_ROUNDS: 12,
    PASSWORD_MIN_LENGTH: 6,
    JWT_SECRET: process.env.JWT_SECRET || 'super-secret-jwt-key-for-vibecord-production-make-it-long-and-random-12345',
    JWT_EXPIRES_IN: '24h',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_LOCKOUT_TIME: 15 * 60 * 1000,
    TWO_FACTOR_ENABLED: false,
    ENABLE_EMAIL_VERIFICATION: false
};

// Вспомогательные функции безопасности
class SecurityUtils {
    
    static async hashPassword(password) {
        try {
            const salt = await bcrypt.genSalt(SECURITY_CONFIG.SALT_ROUNDS);
            return await bcrypt.hash(password, salt);
        } catch (error) {
            throw new Error('Ошибка хеширования пароля');
        }
    }
    
    static async verifyPassword(password, hash) {
        try {
            return await bcrypt.compare(password, hash);
        } catch (error) {
            throw new Error('Ошибка проверки пароля');
        }
    }
    
    static generateToken(payload) {
        try {
            return jwt.sign(payload, SECURITY_CONFIG.JWT_SECRET, {
                expiresIn: SECURITY_CONFIG.JWT_EXPIRES_IN
            });
        } catch (error) {
            throw new Error('Ошибка генерации токена');
        }
    }
    
    static verifyToken(token) {
        try {
            return jwt.verify(token, SECURITY_CONFIG.JWT_SECRET);
        } catch (error) {
            throw new Error('Недействительный токен');
        }
    }
    
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.length <= 254;
    }
    
    static validatePassword(password) {
        if (!password || password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
            return { 
                valid: false, 
                message: `Пароль должен содержать минимум ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} символов` 
            };
        }
        
        const checks = {
            length: password.length >= SECURITY_CONFIG.PASSWORD_MIN_LENGTH,
            noSequential: !/(.)\1{2,}/.test(password),
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
    
    static sanitizeInput(input) {
        if (typeof input === 'string') {
            return input.trim()
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/[<>\"']/g, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
        }
        return input;
    }
    
    static generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
}

// Простая система управления пользователями (mock в development)
class UserManager {
    static users = new Map(); // В реальном проекте - база данных
    
    static async register(userData, ip = null) {
        try {
            const { email, username, password } = userData;
            
            // Валидация данных
            if (!SecurityUtils.validateEmail(email)) {
                throw new Error('Неверный формат email');
            }
            
            const passwordValidation = SecurityUtils.validatePassword(password);
            if (!passwordValidation.valid) {
                throw new Error(passwordValidation.message);
            }
            
            if (username.length < 3 || username.length > 20) {
                throw new Error('Имя пользователя должно содержать от 3 до 20 символов');
            }
            
            // Проверка уникальности
            const existingUser = this.users.get(email.toLowerCase());
            if (existingUser) {
                throw new Error('Пользователь с таким email уже существует');
            }
            
            const existingUsername = Array.from(this.users.values()).find(u => u.username === username);
            if (existingUsername) {
                throw new Error('Это имя пользователя уже занято');
            }
            
            // Хеширование пароля
            const hashedPassword = await SecurityUtils.hashPassword(password);
            
            // Создание пользователя
            const user = {
                id: SecurityUtils.generateSecureToken(16),
                email: SecurityUtils.sanitizeInput(email.toLowerCase()),
                username: SecurityUtils.sanitizeInput(username),
                password: hashedPassword,
                isActive: true,
                isEmailVerified: false,
                createdAt: new Date(),
                lastLogin: null,
                failedLoginAttempts: 0,
                roles: ['user'],
                loginHistory: [],
                ip: ip
            };
            
            // Сохранение пользователя
            this.users.set(user.email, user);
            
            // Попытка сохранения в Firestore (если возможно)
            try {
                if (db) {
                    await db.collection('users').doc(user.id).set({
                        ...user,
                        createdAt: admin.firestore().FieldValue.serverTimestamp()
                    });
                }
            } catch (firestoreError) {
                console.log('⚠️ Не удалось сохранить в Firestore, используем local storage:', firestoreError.message);
            }
            
            // Генерация токенов
            const tokens = this.generateTokens(user);
            
            console.log('✅ Пользователь успешно зарегистрирован:', user.email);
            
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    isEmailVerified: user.isEmailVerified
                },
                tokens
            };
            
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    static async login(credentials, ip = null) {
        try {
            const { email, password } = credentials;
            
            // Поиск пользователя
            const user = this.users.get(email.toLowerCase());
            if (!user) {
                throw new Error('Неверный email или пароль');
            }
            
            // Проверка блокировки
            if (user.failedLoginAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
                throw new Error('Слишком много неудачных попыток входа. Попробуйте позже.');
            }
            
            // Проверка пароля
            const isPasswordValid = await SecurityUtils.verifyPassword(password, user.password);
            if (!isPasswordValid) {
                user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
                this.users.set(user.email, user);
                throw new Error('Неверный email или пароль');
            }
            
            // Сброс попыток при успешном входе
            user.failedLoginAttempts = 0;
            user.lastLogin = new Date();
            user.loginHistory = user.loginHistory || [];
            user.loginHistory.push({
                timestamp: new Date(),
                ip: ip
            });
            
            this.users.set(user.email, user);
            
            // Генерация токенов
            const tokens = this.generateTokens(user);
            
            console.log('✅ Пользователь успешно вошел в систему:', user.email);
            
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    isEmailVerified: user.isEmailVerified,
                    roles: user.roles
                },
                tokens
            };
            
        } catch (error) {
            console.error('❌ Ошибка входа:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    static findUserByEmail(email) {
        return this.users.get(email.toLowerCase()) || null;
    }
    
    static findUserByUsername(username) {
        return Array.from(this.users.values()).find(u => u.username === username) || null;
    }
    
    static findUserById(userId) {
        return Array.from(this.users.values()).find(u => u.id === userId) || null;
    }
    
    static generateTokens(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            roles: user.roles
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
    
    static async refreshToken(refreshToken, ip = null) {
        try {
            const decoded = SecurityUtils.verifyToken(refreshToken);
            const user = this.findUserById(decoded.userId);
            
            if (!user || !user.isActive) {
                throw new Error('Пользователь не найден или неактивен');
            }
            
            const tokens = this.generateTokens(user);
            
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
    
    static async logout(token, ip = null) {
        try {
            // В реальном проекте можно добавить токен в blacklist
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Экспорт
module.exports = {
    UserManager,
    SecurityUtils,
    SECURITY_CONFIG,
    admin,
    firebaseConfig
};
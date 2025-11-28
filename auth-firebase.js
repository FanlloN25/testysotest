// Полноценная система аутентификации с Firebase Firestore
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

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

// Правильная инициализация Firebase Admin SDK
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                type: "service_account",
                project_id: "softai-bd22a",
                private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "dummy",
                private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
                client_email: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk@softai-bd22a.iam.gserviceaccount.com",
                client_id: process.env.FIREBASE_CLIENT_ID || "dummy",
                auth_uri: "https://accounts.google.com/o/oauth2/auth",
                token_uri: "https://oauth2.googleapis.com/token",
                auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40softai-bd22a.iam.gserviceaccount.com"
            }),
            databaseURL: firebaseConfig.databaseURL
        });
        console.log('🔥 Firebase Admin SDK инициализирован успешно');
    }
} catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    console.log('⚠️ Используется режим разработки без Firebase Admin');
}

const db = admin.firestore();

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

// Система управления пользователями с Firebase Firestore
class UserManager {
    
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
            
            // Проверка уникальности в Firestore
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
                roles: ['user'],
                loginHistory: [],
                ip: ip,
                firebaseCreated: true // Маркер для отслеживания
            };
            
            // Сохранение в Firestore
            try {
                await db.collection('users').doc(user.id).set({
                    ...user,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastLogin: null,
                    loginHistory: []
                });
                console.log('📦 Пользователь сохранен в Firestore:', user.email);
            } catch (firestoreError) {
                console.error('❌ Ошибка сохранения в Firestore:', firestoreError.message);
                throw new Error('Ошибка сохранения пользователя в базу данных');
            }
            
            // Генерация токенов
            const tokens = this.generateTokens(user);
            
            console.log('✅ Пользователь зарегистрирован в Firebase:', user.email);
            
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
            
            // Поиск пользователя в Firestore
            const user = await this.findUserByEmail(email);
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
                // Обновляем количество попыток в Firestore
                await this.incrementFailedAttempts(user.id);
                throw new Error('Неверный email или пароль');
            }
            
            // Сброс попыток и обновление времени входа в Firestore
            await this.updateLoginData(user.id, ip);
            
            // Генерация токенов
            const tokens = this.generateTokens(user);
            
            console.log('✅ Пользователь вошел в систему:', user.email);
            
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
    
    static async findUserByEmail(email) {
        try {
            const query = await db.collection('users')
                .where('email', '==', email.toLowerCase())
                .limit(1)
                .get();
            
            if (query.empty) return null;
            
            const doc = query.docs[0];
            return { id: doc.id, ...doc.data() };
            
        } catch (error) {
            console.error('Ошибка поиска по email:', error.message);
            return null;
        }
    }
    
    static async findUserByUsername(username) {
        try {
            const query = await db.collection('users')
                .where('username', '==', username)
                .limit(1)
                .get();
            
            if (query.empty) return null;
            
            const doc = query.docs[0];
            return { id: doc.id, ...doc.data() };
            
        } catch (error) {
            console.error('Ошибка поиска по username:', error.message);
            return null;
        }
    }
    
    static async findUserById(userId) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            
            if (!doc.exists) return null;
            
            return { id: doc.id, ...doc.data() };
            
        } catch (error) {
            console.error('Ошибка поиска по ID:', error.message);
            return null;
        }
    }
    
    static async incrementFailedAttempts(userId) {
        try {
            const userRef = db.collection('users').doc(userId);
            await userRef.update({
                failedLoginAttempts: admin.firestore.FieldValue.increment(1)
            });
        } catch (error) {
            console.error('Ошибка обновления попыток входа:', error.message);
        }
    }
    
    static async updateLoginData(userId, ip) {
        try {
            const userRef = db.collection('users').doc(userId);
            const loginEntry = {
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                ip: ip
            };
            
            await userRef.update({
                failedLoginAttempts: 0,
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
                loginHistory: admin.firestore.FieldValue.arrayUnion(loginEntry)
            });
        } catch (error) {
            console.error('Ошибка обновления данных входа:', error.message);
        }
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
            const user = await this.findUserById(decoded.userId);
            
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
    
    // Метод для получения статистики из Firebase
    static async getUserStats() {
        try {
            const snapshot = await db.collection('users').get();
            return {
                totalUsers: snapshot.size,
                activeUsers: snapshot.docs.filter(doc => doc.data().isActive).length,
                verifiedUsers: snapshot.docs.filter(doc => doc.data().isEmailVerified).length
            };
        } catch (error) {
            console.error('Ошибка получения статистики:', error.message);
            return { totalUsers: 0, activeUsers: 0, verifiedUsers: 0 };
        }
    }
}

// Экспорт
module.exports = {
    UserManager,
    SecurityUtils,
    SECURITY_CONFIG,
    admin,
    firebaseConfig,
    db
};
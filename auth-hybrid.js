// Гибридная система аутентификации: Firebase Auth + Firestore
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
let admin = require('firebase-admin');

// Проверяем наличие Firebase Admin SDK credentials
let adminInitialized = false;

try {
    // Инициализация Firebase Admin SDK
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID || "softai-bd22a",
            private_key_id: "dummy",
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: "dummy",
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token"
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });

        adminInitialized = true;
        console.log('🔥 Firebase Admin SDK инициализирован успешно');
    } else {
        console.log('⚠️ Firebase Admin credentials не найдены, используем mock режим');
        // Mock admin для development
        admin = createMockAdmin();
    }
} catch (error) {
    console.log('⚠️ Ошибка инициализации Firebase Admin, используем mock:', error.message);
    admin = createMockAdmin();
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
    ENABLE_EMAIL_VERIFICATION: false,
    FIREBASE_ENABLED: adminInitialized
};

// Создание mock Admin для development
function createMockAdmin() {
    return {
        apps: [],
        initializeApp: () => ({}),
        credential: {
            cert: () => ({
                getAccessToken: () => Promise.resolve({ access_token: 'mock-token' })
            })
        },
        firestore: () => ({
            FieldValue: {
                serverTimestamp: () => new Date(),
                arrayUnion: (item) => [item]
            },
            collection: (name) => ({
                doc: (id) => ({
                    set: (data) => {
                        console.log(`📝 Mock Firestore: Сохраняем в ${name}/${id}:`, JSON.stringify(data, null, 2));
                        return Promise.resolve();
                    },
                    update: (data) => {
                        console.log(`📝 Mock Firestore: Обновляем ${name}/${id}:`, data);
                        return Promise.resolve();
                    },
                    get: () => Promise.resolve({
                        exists: true,
                        data: () => ({ mock: true }),
                        id: id
                    })
                }),
                add: (data) => {
                    const id = crypto.randomBytes(12).toString('hex');
                    console.log(`📝 Mock Firestore: Добавляем в ${name}:`, JSON.stringify(data, null, 2));
                    return Promise.resolve({ id });
                },
                where: () => ({
                    limit: () => ({
                        get: () => Promise.resolve({
                            empty: false,
                            docs: [{
                                id: 'mock-user',
                                data: () => ({ mock: true })
                            }]
                        })
                    }),
                    get: () => Promise.resolve({
                        empty: false,
                        docs: [{
                            id: 'mock-user',
                            data: () => ({ mock: true })
                        }]
                    })
                }),
                orderBy: () => ({
                    limit: () => ({
                        offset: () => ({
                            get: () => Promise.resolve({
                                empty: false,
                                docs: [{
                                    id: 'mock-user',
                                    data: () => ({ mock: true })
                                }]
                            })
                        })
                    })
                })
            })
        })
    };
}

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

// Гибридный менеджер пользователей с Firebase интеграцией
class HybridUserManager {
    
    // Регистрация пользователя с созданием в Firebase Auth
    static async register(userData, ip = null, firebaseUserId = null) {
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
            
            // Хеширование пароля (для локального использования)
            const hashedPassword = await SecurityUtils.hashPassword(password);
            
            // Создание пользователя в Firestore
            const userId = firebaseUserId || SecurityUtils.generateSecureToken(16);
            
            const user = {
                id: userId,
                email: SecurityUtils.sanitizeInput(email.toLowerCase()),
                username: SecurityUtils.sanitizeInput(username),
                password: hashedPassword, // Только для локального использования
                firebaseUid: firebaseUserId, // UID из Firebase Auth
                isActive: true,
                isEmailVerified: false,
                createdAt: admin.firestore().FieldValue.serverTimestamp(),
                lastLogin: null,
                failedLoginAttempts: 0,
                roles: ['user'],
                loginHistory: [],
                ip: ip,
                registrationSource: 'vibecord_web'
            };
            
            // Сохранение в Firestore
            if (db) {
                await db.collection('vibecord_users').doc(userId).set(user);
                console.log('✅ Пользователь сохранен в Firestore:', user.email);
            } else {
                console.log('⚠️ Firestore недоступен, пользователь не сохранен');
            }
            
            // Генерация токенов
            const tokens = this.generateTokens(user);
            
            console.log('✅ Пользователь успешно зарегистрирован:', user.email, 'ID:', userId);
            
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    isEmailVerified: user.isEmailVerified,
                    firebaseUid: user.firebaseUid
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
    
    // Поиск пользователя в Firestore по email
    static async findUserByEmail(email) {
        try {
            if (!db) return null;
            
            const snapshot = await db.collection('vibecord_users')
                .where('email', '==', email.toLowerCase())
                .limit(1)
                .get();
            
            if (snapshot.empty) return null;
            
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };
            
        } catch (error) {
            console.error('Error finding user by email:', error);
            return null;
        }
    }
    
    // Поиск пользователя по username
    static async findUserByUsername(username) {
        try {
            if (!db) return null;
            
            const snapshot = await db.collection('vibecord_users')
                .where('username', '==', username)
                .limit(1)
                .get();
            
            if (snapshot.empty) return null;
            
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };
            
        } catch (error) {
            console.error('Error finding user by username:', error);
            return null;
        }
    }
    
    // Поиск пользователя по ID
    static async findUserById(userId) {
        try {
            if (!db) return null;
            
            const doc = await db.collection('vibecord_users').doc(userId).get();
            
            if (!doc.exists) return null;
            
            return { id: doc.id, ...doc.data() };
            
        } catch (error) {
            console.error('Error finding user by ID:', error);
            return null;
        }
    }
    
    // Вход пользователя
    static async login(credentials, ip = null) {
        try {
            const { email, password } = credentials;
            
            // Поиск пользователя
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
                // Увеличиваем счетчик неудачных попыток
                await this.recordFailedLogin(user, ip);
                throw new Error('Неверный email или пароль');
            }
            
            // Сброс попыток при успешном входе
            await this.recordSuccessfulLogin(user, ip);
            
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
                    roles: user.roles,
                    firebaseUid: user.firebaseUid
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
    
    // Запись неудачной попытки входа
    static async recordFailedLogin(user, ip = null) {
        try {
            const failedAttempts = (user.failedLoginAttempts || 0) + 1;
            
            await db.collection('vibecord_users').doc(user.id).update({
                failedLoginAttempts: failedAttempts,
                updatedAt: admin.firestore().FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error recording failed login:', error);
        }
    }
    
    // Запись успешного входа
    static async recordSuccessfulLogin(user, ip = null) {
        try {
            const loginEntry = {
                timestamp: admin.firestore().FieldValue.serverTimestamp(),
                ip: ip
            };
            
            await db.collection('vibecord_users').doc(user.id).update({
                failedLoginAttempts: 0,
                lastLogin: admin.firestore().FieldValue.serverTimestamp(),
                loginHistory: admin.firestore().FieldValue.arrayUnion(loginEntry),
                updatedAt: admin.firestore().FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error recording successful login:', error);
        }
    }
    
    // Генерация токенов
    static generateTokens(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            roles: user.roles,
            firebaseUid: user.firebaseUid
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
    
    // Обновление токена
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
    
    // Выход пользователя
    static async logout(token, ip = null) {
        try {
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // Получение всех пользователей (для админки)
    static async getAllUsers() {
        try {
            if (!db) return [];
            
            const snapshot = await db.collection('vibecord_users')
                .orderBy('createdAt', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                password: undefined // Убираем пароль из ответа
            }));
            
        } catch (error) {
            console.error('Error getting all users:', error);
            return [];
        }
    }
}

// Экспорт
module.exports = {
    HybridUserManager,
    SecurityUtils,
    SECURITY_CONFIG,
    admin,
    firebaseConfig: {
        apiKey: "AIzaSyD73TT1L4rslvuNGvOfMUOdR3ZnnNzTWmY",
        authDomain: "softai-bd22a.firebaseapp.com",
        databaseURL: "https://softai-bd22a-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "softai-bd22a",
        storageBucket: "softai-bd22a.firebasestorage.app",
        messagingSenderId: "225066508622",
        appId: "1:225066508622:web:0f09237a168dda21657e1f",
        measurementId: "G-WT2BG911J6"
    }
};
// Firebase Production клиент: Создает аккаунты в Firebase Console + сохраняет данные в Firestore
class VibeCordFirebaseAuth {
    
    constructor() {
        this.currentUser = null;
        this.authListeners = [];
        this.firebaseConfig = null;
        this.app = null;
        this.auth = null;
        this.db = null;
        this.apiBase = window.location.origin;
        this.init();
    }
    
    async init() {
        try {
            // Получаем конфигурацию Firebase с сервера
            await this.loadFirebaseConfig();
            
            // Инициализируем Firebase
            await this.initializeFirebase();
            
            // Настраиваем слушатель аутентификации
            this.setupAuthListener();
            
            console.log('🔥 Firebase Production Auth инициализирован успешно');
            
        } catch (error) {
            console.error('Ошибка инициализации Firebase:', error);
        }
    }
    
    // Загрузка конфигурации Firebase с сервера
    async loadFirebaseConfig() {
        try {
            const response = await fetch(`${this.apiBase}/api/firebase/config`);
            const result = await response.json();
            
            if (result.success) {
                this.firebaseConfig = result.config;
            } else {
                throw new Error('Не удалось получить конфигурацию Firebase');
            }
        } catch (error) {
            console.error('Ошибка загрузки конфигурации Firebase:', error);
            throw error;
        }
    }
    
    // Инициализация Firebase
    async initializeFirebase() {
        try {
            // Загружаем Firebase SDK
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            this.app = initializeApp(this.firebaseConfig);
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app);
            
        } catch (error) {
            console.error('Ошибка инициализации Firebase SDK:', error);
            throw error;
        }
    }
    
    // Настройка слушателя изменений аутентификации
    setupAuthListener() {
        const { onAuthStateChanged } = this.getAuth();
        onAuthStateChanged(this.auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Получаем дополнительную информацию о пользователе с сервера
                await this.loadUserProfile(firebaseUser.uid, firebaseUser.email);
            } else {
                this.currentUser = null;
                this.notifyListeners(null);
                this.updateUI(null);
            }
        });
    }
    
    // Получение профиля пользователя с сервера
    async loadUserProfile(firebaseUid, email) {
        try {
            const token = await this.auth.currentUser.getIdToken();
            const response = await fetch(`${this.apiBase}/api/account/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.data) {
                    this.currentUser = {
                        ...result.data,
                        firebaseUid: firebaseUid,
                        email: email
                    };
                    this.notifyListeners(this.currentUser);
                    this.updateUI(this.currentUser);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
        }
    }
    
    // Получение Firebase Auth модуля
    getAuth() {
        return window.firebase?.auth() || {};
    }
    
    // Добавление слушателя изменений
    addAuthListener(callback) {
        this.authListeners.push(callback);
        if (this.currentUser) {
            callback(this.currentUser);
        }
    }
    
    // Уведомление всех слушателей
    notifyListeners(user) {
        this.authListeners.forEach(callback => callback(user));
    }
    
    // Обновление UI
    updateUI(user) {
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const userInfo = document.getElementById('userInfo');
        
        if (user) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (registerBtn) registerBtn.style.display = 'none';
            if (userInfo) {
                userInfo.style.display = 'flex';
                const usernameSpan = document.getElementById('username');
                if (usernameSpan) {
                    usernameSpan.textContent = user.username || user.email;
                }
            }
        } else {
            if (loginBtn) loginBtn.style.display = 'block';
            if (registerBtn) registerBtn.style.display = 'block';
            if (userInfo) userInfo.style.display = 'none';
        }
    }
    
    // Регистрация пользователя в Firebase Console + Firestore
    async register(email, password, username) {
        try {
            const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            
            // 1. Создаем пользователя в Firebase Console
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const firebaseUser = userCredential.user;
            
            // 2. Обновляем профиль
            await updateProfile(firebaseUser, {
                displayName: username
            });
            
            // 3. Отправляем email верификацию
            if (!firebaseUser.emailVerified) {
                await firebaseUser.sendEmailVerification();
            }
            
            // 4. Сохраняем дополнительные данные в Firestore через серверный API
            const serverResult = await this.saveUserToServer(firebaseUser.uid, email, username, password);
            
            if (serverResult.success) {
                console.log('🔥 Пользователь создан в Firebase Console:', firebaseUser.uid);
                console.log('💾 Дополнительные данные сохранены в Firestore');
                
                return {
                    success: true,
                    user: {
                        id: serverResult.data.user.id,
                        email: firebaseUser.email,
                        username: username,
                        firebaseUid: firebaseUser.uid,
                        isEmailVerified: firebaseUser.emailVerified
                    },
                    message: 'Регистрация успешна! Проверьте email для подтверждения.',
                    firebaseAccount: true,
                    firestoreData: true
                };
            } else {
                // Удаляем пользователя из Firebase если серверная сохранение не удалась
                await firebaseUser.delete();
                throw new Error(serverResult.error);
            }
            
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code || error.message)
            };
        }
    }
    
    // Вход пользователя
    async login(email, password) {
        try {
            const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            
            // 1. Аутентификация через Firebase
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            const firebaseUser = userCredential.user;
            
            // 2. Проверяем что пользователь существует в нашей Firestore коллекции
            const serverResult = await this.loginToServer(firebaseUser.uid, email);
            
            if (serverResult.success) {
                console.log('👤 Вход через Firebase:', firebaseUser.uid);
                
                return {
                    success: true,
                    user: {
                        id: serverResult.data.user.id,
                        email: firebaseUser.email,
                        username: serverResult.data.user.username,
                        firebaseUid: firebaseUser.uid,
                        isEmailVerified: firebaseUser.emailVerified
                    },
                    message: 'Вход выполнен успешно!',
                    firebaseAuth: true,
                    firestoreData: true
                };
            } else {
                // Если пользователь есть в Firebase, но нет в Firestore
                if (error.code === 'auth/wrong-password') {
                    throw error;
                }
                
                return {
                    success: false,
                    error: 'Пользователь не найден в системе'
                };
            }
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code || error.message)
            };
        }
    }
    
    // Выход пользователя
    async logout() {
        try {
            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            await signOut(this.auth);
            
            // Очищаем локальное состояние
            this.currentUser = null;
            this.notifyListeners(null);
            this.updateUI(null);
            
            console.log('👋 Пользователь вышел из Firebase');
            
            return {
                success: true,
                message: 'Выход выполнен успешно!'
            };
            
        } catch (error) {
            console.error('Ошибка выхода:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code || error.message)
            };
        }
    }
    
    // Сохранение пользователя в серверную базу
    async saveUserToServer(firebaseUid, email, username, password) {
        try {
            const response = await fetch(`${this.apiBase}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    username,
                    password,
                    firebaseUid
                })
            });
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error('Ошибка сохранения на сервер:', error);
            return {
                success: false,
                error: 'Не удалось сохранить данные пользователя'
            };
        }
    }
    
    // Вход через сервер (для дополнительной проверки)
    async loginToServer(firebaseUid, email) {
        try {
            // Поскольку пользователь уже аутентифицирован в Firebase,
            // нам нужно использовать токен Firebase для доступа к серверу
            const token = await this.auth.currentUser.getIdToken();
            
            // Создаем простой запрос для проверки существования пользователя
            const response = await fetch(`${this.apiBase}/api/account/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                return {
                    success: true,
                    data: result
                };
            } else {
                return {
                    success: false,
                    error: 'Пользователь не найден в системе'
                };
            }
            
        } catch (error) {
            console.error('Ошибка входа на сервер:', error);
            return {
                success: false,
                error: 'Ошибка аутентификации'
            };
        }
    }
    
    // Получение понятных сообщений об ошибках
    getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/user-not-found': 'Пользователь с таким email не найден',
            'auth/wrong-password': 'Неверный пароль',
            'auth/email-already-in-use': 'Пользователь с таким email уже существует',
            'auth/weak-password': 'Пароль слишком слабый',
            'auth/invalid-email': 'Неверный формат email',
            'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
            'auth/user-disabled': 'Аккаунт заблокирован',
            'auth/operation-not-allowed': 'Операция не разрешена',
            'auth/requires-recent-login': 'Требуется недавний вход'
        };
        
        return errorMessages[errorCode] || errorCode || 'Произошла ошибка. Попробуйте снова.';
    }
    
    // Проверка подключения к Firebase
    async checkFirebaseConnection() {
        try {
            const response = await fetch(`${this.apiBase}/api/firebase/test`);
            const result = await response.json();
            return result;
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Получение статуса системы
    async getSystemStatus() {
        try {
            const response = await fetch(`${this.apiBase}/api/system/status`);
            const result = await response.json();
            return result;
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Утилиты для работы с формами
class FirebaseAuthUI {
    
    static attachHandlers() {
        FirebaseAuthUI.attachRegisterHandler();
        FirebaseAuthUI.attachLoginHandler();
        FirebaseAuthUI.attachLogoutHandler();
    }
    
    // Обработчик регистрации
    static attachRegisterHandler() {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = document.getElementById('registerUsername').value;
                const email = document.getElementById('registerEmail').value;
                const password = document.getElementById('registerPassword').value;
                const confirmPassword = document.getElementById('registerConfirmPassword').value;
                
                // Валидация
                if (password !== confirmPassword) {
                    FirebaseAuthUI.showAlert('Пароли не совпадают!', 'error');
                    return;
                }
                
                if (password.length < 6) {
                    FirebaseAuthUI.showAlert('Пароль должен содержать минимум 6 символов!', 'error');
                    return;
                }
                
                FirebaseAuthUI.showAlert('Создаем аккаунт в Firebase...', 'info');
                
                const result = await window.vibecordFirebaseAuth.register(email, password, username);
                
                if (result.success) {
                    FirebaseAuthUI.showAlert(`${result.message} (Firebase UID: ${result.user.firebaseUid})`, 'success');
                    FirebaseAuthUI.hideModal('registerModal');
                    document.getElementById('registerForm').reset();
                } else {
                    FirebaseAuthUI.showAlert(result.error, 'error');
                }
            });
        }
    }
    
    // Обработчик входа
    static attachLoginHandler() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                
                FirebaseAuthUI.showAlert('Входим через Firebase...', 'info');
                
                const result = await window.vibecordFirebaseAuth.login(email, password);
                
                if (result.success) {
                    FirebaseAuthUI.showAlert(`${result.message} (Firebase UID: ${result.user.firebaseUid})`, 'success');
                    FirebaseAuthUI.hideModal('loginModal');
                    document.getElementById('loginForm').reset();
                } else {
                    FirebaseAuthUI.showAlert(result.error, 'error');
                }
            });
        }
    }
    
    // Обработчик выхода
    static attachLogoutHandler() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                FirebaseAuthUI.showAlert('Выходим из Firebase...', 'info');
                
                const result = await window.vibecordFirebaseAuth.logout();
                
                if (result.success) {
                    FirebaseAuthUI.showAlert(result.message, 'success');
                } else {
                    FirebaseAuthUI.showAlert(result.error, 'error');
                }
            });
        }
    }
    
    // Показать модальное окно
    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }
    
    // Скрыть модальное окно
    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // Показать уведомление
    static showAlert(message, type = 'info') {
        // Создаем уведомление
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        switch (type) {
            case 'success':
                alert.style.backgroundColor = '#10B981';
                break;
            case 'error':
                alert.style.backgroundColor = '#EF4444';
                break;
            default:
                alert.style.backgroundColor = '#3B82F6';
        }
        
        alert.textContent = message;
        document.body.appendChild(alert);
        
        // Удаляем через 5 секунд
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
    }
    
    // Инициализация обработчиков модальных окон
    static initModals() {
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => FirebaseAuthUI.showModal('loginModal'));
        }
        
        if (registerBtn) {
            registerBtn.addEventListener('click', () => FirebaseAuthUI.showModal('registerModal'));
        }
        
        // Кнопки закрытия
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        // Переключение между модалами
        const showRegister = document.getElementById('showRegister');
        const showLogin = document.getElementById('showLogin');
        
        if (showRegister) {
            showRegister.addEventListener('click', (e) => {
                e.preventDefault();
                FirebaseAuthUI.hideModal('loginModal');
                FirebaseAuthUI.showModal('registerModal');
            });
        }
        
        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                FirebaseAuthUI.hideModal('registerModal');
                FirebaseAuthUI.showModal('loginModal');
            });
        }
        
        // Закрытие по клику вне модала
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }
}

// Создаем глобальный экземпляр
window.vibecordFirebaseAuth = new VibeCordFirebaseAuth();

// Экспорт для использования
window.FirebaseAuthUI = FirebaseAuthUI;

// Автоматическая инициализация
document.addEventListener('DOMContentLoaded', async () => {
    FirebaseAuthUI.initModals();
    FirebaseAuthUI.attachHandlers();
    
    // Проверяем подключение к Firebase
    const status = await window.vibecordFirebaseAuth.checkFirebaseConnection();
    console.log('🔥 Firebase Status:', status);
});

console.log('🔥 VibeCord Firebase Production Auth загружен!');
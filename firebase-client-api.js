// Firebase клиент с интеграцией серверного API для VibeCord
// Использует серверные endpoints вместо прямого подключения к Firebase

class VibeCordAuthAPI {
    
    constructor() {
        this.currentUser = null;
        this.authListeners = [];
        this.apiBase = window.location.origin; // Базовый URL API
        this.init();
    }
    
    async init() {
        try {
            // Проверяем текущую сессию
            await this.checkAuthStatus();
            
            console.log('🔥 VibeCord API Auth инициализирован успешно');
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
        }
    }
    
    // Проверка статуса аутентификации
    async checkAuthStatus() {
        const token = localStorage.getItem('vibecord_access_token');
        if (token) {
            try {
                const response = await this.makeRequest('/api/account/profile', 'GET', null, token);
                if (response.data) {
                    this.currentUser = response.data;
                    this.notifyListeners(this.currentUser);
                    this.updateUI(this.currentUser);
                }
            } catch (error) {
                // Токен недействителен, очищаем локальное хранилище
                this.logout();
            }
        }
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
    
    // Обновление UI в зависимости от состояния
    updateUI(user) {
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const userInfo = document.getElementById('userInfo');
        
        if (user) {
            // Пользователь авторизован
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
            // Пользователь не авторизован
            if (loginBtn) loginBtn.style.display = 'block';
            if (registerBtn) registerBtn.style.display = 'block';
            if (userInfo) userInfo.style.display = 'none';
        }
    }
    
    // Регистрация пользователя
    async register(email, password, username) {
        try {
            const response = await this.makeRequest('/api/auth/register', 'POST', {
                email,
                password,
                username
            });
            
            if (response.data && response.data.success) {
                const { user, tokens } = response.data;
                
                // Сохраняем токены
                this.saveTokens(tokens);
                
                // Обновляем текущего пользователя
                this.currentUser = user;
                this.notifyListeners(user);
                this.updateUI(user);
                
                return {
                    success: true,
                    user,
                    message: response.message || 'Регистрация успешна!'
                };
            } else {
                return {
                    success: false,
                    error: response.error || 'Неизвестная ошибка регистрации'
                };
            }
            
        } catch (error) {
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }
    
    // Вход пользователя
    async login(email, password) {
        try {
            const response = await this.makeRequest('/api/auth/login', 'POST', {
                email,
                password
            });
            
            if (response.data && response.data.success) {
                const { user, tokens } = response.data;
                
                // Сохраняем токены
                this.saveTokens(tokens);
                
                // Обновляем текущего пользователя
                this.currentUser = user;
                this.notifyListeners(user);
                this.updateUI(user);
                
                return {
                    success: true,
                    user,
                    message: response.message || 'Вход выполнен успешно!'
                };
            } else {
                return {
                    success: false,
                    error: response.error || 'Неизвестная ошибка входа'
                };
            }
            
        } catch (error) {
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }
    
    // Выход пользователя
    async logout() {
        try {
            const token = this.getAccessToken();
            if (token) {
                await this.makeRequest('/api/auth/logout', 'POST', null, token);
            }
        } catch (error) {
            console.warn('Ошибка при выходе:', error);
        } finally {
            // Очищаем локальное состояние в любом случае
            this.logout();
        }
    }
    
    // Внутренний метод для очистки состояния
    logout() {
        localStorage.removeItem('vibecord_access_token');
        localStorage.removeItem('vibecord_refresh_token');
        this.currentUser = null;
        this.notifyListeners(null);
        this.updateUI(null);
    }
    
    // Сохранение токенов
    saveTokens(tokens) {
        if (tokens.accessToken) {
            localStorage.setItem('vibecord_access_token', tokens.accessToken);
        }
        if (tokens.refreshToken) {
            localStorage.setItem('vibecord_refresh_token', tokens.refreshToken);
        }
    }
    
    // Получение access token
    getAccessToken() {
        return localStorage.getItem('vibecord_access_token');
    }
    
    // Получение refresh token
    getRefreshToken() {
        return localStorage.getItem('vibecord_refresh_token');
    }
    
    // Обновление токена
    async refreshToken() {
        try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) {
                throw new Error('Refresh токен отсутствует');
            }
            
            const response = await this.makeRequest('/api/auth/refresh', 'POST', {
                refreshToken
            });
            
            if (response.data && response.data.success) {
                const { tokens } = response.data;
                this.saveTokens(tokens);
                return tokens;
            } else {
                throw new Error(response.error || 'Не удалось обновить токен');
            }
            
        } catch (error) {
            console.error('Ошибка обновления токена:', error);
            this.logout();
            throw error;
        }
    }
    
    // HTTP запрос с автоматическим обновлением токена
    async makeRequest(url, method = 'GET', data = null, customToken = null) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Добавляем токен авторизации
        const token = customToken || this.getAccessToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const config = {
            method,
            headers
        };
        
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${this.apiBase}${url}`, config);
        
        // Если токен истек, пытаемся обновить и повторить запрос
        if (response.status === 401 && !customToken && this.getRefreshToken()) {
            try {
                await this.refreshToken();
                // Повторяем запрос с новым токеном
                const newToken = this.getAccessToken();
                if (newToken) {
                    headers['Authorization'] = `Bearer ${newToken}`;
                    config.headers = headers;
                    
                    const retryResponse = await fetch(`${this.apiBase}${url}`, config);
                    
                    if (!retryResponse.ok) {
                        const errorData = await retryResponse.json().catch(() => ({}));
                        throw new Error(errorData.error || `HTTP ${retryResponse.status}`);
                    }
                    
                    return await retryResponse.json();
                }
            } catch (refreshError) {
                this.logout();
                throw refreshError;
            }
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
    }
    
    // Получение понятных сообщений об ошибках
    getErrorMessage(error) {
        if (typeof error === 'string') {
            return error;
        }
        
        if (error.message) {
            const errorMessages = {
                'NETWORK_ERROR': 'Ошибка сети. Проверьте подключение к интернету.',
                'TIMEOUT': 'Запрос занял слишком много времени.',
                'TOKEN_EXPIRED': 'Сессия истекла. Пожалуйста, войдите снова.',
                'INVALID_CREDENTIALS': 'Неверный email или пароль.',
                'EMAIL_ALREADY_EXISTS': 'Пользователь с таким email уже существует.',
                'WEAK_PASSWORD': 'Пароль слишком слабый.',
                'INVALID_EMAIL': 'Неверный формат email.',
                'TOO_MANY_REQUESTS': 'Слишком много попыток. Попробуйте позже.'
            };
            
            // Проверяем точное совпадение
            if (errorMessages[error.message]) {
                return errorMessages[error.message];
            }
            
            // Проверяем частичное совпадение
            for (const [key, message] of Object.entries(errorMessages)) {
                if (error.message.includes(key)) {
                    return message;
                }
            }
        }
        
        return 'Произошла ошибка. Попробуйте снова.';
    }
    
    // Проверка состояния API
    async checkSystemStatus() {
        try {
            const response = await this.makeRequest('/api/system/status', 'GET');
            return response;
        } catch (error) {
            console.error('Ошибка проверки статуса системы:', error);
            return null;
        }
    }
}

// Утилиты для работы с формами
class AuthUI {
    
    static attachHandlers() {
        AuthUI.attachRegisterHandler();
        AuthUI.attachLoginHandler();
        AuthUI.attachLogoutHandler();
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
                    alert('Пароли не совпадают!');
                    return;
                }
                
                if (password.length < 6) {
                    alert('Пароль должен содержать минимум 6 символов!');
                    return;
                }
                
                const result = await window.vibecordAuthAPI.register(email, password, username);
                
                if (result.success) {
                    alert(result.message);
                    AuthUI.hideModal('registerModal');
                    document.getElementById('registerForm').reset();
                } else {
                    alert(result.error);
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
                
                const result = await window.vibecordAuthAPI.login(email, password);
                
                if (result.success) {
                    alert(result.message);
                    AuthUI.hideModal('loginModal');
                    document.getElementById('loginForm').reset();
                } else {
                    alert(result.error);
                }
            });
        }
    }
    
    // Обработчик выхода
    static attachLogoutHandler() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await window.vibecordAuthAPI.logout();
                alert('Вы успешно вышли из системы');
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
    
    // Инициализация обработчиков модальных окон
    static initModals() {
        // Кнопки для открытия модалов
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => AuthUI.showModal('loginModal'));
        }
        
        if (registerBtn) {
            registerBtn.addEventListener('click', () => AuthUI.showModal('registerModal'));
        }
        
        // Кнопки для закрытия модалов
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
                AuthUI.hideModal('loginModal');
                AuthUI.showModal('registerModal');
            });
        }
        
        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                AuthUI.hideModal('registerModal');
                AuthUI.showModal('loginModal');
            });
        }
        
        // Закрытие модалов по клику вне их
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }
}

// Создаем глобальный экземпляр
window.vibecordAuthAPI = new VibeCordAuthAPI();

// Экспорт для использования
window.AuthUI = AuthUI;

// Автоматическая инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    AuthUI.initModals();
    AuthUI.attachHandlers();
});

console.log('🔥 VibeCord API интеграция загружена!');
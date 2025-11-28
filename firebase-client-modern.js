// Firebase современная версия для VibeCord - AI aim assist система

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

// VibeCord Authentication Manager (современная версия)
class VibeCordAuthModern {
    
    constructor() {
        this.currentUser = null;
        this.authListeners = [];
        this.db = null;
        this.init();
    }
    
    async init() {
        try {
            // Инициализация Firebase
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { getFirestore, doc, setDoc, updateDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            this.app = initializeApp(firebaseConfig);
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app);
            
            // Слушатель изменений аутентификации
            onAuthStateChanged(this.auth, (user) => {
                this.currentUser = user;
                this.notifyListeners(user);
                this.updateUI(user);
            });
            
            console.log('🔥 Firebase инициализирован успешно');
            
        } catch (error) {
            console.error('Ошибка инициализации Firebase:', error);
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
                    usernameSpan.textContent = user.displayName || user.email;
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
            const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const user = userCredential.user;
            
            // Обновляем профиль
            await updateProfile(user, {
                displayName: username
            });
            
            // Создаем документ клиента в Firestore
            const customerData = {
                email: email,
                username: username,
                createdAt: serverTimestamp(),
                isVerified: false,
                isActive: true,
                isBlocked: false,
                lastLogin: serverTimestamp()
            };
            
            await setDoc(doc(this.db, 'customers', user.uid), customerData);
            
            return {
                success: true,
                user: user,
                message: 'Регистрация успешна! Проверьте email для подтверждения.'
            };
            
        } catch (error) {
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }
    
    // Вход пользователя
    async login(email, password) {
        try {
            const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            await signInWithEmailAndPassword(this.auth, email, password);
            
            // Обновляем время последнего входа
            if (this.currentUser) {
                await updateDoc(doc(this.db, 'customers', this.currentUser.uid), {
                    lastLogin: serverTimestamp()
                });
            }
            
            return {
                success: true,
                message: 'Вход выполнен успешно!'
            };
            
        } catch (error) {
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }
    
    // Выход пользователя
    async logout() {
        try {
            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            await signOut(this.auth);
            
            return {
                success: true,
                message: 'Выход выполнен успешно!'
            };
        } catch (error) {
            return {
                success: false,
                error: this.getErrorMessage(error.code)
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
            'auth/user-disabled': 'Аккаунт заблокирован'
        };
        
        return errorMessages[errorCode] || 'Произошла ошибка. Попробуйте снова.';
    }
}

// Создаем глобальный экземпляр
window.vibecordAuthModern = new VibeCordAuthModern();

// Утилиты для работы с формами
class AuthUIModern {
    
    // Показать форму регистрации
    static showRegisterForm() {
        const modal = document.getElementById('registerModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }
    
    // Показать форму входа
    static showLoginForm() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.style.display = 'block';
        }
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
                
                const result = await window.vibecordAuthModern.register(email, password, username);
                
                if (result.success) {
                    alert(result.message);
                    document.getElementById('registerModal').style.display = 'none';
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
                
                const result = await window.vibecordAuthModern.login(email, password);
                
                if (result.success) {
                    alert(result.message);
                    document.getElementById('loginModal').style.display = 'none';
                } else {
                    alert(result.error);
                }
            });
        }
    }
}

// Экспорт для использования в HTML
window.AuthUIModern = AuthUIModern;

console.log('🔥 VibeCord Firebase современная интеграция загружена!');
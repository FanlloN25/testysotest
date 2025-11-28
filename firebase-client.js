// Firebase клиентская интеграция для VibeCord - AI aim assist система
// Подключение к Firebase для сайта продажи игрового софта

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

// VibeCord Database Manager
class VibeCordDB {
    
    constructor() {
        this.currentUser = null;
        this.authListeners = [];
        this.initAuthStateListener();
    }
    
    // Инициализация слушателя аутентификации
    initAuthStateListener() {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged((user) => {
                this.currentUser = user;
                this.notifyListeners(user);
                this.updateUI(user);
            });
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
        const username = document.getElementById('username');
        
        if (user) {
            // Пользователь авторизован
            if (loginBtn) loginBtn.style.display = 'none';
            if (registerBtn) registerBtn.style.display = 'none';
            if (userInfo) {
                userInfo.style.display = 'flex';
                if (username) username.textContent = user.displayName || user.email;
            }
        } else {
            // Пользователь не авторизован
            if (loginBtn) loginBtn.style.display = 'block';
            if (registerBtn) registerBtn.style.display = 'block';
            if (userInfo) userInfo.style.display = 'none';
        }
    }
    
    // Регистрация нового клиента
    async register(email, password, username) {
        try {
            if (typeof firebase === 'undefined' || !firebase.auth) {
                throw new Error('Firebase не загружен');
            }
            
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Обновляем профиль
            await user.updateProfile({
                displayName: username
            });
            
            // Создаем документ клиента в Firestore
            await firebase.firestore().collection('customers').doc(user.uid).set({
                email: user.email,
                username: username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isVerified: false,
                isActive: true,
                isBlocked: false,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Отправляем email верификацию
            if (!user.emailVerified) {
                await user.sendEmailVerification();
            }
            
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
    
    // Вход клиента
    async login(email, password) {
        try {
            if (typeof firebase === 'undefined' || !firebase.auth) {
                throw new Error('Firebase не загружен');
            }
            
            await firebase.auth().signInWithEmailAndPassword(email, password);
            
            // Обновляем время последнего входа
            const user = firebase.auth().currentUser;
            if (user) {
                await firebase.firestore().collection('customers').doc(user.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
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
    
    // Выход клиента
    async logout() {
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                await firebase.auth().signOut();
            }
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
    
    // Получение списка продуктов
    async getProducts() {
        try {
            const snapshot = await firebase.firestore().collection('products').get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Ошибка загрузки продуктов:', error);
            return [];
        }
    }
    
    // Получение покупок пользователя
    async getUserPurchases() {
        try {
            if (!this.currentUser) return [];
            
            const snapshot = await firebase.firestore()
                .collection('purchases')
                .where('customerId', '==', this.currentUser.uid)
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Ошибка загрузки покупок:', error);
            return [];
        }
    }
    
    // Создание покупки
    async createPurchase(productId, paymentMethod, amount) {
        try {
            if (!this.currentUser) {
                throw new Error('Пользователь не авторизован');
            }
            
            const purchaseData = {
                customerId: this.currentUser.uid,
                productId: productId,
                amount: amount,
                currency: 'RUB',
                status: 'pending',
                paymentMethod: paymentMethod,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await firebase.firestore().collection('purchases').add(purchaseData);
            
            return {
                success: true,
                purchaseId: docRef.id,
                message: 'Заказ создан! Переходим к оплате...'
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
window.vibecordDB = new VibeCordDB();

// Экспорт для использования в HTML
window.VibeCordDB = VibeCordDB;

console.log('🔥 VibeCord Database интеграция загружена!');
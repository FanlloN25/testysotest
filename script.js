// Firebase User Management System
class UserManager {
    constructor() {
        this.currentUser = null;
        this.firebaseReady = false;
        this.init();
    }

    async init() {
        await this.initFirebase();
        this.bindEvents();
        this.updateUI();
    }

    async initFirebase() {
        try {
            // Firebase configuration
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

            // Initialize Firebase
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            this.app = initializeApp(firebaseConfig);
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app);
            
            // Listen for auth state changes
            onAuthStateChanged(this.auth, async (firebaseUser) => {
                if (firebaseUser) {
                    // Get additional user data from Firestore
                    const userDoc = await getDoc(doc(this.db, 'customers', firebaseUser.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        this.currentUser = {
                            id: firebaseUser.uid,
                            email: firebaseUser.email,
                            username: userData.username || firebaseUser.displayName,
                            isEmailVerified: firebaseUser.emailVerified,
                            createdAt: userData.createdAt
                        };
                    } else {
                        // Create user document if it doesn't exist
                        await setDoc(doc(this.db, 'customers', firebaseUser.uid), {
                            email: firebaseUser.email,
                            username: firebaseUser.displayName || '',
                            createdAt: serverTimestamp(),
                            isVerified: firebaseUser.emailVerified,
                            isActive: true,
                            isBlocked: false,
                            lastLogin: serverTimestamp()
                        });
                        
                        this.currentUser = {
                            id: firebaseUser.uid,
                            email: firebaseUser.email,
                            username: firebaseUser.displayName || '',
                            isEmailVerified: firebaseUser.emailVerified
                        };
                    }
                } else {
                    this.currentUser = null;
                }
                this.updateUI();
            });
            
            this.firebaseReady = true;
            console.log('🔥 Firebase инициализирован успешно');
            
        } catch (error) {
            console.error('Ошибка инициализации Firebase:', error);
            this.firebaseReady = false;
        }
    }

    async register(email, password, username) {
        try {
            if (!this.firebaseReady) {
                throw new Error('Firebase не инициализирован');
            }

            const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            // Check if user already exists in Firebase
            try {
                await createUserWithEmailAndPassword(this.auth, email, password);
            } catch (error) {
                if (error.code === 'auth/email-already-in-use') {
                    throw new Error('Пользователь с таким email уже существует в Firebase');
                }
                throw error;
            }
            
            const user = this.auth.currentUser;
            
            // Update profile with username
            await updateProfile(user, {
                displayName: username
            });
            
            // Create user document in Firestore
            await setDoc(doc(this.db, 'customers', user.uid), {
                email: email,
                username: username,
                createdAt: serverTimestamp(),
                isVerified: user.emailVerified,
                isActive: true,
                isBlocked: false,
                lastLogin: serverTimestamp()
            });
            
            return { success: true, message: 'Регистрация в Firebase успешна!' };
            
        } catch (error) {
            console.error('Ошибка регистрации в Firebase:', error);
            return { success: false, error: this.getFirebaseErrorMessage(error.code) };
        }
    }

    async login(email, password) {
        try {
            if (!this.firebaseReady) {
                throw new Error('Firebase не инициализирован');
            }

            const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            const user = userCredential.user;
            
            // Update last login
            await updateDoc(doc(this.db, 'customers', user.uid), {
                lastLogin: serverTimestamp()
            });
            
            return { success: true, message: 'Вход через Firebase успешен!' };
            
        } catch (error) {
            console.error('Ошибка входа в Firebase:', error);
            return { success: false, error: this.getFirebaseErrorMessage(error.code) };
        }
    }

    async logout() {
        try {
            if (!this.firebaseReady) {
                throw new Error('Firebase не инициализирован');
            }

            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            await signOut(this.auth);
            
            this.currentUser = null;
            this.updateUI();
            
            return { success: true, message: 'Вы успешно вышли из аккаунта' };
            
        } catch (error) {
            console.error('Ошибка выхода:', error);
            return { success: false, error: 'Ошибка выхода из системы' };
        }
    }

    getFirebaseErrorMessage(errorCode) {
        const errorMessages = {
            'auth/user-not-found': 'Пользователь с таким email не найден в Firebase',
            'auth/wrong-password': 'Неверный пароль',
            'auth/email-already-in-use': 'Пользователь с таким email уже существует в Firebase',
            'auth/weak-password': 'Пароль слишком слабый (минимум 6 символов)',
            'auth/invalid-email': 'Неверный формат email',
            'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
            'auth/user-disabled': 'Аккаунт заблокирован',
            'auth/operation-not-allowed': 'Операция не разрешена',
            'auth/requires-recent-login': 'Требуется недавний вход'
        };
        
        return errorMessages[errorCode] || errorCode || 'Произошла ошибка Firebase. Попробуйте снова.';
    }

    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const userInfo = document.getElementById('userInfo');
        const username = document.getElementById('username');

        if (this.currentUser) {
            loginBtn.style.display = 'none';
            registerBtn.style.display = 'none';
            userInfo.style.display = 'flex';
            username.textContent = this.currentUser.username;
        } else {
            loginBtn.style.display = 'block';
            registerBtn.style.display = 'block';
            userInfo.style.display = 'none';
        }
    }

    bindEvents() {
        // Login/Register buttons
        document.getElementById('loginBtn').addEventListener('click', () => this.showModal('loginModal'));
        document.getElementById('registerBtn').addEventListener('click', () => this.showModal('registerModal'));
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            const result = await this.logout();
            if (result.success) {
                this.showNotification(result.message, 'success');
            } else {
                this.showNotification(result.error, 'error');
            }
        });

        // Modal switching
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.hideModal('loginModal');
            this.showModal('registerModal');
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.hideModal('registerModal');
            this.showModal('loginModal');
        });

        // Form submissions
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));

        // Close modals
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                this.hideModal('loginModal');
                this.hideModal('registerModal');
            });
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });

        // Buy buttons
        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handlePurchase(e));
        });

        // Smooth scrolling for navigation (only for valid anchors)
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                
                // Skip if it's just '#' or invalid selector
                if (!href || href === '#' || href.length <= 1) {
                    return;
                }
                
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Clear forms
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => form.reset());
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        const result = await this.login(email, password);

        if (result.success) {
            this.hideModal('loginModal');
            this.showNotification('Добро пожаловать, ' + (this.currentUser?.username || email) + '!', 'success');
        } else {
            this.showNotification(result.error, 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        console.log('Registration form submitted to Firebase'); // Debug log
        
        const username = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        console.log('Form values:', { username, email, passwordLength: password.length }); // Debug log

        // Validation
        if (!username || !email || !password || !confirmPassword) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        if (password !== confirmPassword) {
            console.log('Password mismatch'); // Debug log
            this.showNotification('Пароли не совпадают', 'error');
            return;
        }

        if (password.length < 6) {
            console.log('Password too short'); // Debug log
            this.showNotification('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        // Register user in Firebase (this will automatically check if email exists)
        const result = await this.register(email, password, username);

        if (result.success) {
            this.hideModal('registerModal');
            console.log('Firebase registration successful'); // Debug log
            this.showNotification('Регистрация в Firebase успешно завершена!', 'success');
        } else {
            console.log('Firebase registration failed:', result.error); // Debug log
            this.showNotification(result.error, 'error');
        }
    }

    handlePurchase(e) {
        const game = e.target.getAttribute('data-game');
        
        if (!this.currentUser) {
            this.showNotification('Для покупки необходимо войти в аккаунт', 'error');
            this.showModal('loginModal');
            return;
        }

        // Simulate purchase process
        this.showNotification(`Покупка AI аим ассистента для ${game} началась...`, 'info');
        
        // Here you would typically integrate with a payment system
        setTimeout(() => {
            this.showNotification(`AI аим ассистент для ${game} успешно приобретен!`, 'success');
            
            // Save purchase to user data
            const users = JSON.parse(localStorage.getItem('aimassist_users') || '[]');
            const userIndex = users.findIndex(u => u.id === this.currentUser.id);
            if (userIndex !== -1) {
                if (!users[userIndex].purchases) {
                    users[userIndex].purchases = [];
                }
                users[userIndex].purchases.push({
                    game,
                    purchasedAt: new Date().toISOString()
                });
                
                localStorage.setItem('aimassist_users', JSON.stringify(users));
                this.currentUser = users[userIndex];
                this.saveUser(this.currentUser);
            }
        }, 2000);
    }

    showNotification(message, type = 'info') {
        console.log('Showing notification:', message, type); // Debug log
        
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        // Add styles
        const bgColor = type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3';
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            z-index: 3000;
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 300px;
            max-width: 400px;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.4;
        `;

        document.body.appendChild(notification);
        console.log('Notification appended to DOM'); // Debug log

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(400px)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 4000);

        // Close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        });
    }
}

// Game Catalog Management
class GameCatalog {
    constructor() {
        this.games = [
            {
                id: 'rust',
                name: 'Rust',
                description: 'AI аим ассистент для Rust. Автоматическое наведение на врагов с настройкой чувствительности.',
                features: ['Автоаим', 'Настройки', 'Безопасность'],
                price: '1800₽/месяц',
                icon: 'fab fa-rust',
                category: 'Survival'
            }
        ];
        this.init();
    }

    init() {
        // Проверяем, существует ли элемент каталога на этой странице
        const catalogGrid = document.getElementById('catalogGrid');
        if (!catalogGrid) {
            console.log('Catalog grid not found, skipping game catalog initialization');
            return;
        }
        
        this.renderGames();
        this.addFilterListeners();
    }

    renderGames() {
        const catalogGrid = document.getElementById('catalogGrid');
        if (!catalogGrid) {
            console.log('Cannot render games: catalogGrid element not found');
            return;
        }
        
        catalogGrid.innerHTML = '';

        this.games.forEach(game => {
            const gameCard = this.createGameCard(game);
            catalogGrid.appendChild(gameCard);
        });
    }

    createGameCard(game) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.setAttribute('data-game', game.id);
        card.setAttribute('data-category', game.category);

        // Handle Rust game icon - PNG file
        let iconElement = '';
        if (game.id === 'rust') {
            iconElement = '<img src="rust-icon-real.png" alt="Rust Game Logo" class="rust-icon">';
        } else {
            iconElement = `<i class="${game.icon}"></i>`;
        }

        card.innerHTML = `
            <div class="game-image">
                ${iconElement}
            </div>
            <div class="game-info">
                <h3>${game.name}</h3>
                <p>${game.description}</p>
                <div class="game-features">
                    ${game.features.map(feature => `<span class="feature-tag">${feature}</span>`).join('')}
                </div>
                <div class="game-pricing">
                    <span class="price">${game.price}</span>
                    <button class="btn btn-primary buy-btn" data-game="${game.id}">Купить</button>
                </div>
            </div>
        `;

        // Add event listener for buy button
        const buyBtn = card.querySelector('.buy-btn');
        buyBtn.addEventListener('click', (e) => userManager.handlePurchase(e));

        return card;
    }

    addFilterListeners() {
        // Remove filter functionality since we only have one game
        // The catalog grid will show only the Rust game
    }

    filterGames(category) {
        // Remove filtering functionality since we only have one game
        const gameCards = document.querySelectorAll('.game-card');
        gameCards.forEach(card => {
            card.style.display = 'block';
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
        });
    }
}

// Initialize the application
let userManager;
let gameCatalog;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing application...'); // Debug log
    
    try {
        // Clear old localStorage data to avoid conflicts
        localStorage.removeItem('aimassist_users');
        localStorage.removeItem('aimassist_current_user');
        console.log('Cleared old localStorage data'); // Debug log
        
        userManager = new UserManager();
        gameCatalog = new GameCatalog();

        // Firebase will handle user management automatically
        console.log('Firebase user management initialized'); // Debug log

        // Make userManager globally available
        window.userManager = userManager;
        window.gameCatalog = gameCatalog;
        
        console.log('Application initialized successfully'); // Debug log

        // Add scroll effect to header
        window.addEventListener('scroll', function() {
            const header = document.querySelector('.header');
            if (header) {
                if (window.scrollY > 100) {
                    header.style.background = 'rgba(10, 10, 10, 0.98)';
                    header.style.backdropFilter = 'blur(20px)';
                    header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
                } else {
                    header.style.background = 'rgba(10, 10, 10, 0.95)';
                    header.style.backdropFilter = 'blur(20px)';
                    header.style.boxShadow = 'none';
                }
            }
        });

        // Add loading animation
        document.body.style.opacity = '0';
        setTimeout(() => {
            document.body.style.transition = 'opacity 0.5s ease';
            document.body.style.opacity = '1';
        }, 100);
        
    } catch (error) {
        console.error('Error initializing application:', error);
    }
});
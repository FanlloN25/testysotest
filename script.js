// User Management System
class UserManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        this.loadUser();
        this.bindEvents();
        this.updateUI();
    }

    loadUser() {
        const userData = localStorage.getItem('aimassist_current_user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
    }

    saveUser(user) {
        localStorage.setItem('aimassist_current_user', JSON.stringify(user));
        this.currentUser = user;
    }

    logout() {
        localStorage.removeItem('aimassist_current_user');
        this.currentUser = null;
        this.updateUI();
        this.showNotification('Вы успешно вышли из аккаунта', 'success');
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
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

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

    handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        // Get users from localStorage
        const users = JSON.parse(localStorage.getItem('aimassist_users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);

        if (user) {
            this.saveUser(user);
            this.hideModal('loginModal');
            this.showNotification('Добро пожаловать, ' + user.username + '!', 'success');
        } else {
            this.showNotification('Неверный email или пароль', 'error');
        }
    }

    handleRegister(e) {
        e.preventDefault();
        console.log('Registration form submitted'); // Debug log
        
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

        // Check if email already exists
        const users = JSON.parse(localStorage.getItem('aimassist_users') || '[]');
        console.log('Existing users:', users.length); // Debug log
        
        if (users.find(u => u.email === email)) {
            console.log('Email already exists'); // Debug log
            this.showNotification('Пользователь с таким email уже существует', 'error');
            return;
        }

        // Create new user
        const newUser = {
            id: Date.now(),
            username,
            email,
            password,
            createdAt: new Date().toISOString()
        };

        console.log('New user created:', newUser); // Debug log

        users.push(newUser);
        localStorage.setItem('aimassist_users', JSON.stringify(users));
        this.saveUser(newUser);
        this.hideModal('registerModal');
        
        console.log('Registration successful'); // Debug log
        this.showNotification('Регистрация успешно завершена!', 'success');
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

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...'); // Debug log
    
    try {
        userManager = new UserManager();
        gameCatalog = new GameCatalog();

        // Add some demo users for testing
        const demoUsers = [
            {
                id: 1,
                username: 'demo_user',
                email: 'demo@example.com',
                password: 'demo123',
                createdAt: new Date().toISOString()
            }
        ];

        const existingUsers = JSON.parse(localStorage.getItem('aimassist_users') || '[]');
        if (existingUsers.length === 0) {
            localStorage.setItem('aimassist_users', JSON.stringify(demoUsers));
            console.log('Demo users added to localStorage'); // Debug log
        }

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
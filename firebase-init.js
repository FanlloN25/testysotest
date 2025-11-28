// Firebase инициализация для VibeCord сайта
// Замените конфигурацию на ваши Firebase данные

// Firebase конфигурация для VibeCord - AI aim assist система
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

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);

// Глобальные функции
window.checkSystemStatus = async function() {
    try {
        // Проверка API статуса
        const apiStatus = document.getElementById('api-status');
        const dbStatus = document.getElementById('db-status');
        
        // Проверяем Firebase
        try {
            await firebase.firestore().collection('users').limit(1).get();
            if (dbStatus) dbStatus.textContent = 'Firebase подключен';
        } catch (error) {
            if (dbStatus) dbStatus.textContent = 'Ошибка подключения к БД';
        }
        
        // Проверяем API (если запущен локально)
        try {
            const response = await fetch('http://localhost:3000/api/health');
            if (response.ok) {
                if (apiStatus) apiStatus.textContent = 'API работает';
            } else {
                if (apiStatus) apiStatus.textContent = 'API недоступен';
            }
        } catch (error) {
            if (apiStatus) apiStatus.textContent = 'API не запущен';
        }
        
    } catch (error) {
        console.error('Error checking system status:', error);
    }
};

window.showProfile = async function() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Пожалуйста, войдите в систему');
        return;
    }
    
    try {
        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        let profileInfo = `
            <div class="profile-modal">
                <div class="profile-content">
                    <h3>Профиль пользователя</h3>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Имя пользователя:</strong> ${user.displayName || 'Не указано'}</p>
                    <p><strong>Email подтвержден:</strong> ${user.emailVerified ? 'Да' : 'Нет'}</p>
                    <p><strong>Дата регистрации:</strong> ${new Date(user.metadata.creationTime).toLocaleDateString()}</p>
        `;
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            profileInfo += `
                    <p><strong>Статус:</strong> ${userData.isActive ? 'Активен' : 'Заблокирован'}</p>
                    <p><strong>Последний вход:</strong> ${userData.lastLogin ? new Date(userData.lastLogin.seconds * 1000).toLocaleDateString() : 'Никогда'}</p>
            `;
        }
        
        profileInfo += `
                    <div class="profile-actions">
                        <button onclick="window.vibecordAuth.logout()" class="btn btn-outline">Выйти</button>
                        <button onclick="editProfile()" class="btn btn-primary">Редактировать</button>
                    </div>
                </div>
            </div>
        `;
        
        // Создаем модальное окно профиля
        let profileModal = document.getElementById('profile-modal');
        if (!profileModal) {
            profileModal = document.createElement('div');
            profileModal.id = 'profile-modal';
            profileModal.className = 'auth-modal';
            document.body.appendChild(profileModal);
        }
        
        profileModal.innerHTML = profileInfo;
        profileModal.style.display = 'block';
        
        // Закрытие при клике вне окна
        profileModal.onclick = function(e) {
            if (e.target === profileModal) {
                profileModal.style.display = 'none';
            }
        };
        
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Ошибка загрузки профиля');
    }
};

window.editProfile = async function() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    const newDisplayName = prompt('Введите новое имя пользователя:', user.displayName || '');
    if (newDisplayName && newDisplayName !== user.displayName) {
        try {
            await user.updateProfile({
                displayName: newDisplayName
            });
            alert('Имя пользователя обновлено!');
            location.reload(); // Обновляем страницу для показа изменений
        } catch (error) {
            alert('Ошибка обновления профиля: ' + error.message);
        }
    }
};

// Запуск проверки статуса при загрузке
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        window.checkSystemStatus();
    }, 1000);
});

// Добавляем стили для модального окна профиля
const profileStyles = document.createElement('style');
profileStyles.textContent = `
    .profile-modal .profile-content {
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 500px;
        margin: 10% auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    
    .profile-modal .profile-content h3 {
        text-align: center;
        margin-bottom: 20px;
        color: #333;
    }
    
    .profile-modal .profile-content p {
        margin: 10px 0;
        padding: 8px 0;
        border-bottom: 1px solid #eee;
    }
    
    .profile-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 20px;
    }
    
    .status-section {
        padding: 60px 0;
        background: #f5f5f5;
    }
    
    .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 30px;
        margin-top: 30px;
    }
    
    .status-card {
        background: white;
        padding: 30px;
        border-radius: 10px;
        text-align: center;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        transition: transform 0.3s ease;
    }
    
    .status-card:hover {
        transform: translateY(-5px);
    }
    
    .status-card i {
        font-size: 3rem;
        color: #007bff;
        margin-bottom: 15px;
    }
    
    .status-card h3 {
        margin-bottom: 10px;
        color: #333;
    }
    
    .status-card p {
        color: #666;
        font-size: 0.9rem;
    }
`;

document.head.appendChild(profileStyles);

console.log('🔥 VibeCord Firebase инициализация загружена!');
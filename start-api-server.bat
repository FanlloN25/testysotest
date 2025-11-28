@echo off
echo ===================================
echo  SoftAI - Запуск API сервера
echo ===================================
echo.
echo Устанавливаю зависимости (если нужно)...
npm install

echo.
echo Запускаю API сервер на порту 3000...
echo API будет доступен: http://localhost:3000
echo.
echo Нажмите Ctrl+C для остановки сервера
echo.

npm start

pause
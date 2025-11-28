@echo off
echo ===================================
echo  SoftAI - Запуск веб-сервера
echo ===================================
echo.
echo Запускаю локальный веб-сервер...
echo Сайт будет доступен: http://localhost:8080
echo.
echo Нажмите Ctrl+C для остановки сервера
echo.

python -m http.server 8080

pause
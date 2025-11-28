#!/bin/bash

# Скачивание Font Awesome web fonts для автономной работы
# Запустите этот скрипт перед деплоем на хостинг

echo "Скачивание Font Awesome web fonts..."

# Создаем папку для шрифтов
mkdir -p fonts/webfonts

# Скачиваем основные шрифты Font Awesome
curl -o fonts/webfonts/fa-solid-900.woff2 https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2
curl -o fonts/webfonts/fa-regular-400.woff2 https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-regular-400.woff2
curl -o fonts/webfonts/fa-brands-400.woff2 https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-brands-400.woff2

# Также скачиваем TTF версии для совместимости
curl -o fonts/webfonts/fa-solid-900.ttf https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.ttf
curl -o fonts/webfonts/fa-regular-400.ttf https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-regular-400.ttf
curl -o fonts/webfonts/fa-brands-400.ttf https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-brands-400.ttf

echo "Font Awesome web fonts скачаны!"
echo "Теперь сайт полностью автономен и готов к деплою."
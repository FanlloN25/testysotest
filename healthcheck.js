#!/usr/bin/env node

// Health Check для мониторинга состояния системы безопасности
const http = require('http');

const options = {
    host: 'localhost',
    port: process.env.PORT || 3000,
    path: '/api/health',
    method: 'GET',
    timeout: 5000
};

const healthCheck = http.request(options, (res) => {
    console.log(`Health Check Status: ${res.statusCode}`);
    
    if (res.statusCode === 200) {
        res.on('data', (chunk) => {
            const healthData = JSON.parse(chunk);
            console.log('Health Data:', JSON.stringify(healthData, null, 2));
            
            // Проверяем основные метрики
            const checks = {
                api: res.statusCode === 200,
                memory: process.memoryUsage().heapUsed < 500 * 1024 * 1024, // < 500MB
                uptime: process.uptime() > 60 // > 1 минуты
            };
            
            const allHealthy = Object.values(checks).every(check => check);
            
            if (allHealthy) {
                console.log('✅ Все проверки здоровья пройдены');
                process.exit(0);
            } else {
                console.log('❌ Некоторые проверки здоровья не пройдены:', checks);
                process.exit(1);
            }
        });
    } else {
        console.log(`❌ Health check failed with status: ${res.statusCode}`);
        process.exit(1);
    }
});

healthCheck.on('error', (error) => {
    console.error('❌ Health check error:', error.message);
    process.exit(1);
});

healthCheck.on('timeout', () => {
    console.error('❌ Health check timeout');
    healthCheck.destroy();
    process.exit(1);
});

healthCheck.end();
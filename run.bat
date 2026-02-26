@echo off
title Backend Kelurahan Server
cd /d "%~dp0"

echo ==============================
echo  STARTING BACKEND KELURAHAN
echo ==============================

call npm install

call pm2 delete backend-kelurahan
call pm2 start server.js --name backend-kelurahan
call pm2 save

pause
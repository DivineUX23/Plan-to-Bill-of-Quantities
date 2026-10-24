@echo off
echo Starting AutoPlan Frontend...
cd /d "%~dp0frontend"
npm.cmd run dev
pause

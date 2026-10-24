@echo off
echo Starting PlanToBOQ Frontend...
cd /d "%~dp0frontend"
npm.cmd run dev
pause

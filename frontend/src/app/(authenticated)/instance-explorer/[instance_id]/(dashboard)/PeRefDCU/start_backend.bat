@echo off
cd /d "%~dp0..\..\..\..\..\..\.."
call .\services\venv\Scripts\activate.bat
python services/app/main.py
pause

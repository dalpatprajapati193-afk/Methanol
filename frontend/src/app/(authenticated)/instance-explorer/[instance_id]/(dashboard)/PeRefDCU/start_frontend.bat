@echo off
:: -------------------------------------------------------
:: UPDATE THIS LINE to your Node v26 folder path
set NODE_PATH=C:\node-v26.3.1-win-x64
:: -------------------------------------------------------
set PATH=%NODE_PATH%;%PATH%
cd /d "%~dp0..\..\..\..\..\..\.."
npm run dev

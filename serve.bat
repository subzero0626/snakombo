@echo off
echo.
echo  Snakombo local server
echo  ---------------------
echo  PC:        http://localhost:8000
echo  Phone:     http://192.168.1.102:8000   (must be on the same Wi-Fi)
echo.
echo  Press Ctrl+C to stop.
echo.
npx --yes serve -l 8000 "%~dp0"

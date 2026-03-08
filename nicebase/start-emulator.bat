@echo off
title NICEBASE - Emulator Live Reload
color 0A

echo.
echo  ============================================
echo   NICEBASE - Android Emulator Live Reload
echo  ============================================
echo.
echo  Bu script:
echo  1. Vite dev server'i baslatir (port 5173)
echo  2. Capacitor'u live reload modunda sync'ler
echo  3. Android Studio'yu acar
echo.
echo  Sonra: Android Studio'da YESIL BUTONA bas!
echo  Kod degisiklikleri OTOMATIK yenilenir.
echo.
echo  Durdurmak icin: Bu pencereyi kapat
echo  ============================================
echo.

cd /d "%~dp0"

:: Node modules kontrol
if not exist "node_modules" (
    echo [!] node_modules bulunamadi, npm install yapiliyor...
    npm install
    if errorlevel 1 (
        echo [HATA] npm install basarisiz!
        pause
        exit /b 1
    )
)

:: Vite dev server'i arkaplanda baslat
echo [1/3] Vite dev server baslatiliyor (port 5173)...
start "Vite Dev Server" cmd /k "cd /d "%~dp0" && npm run dev"

:: Kisa bekleme (server ayaga kalksın)
timeout /t 3 /nobreak > nul

:: Capacitor sync (live reload aktif)
echo [2/3] Capacitor sync yapiliyor (live reload modu)...
set CAPACITOR_USE_LIVE_RELOAD=true
npx cap sync android
if errorlevel 1 (
    echo [HATA] cap sync basarisiz! Devam ediliyor...
)

:: Android Studio'yu ac
echo [3/3] Android Studio aciliyor...
npx cap open android

echo.
echo  ============================================
echo   HAZIR! Android Studio'da YESIL BUTONA BAS
echo   Sonra kod degisiklikleri otomatik yuklenecek
echo  ============================================
echo.
echo  NOT: Bu pencereyi acik tut (dev server calisiyor)
echo.
pause

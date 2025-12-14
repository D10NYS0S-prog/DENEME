@echo off
REM UYAP Desktop Uygulaması Başlatıcı
REM 
REM Bu dosya UYAP Desktop uygulamasını Windows'ta kolayca başlatmak için kullanılır.

echo ========================================
echo UYAP Desktop Uygulamasi Baslatiliyor...
echo ========================================
echo.

REM Node.js ve npm kurulu mu kontrol et
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [HATA] Node.js bulunamadi!
    echo Lutfen Node.js yukleyin: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Bağımlılıklar yüklü mü kontrol et
if not exist "node_modules" (
    echo [BILGI] Bagimliliklar yukleniyor...
    echo Bu islem ilk seferde 1-2 dakika surebilir.
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [HATA] Bagimliliklari yuklerken hata olustu!
        echo.
        pause
        exit /b 1
    )
    echo.
    echo [BASARILI] Bagimliliklari yuklendi.
    echo.
)

REM Uygulamayı başlat
echo [BILGI] Uygulama baslatiliyor...
echo.
call npm start

REM Uygulama kapandı
echo.
echo ========================================
echo Uygulama kapatildi.
echo ========================================
pause

@echo off
chcp 65001 >nul
title منصة قواعد السلوك والمواظبة - وزارة التعليم
cd /d "%~dp0"

echo ============================================================
echo   منصة قواعد السلوك والمواظبة لطلبة التعليم العام
echo   وزارة التعليم - المملكة العربية السعودية
echo   الاصدار الخامس 1447هـ / 2025م
echo ============================================================
echo.
echo جاري تشغيل السيرفر المحلي على المنفذ 8791 ...
echo   الصفحة الرئيسية : http://127.0.0.1:8791/index.html
echo   صفحة الادوار    : http://127.0.0.1:8791/roles.html
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    start "" http://127.0.0.1:8791/index.html
    python -m http.server 8791 --bind 127.0.0.1
    goto end
)

where py >nul 2>nul
if %errorlevel%==0 (
    start "" http://127.0.0.1:8791/index.html
    py -m http.server 8791 --bind 127.0.0.1
    goto end
)

echo لم يتم العثور على Python على هذا الجهاز.
echo يمكنك فتح المنصة مباشرة بالضغط نقرًا مزدوجًا على: index.html
echo ملاحظة: عارض PDF يعمل بشكل أفضل عبر السيرفر المحلي.
echo.
pause
goto end

:end
echo.
echo تم ايقاف السيرفر.
pause
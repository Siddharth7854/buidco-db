@echo off
echo Searching for SQL Server Configuration Manager...
echo.

echo Trying SQLServerManager13.msc (SQL Server 2016)...
start SQLServerManager13.msc
timeout /t 2 /nobreak >nul

echo Trying SQLServerManager14.msc (SQL Server 2017)...
start SQLServerManager14.msc
timeout /t 2 /nobreak >nul

echo Trying SQLServerManager15.msc (SQL Server 2019)...
start SQLServerManager15.msc
timeout /t 2 /nobreak >nul

echo Trying SQLServerManager16.msc (SQL Server 2022)...
start SQLServerManager16.msc
timeout /t 2 /nobreak >nul

echo.
echo If none of these work, try:
echo 1. Press Win + R
echo 2. Type: SQLServerManager13.msc
echo 3. Press Enter
echo.
pause 
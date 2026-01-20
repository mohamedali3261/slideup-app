@echo off
REM Database Backup Script for SlideUP (Windows)
REM Usage: scripts\backup-db.bat

REM Configuration
set DB_PATH=data\slideforge.db
set BACKUP_DIR=backups
set DATETIME=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATETIME=%DATETIME: =0%
set BACKUP_FILE=%BACKUP_DIR%\slideforge_backup_%DATETIME%.db

REM Create backup directory if it doesn't exist
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM Check if database exists
if not exist "%DB_PATH%" (
    echo ❌ Error: Database file not found at %DB_PATH%
    exit /b 1
)

REM Create backup
echo 📦 Creating backup...
copy "%DB_PATH%" "%BACKUP_FILE%"

if %errorlevel% equ 0 (
    echo ✅ Backup created successfully: %BACKUP_FILE%
    
    REM Get file size
    for %%A in ("%BACKUP_FILE%") do set SIZE=%%~zA
    echo 📊 Backup size: %SIZE% bytes
    
    echo ✅ Backup process completed!
) else (
    echo ❌ Error: Backup failed
    exit /b 1
)

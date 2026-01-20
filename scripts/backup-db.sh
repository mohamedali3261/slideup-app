#!/bin/bash

# Database Backup Script for SlideUP
# Usage: ./scripts/backup-db.sh

# Configuration
DB_PATH="data/slideforge.db"
BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/slideforge_backup_$DATE.db"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Error: Database file not found at $DB_PATH"
    exit 1
fi

# Create backup
echo "📦 Creating backup..."
cp "$DB_PATH" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully: $BACKUP_FILE"
    
    # Compress backup
    echo "🗜️  Compressing backup..."
    gzip "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ Backup compressed: ${BACKUP_FILE}.gz"
        
        # Get file size
        SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
        echo "📊 Backup size: $SIZE"
    else
        echo "⚠️  Warning: Compression failed, but backup file exists"
    fi
    
    # Keep only last 30 backups
    echo "🧹 Cleaning old backups (keeping last 30)..."
    ls -t $BACKUP_DIR/slideforge_backup_*.db.gz 2>/dev/null | tail -n +31 | xargs -r rm
    
    echo "✅ Backup process completed!"
else
    echo "❌ Error: Backup failed"
    exit 1
fi

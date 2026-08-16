#!/bin/bash
# Respaldo automático de la base de datos (Postgres/Supabase) de NodoISP.
# Guarda un dump comprimido con fecha y borra los más viejos que RETENTION_DAYS
# para no llenar el disco. Pensado para correr a diario vía cron (ver
# /opt/taller1/scripts/README.md).

set -euo pipefail

CONTAINER="supabase_db_taller1"
BACKUP_DIR="/opt/taller1/backups/db"
RETENTION_DAYS=14
LOG_FILE="$BACKUP_DIR/backup.log"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
DEST="$BACKUP_DIR/nodoisp_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando respaldo -> $DEST" >> "$LOG_FILE"

if docker exec "$CONTAINER" pg_dump -U postgres -d postgres | gzip > "$DEST"; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK — $(du -h "$DEST" | cut -f1)" >> "$LOG_FILE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] FALLÓ el respaldo" >> "$LOG_FILE"
  rm -f "$DEST"
  exit 1
fi

# Borra respaldos más viejos que RETENTION_DAYS.
find "$BACKUP_DIR" -name 'nodoisp_*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Respaldos actuales: $(ls "$BACKUP_DIR"/nodoisp_*.sql.gz 2>/dev/null | wc -l)" >> "$LOG_FILE"

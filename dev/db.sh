#!/usr/bin/env bash
# Local Postgres 16 for Refka development.
#   dev/db.sh start            start the cluster (initdb on first run)
#   dev/db.sh stop             stop the cluster
#   dev/db.sh reset [dbname]   drop + recreate the database, apply the local prelude, then all migrations
#   dev/db.sh psql [dbname]    open psql
# Env overrides: REFKA_PGBIN, REFKA_PGDATA, REFKA_PGPORT, REFKA_PGUSER_OS, REFKA_DB
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${REFKA_PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA_DIR="${REFKA_PGDATA:-/tmp/claude-0/-home-claude/bb9b7cf3-e612-523e-bf4c-5ab702ad24aa/scratchpad/pgdata}"
PORT="${REFKA_PGPORT:-55432}"
OSUSER="${REFKA_PGUSER_OS:-pgdev}"
DB_DEFAULT="${REFKA_DB:-refka}"

# The scratchpad's parent folders are root only (and get re-locked), which makes a running postgres
# panic. So when we are root the real data lives in the postgres OS user's home and $PGDATA_DIR is
# a symlink to it; postgres is always started on the resolved path.
REAL_HOME_DATA="/home/$OSUSER/refka-pgdata"

# Postgres refuses to run as root, so every binary runs as $OSUSER when we are root.
as_pg() {
  if [ "$(id -u)" = "0" ]; then
    (cd / && runuser -u "$OSUSER" -- "$@")
  else
    "$@"
  fi
}

prepare() {
  if [ "$(id -u)" = "0" ]; then
    id "$OSUSER" >/dev/null 2>&1 || useradd -m "$OSUSER"
    if [ ! -e "$PGDATA_DIR" ] && [ ! -L "$PGDATA_DIR" ]; then
      mkdir -p "$REAL_HOME_DATA" "$(dirname "$PGDATA_DIR")"
      ln -s "$REAL_HOME_DATA" "$PGDATA_DIR"
    fi
    DATA="$(readlink -f "$PGDATA_DIR")"
    mkdir -p "$DATA"
    chown "$OSUSER" "$DATA"
    chmod 700 "$DATA"
  else
    mkdir -p "$PGDATA_DIR"
    DATA="$(readlink -f "$PGDATA_DIR")"
  fi
  LOG="$DATA/server.log"
}

running() { as_pg "$PGBIN/pg_isready" -q -h 127.0.0.1 -p "$PORT"; }

start() {
  prepare
  if [ ! -f "$DATA/PG_VERSION" ]; then
    as_pg "$PGBIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 --locale=C.UTF-8 >/dev/null
    {
      echo "listen_addresses = '127.0.0.1'"
      echo "port = $PORT"
      echo "unix_socket_directories = ''"
      echo "fsync = off"
      echo "synchronous_commit = off"
      echo "timezone = 'UTC'"
    } | as_pg tee -a "$DATA/postgresql.conf" >/dev/null
  fi
  if running; then echo "postgres already running on 127.0.0.1:$PORT"; return 0; fi
  as_pg "$PGBIN/pg_ctl" -D "$DATA" -l "$LOG" -w -t 30 start >/dev/null
  echo "postgres started on 127.0.0.1:$PORT (data: $DATA)"
}

stop() {
  prepare
  if [ -f "$DATA/postmaster.pid" ]; then
    as_pg "$PGBIN/pg_ctl" -D "$DATA" -m fast -w stop >/dev/null || true
  fi
  echo "postgres stopped"
}

q() { as_pg "$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PORT" -U postgres "$@"; }

reset() {
  local db="${1:-$DB_DEFAULT}"
  [[ "$db" =~ ^[a-z_][a-z0-9_]*$ ]] || { echo "bad database name" >&2; exit 2; }
  running || start
  q -d postgres -c "drop database if exists $db with (force)" -c "create database $db"
  # files are piped through stdin so the postgres OS user does not need to read the repo
  q -d "$db" < "$ROOT/supabase/tests/local_prelude.sql"
  local f
  for f in $(ls "$ROOT"/supabase/migrations/*.sql | sort); do
    q -d "$db" < "$f" || { echo "migration failed: $f" >&2; exit 1; }
  done
  echo "database $db reset: prelude + $(ls "$ROOT"/supabase/migrations/*.sql | wc -l) migration(s) applied"
}

case "${1:-}" in
  start) start ;;
  stop)  stop ;;
  reset) reset "${2:-}" ;;
  psql)  as_pg "$PGBIN/psql" -X -h 127.0.0.1 -p "$PORT" -U postgres -d "${2:-$DB_DEFAULT}" ;;
  *) echo "usage: dev/db.sh start | stop | reset [dbname] | psql [dbname]" >&2; exit 2 ;;
esac

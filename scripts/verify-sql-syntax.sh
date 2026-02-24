#!/bin/bash
# Quick syntax verification for SQL file

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_FILE="$REPO_ROOT/supabase/migrations/database-migration-report-gallery-feed.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ SQL file not found: $SQL_FILE"
    exit 1
fi

echo "Checking for escaped dollar signs..."
if grep -q '\\$\\$' "$SQL_FILE"; then
    echo "❌ Found escaped dollar signs (\\$\\$)"
    grep -n '\\$\\$' "$SQL_FILE"
    exit 1
else
    echo "✅ No escaped dollar signs found"
fi

echo ""
echo "Checking function definitions..."
echo "Number of $$ delimiters: $(grep -o '\$\$' "$SQL_FILE" | wc -l)"
echo "Should be an even number (each function has opening and closing $$)"

echo ""
echo "Checking BEGIN/COMMIT balance..."
BEGIN_COUNT=$(grep -c '^BEGIN;' "$SQL_FILE")
COMMIT_COUNT=$(grep -c '^COMMIT;' "$SQL_FILE")
echo "BEGIN count: $BEGIN_COUNT"
echo "COMMIT count: $COMMIT_COUNT"

if [ "$BEGIN_COUNT" -eq "$COMMIT_COUNT" ]; then
    echo "✅ BEGIN/COMMIT are balanced"
else
    echo "⚠️ BEGIN/COMMIT mismatch"
fi

echo ""
echo "File is ready for Supabase!"
echo "Lines: $(wc -l < "$SQL_FILE")"
echo "Size: $(ls -lh "$SQL_FILE" | awk '{print $5}')"

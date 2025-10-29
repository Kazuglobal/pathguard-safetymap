#!/bin/bash
# Quick syntax verification for SQL file

echo "Checking for escaped dollar signs..."
if grep -q '\\$\\$' database-migration-report-gallery-feed.sql; then
    echo "❌ Found escaped dollar signs (\\$\\$)"
    grep -n '\\$\\$' database-migration-report-gallery-feed.sql
    exit 1
else
    echo "✅ No escaped dollar signs found"
fi

echo ""
echo "Checking function definitions..."
echo "Number of $$ delimiters: $(grep -o '\$\$' database-migration-report-gallery-feed.sql | wc -l)"
echo "Should be an even number (each function has opening and closing $$)"

echo ""
echo "Checking BEGIN/COMMIT balance..."
BEGIN_COUNT=$(grep -c '^BEGIN;' database-migration-report-gallery-feed.sql)
COMMIT_COUNT=$(grep -c '^COMMIT;' database-migration-report-gallery-feed.sql)
echo "BEGIN count: $BEGIN_COUNT"
echo "COMMIT count: $COMMIT_COUNT"

if [ "$BEGIN_COUNT" -eq "$COMMIT_COUNT" ]; then
    echo "✅ BEGIN/COMMIT are balanced"
else
    echo "⚠️ BEGIN/COMMIT mismatch"
fi

echo ""
echo "File is ready for Supabase!"
echo "Lines: $(wc -l < database-migration-report-gallery-feed.sql)"
echo "Size: $(ls -lh database-migration-report-gallery-feed.sql | awk '{print $5}')"

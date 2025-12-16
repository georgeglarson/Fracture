#!/bin/bash
# Track TypeScript strict mode migration progress
# Usage: ./scripts/strict-progress.sh

cd "$(dirname "$0")/.."

echo "=== TypeScript Strict Mode Progress ==="
echo ""

# Run strict check and capture output
ERRORS=$(cd server && npx tsc --noEmit -p tsconfig.strict.json 2>&1)
TOTAL=$(echo "$ERRORS" | grep -c "error TS" || echo "0")

echo "Total errors: $TOTAL"
echo ""

# Count errors by directory
echo "=== Errors by Directory ==="
for dir in ai utils middleware combat party zones player achievements; do
  count=$(echo "$ERRORS" | grep "ts/$dir/" | grep -c "error TS" || echo "0")
  if [ "$count" -gt 0 ]; then
    printf "  %-20s %d errors\n" "$dir/" "$count"
  else
    printf "  %-20s ✅ clean\n" "$dir/"
  fi
done

# Count core file errors
echo ""
echo "=== Core Files ==="
for file in player.ts world.ts mob.ts message.ts entity.ts character.ts area.ts; do
  count=$(echo "$ERRORS" | grep "ts/$file" | grep -c "error TS" || echo "0")
  if [ "$count" -gt 0 ]; then
    printf "  %-20s %d errors\n" "$file" "$count"
  else
    printf "  %-20s ✅ clean\n" "$file"
  fi
done

# Count errors by type
echo ""
echo "=== Errors by Type ==="
echo "$ERRORS" | grep -oE "error TS[0-9]+" | sort | uniq -c | sort -rn | head -10

echo ""
echo "Run 'cd server && npx tsc --noEmit -p tsconfig.strict.json' to see all errors"

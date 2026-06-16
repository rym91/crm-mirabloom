#!/bin/sh
set -e
# Fresh Contabo Postgres → db push creates the schema from prisma/schema.prisma
# (idempotent on restart; no migration history needed for a single-instance app).
npx prisma db push --skip-generate
exec node server.js
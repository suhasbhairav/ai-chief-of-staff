# Supabase Database Setup

AI Chief of Staff uses Supabase Postgres as a database-only persistence layer. There is no Supabase Auth requirement.

## 1. Create Tables

Open the Supabase SQL Editor and run:

```sql
-- paste supabase/schema.sql here
```

The schema stores each department upload in `department_snapshots` with flexible `jsonb` columns:

- `records`: parsed CSV rows as JSON.
- `headers`: uploaded CSV column names.
- `sample_records`: first five records for previews and AI context.
- `content`: complete scalable department snapshot JSON.

The `organization_summaries` table stores the current executive rollup as JSONB.

Additional operating-system tables:

- `department_snapshot_history`: immutable upload ledger for historical trend imports and multi-period analysis.
- `board_memos`: board memo metadata and JSON content for exported CEO/department memos.

## 2. Environment Variables

Create `frontend/.env.local` or update `frontend/.env`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-or-secret-key
OPENAI_API_KEY=your-openai-api-key
```

The app uses the Supabase key only in Next.js route handlers. Do not expose the service role key in browser code.

## 3. Data Flow

1. Upload a department CSV.
2. `/api/current-data` upserts the department snapshot into Supabase.
3. The API appends the same upload to `department_snapshot_history`.
4. The API rebuilds `organization_summaries.current`.
5. Department dashboards and executive charts fetch `/api/current-data`.
6. Historical trend tables fetch `/api/historical-data`.
7. Board memo exports save memo metadata through `/api/board-memos`.
8. Metric cards, charts, PDF reports, board memos, and OpenAI suggestions are calculated from database JSON.

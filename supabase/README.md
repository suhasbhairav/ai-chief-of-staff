# Supabase Database Setup

TAI Chief uses Supabase Postgres as a database-only persistence layer. There is no Supabase Auth requirement.

## 1. Create Tables

Open the Supabase SQL Editor and run:

```sql
-- paste supabase/schema.sql here
```

For a full demo workspace, run the seed file after the schema:

```sql
-- paste supabase/seed-demo.sql here
```

The seed resets TAI Chief application tables and loads two quarters of demo data from April 2026 through September 2026 across departments, history, board memos, Slack, Notion, HubSpot, Linear, ClickUp, Jira, Confluence, GitHub, Asana, Mailchimp, QuickBooks, Salesforce, Stripe, and vector search rows.

The schema stores each department upload in `department_snapshots` with flexible `jsonb` columns:

- `records`: parsed CSV rows as JSON.
- `headers`: uploaded CSV column names.
- `sample_records`: first five records for previews and AI context.
- `content`: complete scalable department snapshot JSON.

The `organization_summaries` table stores the current executive rollup as JSONB.

The schema also enables the `vector` extension and stores configurable LLM embeddings in `department_embeddings`. The `match_department_embeddings` RPC performs cosine-similarity retrieval for the CEO Chat assistant.

Additional operating-system tables:

- `department_snapshot_history`: immutable upload ledger for historical trend imports and multi-period analysis.
- `board_memos`: board memo metadata and JSON content for exported CEO/department memos.
- `slack_installations`: real Slack OAuth installations and bot tokens.
- `slack_events`: signed Slack Events API webhook ledger.
- `slack_message_snapshots`: Slack channel/DM message snapshots for auditability.
- `department_embeddings`: pgvector chunks for department snapshots and CEO retrieval.
- `notion_okr_snapshots`: synced Notion Product OKR snapshots for objective tracking.
- `hubspot_deal_snapshots`: synced HubSpot deal pipeline snapshots for CEO revenue tracking.
- `linear_ticket_snapshots`: synced Linear issue snapshots for CEO execution tracking.
- `clickup_workspace_snapshots`: synced ClickUp Goals, workspace tasks, roadmap-style initiatives, views, and CEO execution summaries.
- `jira_issue_snapshots`: synced Jira issues, projects, delivery risks, and CEO execution summaries.
- `confluence_content_snapshots`: synced Confluence pages, spaces, knowledge freshness, roadmap/policy coverage, and CEO summaries.
- `github_repo_snapshots`: synced GitHub repositories, pull requests, issues, bug queues, and CEO engineering risk summaries.
- `asana_workspace_snapshots`: synced Asana projects, tasks, owners, overdue work, stale work, and CEO execution summaries.
- `mailchimp_marketing_snapshots`: synced Mailchimp audiences, campaigns, reports, engagement, unsubscribes, bounces, and CEO marketing summaries.
- `quickbooks_accounting_snapshots`: synced QuickBooks chart of accounts, accounting reports, balances, receivables, payables, and CEO finance summaries.
- `salesforce_crm_snapshots`: synced Salesforce accounts, opportunities, leads, pipeline, forecast, owner load, and CEO revenue summaries.
- `stripe_payments_snapshots`: synced Stripe customers, payment intents, subscriptions, invoices, balances, MRR, failed payments, and CEO billing risk summaries.

## 2. Environment Variables

Create `ai-chief-of-staff/.env.local` or update `ai-chief-of-staff/.env`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-or-secret-key
LLM_PROVIDER=openai
LLM_MODEL=gpt-5.5
LLM_API_KEY=your-llm-api-key
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_API_KEY=your-embedding-api-key
NOTION_API_KEY=your-notion-internal-integration-secret
NOTION_OKR_DATABASE_ID=your-product-okr-database-id
HUBSPOT_ACCESS_TOKEN=your-hubspot-private-app-access-token
LINEAR_API_KEY=your-linear-personal-api-key
CLICKUP_API_TOKEN=your-clickup-personal-token-optional
CLICKUP_WORKSPACE_ID=your-clickup-workspace-id-optional
CLICKUP_CLIENT_ID=your-clickup-oauth-client-id-optional
CLICKUP_CLIENT_SECRET=your-clickup-oauth-client-secret-optional
ATLASSIAN_SITE_URL=https://your-company.atlassian.net
ATLASSIAN_EMAIL=you@company.com
ATLASSIAN_API_TOKEN=your-atlassian-api-token
JIRA_JQL=order by updated DESC
CONFLUENCE_CQL=type=page order by lastmodified desc
GITHUB_TOKEN=your-github-token
GITHUB_OWNER=your-org-or-user-optional
GITHUB_REPOS=repo-one,repo-two-optional
ASANA_ACCESS_TOKEN=your-asana-personal-access-token
ASANA_WORKSPACE_GID=your-workspace-gid-optional
ASANA_PROJECT_GIDS=project-gid-one,project-gid-two-optional
MAILCHIMP_API_KEY=your-mailchimp-api-key
MAILCHIMP_SERVER_PREFIX=us21
QUICKBOOKS_REALM_ID=your-quickbooks-company-id
QUICKBOOKS_ENVIRONMENT=sandbox
QUICKBOOKS_ACCESS_TOKEN=your-oauth-access-token
QUICKBOOKS_CLIENT_ID=your-intuit-client-id-optional
QUICKBOOKS_CLIENT_SECRET=your-intuit-client-secret-optional
QUICKBOOKS_REFRESH_TOKEN=your-oauth-refresh-token-optional
SALESFORCE_INSTANCE_URL=https://your-domain.my.salesforce.com
SALESFORCE_ACCESS_TOKEN=your-salesforce-oauth-access-token
SALESFORCE_API_VERSION=v61.0
STRIPE_SECRET_KEY=your-stripe-secret-or-restricted-key
```

The app uses the Supabase key only in Next.js route handlers. Do not expose the service role key in browser code.
The default embedding model produces 1536-dimensional vectors, matching `department_embeddings.embedding vector(1536)`.

## 3. Data Flow

1. Upload a department CSV.
2. `/api/current-data` upserts the department snapshot into Supabase.
3. The API appends the same upload to `department_snapshot_history`.
4. The API rebuilds `organization_summaries.current`.
5. The API refreshes `department_embeddings` for Supabase vector search.
6. Department dashboards and executive charts fetch `/api/current-data`.
7. Historical trend tables fetch `/api/historical-data`.
8. CEO Chat uses `/api/ceo-chat` and `match_department_embeddings` for grounded retrieval.
9. Product OKRs sync from Notion through `/api/notion/okrs` into `notion_okr_snapshots`.
10. Deal pipeline syncs from HubSpot through `/api/hubspot/deals` into `hubspot_deal_snapshots`.
11. Ticket overview syncs from Linear through `/api/linear/tickets` into `linear_ticket_snapshots`.
12. ClickUp Goals, tasks, roadmap items, and views sync through `/api/clickup/overview` into `clickup_workspace_snapshots`.
13. Jira issues and projects sync through `/api/jira/overview` into `jira_issue_snapshots`.
14. Confluence pages and spaces sync through `/api/confluence/overview` into `confluence_content_snapshots`.
15. GitHub repositories, PRs, issues, and bugs sync through `/api/github/overview` into `github_repo_snapshots`.
16. Asana projects, tasks, owners, and risks sync through `/api/asana/overview` into `asana_workspace_snapshots`.
17. Mailchimp audiences, campaigns, and reports sync through `/api/mailchimp/overview` into `mailchimp_marketing_snapshots`.
18. QuickBooks accounts and accounting reports sync through `/api/quickbooks/overview` into `quickbooks_accounting_snapshots`.
19. Salesforce accounts, opportunities, and leads sync through `/api/salesforce/overview` into `salesforce_crm_snapshots`.
20. Stripe customers, payments, subscriptions, invoices, and balances sync through `/api/stripe/overview` into `stripe_payments_snapshots`.
21. Board memo exports save memo metadata through `/api/board-memos`.
22. Metric cards, charts, PDF reports, board memos, and LLM suggestions are calculated from database JSON.

Use `POST /api/embeddings/rebuild` with `{ "departmentId": "all" }` after running the schema on an existing project to backfill vector memory for older uploads.

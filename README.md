# AI Chief of Staff

**The AI operating system for CEOs: turn every department's metrics into board-ready decisions.**

Created by **Suhas Bhairav**  
Website: **https://suhasbhairav.com**

**Completely open source.** This is an independent personal project released under the MIT License.

![AI Chief of Staff executive dashboard](screenshot.png)

AI Chief of Staff is an operating intelligence workspace for CEOs. It turns department-level CSV uploads into live executive dashboards, department scorecards, and OpenAI-generated recommendations for the CEO and functional leaders.

The product is designed around a simple idea: every important department should report the metrics a serious CEO would actually inspect, and the Executive dashboard should synthesize those metrics into company-level operating judgment.

## What It Does

- Provides dashboards for 13 company functions: Executive, Finance, HR, Legal, IT, Operations, Sales, Marketing, Product, R&D, Customer Support, Risk, and Strategy.
- Generates CEO-grade CSV templates for each department.
- Parses uploaded CSV files into structured JSON.
- Stores current operating data in Supabase Postgres using flexible JSONB snapshots.
- Builds department-specific KPI cards and charts directly from database JSON.
- Builds Executive-level scorecards from the combined Supabase department JSON.
- Calls OpenAI only when the user clicks `Fetch Suggestions` or `Fetch Org Suggestions`.
- Sends summarized dashboard context and current database JSON to OpenAI for concise operating recommendations.
- Exports polished PDF reports with a cover page, KPI snapshot, OpenAI synthesis, chart scorecard tables, department data tables, and creator attribution.
- Preserves historical trend imports in Supabase for multi-period analysis.
- Exports board memo PDFs and stores board memo metadata in Supabase.

## Product Philosophy

This is not a generic BI dashboard. The application is built around metrics that CEOs, CFOs, operators, and investors actually care about:

- Growth quality: ARR, revenue growth, net revenue retention, Rule of 40.
- Cash discipline: burn multiple, runway, free cash flow margin, operating expenses.
- GTM efficiency: qualified pipeline, bookings, CAC, LTV:CAC, CAC payback, win rate.
- Product health: activation, retention, adoption, NPS, P1 bugs, velocity.
- Customer health: CSAT, NPS, backlog, escalation rate, response/resolution time.
- Operational execution: throughput, yield, defect rate, on-time delivery, inventory turns.
- Risk posture: enterprise risk, audit score, control coverage, unmitigated risks.
- Strategic leverage: TAM coverage, market share, partnership revenue, M&A pipeline.

The Executive dashboard intentionally avoids naive technical metrics like row count or column count as core charts. Those are relegated to the data-store table. Executive charts focus on operating outcomes.

## Architecture

```text
ai-chief-of-staff/
  frontend/
    app/
      page.js                              # Home command center
      departments/[slug]/page.js           # Department + executive dashboards
      api/
        analytics/[department]/route.js    # OpenAI Responses API endpoint
        current-data/route.js              # Supabase JSONB data store API
    lib/
      current-data-store.js                # Supabase read/write + org rollup
      supabase/server.js                   # Server-side Supabase client
    package.json

  supabase/
    schema.sql                             # Table creation SQL
    README.md                              # Supabase setup notes

  backend/
    main.py                                # FastAPI CSV parsing service scaffold

  .gitignore
  README.md
```

## Data Flow

1. A department user downloads a CSV template.
2. The user fills the CSV with operating data.
3. The user uploads the CSV in that department dashboard.
4. The frontend parses the CSV into records.
5. The frontend posts the structured department snapshot to `/api/current-data`.
6. The server upserts that snapshot into `department_snapshots` in Supabase.
7. The server appends the upload to `department_snapshot_history`.
8. The server rebuilds the `organization_summaries.current` JSONB rollup.
9. Department dashboards calculate KPI cards and charts from Supabase JSON.
10. Executive dashboard calculates org-level scorecards from all department JSON.
11. OpenAI is called only when the user clicks `Fetch Suggestions`.
12. PDF reports and board memos export from the same live dashboard state.

## Current Data Store

The project uses Supabase Postgres as its database-only persistence layer. Authentication is intentionally not included. Each upload is stored as JSONB so departments can evolve their columns without requiring a migration for every new metric.

Primary tables:

- `department_snapshots`: one current JSONB snapshot per department.
- `organization_summaries`: the latest executive rollup generated from all department snapshots.
- `department_snapshot_history`: immutable historical import ledger for multi-period trend analysis.
- `board_memos`: saved board memo metadata and JSON content.

Run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL Editor before starting the app.

Required frontend environment variables:

```bash
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

The Supabase service key is used only inside Next.js route handlers and is never imported into client components.

## OpenAI Integration

The analytics route uses the official OpenAI SDK:

```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});
```

The application uses `client.responses.create(...)` to generate operating recommendations.

OpenAI calls are not made automatically on page load. They happen only when:

- Department page: user clicks `Fetch Suggestions`
- Executive page: user clicks `Fetch Org Suggestions`

For Executive, the request includes:

- KPI cards
- Executive scorecard chart points
- Full organization Supabase JSONB snapshot

## PDF Reports

Every department dashboard and the Executive dashboard include `Export PDF Report`.

The generated report includes:

- A designed cover page.
- Report metadata.
- The latest OpenAI synthesis shown in the dashboard.
- KPI cards from the live dashboard calculations.
- Chart scorecard source tables.
- Uploaded department data tables from Supabase JSONB.
- A methodology page explaining how the report was assembled.

For the best report, upload department CSVs first and click `Fetch Suggestions` before exporting.

## Historical Trend Imports

Department dashboards include a `Historical Trend Import` control for multi-period CSV uploads. Every upload is appended to `department_snapshot_history`, including detected period bounds, filename, row count, headers, sample records, full records, and the complete JSON content.

The dashboard displays a historical import ledger, and PDF reports include the same import history so reviewers can see the data trail behind current trends.

## Board Memo Export

Every dashboard includes `Export Board Memo`.

The board memo workflow:

1. Builds a board-facing summary from the latest OpenAI synthesis, KPI cards, chart scorecards, and historical import ledger.
2. Saves memo metadata and JSON content to `board_memos`.
3. Generates a polished PDF memo with a cover page, board narrative, KPI snapshot, chart tables, historical imports, and creator attribution.

## Required Environment Variables

Create `frontend/.env.local` or `frontend/.env`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_or_secret_key
```

Do not commit real `.env` files. They are ignored by `.gitignore`.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

If port `3000` is already occupied, Next.js may choose another port.

## Backend Setup

The backend is a FastAPI scaffold for CSV ingestion and validation. The current frontend primarily uses the Next.js `/api/current-data` route for Supabase-backed JSONB storage, but the backend is available for future API-backed ingestion.

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn python-multipart
python main.py
```

Health check:

```text
GET http://127.0.0.1:8000/health
```

CSV upload endpoint:

```text
POST http://127.0.0.1:8000/api/v1/departments/{department_id}/upload
```

## Available Scripts

From `frontend/`:

```bash
npm run dev      # Start Next.js development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Department Metrics

Each department has a dedicated analytics model.

### Finance

- ARR
- Revenue growth
- Gross margin
- Free cash flow margin
- Operating expenses
- Cash balance
- Net new ARR
- Burn multiple
- Runway
- Working capital

### Sales

- Pipeline created
- Qualified pipeline
- Bookings
- ARR won
- Win rate
- Sales cycle
- Quota attainment
- Forecast commit
- Churn-risk ARR

### Marketing

- Spend
- MQLs
- SQLs
- Pipeline created
- CAC
- LTV
- CAC payback
- Conversion rate
- ROAS
- Brand demand

### Product

- Active users
- Activation
- 30-day retention
- NPS
- Velocity
- P1 bugs
- Cycle time
- Feature adoption
- ARR influenced

### Operations

- Throughput
- Demand
- On-time delivery
- Inventory turns
- Defect rate
- Gross yield
- Operating cost
- Unit cost
- Supplier OTIF

### HR

- Headcount
- Open roles
- Attrition
- eNPS
- Revenue per employee
- Offer acceptance
- Time to hire
- Diversity index
- Performance index

### Customer Support

- Tickets created
- Tickets resolved
- First response time
- Resolution time
- CSAT
- NPS
- Escalation rate
- Backlog
- Retention-risk accounts

### Risk

- Enterprise risk score
- Control coverage
- Audit score
- Unmitigated risks
- Mitigated risks
- Open audit items
- Security findings
- Operational loss
- Compliance breaches

### Strategy

- Strategic pipeline value
- TAM coverage
- Market share
- Synergy score
- Diligence risk
- Partnership revenue
- Competitive win rate
- Strategic initiatives on track
- M&A targets

## Executive Dashboard

The Executive dashboard rolls up Supabase department JSON into four CEO scorecards:

1. Value Creation and Cash
   - Rule of 40
   - Net revenue retention
   - Gross margin
   - Runway

2. GTM Efficiency
   - Qualified pipeline
   - Bookings
   - CAC payback
   - Win rate

3. Customer and Product Health
   - 30-day retention
   - NPS
   - CSAT
   - Activation

4. Risk and Execution Posture
   - Enterprise risk
   - Audit score
   - On-time delivery
   - Security incidents

The Executive page also includes a metrics glossary so operators can understand what each metric means and how it should be interpreted.

## Recommended CEO Workflow

1. Start at the home command center.
2. Visit each department dashboard.
3. Download the department CSV template.
4. Fill it with monthly operating data.
5. Upload the CSV.
6. Confirm the department dashboard updates.
7. Return to Executive.
8. Review the combined scorecards.
9. Click `Fetch Org Suggestions`.
10. Use the generated synthesis to drive the operating meeting agenda.

## Development Notes

- The OpenAI API key must live in `frontend/.env.local` or `frontend/.env`.
- Supabase credentials must live in `frontend/.env.local` or `frontend/.env`.
- Department data is stored in Supabase JSONB tables, not source-controlled files.
- For production security, add authentication, RBAC, audit logging, upload limits, schema validation, and encryption at rest.

## Verification

Run:

```bash
cd frontend
npm run lint
npm run build
```

Expected routes:

```text
/                               Home command center
/departments/executive           Executive dashboard
/departments/finance             Finance dashboard
/departments/sales               Sales dashboard
/api/current-data                 Supabase JSONB store
/api/historical-data              Supabase historical import ledger
/api/board-memos                  Supabase board memo storage
/api/analytics/[department]       OpenAI analysis endpoint
```

## Roadmap

- Add user authentication and role-based access control.
- Add schema validation per department.
- Add Slack/email action routing to department owners.
- Add automated anomaly detection before OpenAI synthesis.
- Add permissioned multi-company workspaces.

## Status

This is a completely open-source, local-first MVP of an AI operating system for company leadership. It is an independent personal project designed to be credible in front of founders, operators, investors, and technical reviewers, while remaining small enough to iterate quickly.

## License

MIT License. See [LICENSE](LICENSE).

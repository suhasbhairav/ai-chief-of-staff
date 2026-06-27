# AI Chief of Staff

Created by **Suhas Bhairav**  
Website: **https://suhasbhairav.com**

AI Chief of Staff is an operating intelligence workspace for CEOs. It turns department-level CSV uploads into live executive dashboards, department scorecards, and OpenAI-generated recommendations for the CEO and functional leaders.

The product is designed around a simple idea: every important department should report the metrics a serious CEO would actually inspect, and the Executive dashboard should synthesize those metrics into company-level operating judgment.

## What It Does

- Provides dashboards for 13 company functions: Executive, Finance, HR, Legal, IT, Operations, Sales, Marketing, Product, R&D, Customer Support, Risk, and Strategy.
- Generates CEO-grade CSV templates for each department.
- Parses uploaded CSV files into structured JSON.
- Stores current operating data in `frontend/current-data/`.
- Builds department-specific KPI cards and charts from uploaded data.
- Builds Executive-level scorecards from the combined department JSON.
- Calls OpenAI only when the user clicks `Fetch Suggestions` or `Fetch Org Suggestions`.
- Sends summarized dashboard context and current-data JSON to OpenAI for concise operating recommendations.

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
        current-data/route.js              # File-backed JSON data store API
    current-data/
      .gitkeep
      organization-summary.json            # Generated rollup
      <department>.json                    # Generated per-department data
    package.json

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
6. The server writes:
   - `frontend/current-data/<department>.json`
   - `frontend/current-data/organization-summary.json`
7. Department dashboards calculate KPI cards and charts from their own JSON.
8. Executive dashboard calculates org-level scorecards from all department JSON.
9. OpenAI is called only when the user clicks `Fetch Suggestions`.

## Current Data Store

The project uses a lightweight file-backed store for local development:

```text
frontend/current-data/
  finance.json
  sales.json
  marketing.json
  organization-summary.json
```

These generated JSON files are ignored by git:

```gitignore
frontend/current-data/*.json
!frontend/current-data/.gitkeep
```

This keeps local/company data out of source control while preserving the folder structure.

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
- Full organization current-data JSON

## Required Environment Variables

Create `frontend/.env`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
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

The backend is a FastAPI scaffold for CSV ingestion and validation. The current frontend primarily uses the Next.js `/api/current-data` route for local JSON storage, but the backend is available for future API-backed ingestion.

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

The Executive dashboard rolls up the current-data JSON into four CEO scorecards:

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

- Generated current-data JSON is local and ignored by git.
- The OpenAI API key must live in `frontend/.env`.
- The Next.js API route writes files to `frontend/current-data`, so this setup is intended for local development or controlled internal deployment.
- For production multi-user use, replace the file-backed current-data API with a database such as Postgres, Supabase, Neon, or DynamoDB.
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
/api/current-data                 Current JSON store
/api/analytics/[department]       OpenAI analysis endpoint
```

## Roadmap

- Add persistent database storage.
- Add user authentication and role-based access control.
- Add schema validation per department.
- Add historical trend imports for multi-period analysis.
- Add board memo export.
- Add Slack/email action routing to department owners.
- Add automated anomaly detection before OpenAI synthesis.
- Add permissioned multi-company workspaces.

## Status

This is a local-first MVP of an AI operating system for company leadership. It is designed to be credible in front of founders, operators, investors, and technical reviewers, while remaining small enough to iterate quickly.

## License

MIT License. See [LICENSE](LICENSE).

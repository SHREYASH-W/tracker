# Contact CRM

A local-first outreach tracker for managing your professional network and follow-up workflow. The app helps you keep a searchable directory of people and companies, track outreach status, monitor follow-ups, and review recent interaction history without needing a hosted backend.

This project is built as a Next.js application with SQLite persistence, making it ideal for individual recruiters, job seekers, and relationship managers who want a lightweight personal CRM.

## Why this app exists

The repository is organized around a simple operational loop:

- add people and their company context
- define a role or opportunity target
- log outreach attempts and responses
- monitor follow-ups that are due or overdue
- review activity over time and export data when needed

The app is optimized for personal use: data stays on-device in a local SQLite database, and many workflows are handled directly in the application UI.

## Core features

- People directory with search, filtering, sorting, and pagination
- Company records with relationship tracking to individual contacts
- Outreach pipeline with statuses such as not contacted, message sent, awaiting reply, interview discussions, and rejected/not interested
- Follow-up calendar based on next follow-up timestamps
- Recent activity timeline for interactions and status changes
- Message templates for recurring outreach
- CSV export for contact and outreach records
- Database backup endpoint for exporting a SQLite snapshot
- Local database initialization and migration support
- Optional third-party email lookup providers for enrichment
- Search profiles that turn a free-text target (for example “AI/ML internship”) into job titles, keywords, and locations
- AI-assisted query expansion via Groq, Ollama, or Gemini, with a deterministic offline fallback
- Automation-ready SQLite schema for jobs, matches, applications, drafts, and provider quotas

## Product overview

The application is centered on a small data model:

- Companies: organizations and their metadata
- People: individual contacts associated with a company
- Opportunities: job or referral opportunities tied to a company
- Outreach records: one or more outreach attempts per person, each with status and follow-up details
- Interactions: time-stamped notes and outcomes connected to outreach records
- Message templates: reusable outreach snippets
- Settings: key-value preferences and custom status configuration
- Search profiles: saved job-search targets with editable titles, keywords, locations, and match thresholds
- Automation tables: jobs, job sources, matches, applications, apply queue, drafts, and provider usage (foundation for the job-hunt pipeline)

This structure allows the app to handle both relationship tracking and outbound work management in one place.

## Tech stack

- Next.js 15 with App Router
- React 19 and TypeScript
- Tailwind CSS for styling
- SQLite via Drizzle ORM and a lightweight custom database wrapper
- Radix UI primitives for dialogs, dropdowns, selects, popovers, and tabs
- Recharts for dashboard visualizations
- Vitest for testing

## Project structure

```text
.
├── .env.example                # Example environment configuration
├── .gitignore                  # Git ignore rules
├── .vscode/                    # Editor settings
├── drizzle.config.ts           # Drizzle configuration
├── next.config.js              # Next.js config
├── package.json                # Scripts and dependencies
├── postcss.config.js           # PostCSS config
├── tailwind.config.ts          # Tailwind config
├── tsconfig.json               # TypeScript config
├── vitest.config.ts            # Vitest config
├── src/
│   ├── app/
│   │   ├── activity/           # Activity timeline page
│   │   ├── api/                # API routes for backups and CSV export
│   │   ├── companies/          # Company pages and company forms
│   │   ├── find-hr/           # HR contact lookup flow
│   │   ├── follow-ups/        # Follow-up dashboard
│   │   ├── people/            # People directory and detail pages
│   │   ├── search-profiles/   # Automated job-search targets
│   │   ├── settings/          # Application settings, AI status, and data tools
│   │   ├── templates/         # Message template pages
│   │   ├── dashboard-chart.tsx
│   │   ├── globals.css
│   │   ├── init-db.ts         # App startup DB bootstrap
│   │   ├── layout.tsx         # Root layout and metadata
│   │   └── page.tsx           # Dashboard landing page
│   ├── components/            # Reusable UI and feature components
│   ├── db/
│   │   ├── index.ts           # SQLite database initialization
│   │   ├── migrate.ts         # Migration runner
│   │   ├── migrate-cli.ts     # CLI migration entry point
│   │   ├── schema.ts          # Drizzle schema definitions
│   │   └── sqlite-wrapper.ts  # SQLite wrapper utilities
│   ├── lib/
│   │   ├── actions.ts         # Shared workflow actions
│   │   ├── constants.ts       # Status definitions and labels
│   │   ├── email-lookup.ts   # Email enrichment integration
│   │   ├── enrichlayer.ts     # EnrichLayer provider module
│   │   ├── hunter.ts          # Hunter.io lookup module
│   │   ├── prospeo.ts         # Prospeo lookup module
│   │   ├── query-expansion.ts # Target → titles/keywords heuristics and parsing
│   │   ├── queries.ts         # Query helpers
│   │   ├── types.ts           # Shared TypeScript interfaces
│   │   └── validators.ts     # Form validation and schemas
│   └── server/
│       ├── actions/           # Server actions for DB access and app logic
│       ├── llm/               # LLM provider abstraction (Groq, Ollama, Gemini)
│       ├── providers/         # Rate limiting, TTL cache, quota tracking
│       └── search-profiles/   # Search profile repository
└── data/                      # Local SQLite database directory
```

## How the app is organized at runtime

The app follows a server-first Next.js structure:

- The dashboard page aggregates stats and recent activity from SQLite queries.
- People and company views use server actions to query filtered directories and aggregate summaries.
- Updates and creates are performed through server actions with revalidation to keep the UI current.
- All data is persisted to a local SQLite database in `./data/contact_crm.db` by default.
- UI components handle forms, dialogs, and navigation, while the data layer is separated under `src/db` and `src/server/actions`.

## Local setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Copy the example environment file:

```bash
cp .env.example .env
```

4. Start the development server:

```bash
npm run dev
```

Then open the app in your browser at `http://localhost:3000`.

## Environment variables

The app uses a local database and optional API keys for enrichment features.

Available variables from `.env.example`:

```env
# Optional: override the database file location (defaults to ./data/contact_crm.db)
# DATABASE_URL=./data/contact_crm.db

# Optional: override the backups directory (defaults to ./backups)
# BACKUPS_DIR=./backups

# Hunter.io API key for the contact email lookup (server-side only)
# HUNTER_API_KEY=

# Prospeo API key for the contact email lookup (server-side only)
# PROSPEO_API_KEY=

# Enrich Layer token for the contact email lookup (server-side only)
# ENRICH_LAYER_API_KEY=

# --- AI (LLM) providers ---------------------------------------------------
# Primary provider: groq | ollama | gemini
# LLM_PROVIDER=groq
# Comma-separated fallbacks tried in order
# LLM_FALLBACKS=ollama,gemini

# GROQ_API_KEY=
# GROQ_MODEL=openai/gpt-oss-20b

# OLLAMA_BASE_URL=http://127.0.0.1:11434
# OLLAMA_MODEL=llama3.1
# OLLAMA_ENABLED=true

# GEMINI_API_KEY=
# GEMINI_MODEL=gemini-2.5-flash

# LLM_RATE_LIMIT_PER_MINUTE=20
# LLM_CACHE_TTL_MS=600000
```

Notes:

- The local database is created automatically when the app starts.
- Backups are generated using SQLite `VACUUM INTO` commands.
- Email lookup and LLM providers are optional and are used only when configured.
- API keys are read on the server only. Never prefix them with `NEXT_PUBLIC_`.
- If no LLM responds, search-profile expansion falls back to built-in rules so the app remains usable offline.

## Database and migrations

This project uses Drizzle with a SQLite schema defined in `src/db/schema.ts`.

Useful commands:

```bash
npm run db:generate
npm run db:migrate
```

The app initializes the database automatically on startup through `src/app/init-db.ts` and `src/db/index.ts`.

## Scripts

```bash
npm run dev          # start Next.js development server
npm run build        # production build
npm run start        # run the production build
npm run lint         # run Next.js linting
npm run test         # run Vitest suite
npm run db:generate  # generate migration files
npm run db:migrate   # run pending DB migrations
```

## Data export and backup

The app includes built-in data lifecycle operations:

- CSV export at `/api/export/csv`
- Database backup at `/api/backup`

These endpoints are intended for local export workflows and backup snapshots.

## Notable app workflows

### People directory

The people pages support:

- full-text search across names, company names, titles, emails, and notes
- filtering by company, outreach status, role, and follow-up window
- sorting by name, company, last contact, next follow-up, status, and creation date
- result pagination for large contact lists

### Dashboard

The home dashboard presents:

- total people and companies
- messages sent and awaiting replies
- follow-ups due
- interview counts and positive outcomes
- recent activity feed
- outreach status distribution chart
- company breakdown chart

### Search profiles and AI

The `/search-profiles` page replaces manual company-domain entry with a free-text target:

1. Describe the role, for example “AI/ML internship in Bengaluru, remote ok”.
2. Click **Expand with AI** (or type terms manually). Expansion produces job titles, keywords, locations, role type, and experience level.
3. Edit any chip, set a minimum match score, and save.

Expansion runs through a provider chain (Groq → Ollama → Gemini) with rate limiting, a short TTL cache, and daily quota counters. Provider failures fall back to the next provider without breaking the page. Without any provider, a deterministic rule-based expansion is used.

The Settings page shows which provider is active and how many calls were made today. Keys never reach the browser.

### Follow-ups and activity

The app tracks when a person is due for follow-up, identifies overdue items, and maintains an activity timeline of interactions and record changes.

## Safety and source policy

- No LinkedIn, Indeed, or Glassdoor scraping or automation.
- Email lookup and LLM providers are optional; the app works offline with local rules.
- All external calls are rate-limited and cached, and failures degrade gracefully.
- Search expansion and generated content must stay grounded in your own resume and data.

## Development notes

- The app is designed for local-first personal use rather than a multi-user SaaS deployment.
- SQLite is used intentionally for portability and simplicity.
- The codebase separates schema, DB initialization, app pages, and server actions cleanly.
- Most business logic is encapsulated in `src/server/actions` and related query helpers.

## License

No explicit license file is present in the repository at this time. If you plan to publish or distribute this project more broadly, add a license file that matches your intended usage.

## Status

This repository is a working local CRM-style application for professional outreach tracking. It is ready for local development and day-to-day use as a personal contact and follow-up organizer.

The job-hunt automation is being built in phases. Phase 1 is complete: automation schema and migrations, search profiles, and the LLM provider layer. Upcoming phases add resume parsing, job ingestion and matching, contact discovery, outreach drafting, and guarded auto-apply.

---

If you want to extend the app further, the most natural next steps are job-source adapters, resume-aware match scoring, and a background worker for scheduled runs.

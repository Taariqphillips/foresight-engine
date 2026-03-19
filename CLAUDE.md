# Foresight Engine — Project Context for Claude Code

## What This Project Is
A strategic foresight intelligence engine that:
1. SCANS signals from RSS feeds and web searches across three domains
2. SYNTHESIZES raw signals into actionable insights using Claude's API
3. DELIVERS a daily strategic brief via email at 4:15 AM CT
4. LEARNS from user feedback to improve relevance over time

## Architecture
- Runtime: Node.js (ES modules, "type": "module" in package.json)
- Deployment: Render.com (Starter plan, persistent web service)
- Database: SQLite via better-sqlite3 (local persistence for signals, insights, feedback)
- AI: Anthropic SDK (@anthropic-ai/sdk) using claude-sonnet-4-20250514
- Email: Nodemailer via Gmail SMTP with App Password
- Scheduling: node-cron for daily brief and periodic scanning
- HTTP: Express server for feedback API and dashboard

## Project Structure
```
foresight-engine/
├── src/
│   ├── index.js                    # Main entry — orchestration + cron scheduling
│   ├── config/
│   │   ├── domains.js              # Domain definitions, strategic context, weights
│   │   └── database.js             # SQLite schema, CRUD operations, learning queries
│   ├── scanners/
│   │   ├── rss-scanner.js          # RSS feed scanning with relevance scoring
│   │   └── web-scanner.js          # Web search scanning via NewsAPI + fallback
│   ├── analysis/
│   │   └── synthesis-engine.js     # Claude API-powered insight generation
│   ├── delivery/
│   │   └── email-delivery.js       # HTML email templates + SMTP delivery
│   └── feedback/
│       └── feedback-api.js         # Express server, feedback processing, dashboard
├── data/                           # SQLite database (auto-created, gitignored)
├── package.json
├── render.yaml                     # Render.com deployment config
├── .env                            # Environment variables (gitignored)
├── .env.example                    # Template for env vars
└── .gitignore
```

## Three Scanning Domains
1. **AI & Autonomous Systems** (AI-PROD) — The new means of production
2. **Real Assets & Spatial Economics** (REAL-ASSET) — Physical × digital value
3. **Human Systems & Consciousness Infrastructure** (HUMAN-SYS) — The deepest moat

## Key Technical Decisions
- ES modules throughout (import/export, not require)
- SQLite over Postgres: single-user, serverless, zero-config, modest data volume
- Gmail SMTP over SendGrid/SES: simplest path, no additional account needed
- Claude Sonnet over Opus for synthesis: cost-efficient for daily automated analysis
- node-cron over external schedulers: keeps everything in one process on Render

## Dependencies
```json
{
  "@anthropic-ai/sdk": "^0.39.0",
  "node-cron": "^3.0.3",
  "nodemailer": "^6.9.16",
  "express": "^4.21.0",
  "rss-parser": "^3.13.0",
  "dotenv": "^16.4.7",
  "better-sqlite3": "^11.7.0",
  "uuid": "^11.0.0"
}
```

## Coding Standards
- Use async/await throughout (no callbacks, no raw .then chains)
- Comprehensive error handling — every external call (RSS, API, SMTP) wrapped in try/catch
- Console logging with timestamps for operational visibility
- Comments that explain WHY, not WHAT (the code should explain what)

## Testing Approach
- Manual trigger endpoints: POST /trigger/scan and POST /trigger/brief
- Run `npm run brief` for a manual pipeline test
- Check http://localhost:3000/feedback?view=dashboard for operational status
- Verify email delivery to configured DELIVERY_EMAIL

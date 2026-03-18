# Infrastructure & DevOps — BIM Platform

> Complete documentation of deployment architecture, hosting, cron jobs, scripts, environment configuration, and production infrastructure.

---

## Table of Contents

- [Overview](#overview)
- [Production Deployment](#production-deployment)
- [Deployment Architecture](#deployment-architecture)
- [Configuration Files](#configuration-files)
- [Environment Variables](#environment-variables)
- [Cron Jobs & Scheduled Tasks](#cron-jobs--scheduled-tasks)
- [Database Infrastructure](#database-infrastructure)
- [External Service Dependencies](#external-service-dependencies)
- [Scripts & Tooling](#scripts--tooling)
- [Build & Development](#build--development)
- [Performance Testing](#performance-testing)
- [SSL/TLS & Security Headers](#ssltls--security-headers)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Deployment Checklist](#deployment-checklist)
- [Related Documentation](#related-documentation)

---

## Overview

| Attribute                | Detail                                          |
| ------------------------ | ----------------------------------------------- |
| **Primary Hosting**      | Railway.app (PaaS)                              |
| **Production URL**       | `https://bim-model-production.up.railway.app`   |
| **Alternative Hosting**  | Vercel (Next.js optimized, with cron support)   |
| **Database Hosting**     | MongoDB Atlas (cloud)                           |
| **SSL/TLS**              | Auto-managed by Railway                         |
| **Build Tool**           | Next.js built-in + Turbopack (dev)              |
| **CI/CD Pipeline**       | Not configured (manual deploy)                  |
| **Containerization**     | Not containerized (no Dockerfile)               |
| **Infrastructure as Code**| Not configured                                 |

---

## Production Deployment

### Current Stack

```
┌───────────────────────────────────────────────────────────────┐
│                        INTERNET                               │
│                    (HTTPS / TLS 1.3)                          │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            v
┌───────────────────────────────────────────────────────────────┐
│                      Railway.app                              │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  Next.js Server                          │  │
│  │              (Node.js runtime)                           │  │
│  │                                                         │  │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │  │
│  │  │  SSR Pages   │  │  API Routes   │  │  Static     │  │  │
│  │  │  (React 19)  │  │  (126 endpts) │  │  Assets     │  │  │
│  │  └──────────────┘  └───────────────┘  └─────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Process: web → next start                                    │
│  Defined in: Procfile                                         │
└───────────────────────────┬───────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              v             v             v
┌──────────────────┐ ┌──────────────┐ ┌──────────────────────┐
│  MongoDB Atlas   │ │ Autodesk     │ │  Other External APIs │
│                  │ │ Forge        │ │                      │
│  27 collections  │ │ 3D models    │ │  Google Maps/OAuth   │
│  20 indexes      │ │ S3 storage   │ │  UbiBot sensors      │
│  GridFS files    │ │ Translation  │ │  Shelly devices      │
│                  │ │              │ │  Gmail SMTP          │
└──────────────────┘ └──────────────┘ └──────────────────────┘
```

### Platform Comparison

| Feature              | Railway (Current)    | Vercel (Alternative) |
| -------------------- | -------------------- | -------------------- |
| Hosting type         | PaaS (container)     | Serverless           |
| Auto-scaling         | Manual               | Automatic            |
| SSL/TLS              | Auto-managed         | Auto-managed         |
| Custom domains       | Supported            | Supported            |
| Cron jobs            | External trigger     | Native (vercel.json) |
| Cold starts          | No (always running)  | Yes (serverless)     |
| Persistent process   | Yes (Procfile)       | No                   |
| Pricing              | Usage-based          | Hobby free / Pro     |
| Build command        | `next build`         | `next build`         |

---

## Configuration Files

### Procfile (Railway Deployment)

```
web: npm run start
```

Tells Railway to run `next start` as the web process. The server listens on `$PORT` (auto-assigned by Railway).

### vercel.json (Vercel Cron Jobs)

```json
{
  "crons": [
    {
      "path": "/api/admins/cron/check-expirations",
      "schedule": "30 1 * * *"
    }
  ]
}
```

Schedules the admin expiration check to run daily at 1:30 AM UTC. This only works when deployed to Vercel.

### next.config.ts (Next.js Configuration)

```typescript
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true    // Skip ESLint during production build
  },
  webpack: (config) => {
    // Handle canvas dependency for pdfjs-dist
    config.externals.push('canvas');         // Server-side
    config.resolve.fallback.canvas = false;  // Client-side
    return config;
  }
};
```

### tsconfig.json (TypeScript)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Key settings:
- **Strict mode** enabled for type safety
- **Incremental builds** for faster compilation
- **Path alias** `@/` maps to project root
- **ES2017 target** for async/await support

### .eslintrc.json

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"]
}
```

### postcss.config.mjs

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};
```

---

## Environment Variables

### Complete Variable Reference (21 Variables)

#### Authentication (4 variables)

| Variable              | Required | Description                              | Example                              |
| --------------------- | -------- | ---------------------------------------- | ------------------------------------ |
| `NEXTAUTH_SECRET`     | Yes      | JWT signing secret (random string)       | `a8f2k9d...` (32+ chars)            |
| `NEXTAUTH_URL`        | Yes      | Application base URL                     | `https://your-app.railway.app`       |
| `GOOGLE_CLIENT_ID`    | Yes      | Google OAuth client ID                   | `123...apps.googleusercontent.com`   |
| `GOOGLE_CLIENT_SECRET`| Yes      | Google OAuth client secret               | `GOCSPX-...`                         |

#### Database (2 variables)

| Variable              | Required | Description                              | Example                              |
| --------------------- | -------- | ---------------------------------------- | ------------------------------------ |
| `MONGODB_URI`         | Yes      | MongoDB Atlas connection string          | `mongodb+srv://user:pass@cluster...` |
| `MONGODB_DB`          | Yes      | Database name                            | `bim-client`                         |

#### Autodesk Forge (4 variables)

| Variable              | Required | Description                              | Example                              |
| --------------------- | -------- | ---------------------------------------- | ------------------------------------ |
| `FORGE_CLIENT_ID`     | Yes      | Forge app client ID                      | `dXJuOmFk...`                        |
| `FORGE_CLIENT_SECRET` | Yes      | Forge app client secret                  | `aBcDeFg...`                         |
| `FORGE_BUCKET_KEY`    | Yes      | S3 bucket for model files                | `bim-viewer-pro-bucket`              |
| `FORGE_REGION`        | No       | Forge region (default: us)               | `us` or `emea`                       |

#### Email / SMTP (5 variables)

| Variable              | Required | Description                              | Example                              |
| --------------------- | -------- | ---------------------------------------- | ------------------------------------ |
| `SMTP_HOST`           | Yes      | SMTP server host                         | `smtp.gmail.com`                     |
| `SMTP_PORT`           | Yes      | SMTP port (SSL)                          | `465`                                |
| `SMTP_USER`           | Yes      | SMTP username                            | `app@gmail.com`                      |
| `SMTP_PASS`           | Yes      | SMTP app password                        | `xxxx xxxx xxxx xxxx`                |
| `MAIL_FROM`           | No       | Sender display name                      | `BIM App <app@gmail.com>`            |

#### IoT Services (3 variables)

| Variable              | Required | Description                              | Example                              |
| --------------------- | -------- | ---------------------------------------- | ------------------------------------ |
| `UBIBOT_ACCOUNT_KEY`  | No       | UbiBot API key                           | `abc123...`                          |
| `SHELLY_AUTH_KEY`      | No       | Shelly Cloud auth key                    | `xyz789...`                          |
| `SHELLY_CLOUD_SERVER`  | No       | Shelly Cloud region server               | `https://shelly-238-eu.shelly.cloud` |

#### Google Maps (1 variable)

| Variable                          | Required | Description                      | Example              |
| --------------------------------- | -------- | -------------------------------- | -------------------- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes      | Maps API key (exposed to client) | `AIzaSy...`          |

#### Platform Configuration (3 variables)

| Variable               | Required | Description                              | Example                              |
| ---------------------- | -------- | ---------------------------------------- | ------------------------------------ |
| `PLATFORM_OWNER_EMAILS`| Yes      | Comma-separated platform admin emails    | `admin@example.com`                  |
| `APP_BASE_URL`         | Yes      | Application URL for email links          | `https://your-app.railway.app`       |
| `CRON_SECRET`          | Yes      | Secret for authenticating cron requests  | `random-strong-secret`               |

### Setting Environment Variables

**Railway:**
```
Railway Dashboard → Project → Variables → Add each variable
```

**Vercel:**
```
Vercel Dashboard → Project → Settings → Environment Variables
```

**Local Development:**
```bash
cp env.example .env.local
# Edit .env.local with your values
```

---

## Cron Jobs & Scheduled Tasks

### Active Cron Jobs

| Job                        | Endpoint                                   | Schedule           | Trigger Method          | Purpose                              |
| -------------------------- | ------------------------------------------ | ------------------ | ----------------------- | ------------------------------------ |
| **Admin Expiration Check** | `/api/admins/cron/check-expirations`       | Daily at 1:30 AM UTC | Vercel cron / external | Check and expire pending admin requests |
| **Sensor Data Update**     | `/api/cron/sensor-update`                  | Every 5 minutes    | External cron service   | Fetch latest data from UbiBot/Shelly |

### Cron Authentication

Both cron endpoints validate requests using the `CRON_SECRET` environment variable:

```
Request must include:
  Header: Authorization: Bearer <CRON_SECRET>
  OR
  Query: ?secret=<CRON_SECRET>

If secret doesn't match → 401 Unauthorized
```

### Setting Up External Cron (Railway)

Since Railway doesn't have native cron support, use an external service:

```
Options:
├── cron-job.org (free, reliable)
├── EasyCron
├── GitHub Actions (scheduled workflow)
└── Custom server with node-cron

Example cron-job.org configuration:
  URL: https://bim-model-production.up.railway.app/api/cron/sensor-update
  Method: POST
  Headers: Authorization: Bearer <your-cron-secret>
  Schedule: */5 * * * * (every 5 minutes)
```

---

## Database Infrastructure

### MongoDB Atlas Configuration

```
Cluster: MongoDB Atlas (M0 free tier or higher)
Region: Configurable per Atlas project
Replication: 3-node replica set (Atlas managed)
Backup: Atlas automated backups
Monitoring: Atlas built-in performance metrics

Connection:
├── Protocol: mongodb+srv (DNS-based)
├── Authentication: Username/password
├── Encryption: TLS 1.2+ in transit
├── IP Whitelist: Configured in Atlas
└── Connection Pooling: MongoDB driver built-in
```

### Database Optimization

```
20 strategic indexes (scripts/create-indexes.js):
├── User lookup by email (unique)
├── Project queries by owner
├── Geo-spatial project location queries
├── Invite lookups by project, email, and token
├── File/folder queries by project
├── FM asset and space queries by project + model
├── Ticket and work order status filtering
├── Sensor readings sorted by timestamp (desc)
├── Activity logs by project (recent first)
└── Notification queries by user + read status
```

---

## External Service Dependencies

### Service Health Dependencies

```
┌──────────────────────────────────────────────────────────────┐
│                  Service Dependency Map                       │
│                                                              │
│  CRITICAL (app won't function without):                      │
│  ├── MongoDB Atlas ─── All data storage                      │
│  └── Railway ───────── Application hosting                   │
│                                                              │
│  HIGH (major features break without):                        │
│  ├── Autodesk Forge ── 3D model viewing                      │
│  ├── Google OAuth ──── Social login                          │
│  └── Gmail SMTP ────── Email delivery (OTP, reset, invites) │
│                                                              │
│  MEDIUM (specific features break without):                   │
│  ├── Google Maps ───── Project location display              │
│  ├── UbiBot ────────── Environmental sensor data             │
│  └── Shelly Cloud ──── Smart device sensor data              │
└──────────────────────────────────────────────────────────────┘
```

### API Rate Limits & Quotas

| Service         | Free Tier Limit                 | Production Tier                |
| --------------- | ------------------------------- | ------------------------------ |
| MongoDB Atlas   | 512MB storage (M0)              | Pay-per-use (M10+)            |
| Autodesk Forge  | 100 translations/month          | Pay-per-use                   |
| Google Maps     | $200/month free credit          | $7/1000 loads                 |
| Google OAuth    | Unlimited                       | Unlimited                      |
| Gmail SMTP      | 500 emails/day                  | Google Workspace: higher limit |
| UbiBot API      | Varies by plan                  | Varies by plan                 |
| Shelly Cloud    | Unlimited (own devices)         | Unlimited (own devices)        |

---

## Scripts & Tooling

### Available Scripts

| Script                       | Command                            | Purpose                              |
| ---------------------------- | ---------------------------------- | ------------------------------------ |
| **Create Indexes**           | `node scripts/create-indexes.js`   | Create all 20 MongoDB indexes        |
| **Database Cleanup**         | `node scripts/cleanup.js`          | Reset database (development only!)   |
| **Seed Sensors**             | `node scripts/seed-sensors.js`     | Insert sample IoT sensor data        |
| **Verify UbiBot**            | `python scripts/verify-ubibot.py`  | Test UbiBot API connectivity         |

### Script Details

#### create-indexes.js (Recommended: Run on First Deploy)
```
What it does:
├── Connects to MongoDB using MONGODB_URI
├── Creates 20 indexes across all collections
├── Safe to run multiple times (idempotent)
├── Logs success/failure for each index
└── Exits when complete

When to run:
├── First deployment to a new database
├── After adding new collections
└── After modifying index requirements
```

#### cleanup.js (Development Only!)
```
What it does:
├── Drops specified collections
├── Resets data to clean state
├── WARNING: Destroys all data!
└── Never run in production

Collections affected: 10+ collections cleared
```

#### seed-sensors.js
```
What it does:
├── Clears existing iot_sensors collection
├── Inserts 2 sample sensor templates
│   ├── Temperature sensor (UbiBot type)
│   └── CO2 sensor (generic type)
├── Sets realistic default values
└── Used for development/demo purposes
```

#### verify-ubibot.py
```
What it does:
├── Tests UbiBot API connectivity
├── Verifies account key validity
├── Lists available channels/devices
├── Reports sensor data availability
└── Requires: python3, requests library
```

---

## Build & Development

### NPM Scripts

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Start dev server with Turbopack (fast HMR) |
| `npm run build`       | Create optimized production build        |
| `npm run start`       | Start production server                  |
| `npm run lint`        | Run ESLint checks                        |
| `npm run railway:build` | Production build (Railway-specific)    |
| `npm run railway:start` | Start server (Railway-specific)        |

### Development Server

```bash
npm run dev
# Starts Next.js dev server with Turbopack
# Available at http://localhost:3000
# Hot Module Replacement enabled
# Fast Refresh for React components
```

### Production Build

```bash
npm run build
# Creates .next/ directory with:
#   ├── Optimized JavaScript bundles
#   ├── Pre-rendered static pages
#   ├── Server-side rendering functions
#   ├── API route handlers
#   └── Static assets (images, fonts)

npm run start
# Serves production build on port 3000
# Uses NODE_ENV=production
```

### Build Output Structure

```
.next/
├── cache/              # Build cache for incremental builds
├── server/             # Server-side bundles
│   ├── app/            # App Router pages
│   ├── chunks/         # Shared code chunks
│   └── middleware.js   # Compiled middleware
├── static/             # Client-side assets
│   ├── chunks/         # JS bundles
│   ├── css/            # Compiled CSS
│   └── media/          # Static media
└── BUILD_ID            # Unique build identifier
```

---

## Performance Testing

### K6 Load Test (load-test.js)

The project includes a K6 load testing script for performance validation:

```
File: load-test.js

Purpose: Simulate concurrent users hitting API endpoints
Tool: K6 (https://k6.io)

Running:
  k6 run load-test.js

Metrics captured:
├── Response time (p50, p95, p99)
├── Requests per second
├── Error rate
├── Virtual user concurrency
└── Data transferred
```

---

## SSL/TLS & Security Headers

### Current SSL Setup

```
Provider: Railway (auto-managed)
Protocol: TLS 1.2 / TLS 1.3
Certificate: Let's Encrypt (auto-renewed)
HSTS: Not explicitly configured
Force HTTPS: Railway handles redirect
```

### Current Security Headers

```
Currently configured: None explicitly set

Recommended additions to next.config.ts:
├── Strict-Transport-Security (HSTS)
├── X-Content-Type-Options: nosniff
├── X-Frame-Options: DENY
├── X-XSS-Protection: 1; mode=block
├── Referrer-Policy: strict-origin-when-cross-origin
└── Content-Security-Policy (CSP)
```

---

## Monitoring & Health Checks

### Health Check Endpoint

```
GET /api/health

Response: 200 OK
Purpose: Verify application is running
Used by: Railway health checks, external monitoring
```

### Current Monitoring

```
Available:
├── Railway dashboard (CPU, memory, requests)
├── MongoDB Atlas metrics (queries, connections, storage)
└── /api/health endpoint for uptime monitoring

Not configured:
├── Error tracking (Sentry, LogRocket)
├── Application Performance Monitoring (APM)
├── Log aggregation (Datadog, CloudWatch)
├── Custom alerts and notifications
└── Real User Monitoring (RUM)
```

---

## Deployment Checklist

### First-Time Deployment

```
1. [ ] Create Railway project (or Vercel project)
2. [ ] Create MongoDB Atlas cluster
3. [ ] Configure all 21 environment variables
4. [ ] Set up Google OAuth consent screen
5. [ ] Create Autodesk Forge application
6. [ ] Configure Google Maps API key with domain restrictions
7. [ ] Set up Gmail App Password for SMTP
8. [ ] Deploy application
9. [ ] Run: node scripts/create-indexes.js
10. [ ] Verify: GET /api/health returns 200
11. [ ] Set up external cron for sensor updates (if on Railway)
12. [ ] Test authentication flow (Google OAuth + Credentials)
13. [ ] Test 3D model upload and viewing
14. [ ] Test email delivery (OTP, password reset)
15. [ ] Configure custom domain (optional)
```

### Environment Update Deployment

```
1. [ ] Update environment variable in hosting dashboard
2. [ ] Trigger redeploy (Railway auto-redeploys on env change)
3. [ ] Verify affected feature works
```

### Code Update Deployment

```
1. [ ] Push to main branch (Railway auto-deploys from Git)
2. [ ] Monitor build logs for errors
3. [ ] Verify /api/health after deploy
4. [ ] Smoke test critical paths:
       ├── Login/signup
       ├── Project creation
       ├── Model upload
       └── Sensor data display
```

---

## Related Documentation

| Document                                                          | Description                                   |
| ----------------------------------------------------------------- | --------------------------------------------- |
| [Project Overview](./PROJECT_OVERVIEW.md)                          | High-level project summary and tech stack      |
| [Backend API Reference](./BACKEND_API_REFERENCE.md)                | All 126 API endpoints                          |
| [Database Architecture](./DATABASE_ARCHITECTURE.md)                | MongoDB collections and indexes                |
| [Authentication & Security](./AUTHENTICATION_AND_SECURITY.md)      | Security configuration and recommendations     |

---

*Last updated: March 2026*

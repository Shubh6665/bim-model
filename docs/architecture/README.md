# Architecture Documentation — BIM Platform

> This folder contains comprehensive technical documentation for every layer of the BIM Project Management Platform. Each document is self-contained and can be read independently.

---

## Documents

| # | Document | Description | Key Metrics |
|---|----------|-------------|-------------|
| 1 | [Project Overview](../../README.md) | High-level summary of the entire platform — what it does, tech stack, architecture diagram, project structure, and getting started guide. | 45+ dependencies, 25 routes, 126 endpoints |
| 2 | [Backend API Reference](./BACKEND_API_REFERENCE.md) | Every API endpoint documented with methods, paths, auth requirements, request/response formats, and data flow diagrams. | 126 endpoints across 12 modules |
| 3 | [Database Architecture](./DATABASE_ARCHITECTURE.md) | All 27 MongoDB collections with field-level schemas, entity relationships, indexing strategy, caching, and data flow patterns. | 27 collections, 20 indexes |
| 4 | [Frontend Architecture](./FRONTEND_ARCHITECTURE.md) | React component tree, page routing, state management, 3D visualization engine, IoT dashboards, FM UI, and design system. | 41+ components, 25 pages, 570+ hooks |
| 5 | [Infrastructure & DevOps](./INFRASTRUCTURE_AND_DEVOPS.md) | Deployment architecture, Railway/Vercel hosting, cron jobs, environment variables, scripts, build process, and production checklist. | 21 env vars, 2 cron jobs, 4 scripts |
| 6 | [Authentication & Security](./AUTHENTICATION_AND_SECURITY.md) | Auth providers, JWT sessions, RBAC hierarchy, maintenance roles, password security, audit logging, and security recommendations. | 3 auth providers, 6+ RBAC tiers |

---

## Quick Reference — Platform at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                   BIM PROJECT PLATFORM                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Framework:    Next.js 15 + React 19 + TypeScript 5         │
│  Database:     MongoDB Atlas (27 collections, 20 indexes)   │
│  Hosting:      Railway.app (production)                     │
│  Auth:         NextAuth.js (Google OAuth, Email, Password)  │
│  Styling:      Tailwind CSS 4                               │
│  3D Engine:    Autodesk Forge + Three.js                    │
│                                                             │
│  API Endpoints:      126                                    │
│  Frontend Pages:     25                                     │
│  React Components:   41+                                    │
│  Service Files:      11                                     │
│  RBAC Roles:         6+ tiers                               │
│  External APIs:      5 (Forge, Google, UbiBot, Shelly, SMTP)│
│  Cron Jobs:          2 automated                            │
│                                                             │
│  Core Features:                                             │
│  ├── 3D BIM model viewing (RVT, DWG, IFC)                  │
│  ├── IoT sensor monitoring (5 dashboard types)              │
│  ├── Facility management (tickets → work orders lifecycle)  │
│  ├── Team collaboration (invites, RBAC, packages)           │
│  ├── Document management (upload, folders, sharing)         │
│  └── Geo-located project browsing (Google Maps)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Reading Order

**For a complete understanding, read in this order:**

1. **[Project Overview](../../README.md)** — Start here. Understand what the platform does and how it's structured.
2. **[Database Architecture](./DATABASE_ARCHITECTURE.md)** — Understand the data models that power everything.
3. **[Backend API Reference](./BACKEND_API_REFERENCE.md)** — See how the API exposes the data.
4. **[Authentication & Security](./AUTHENTICATION_AND_SECURITY.md)** — Understand who can access what.
5. **[Frontend Architecture](./FRONTEND_ARCHITECTURE.md)** — See how users interact with the platform.
6. **[Infrastructure & DevOps](./INFRASTRUCTURE_AND_DEVOPS.md)** — Learn how it's deployed and operated.

**For a specific topic, jump directly to the relevant document.**

---

## Other Documentation

The `/docs` folder also contains:

| Folder/File | Description |
|-------------|-------------|
| `docs/setup/FORGE_SETUP.md` | Autodesk Forge account and API setup |
| `docs/setup/GOOGLE_MAPS_SETUP.md` | Google Maps API configuration |
| `docs/development/` | 15+ development guides (implementation details, debugging) |
| `docs/api/` | API pricing analysis for external services |
| `docs/guides/` | Quick reference guides for developers and users |
| `docs/COST_ANALYSIS.md` | Infrastructure cost breakdown |
| `docs/INTERVIEW_PREP.md` | Interview preparation notes |

---

*Last updated: March 2026*

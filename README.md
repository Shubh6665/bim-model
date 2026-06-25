# Project Overview — BIM Project Management Platform

> A production-grade, full-stack Building Information Modeling (BIM) platform for project management, IoT sensor monitoring, 3D model visualization, and facility management.

---

## Table of Contents

- [Introduction](#introduction)
- [What This Platform Does](#what-this-platform-does)
- [Technology Stack](#technology-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Key Statistics](#key-statistics)
- [Core Capabilities](#core-capabilities)
- [External Service Integrations](#external-service-integrations)
- [Environment Configuration](#environment-configuration)
- [Getting Started](#getting-started)
- [Related Documentation](#related-documentation)

---

## Introduction

**BIM Project Client** is a web-based platform built for managing Building Information Modeling (BIM) projects end-to-end. It combines 3D model visualization, real-time IoT sensor monitoring, facility management workflows, and team collaboration into a single unified application.

| Attribute        | Detail                                          |
| ---------------- | ----------------------------------------------- |
| **Project Name** | bim-project-client                              |
| **Version**      | 0.1.0                                           |
| **Framework**    | Next.js 15.5.9 (App Router) + React 19          |
| **Language**     | TypeScript 5                                    |
| **Database**     | MongoDB Atlas (NoSQL)                           |
| **Deployment**   | Railway (production), Vercel-compatible          |
| **Architecture** | Full-stack monolith with modular domain layers   |

---

## What This Platform Does

The platform serves as a centralized hub for construction and facility management professionals:

1. **3D BIM Visualization** — Upload RVT, DWG, and IFC files. View fully interactive 3D building models in the browser via Autodesk Forge and Three.js.

2. **IoT Sensor Monitoring** — Connect UbiBot and Shelly sensors. Track temperature, humidity, CO2, energy consumption, seismic activity, and photovoltaic output in real time.

3. **Facility Management** — Create maintenance tickets, manage work orders through a complete lifecycle (creation → approval → assignment → execution → resolution), schedule planned maintenance, and track assets with QR codes.

4. **Project Collaboration** — Invite team members with specific roles and feature packages. Control access with a multi-tier RBAC system.

5. **Geo-located Project Browsing** — Visualize project locations on Google Maps/Earth with satellite imagery.

6. **Document Management** — Upload, organize, share, and annotate project files with folder structures and shareable links.

---

## Technology Stack

### Frontend

| Technology          | Version  | Purpose                                    |
| ------------------- | -------- | ------------------------------------------ |
| Next.js             | 15.5.9   | React framework with SSR and App Router    |
| React               | 19       | UI component library                       |
| TypeScript          | 5        | Type-safe JavaScript                       |
| Tailwind CSS        | 4        | Utility-first CSS styling                  |
| Three.js            | 0.178.0  | 3D graphics rendering                      |
| @react-three/fiber  | 9.2.0    | React wrapper for Three.js                 |
| @react-three/drei   | 10.4.2   | Three.js utility components                |
| Lucide React        | 0.525.0  | Icon library                               |
| React Hot Toast     | 2.6.0    | Toast notifications                        |

### Backend

| Technology          | Version  | Purpose                                    |
| ------------------- | -------- | ------------------------------------------ |
| Next.js API Routes  | 15.5.9   | RESTful API layer (serverless functions)    |
| MongoDB             | 6.8.0    | NoSQL database driver                      |
| NextAuth.js         | 4.24.7   | Authentication framework                   |
| bcryptjs            | 3.0.2    | Password hashing                           |
| Nodemailer          | 6.10.1   | SMTP email delivery                        |
| Resend              | 6.0.1    | Email service API                          |
| Formidable          | 3.5.4    | File upload handling                       |

### Document Processing

| Technology          | Version  | Purpose                                    |
| ------------------- | -------- | ------------------------------------------ |
| pdf-lib             | 1.17.1   | PDF creation and manipulation              |
| pdfjs-dist          | 3.11.174 | PDF rendering in browser                   |
| mammoth             | 1.10.0   | DOCX to HTML conversion                    |
| xlsx                | 0.18.5   | Excel file parsing                         |
| jszip               | 3.10.1   | ZIP archive handling                       |
| qrcode              | 1.5.4    | QR code generation                         |

### External APIs

| Service             | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| Autodesk Forge      | 3D BIM model translation, viewing, and metadata |
| Google Maps         | Project geolocation and mapping                 |
| Google OAuth 2.0    | Third-party authentication                      |
| UbiBot              | Environmental IoT sensor data                   |
| Shelly Cloud        | Smart device IoT control                        |
| Gmail SMTP          | Email delivery                                  |

---

## Architecture Overview

The application follows a **monolithic architecture** with clear domain-driven separation inside a single Next.js application:

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                            │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │  Dashboard   │  │  3D Viewer   │  │  IoT Sensor Dashboards  │ │
│  │  (React 19)  │  │ (Forge/Three)│  │  (Charts + Heatmaps)    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬─────────────┘ │
│         │                 │                      │               │
│  ┌──────┴─────────────────┴──────────────────────┴─────────────┐ │
│  │              React Context (State Management)                │ │
│  │              Custom Hooks (useAuth, useUserRole)              │ │
│  └──────────────────────────┬───────────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────┼────────────────────────────────────┐
│                     NEXT.JS SERVER                               │
│                                                                  │
│  ┌──────────────────────────┴───────────────────────────────────┐│
│  │                    middleware.ts                               ││
│  │            (JWT Authentication Guard)                          ││
│  └──────────────────────────┬───────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────┴───────────────────────────────────┐│
│  │                    API ROUTES (126 endpoints)                  ││
│  │                                                               ││
│  │  ┌─────────┐ ┌────────┐ ┌────────┐ ┌──────┐ ┌─────────────┐ ││
│  │  │  Auth   │ │Projects│ │  IoT   │ │Forge │ │   Facility   │ ││
│  │  │(6 rtes) │ │(45 rts)│ │(5 rtes)│ │(9 rt)│ │ Mgmt (25+)  │ ││
│  │  └─────────┘ └────────┘ └────────┘ └──────┘ └─────────────┘ ││
│  └──────────────────────────┬───────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────┴───────────────────────────────────┐│
│  │                   SERVICE LAYER                               ││
│  │                                                               ││
│  │  ┌──────────────┐  ┌─────────────┐  ┌─────────────────────┐ ││
│  │  │ RBAC Engine  │  │ Forge Svc   │  │ Asset Extraction    │ ││
│  │  │ Activity Log │  │ Heatmap Svc │  │ DataViz Service     │ ││
│  │  │ Auth Config  │  │ Cache Svc   │  │ Room Mapping        │ ││
│  │  └──────────────┘  └─────────────┘  └─────────────────────┘ ││
│  └──────────────────────────┬───────────────────────────────────┘│
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│                      DATA LAYER                                  │
│                                                                  │
│  ┌──────────────────────────┴───────────────────────────────────┐│
│  │                   MongoDB Atlas                               ││
│  │              27 Collections + GridFS                           ││
│  │              20 Strategic Indexes                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  External APIs: Forge | Google | UbiBot | Shelly | SMTP     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
bim-model/
│
├── app/                                # Next.js App Router (all source code)
│   ├── api/                            # Backend API routes (79 route files)
│   │   ├── auth/                       #   Authentication endpoints
│   │   ├── projects/                   #   Project management (largest module)
│   │   ├── forge/                      #   Autodesk Forge integration
│   │   ├── iot/                        #   IoT sensor endpoints
│   │   ├── admins/                     #   Admin panel routes
│   │   ├── sensors/                    #   Individual sensor CRUD
│   │   ├── notifications/              #   Push notifications
│   │   ├── invites/                    #   Team invitations
│   │   ├── uploads/                    #   File upload handling
│   │   ├── shared/                     #   Shareable link routes
│   │   ├── cron/                       #   Scheduled task endpoints
│   │   └── health/                     #   Health check endpoint
│   │
│   ├── components/                     # React components (41 components)
│   │   ├── auth/                       #   Login/signup panel
│   │   ├── dashboard/                  #   Main dashboard UI
│   │   ├── viewer/                     #   3D model viewers (Forge + Three.js)
│   │   ├── sensors/                    #   IoT sensor dashboards (7 components)
│   │   ├── fm/                         #   Facility management (14 components)
│   │   ├── floor/                      #   Floor plan rendering
│   │   ├── shared/                     #   Reusable components
│   │   └── ui/                         #   Base UI elements (navbar)
│   │
│   ├── services/                       # Business logic layer (11 services)
│   │   ├── asset-extraction-service.ts #   BIM asset extraction (25KB)
│   │   ├── aps-asset-extractor.ts      #   APS/Forge asset extraction (20KB)
│   │   ├── viewer-leaf-asset-extractor.ts # Tree/leaf extraction (44KB)
│   │   ├── dataviz-service.ts          #   Data visualization engine (22KB)
│   │   ├── heatmap-service.ts          #   Thermal heatmap generation (14KB)
│   │   ├── forge-service.ts            #   Forge API wrapper
│   │   ├── room-mapping.ts             #   Sensor-to-space mapping (11KB)
│   │   ├── model-cache-service.ts      #   IndexedDB caching
│   │   ├── shelly.ts                   #   Shelly device integration
│   │   ├── ubibot.ts                   #   UbiBot API integration
│   │   └── mongodb.ts                  #   MongoDB client setup
│   │
│   ├── lib/                            # Shared utilities (9 files)
│   │   ├── auth-config.ts              #   NextAuth configuration
│   │   ├── rbac.ts                     #   Role-based access control (13KB)
│   │   ├── maintenance-roles.ts        #   FM role definitions
│   │   ├── maintenance-state-machine.ts#   Work order lifecycle
│   │   ├── activity-logger.ts          #   Audit trail logging
│   │   ├── api-cache.ts                #   API caching layer
│   │   ├── email-templates.ts          #   Email HTML templates
│   │   ├── email.ts                    #   Email service wrapper
│   │   └── mongodb.ts                  #   MongoDB connection
│   │
│   ├── context/                        # React Context providers
│   ├── hooks/                          # Custom React hooks
│   │   ├── use-auth.ts                 #   Authentication hook
│   │   └── useUserRole.ts              #   Role-based access hook
│   │
│   ├── dashboard/                      # Dashboard page + components
│   ├── sensor-dashboard/               # Sensor monitoring pages
│   ├── energy-dashboard/               # Energy monitoring pages
│   ├── seismic-dashboard/              # Seismic monitoring pages
│   ├── pv-dashboard/                   # Photovoltaic monitoring pages
│   ├── fm-standalone/                  # Standalone FM page
│   ├── manual/                         # In-app documentation (19 pages)
│   ├── invite/                         # Invite acceptance page
│   ├── shared/                         # Shared link viewer page
│   │
│   ├── layout.tsx                      # Root layout
│   ├── page.tsx                        # Home/login page
│   ├── config.ts                       # Centralized env config
│   ├── globals.css                     # Global styles
│   └── middleware.ts                   # Auth middleware
│
├── docs/                               # Documentation (29 files)
│   ├── architecture/                   #   Architecture documentation (this folder)
│   ├── development/                    #   Development guides
│   ├── setup/                          #   Setup instructions
│   ├── api/                            #   API pricing analysis
│   └── guides/                         #   Quick reference guides
│
├── scripts/                            # Utility scripts
│   ├── create-indexes.js               #   MongoDB index creation
│   ├── cleanup.js                      #   Database cleanup
│   ├── seed-sensors.js                 #   IoT sensor seeding
│   └── verify-ubibot.py               #   UbiBot integration test
│
├── public/                             # Static assets
├── types/                              # Global TypeScript types
│
├── package.json                        # Dependencies and scripts
├── tsconfig.json                       # TypeScript configuration
├── next.config.ts                      # Next.js configuration
├── vercel.json                         # Cron job scheduling
├── Procfile                            # Railway deployment config
├── load-test.js                        # K6 performance testing
├── middleware.ts                       # Route protection
└── env.example                         # Environment variable template
```

---

## Key Statistics

| Metric                        | Count  |
| ----------------------------- | ------ |
| Total API Endpoints           | 126    |
| API Route Files               | 79     |
| API Modules                   | 12     |
| MongoDB Collections           | 27     |
| Database Indexes              | 20     |
| React Components              | 41+    |
| Frontend Pages/Routes         | 25     |
| Service Layer Files           | 11     |
| RBAC Role Tiers               | 6+     |
| External API Integrations     | 5      |
| Authentication Providers      | 3      |
| IoT Dashboard Types           | 5      |
| FM Module Components          | 14     |
| In-App Documentation Pages    | 19     |
| Automated Cron Jobs           | 2      |
| Supported File Formats        | 5+ (RVT, DWG, IFC, PDF, DOCX) |
| Environment Variables         | 21     |
| NPM Dependencies              | 45+    |

---

## Core Capabilities

### 1. 3D BIM Visualization
- Upload and translate RVT, DWG, and IFC files via Autodesk Forge
- Interactive 3D model viewer with pan, zoom, rotate, and section tools
- Asset tree navigation and property inspection
- Floor plan rendering and space identification
- Model annotation overlays
- Client-side model caching via IndexedDB (SHA-256 hashed keys)

### 2. IoT Sensor Monitoring
- **UbiBot Integration** — Temperature, humidity, light, CO2
- **Shelly Integration** — Smart device monitoring and control
- **5 Dashboard Types** — Sensor, Energy, Seismic, Photovoltaic, Environmental
- **Thermal Heatmaps** — Overlay sensor data on 3D BIM models
- **Room-to-Sensor Mapping** — Spatial association between sensors and building spaces
- **Historical Data** — Time-series readings stored in `iot_sensor_readings`

### 3. Facility Management
- **Ticket System** — Create maintenance requests with location, discipline, and priority
- **Work Order Lifecycle** — State machine: Pending → Approved → Assigned → In Progress → Resolved → Confirmed
- **Technician Assignment** — Assign work to specific maintenance personnel
- **Scheduled Maintenance** — Plan recurring maintenance tasks
- **Asset Tracking** — QR-code-based asset identification and management
- **Maintenance Reports** — Generate detailed maintenance reports
- **Activity Timeline** — Complete audit trail of every maintenance operation

### 4. Team Collaboration
- **Invite System** — Email-based team invitations with role and package assignment
- **RBAC** — Platform Owner → Administrator → Project Admin → FM/TM → Technician → User
- **Package-Based Access** — Grant access to specific feature modules (BIM, IoT, FM, AI, Database)
- **Company-Level Admin** — Administrators can manage projects for their company

### 5. Document Management
- **File Upload** — Multi-format support via GridFS
- **Folder Organization** — Hierarchical folder structure per project
- **Shareable Links** — Token-based file sharing with expiration
- **PDF Viewer** — In-browser PDF viewing with highlighting
- **DOCX Conversion** — Convert Word documents to HTML for viewing
- **ZIP Download** — Package and download multiple files

### 6. Location & Mapping
- **Google Maps Integration** — View projects on interactive maps
- **Satellite Imagery** — Google Earth-style project visualization
- **Geo-Coordinates** — Store and display project lat/lng data

---

## External Service Integrations

```
┌─────────────────────────────────────────────────────────────┐
│                    BIM Platform                              │
│                                                             │
│  ┌───────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │  Autodesk     │    │  Google      │    │  MongoDB     │ │
│  │  Forge API    │    │  Cloud       │    │  Atlas       │ │
│  │               │    │              │    │              │ │
│  │  - Model      │    │  - Maps API  │    │  - Database  │ │
│  │    translation│    │  - OAuth 2.0 │    │  - GridFS    │ │
│  │  - Viewer     │    │              │    │  - Indexes   │ │
│  │  - Metadata   │    │              │    │              │ │
│  └───────────────┘    └──────────────┘    └──────────────┘ │
│                                                             │
│  ┌───────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │  UbiBot       │    │  Shelly      │    │  Gmail       │ │
│  │  Platform     │    │  Cloud       │    │  SMTP        │ │
│  │               │    │              │    │              │ │
│  │  - Temp/Humid │    │  - Smart     │    │  - OTP       │ │
│  │  - CO2/Light  │    │    devices   │    │  - Reset pwd │ │
│  │  - Channels   │    │  - Relay     │    │  - Invites   │ │
│  │               │    │    control   │    │  - Alerts    │ │
│  └───────────────┘    └──────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Configuration

The platform requires 21 environment variables. Copy `env.example` to `.env.local` and fill in the values:

```bash
# Authentication
GOOGLE_CLIENT_ID=                      # Google OAuth client ID
GOOGLE_CLIENT_SECRET=                  # Google OAuth client secret
NEXTAUTH_SECRET=                       # Random string for JWT signing
NEXTAUTH_URL=http://localhost:3000     # Base URL of the application

# Database
MONGODB_URI=mongodb+srv://...          # MongoDB Atlas connection string
MONGODB_DB=bim-client                  # Database name

# Autodesk Forge (3D BIM Viewing)
FORGE_CLIENT_ID=                       # Forge app client ID
FORGE_CLIENT_SECRET=                   # Forge app client secret
FORGE_BUCKET_KEY=                      # S3 bucket for model storage
FORGE_REGION=us                        # Forge region

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=       # Maps API key (client-side)

# Email (SMTP)
SMTP_HOST=smtp.gmail.com               # SMTP server
SMTP_PORT=465                          # SMTP port (SSL)
SMTP_USER=                             # SMTP username
SMTP_PASS=                             # SMTP app password
MAIL_FROM=                             # Sender email display

# IoT Integrations
UBIBOT_ACCOUNT_KEY=                    # UbiBot API key
SHELLY_AUTH_KEY=                       # Shelly Cloud auth key
SHELLY_CLOUD_SERVER=https://shelly-238-eu.shelly.cloud

# Platform Configuration
PLATFORM_OWNER_EMAILS=                 # Comma-separated admin emails
APP_BASE_URL=http://localhost:3000     # Application base URL
CRON_SECRET=                           # Secret for cron job authentication
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- MongoDB Atlas account
- Autodesk Forge account (for 3D viewing)
- Google Cloud Console project (for Maps + OAuth)

### Installation

```bash
# Clone the repository
git clone https://github.com/Shubh6665/bim-model.git
cd bim-model

# Install dependencies
npm install

# Set up environment variables
cp env.example .env.local
# Edit .env.local with your credentials

# Create database indexes (recommended for performance)
node scripts/create-indexes.js

# (Optional) Seed sample sensor data
node scripts/seed-sensors.js

# Start development server with Turbopack
npm run dev

# Visit http://localhost:3000
```

### Build for Production

```bash
npm run build
npm run start
```

---

## Related Documentation

| Document                                                          | Description                                      |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| [Architecture Index](./docs/architecture/README.md)               | Index of all architecture documents               |
| [Backend API Reference](./docs/architecture/BACKEND_API_REFERENCE.md) | Complete API endpoint documentation           |
| [Database Architecture](./docs/architecture/DATABASE_ARCHITECTURE.md) | MongoDB collections, models, and relationships |
| [Frontend Architecture](./docs/architecture/FRONTEND_ARCHITECTURE.md) | Pages, components, state management           |
| [Infrastructure & DevOps](./docs/architecture/INFRASTRUCTURE_AND_DEVOPS.md) | Deployment, hosting, CI/CD, scripts       |
| [Authentication & Security](./docs/architecture/AUTHENTICATION_AND_SECURITY.md) | Auth providers, RBAC, security analysis |

---

*Last updated: March 2026*

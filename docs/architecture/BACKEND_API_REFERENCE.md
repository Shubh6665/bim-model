# Backend API Reference — BIM Platform

> Complete documentation of all 126 API endpoints across 12 modules, built with Next.js 15 App Router.

---

## Table of Contents

- [Overview](#overview)
- [API Architecture](#api-architecture)
- [Endpoint Summary](#endpoint-summary)
- [Module 1: Authentication](#module-1-authentication)
- [Module 2: Projects](#module-2-projects)
- [Module 3: Autodesk Forge](#module-3-autodesk-forge)
- [Module 4: IoT & Sensors](#module-4-iot--sensors)
- [Module 5: Facility Management — Assets](#module-5-facility-management--assets)
- [Module 6: Facility Management — Spaces](#module-6-facility-management--spaces)
- [Module 7: Facility Management — Tickets](#module-7-facility-management--tickets)
- [Module 8: Facility Management — Work Orders](#module-8-facility-management--work-orders)
- [Module 9: Users & Admin](#module-9-users--admin)
- [Module 10: Notifications](#module-10-notifications)
- [Module 11: File Uploads & Sharing](#module-11-file-uploads--sharing)
- [Module 12: Cron Jobs & Health](#module-12-cron-jobs--health)
- [HTTP Method Distribution](#http-method-distribution)
- [Middleware & Guards](#middleware--guards)
- [Error Handling](#error-handling)
- [Related Documentation](#related-documentation)

---

## Overview

| Attribute             | Detail                                         |
| --------------------- | ---------------------------------------------- |
| **Framework**         | Next.js 15.5.9 (App Router)                    |
| **Pattern**           | Route Handlers (`export async function GET()`)  |
| **Language**          | TypeScript                                     |
| **Total Route Files** | 79                                             |
| **Total Endpoints**   | 126                                            |
| **API Modules**       | 12                                             |
| **Auth-Protected**    | 34+ endpoints                                  |
| **Database-Backed**   | 69+ endpoints                                  |

---

## API Architecture

```
Client Request
      │
      v
┌─────────────────────────────────┐
│         middleware.ts            │   JWT token validation
│   Protected: /dashboard,        │   Redirects unauthenticated
│              /admin, /manual    │   users to login
└──────────────┬──────────────────┘
               │
               v
┌─────────────────────────────────┐
│       Next.js API Router        │   /app/api/***/route.ts
│                                 │   Route handler functions
│   GET | POST | PUT | PATCH |    │   Each file exports HTTP
│   DELETE                        │   method handlers
└──────────────┬──────────────────┘
               │
               v
┌─────────────────────────────────┐
│        Service Layer            │   /app/services/
│                                 │   /app/lib/
│   RBAC checks, business logic,  │   Auth validation,
│   external API calls            │   state machines
└──────────────┬──────────────────┘
               │
               v
┌─────────────────────────────────┐
│        MongoDB Atlas            │   27 collections
│        External APIs            │   Forge, Shelly, UbiBot
└─────────────────────────────────┘
```

---

## Endpoint Summary

| Module                      | Route Files | Endpoints | Primary Operations                       |
| --------------------------- | ----------- | --------- | ---------------------------------------- |
| **Authentication**          | 6           | 5         | Login, signup, OAuth, password reset, OTP|
| **Projects (core)**         | 15          | 28        | CRUD projects, profiles, teams           |
| **Projects (models)**       | 5           | 10        | BIM model management                     |
| **Projects (spaces)**       | 4           | 8         | Building space/room management           |
| **Projects (files/folders)**| 6           | 12        | Document management                      |
| **Projects (work orders)**  | 5           | 10        | Maintenance work orders                  |
| **Projects (tickets)**      | 4           | 8         | Service request tickets                  |
| **Autodesk Forge**          | 9           | 9         | 3D model translation & viewing           |
| **IoT & Sensors**           | 5           | 8         | Sensor CRUD & readings                   |
| **Users & Admin**           | 7           | 10        | User management, admin approval          |
| **Notifications**           | 1           | 3         | User notification system                 |
| **Uploads & Sharing**       | 3           | 4         | File uploads, shared links               |
| **Cron & Health**           | 3           | 3         | Scheduled tasks, health check            |
| **Invites**                 | 1           | 2         | Team invitation management               |
| **TOTAL**                   | **79**      | **126**   |                                          |

---

## Module 1: Authentication

Authentication is handled by NextAuth.js v4.24.7 with three providers.

**Source files:** `app/api/auth/`

### Endpoints

| Method | Path                              | Auth Required | Description                                      |
| ------ | --------------------------------- | ------------- | ------------------------------------------------ |
| *      | `/api/auth/[...nextauth]`         | No            | NextAuth.js catch-all handler (login, callback, session, signout) |
| POST   | `/api/auth/signup`                | No            | Register a new user with email/password           |
| POST   | `/api/auth/forgot-password`       | No            | Send password reset email with token              |
| POST   | `/api/auth/reset-password`        | No            | Reset password using token                        |
| POST   | `/api/auth/otp/send`              | No            | Send 6-digit OTP to email for verification        |
| POST   | `/api/auth/force-logout`          | Yes           | Terminate user session manually                   |

### Authentication Providers

| Provider      | Type                | Flow                                       |
| ------------- | ------------------- | ------------------------------------------ |
| Google        | OAuth 2.0           | Redirect to Google → callback → JWT        |
| Email         | Magic Link          | Enter email → receive link → click → JWT   |
| Credentials   | Username/Password   | Enter email + password → bcrypt verify → JWT |

### Signup Flow (POST `/api/auth/signup`)

```
Client sends: { email, password, firstName, lastName, otpCode? }
        │
        v
   ┌────────────────┐
   │ Validate OTP   │ (if OTP verification enabled)
   │ (10-min expiry)│
   └───────┬────────┘
           v
   ┌────────────────┐
   │ Check email    │ → 400 if already exists
   │ uniqueness     │
   └───────┬────────┘
           v
   ┌────────────────┐
   │ Hash password  │ bcrypt(password, 10 rounds)
   │                │
   └───────┬────────┘
           v
   ┌────────────────┐
   │ Insert into    │ users collection
   │ MongoDB        │ role: "user" (default)
   └───────┬────────┘
           v
   Response: { success: true }
```

### Password Reset Flow

```
1. POST /api/auth/forgot-password { email }
   → Generate crypto.randomBytes(32) token
   → Store in passwordResetTokens (1-hour TTL)
   → Send email with reset link
   → Response: success (no user enumeration)

2. POST /api/auth/reset-password { token, password }
   → Validate token exists and not expired
   → Hash new password with bcrypt
   → Update user record
   → Delete token (single-use)
   → Response: { message: "Password updated" }
```

---

## Module 2: Projects

The largest API module handling project lifecycle, team management, files, and collaboration.

**Source files:** `app/api/projects/`

### Core Project Endpoints

| Method | Path                                         | Auth | Description                              |
| ------ | -------------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/projects`                              | Yes  | List all projects accessible to user     |
| POST   | `/api/projects`                              | Yes  | Create a new project                     |
| GET    | `/api/projects/can-create`                   | Yes  | Check if user has permission to create   |
| GET    | `/api/projects/[projectId]`                  | Yes  | Get single project details               |
| PUT    | `/api/projects/[projectId]`                  | Yes  | Update project metadata                  |
| DELETE | `/api/projects/[projectId]`                  | Yes  | Delete project and all related data      |
| GET    | `/api/projects/[projectId]/user-role`         | Yes  | Get current user's role in this project  |
| GET    | `/api/projects/[projectId]/profile`           | Yes  | Get project profile/settings             |
| PUT    | `/api/projects/[projectId]/profile`           | Yes  | Update project profile                   |

### Team Management Endpoints

| Method | Path                                               | Auth | Description                              |
| ------ | -------------------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/projects/[projectId]/team`                   | Yes  | List all team members                    |
| POST   | `/api/projects/[projectId]/team/invite`             | Yes  | Send team invitation                     |
| DELETE | `/api/projects/[projectId]/team/[memberId]`         | Yes  | Remove team member                       |
| PATCH  | `/api/projects/[projectId]/team/[memberId]`         | Yes  | Update member role/packages              |

### Model Management Endpoints

| Method | Path                                               | Auth | Description                              |
| ------ | -------------------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/projects/[projectId]/models`                 | Yes  | List all BIM models in project           |
| POST   | `/api/projects/[projectId]/models`                 | Yes  | Add a new model to project               |
| GET    | `/api/projects/[projectId]/models/[modelId]`       | Yes  | Get specific model details               |
| PUT    | `/api/projects/[projectId]/models/[modelId]`       | Yes  | Update model metadata                    |
| DELETE | `/api/projects/[projectId]/models/[modelId]`       | Yes  | Remove model from project                |

### Space Management Endpoints

| Method | Path                                                     | Auth | Description                              |
| ------ | -------------------------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/projects/[projectId]/spaces`                       | Yes  | List all spaces/rooms                    |
| POST   | `/api/projects/[projectId]/spaces`                       | Yes  | Create a new space                       |
| PUT    | `/api/projects/[projectId]/spaces/[spaceId]`             | Yes  | Update space details                     |
| DELETE | `/api/projects/[projectId]/spaces/[spaceId]`             | Yes  | Delete a space                           |
| POST   | `/api/projects/[projectId]/spaces/bulk`                  | Yes  | Bulk import spaces from BIM model        |
| GET    | `/api/projects/[projectId]/spaces/export`                | Yes  | Export spaces as data                    |

### File & Folder Endpoints

| Method | Path                                                     | Auth | Description                              |
| ------ | -------------------------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/projects/[projectId]/files`                        | Yes  | List all project files                   |
| POST   | `/api/projects/[projectId]/files`                        | Yes  | Upload a new file                        |
| DELETE | `/api/projects/[projectId]/files/[fileId]`               | Yes  | Delete a file                            |
| GET    | `/api/projects/[projectId]/files/[fileId]/download`      | Yes  | Download file content                    |
| GET    | `/api/projects/[projectId]/folders`                      | Yes  | List folder structure                    |
| POST   | `/api/projects/[projectId]/folders`                      | Yes  | Create a new folder                      |

### Work Order Endpoints

| Method | Path                                                        | Auth | Description                              |
| ------ | ----------------------------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/projects/[projectId]/work-orders`                     | Yes  | List all work orders                     |
| POST   | `/api/projects/[projectId]/work-orders`                     | Yes  | Create a new work order                  |
| GET    | `/api/projects/[projectId]/work-orders/[orderId]`           | Yes  | Get work order details                   |
| PATCH  | `/api/projects/[projectId]/work-orders/[orderId]`           | Yes  | Update work order status/details         |
| DELETE | `/api/projects/[projectId]/work-orders/[orderId]`           | Yes  | Delete a work order                      |
| PATCH  | `/api/projects/[projectId]/work-orders/[orderId]/assign`    | Yes  | Assign technician                        |
| PATCH  | `/api/projects/[projectId]/work-orders/[orderId]/resolve`   | Yes  | Mark as resolved                         |
| PATCH  | `/api/projects/[projectId]/work-orders/[orderId]/confirm`   | Yes  | Confirm resolution                       |

### Ticket Endpoints

| Method | Path                                                     | Auth | Description                              |
| ------ | -------------------------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/projects/[projectId]/tickets`                      | Yes  | List all maintenance tickets             |
| POST   | `/api/projects/[projectId]/tickets`                      | Yes  | Create a new ticket                      |
| GET    | `/api/projects/[projectId]/tickets/[ticketId]`           | Yes  | Get ticket details                       |
| PATCH  | `/api/projects/[projectId]/tickets/[ticketId]`           | Yes  | Update ticket (approve, reject, etc.)    |
| DELETE | `/api/projects/[projectId]/tickets/[ticketId]`           | Yes  | Delete a ticket                          |

### Other Project Endpoints

| Method | Path                                                     | Auth | Description                              |
| ------ | -------------------------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/projects/[projectId]/sensors`                      | Yes  | List sensors for this project            |
| POST   | `/api/projects/[projectId]/sensors`                      | Yes  | Add sensor to project                    |
| GET    | `/api/projects/[projectId]/activity`                     | Yes  | Get project activity log                 |
| GET    | `/api/projects/[projectId]/fm-assets`                    | Yes  | List facility management assets          |
| POST   | `/api/projects/[projectId]/fm-assets`                    | Yes  | Create FM asset                          |
| PATCH  | `/api/projects/[projectId]/fm-assets/[assetId]`          | Yes  | Update FM asset                          |
| DELETE | `/api/projects/[projectId]/fm-assets/[assetId]`          | Yes  | Delete FM asset (soft-delete)            |
| POST   | `/api/projects/[projectId]/fm-assets/bulk`               | Yes  | Bulk import assets from BIM model        |
| GET    | `/api/projects/[projectId]/annotations`                  | Yes  | Get model annotations                    |
| POST   | `/api/projects/[projectId]/annotations`                  | Yes  | Create annotation                        |
| GET    | `/api/projects/[projectId]/scheduled-maintenance`        | Yes  | List scheduled maintenance plans         |
| POST   | `/api/projects/[projectId]/scheduled-maintenance`        | Yes  | Create maintenance schedule              |

---

## Module 3: Autodesk Forge

Handles 3D BIM model translation, viewing, and metadata retrieval via the Autodesk Platform Services (APS) API.

**Source files:** `app/api/forge/`

### Endpoints

| Method | Path                                | Auth | Description                                |
| ------ | ----------------------------------- | ---- | ------------------------------------------ |
| POST   | `/api/forge`                        | Yes  | Upload file to Forge bucket                |
| GET    | `/api/forge/token`                  | Yes  | Get Forge viewer access token              |
| POST   | `/api/forge/translate`              | Yes  | Start model translation job                |
| GET    | `/api/forge/status/[urn]`           | Yes  | Check translation status                   |
| GET    | `/api/forge/metadata/[urn]`         | Yes  | Get model metadata (properties tree)       |
| GET    | `/api/forge/thumbnail/[urn]`        | Yes  | Get model thumbnail image                  |
| DELETE | `/api/forge/cache/[urn]`            | Yes  | Clear cached model data                    |
| GET    | `/api/forge/manifest/[urn]`         | Yes  | Get translation manifest                   |
| *      | `/api/forge/[...handlers]`          | Yes  | Catch-all proxy for other Forge API calls  |

### Forge Token Flow

```
Client needs to view a 3D model
        │
        v
GET /api/forge/token
        │
        v
Server generates 2-legged OAuth token:
   POST https://developer.api.autodesk.com/authentication/v2/token
   grant_type: client_credentials
   scope: data:read data:write data:create bucket:read bucket:create
        │
        v
Token cached with 5-minute expiry buffer
        │
        v
Client initializes Forge Viewer with token
```

### Model Translation Flow

```
1. Upload file → POST /api/forge (file → Forge bucket via signed URL)
2. Translate   → POST /api/forge/translate (start SVF2 conversion)
3. Poll status → GET /api/forge/status/[urn] (check progress)
4. View model  → GET /api/forge/token (get viewer token)
5. Metadata    → GET /api/forge/metadata/[urn] (get model tree)
```

---

## Module 4: IoT & Sensors

Manages IoT sensor definitions, real-time data retrieval from UbiBot and Shelly platforms, and sensor readings storage.

**Source files:** `app/api/iot/`, `app/api/sensors/`, `app/api/ubibot/`

### Endpoints

| Method | Path                                    | Auth | Description                              |
| ------ | --------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/iot/ubibot/channels`              | Yes  | List all UbiBot channels/devices         |
| GET    | `/api/iot/ubibot/readings`              | Yes  | Get latest UbiBot sensor readings        |
| GET    | `/api/iot/shelly/devices`               | Yes  | List all Shelly smart devices            |
| GET    | `/api/iot/shelly/status`                | Yes  | Get Shelly device status/readings        |
| GET    | `/api/iot/realtime`                     | Yes  | Get latest sensor data (polling endpoint)|
| GET    | `/api/sensors/[sensorId]`               | Yes  | Get individual sensor details            |
| PUT    | `/api/sensors/[sensorId]`               | Yes  | Update sensor configuration              |
| DELETE | `/api/sensors/[sensorId]`               | Yes  | Remove sensor                            |

### Sensor Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   UbiBot     │     │   Shelly     │     │   Manual     │
│   Platform   │     │   Cloud      │     │   Sensors    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       v                    v                    v
┌──────────────────────────────────────────────────────────┐
│                    /api/iot/*                             │
│              (Server-side API calls)                     │
│                                                          │
│  ubibot.ts service    shelly.ts service    Direct CRUD   │
└──────────────────────────┬───────────────────────────────┘
                           │
                           v
┌──────────────────────────────────────────────────────────┐
│                    MongoDB                               │
│                                                          │
│  iot_sensors (definitions)    iot_sensor_readings (data)  │
└──────────────────────────────────────────────────────────┘
                           │
                           v
┌──────────────────────────────────────────────────────────┐
│              Frontend Dashboards                         │
│                                                          │
│  Sensor Graphs │ Heatmaps │ Energy │ Seismic │ PV       │
└──────────────────────────────────────────────────────────┘
```

---

## Module 5: Facility Management — Assets

Manages facility assets extracted from BIM models or created manually, including QR code tracking.

**Source files:** `app/api/projects/[projectId]/fm-assets/`

### Endpoints

| Method | Path                                                  | Auth | Description                              |
| ------ | ----------------------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/projects/[projectId]/fm-assets`                 | Yes  | List all assets (filterable)             |
| POST   | `/api/projects/[projectId]/fm-assets`                 | Yes  | Create asset manually                    |
| GET    | `/api/projects/[projectId]/fm-assets/[assetId]`       | Yes  | Get asset details                        |
| PATCH  | `/api/projects/[projectId]/fm-assets/[assetId]`       | Yes  | Update asset fields                      |
| DELETE | `/api/projects/[projectId]/fm-assets/[assetId]`       | Yes  | Soft-delete asset (moves to deletedAssets)|
| POST   | `/api/projects/[projectId]/fm-assets/bulk`            | Yes  | Bulk import from BIM model               |
| POST   | `/api/projects/[projectId]/fm-assets/[assetId]/qr`    | Yes  | Generate QR code for asset               |

### Asset Data Model (Key Fields)

```
AssetRecord {
  assetCode, assetName, category, type
  brand, model, serialNumber
  assetClassification: STRUCTURAL | ARCHITECTURAL | MEP | FURNITURE | EQUIPMENT | OTHER
  material, dimensions, weight, capacity, powerRating
  condition, serviceDate, expectedLife
  maintenanceSchedule, lastService, nextService
  purchaseCost, maintenanceCost
  dbId, modelGuid                       // BIM model references
  ifcGuid, ifcClass, ifcType            // IFC standard fields
  qrCode, qrGeneratedAt                // QR tracking
  source: BIM_MODEL | MANUAL
}
```

---

## Module 6: Facility Management — Spaces

Manages building spaces and rooms, with BIM model integration for spatial data.

**Source files:** `app/api/projects/[projectId]/spaces/`

### Endpoints

| Method | Path                                                     | Auth | Description                       |
| ------ | -------------------------------------------------------- | ---- | --------------------------------- |
| GET    | `/api/projects/[projectId]/spaces`                       | Yes  | List all spaces/rooms             |
| POST   | `/api/projects/[projectId]/spaces`                       | Yes  | Create space manually             |
| PUT    | `/api/projects/[projectId]/spaces/[spaceId]`             | Yes  | Update space                      |
| DELETE | `/api/projects/[projectId]/spaces/[spaceId]`             | Yes  | Soft-delete space                 |
| POST   | `/api/projects/[projectId]/spaces/bulk`                  | Yes  | Bulk import from BIM model        |
| GET    | `/api/projects/[projectId]/spaces/export`                | Yes  | Export spaces data                |

---

## Module 7: Facility Management — Tickets

Service request tickets form the first step in the maintenance workflow.

**Source files:** `app/api/projects/[projectId]/tickets/`

### Endpoints

| Method | Path                                                     | Auth | Description                       |
| ------ | -------------------------------------------------------- | ---- | --------------------------------- |
| GET    | `/api/projects/[projectId]/tickets`                      | Yes  | List all tickets                  |
| POST   | `/api/projects/[projectId]/tickets`                      | Yes  | Create new ticket                 |
| GET    | `/api/projects/[projectId]/tickets/[ticketId]`           | Yes  | Get ticket details                |
| PATCH  | `/api/projects/[projectId]/tickets/[ticketId]`           | Yes  | Update ticket status              |
| DELETE | `/api/projects/[projectId]/tickets/[ticketId]`           | Yes  | Delete ticket                     |

### Ticket Status Flow

```
PENDING_APPROVAL  ──→  APPROVED  ──→  (creates Work Order)
        │
        └──→  REJECTED
                │
                └──→  ARCHIVED
```

---

## Module 8: Facility Management — Work Orders

Work orders are created from approved tickets and follow a complete maintenance lifecycle.

**Source files:** `app/api/projects/[projectId]/work-orders/`

### Endpoints

| Method | Path                                                            | Auth | Description                    |
| ------ | --------------------------------------------------------------- | ---- | ------------------------------ |
| GET    | `/api/projects/[projectId]/work-orders`                         | Yes  | List all work orders           |
| POST   | `/api/projects/[projectId]/work-orders`                         | Yes  | Create work order              |
| GET    | `/api/projects/[projectId]/work-orders/[orderId]`               | Yes  | Get details                    |
| PATCH  | `/api/projects/[projectId]/work-orders/[orderId]`               | Yes  | Update status/details          |
| DELETE | `/api/projects/[projectId]/work-orders/[orderId]`               | Yes  | Delete work order              |
| PATCH  | `/api/projects/[projectId]/work-orders/[orderId]/assign`        | Yes  | Assign technician (TM only)    |
| PATCH  | `/api/projects/[projectId]/work-orders/[orderId]/resolve`       | Yes  | Mark resolved (TM only)        |
| PATCH  | `/api/projects/[projectId]/work-orders/[orderId]/confirm`       | Yes  | Confirm resolution (FM only)   |
| PATCH  | `/api/projects/[projectId]/work-orders/[orderId]/integration`   | Yes  | Request integration            |

### Work Order Lifecycle (State Machine)

```
  PENDING_APPROVAL
        │
        v
     APPROVED ──────────────────────────────────────┐
        │                                            │
        v                                            │
     ASSIGNED (technician assigned by TM)             │
        │                                            │
        v                                            │
   IN_PROGRESS (technician working)                   │
        │                                            │
        ├──→ INTEGRATION_REQUESTED                    │
        │         │                                  │
        │         v                                  │
        │    (FM reviews integration)                │
        │         │                                  │
        │         v                                  │
        v                                            │
     RESOLVED (TM marks complete)                     │
        │                                            │
        v                                            │
   RESOLUTION_CONFIRMED (FM confirms)                 │
        │                                            │
        v                                            │
     CLOSED                                           │
                                                     │
     REJECTED ←──────────────────────────────────────┘
```

### Role Permissions for Work Orders

| Action                | Platform Owner | TM (Team Manager) | FM (Facility Manager) | Technician | User |
| --------------------- | -------------- | ------------------ | --------------------- | ---------- | ---- |
| Create ticket         | Yes            | Yes                | Yes                   | Yes        | Yes  |
| Approve/reject ticket | Yes            | Yes                | No                    | No         | No   |
| Assign technician     | Yes            | Yes                | No                    | No         | No   |
| Update work details   | Yes            | Yes                | No                    | Yes        | No   |
| Set priority/type     | Yes            | Yes                | Yes                   | No         | No   |
| Mark resolved         | Yes            | Yes                | No                    | No         | No   |
| Confirm resolution    | Yes            | No                 | Yes                   | No         | No   |
| Request integration   | Yes            | Yes                | Yes                   | No         | No   |

---

## Module 9: Users & Admin

User management and platform administration.

**Source files:** `app/api/users/`, `app/api/admins/`

### User Endpoints

| Method | Path                                  | Auth | Description                              |
| ------ | ------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/users`                          | Yes  | List users (admin only)                  |
| GET    | `/api/users/me`                       | Yes  | Get current user profile                 |
| PATCH  | `/api/users/me`                       | Yes  | Update current user profile              |

### Admin Endpoints

| Method | Path                                              | Auth    | Description                              |
| ------ | ------------------------------------------------- | ------- | ---------------------------------------- |
| GET    | `/api/admins`                                     | Yes     | List all admin requests                  |
| POST   | `/api/admins/request`                             | Yes     | Request admin privileges                 |
| PATCH  | `/api/admins/[requestId]/approve`                 | Owner   | Approve admin request                    |
| PATCH  | `/api/admins/[requestId]/reject`                  | Owner   | Reject admin request                     |
| GET    | `/api/admins/cron/check-expirations`              | Secret  | Check admin request expirations (cron)   |

### Invites Endpoints

| Method | Path                        | Auth | Description                              |
| ------ | --------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/invites`              | Yes  | List pending invites for current user    |
| POST   | `/api/invites/accept`       | Yes  | Accept an invitation                     |

---

## Module 10: Notifications

User notification system.

**Source files:** `app/api/notifications/`

| Method | Path                                       | Auth | Description                              |
| ------ | ------------------------------------------ | ---- | ---------------------------------------- |
| GET    | `/api/notifications`                       | Yes  | List notifications for current user      |
| PATCH  | `/api/notifications/[notifId]/read`        | Yes  | Mark notification as read                |
| DELETE | `/api/notifications/[notifId]`             | Yes  | Delete a notification                    |

---

## Module 11: File Uploads & Sharing

**Source files:** `app/api/uploads/`, `app/api/shared/`

| Method | Path                                  | Auth  | Description                              |
| ------ | ------------------------------------- | ----- | ---------------------------------------- |
| POST   | `/api/uploads/avatar`                 | Yes   | Upload user avatar (max 5MB, images only)|
| GET    | `/api/uploads/avatar/[id]`            | No    | Retrieve avatar image                    |
| POST   | `/api/shared`                         | Yes   | Create shareable link with token         |
| GET    | `/api/shared/[token]`                 | No    | Access shared content via token          |

---

## Module 12: Cron Jobs & Health

Automated scheduled tasks and system health monitoring.

**Source files:** `app/api/cron/`, `app/api/health/`, `app/api/admins/cron/`

| Method | Path                                        | Auth   | Description                              |
| ------ | ------------------------------------------- | ------ | ---------------------------------------- |
| POST   | `/api/cron/sensor-update`                   | Secret | Update sensor data from IoT platforms    |
| GET    | `/api/admins/cron/check-expirations`        | Secret | Check/expire pending admin requests      |
| GET    | `/api/health`                               | No     | Health check (returns 200 OK)            |

### Cron Schedule (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/admins/cron/check-expirations",
      "schedule": "30 1 * * *"          // Daily at 1:30 AM UTC
    }
  ]
}
```

Sensor updates are triggered by an external cron service every 5 minutes.

---

## HTTP Method Distribution

```
   GET (53)   ███████████████████████████████████████████  42%
  POST (37)   █████████████████████████████               29%
DELETE (15)   ████████████                                12%
 PATCH (12)   ██████████                                  10%
   PUT (9)    ████████                                     7%
```

| Method | Count | Percentage | Primary Use                              |
| ------ | ----- | ---------- | ---------------------------------------- |
| GET    | 53    | 42%        | Read/list operations                     |
| POST   | 37    | 29%        | Create operations, file uploads          |
| DELETE | 15    | 12%        | Remove resources                         |
| PATCH  | 12    | 10%        | Partial updates (status changes)         |
| PUT    | 9     | 7%         | Full resource updates                    |

---

## Middleware & Guards

### Route Protection (middleware.ts)

```typescript
// Protected routes — require valid JWT token
const protectedRoutes = ["/dashboard", "/admin", "/manual"];

// Flow:
// 1. Check if request path starts with protected route
// 2. Extract JWT token from httpOnly cookie
// 3. If no valid token → redirect to "/" with callbackUrl
// 4. If valid token → allow request to proceed
```

### RBAC Authorization (lib/rbac.ts)

Every API route that requires authorization performs these checks:

```
1. Extract session from NextAuth (getServerSession)
2. Check user email against PLATFORM_OWNER_EMAILS (platform owner?)
3. Check user's adminCompanies array (approved administrator?)
4. Check project's invites collection (project-level role?)
5. Determine effective role and allowed operations
6. Return 403 if insufficient permissions
```

### Activity Logging (lib/activity-logger.ts)

Certain endpoints (primarily FM) log every action for audit compliance:

```
activity_logs collection stores:
  - projectId, ticketId, workOrderId
  - author (email), authorRole
  - action performed
  - fieldChanged, oldValue, newValue
  - notes, metadata
  - timestamp
```

---

## Error Handling

All API routes follow a consistent error response format:

```json
// Success
{ "success": true, "data": { ... } }

// or direct data return
{ ... }

// Error
{ "error": "Human-readable error message" }
// HTTP status: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error)
```

### Common Error Responses

| Status | Meaning            | Example                                    |
| ------ | ------------------ | ------------------------------------------ |
| 400    | Bad Request        | Missing required fields, invalid format    |
| 401    | Unauthorized       | No valid session token                     |
| 403    | Forbidden          | Valid session but insufficient permissions  |
| 404    | Not Found          | Project/resource doesn't exist             |
| 405    | Method Not Allowed | Using wrong HTTP method                    |
| 500    | Server Error       | Database failure, external API error       |

---

## Related Documentation

| Document                                                          | Description                                   |
| ----------------------------------------------------------------- | --------------------------------------------- |
| [Project Overview](../../README.md)                          | High-level project summary                     |
| [Database Architecture](./DATABASE_ARCHITECTURE.md)                | MongoDB collections and data models            |
| [Authentication & Security](./AUTHENTICATION_AND_SECURITY.md)      | Auth providers, RBAC, security details         |
| [Frontend Architecture](./FRONTEND_ARCHITECTURE.md)                | Pages, components, and UI                      |

---

*Last updated: March 2026*

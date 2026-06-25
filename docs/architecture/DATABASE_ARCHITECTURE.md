# Database Architecture — BIM Platform

> Complete documentation of the MongoDB database with 27 collections, data models, relationships, indexing strategy, and data flow.

---

## Table of Contents

- [Overview](#overview)
- [Database Configuration](#database-configuration)
- [Collection Inventory](#collection-inventory)
- [Collection Details](#collection-details)
  - [Authentication Collections](#authentication-collections)
  - [Project & File Collections](#project--file-collections)
  - [Facility Management Collections](#facility-management-collections)
  - [IoT & Sensor Collections](#iot--sensor-collections)
  - [Operational Collections](#operational-collections)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Indexing Strategy](#indexing-strategy)
- [Caching Architecture](#caching-architecture)
- [Data Flow Patterns](#data-flow-patterns)
- [Scripts & Tooling](#scripts--tooling)
- [Related Documentation](#related-documentation)

---

## Overview

| Attribute            | Detail                                        |
| -------------------- | --------------------------------------------- |
| **Database**         | MongoDB Atlas (cloud-hosted)                  |
| **Database Name**    | `bim-client`                                  |
| **Driver Version**   | mongodb v6.8.0                                |
| **Auth Adapter**     | @auth/mongodb-adapter v3.10.0                 |
| **ORM**              | None — direct MongoDB driver                  |
| **Total Collections**| 27                                            |
| **Strategic Indexes**| 20                                            |
| **Schema Management**| Application-level (no migration framework)    |
| **File Storage**     | MongoDB GridFS (for avatars and uploads)       |

---

## Database Configuration

### Connection Setup

The application uses two MongoDB connection files:

**`app/lib/mongodb.ts`** — Used by NextAuth for session management
```
Creates a singleton MongoClient instance
Exports a Promise<MongoClient> for NextAuth MongoDB Adapter
Used for: users, accounts, sessions, verificationTokens
```

**`app/services/mongodb.ts`** — Used by all application API routes
```
Wraps MongoClient with getDb() function
Returns connected Db instance
Database name from MONGODB_DB env var (defaults to "bim-client")
Connection pooling and reuse built-in
Used for: all application data (projects, assets, sensors, etc.)
```

### Connection String Format

```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
```

---

## Collection Inventory

### By Category

| Category                | Count | Collections                                                              |
| ----------------------- | ----- | ------------------------------------------------------------------------ |
| **Authentication**      | 6     | users, accounts, sessions, verificationTokens, emailOtps, passwordResetTokens |
| **Projects & Files**    | 8     | projects, project_profiles, files, folders, invites, shareLinks, uploads.files, zipShares |
| **Facility Management** | 7     | fm_assets, fm_spaces, fm_tickets, fm_work_orders, fm_scheduled_maintenance, deletedAssets, deletedSpaces |
| **IoT & Sensors**       | 2     | iot_sensors, iot_sensor_readings                                         |
| **Operational**         | 4     | activity_logs, forge_models, notifications, annotations                  |
| **TOTAL**               | **27**|                                                                          |

---

## Collection Details

### Authentication Collections

#### 1. `users`

The core user collection storing credentials and profile data.

| Field            | Type       | Description                              |
| ---------------- | ---------- | ---------------------------------------- |
| `_id`            | ObjectId   | Primary key                              |
| `email`          | String     | User email (unique, lowercase)           |
| `name`           | String     | Display name                             |
| `firstName`      | String     | First name                               |
| `lastName`       | String     | Last name                                |
| `password`       | String     | Bcrypt-hashed password (10 rounds)       |
| `image`          | String     | Profile image URL                        |
| `emailVerified`  | Date       | Email verification timestamp             |
| `provider`       | String     | Auth provider (google, email, credentials)|
| `role`           | String     | Platform role (default: "user")          |
| `adminCompanies` | Array      | Companies user can admin: `[{company, status}]` |
| `createdAt`      | Date       | Account creation timestamp               |

#### 2. `accounts`

OAuth provider accounts linked to users (managed by NextAuth).

| Field               | Type     | Description                              |
| -------------------- | -------- | ---------------------------------------- |
| `_id`               | ObjectId | Primary key                              |
| `userId`            | ObjectId | Reference to `users._id`                 |
| `type`              | String   | Account type ("oauth")                   |
| `provider`          | String   | Provider name ("google")                 |
| `providerAccountId` | String   | External provider user ID                |
| `access_token`      | String   | OAuth access token                       |
| `token_type`        | String   | Token type ("Bearer")                    |
| `scope`             | String   | OAuth scopes granted                     |

#### 3. `sessions`

Active user sessions (managed by NextAuth).

| Field          | Type     | Description                              |
| -------------- | -------- | ---------------------------------------- |
| `sessionToken` | String   | Unique session token                     |
| `userId`       | ObjectId | Reference to `users._id`                 |
| `expires`      | Date     | Session expiration timestamp             |

#### 4. `verificationTokens`

Email verification tokens (managed by NextAuth).

| Field        | Type   | Description                              |
| ------------ | ------ | ---------------------------------------- |
| `identifier` | String | Email address                            |
| `token`      | String | Verification token                       |
| `expires`    | Date   | Token expiration                         |

#### 5. `emailOtps`

One-time passwords for email verification during signup.

| Field       | Type   | Description                              |
| ----------- | ------ | ---------------------------------------- |
| `email`     | String | Target email address                     |
| `code`      | String | 6-digit OTP code (100000-999999)         |
| `expiresAt` | Date   | Expiration (10 minutes from creation)    |

#### 6. `passwordResetTokens`

Tokens for password reset flow.

| Field       | Type   | Description                              |
| ----------- | ------ | ---------------------------------------- |
| `email`     | String | User's email address                     |
| `token`     | String | Random 32-byte hex token                 |
| `expiresAt` | Date   | Expiration (1 hour from creation)        |

---

### Project & File Collections

#### 7. `projects`

Core project data with BIM model references and location.

| Field          | Type     | Description                              |
| -------------- | -------- | ---------------------------------------- |
| `_id`          | ObjectId | Primary key                              |
| `userId`       | ObjectId | Project owner reference                  |
| `name`         | String   | Project display name                     |
| `code`         | String   | Project code identifier                  |
| `country`      | String   | Country                                  |
| `municipality` | String   | Municipality/city                        |
| `address`      | String   | Street address                           |
| `cadastral`    | String   | Cadastral reference                      |
| `company`      | String   | Company name                             |
| `surname`      | String   | Project owner surname                    |
| `clientName`   | String   | Client name                              |
| `urn`          | String   | Legacy Forge URN (deprecated)            |
| `fileType`     | String   | Legacy file type                         |
| `models`       | Array    | Federated BIM models array               |
| `location`     | Object   | `{ lat: Number, lng: Number }`           |
| `description`  | String   | Project description                      |
| `createdAt`    | Date     | Creation timestamp                       |

#### 8. `project_profiles`

Project-specific team member profiles.

| Field       | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `projectId` | ObjectId | Reference to `projects._id`              |
| `email`     | String   | Member email                             |
| `firstName` | String   | First name in this project context       |
| `lastName`  | String   | Last name                                |
| `company`   | String   | Company affiliation                      |
| `role`      | String   | Role within this project                 |

#### 9. `files`

Project document files with metadata.

| Field        | Type     | Description                              |
| ------------ | -------- | ---------------------------------------- |
| `projectId`  | ObjectId | Reference to `projects._id`              |
| `fileName`   | String   | Original file name                       |
| `fileType`   | String   | MIME type or extension                   |
| `fileSize`   | Number   | File size in bytes                       |
| `uploadedBy` | String   | Uploader email                           |
| `uploadedAt` | Date     | Upload timestamp                         |
| `fileId`     | ObjectId | GridFS file reference (for large files)  |
| `s3Key`      | String   | S3/Forge storage key                     |
| `url`        | String   | Direct access URL                        |

#### 10. `folders`

Hierarchical folder structure for project files.

| Field       | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `projectId` | ObjectId | Reference to `projects._id`              |
| `parentId`  | ObjectId | Parent folder (null for root)            |
| `name`      | String   | Folder name                              |
| `createdAt` | Date     | Creation timestamp                       |
| `updatedAt` | Date     | Last update                              |

#### 11. `invites`

Team invitations with role and package assignments.

| Field            | Type     | Description                              |
| ---------------- | -------- | ---------------------------------------- |
| `projectId`      | ObjectId | Reference to `projects._id`              |
| `inviterUserId`  | ObjectId | Who sent the invite                      |
| `invitee`        | Object   | Invitee details (see below)              |
| `invitee.name`   | String   | Invitee first name                       |
| `invitee.surname`| String   | Invitee last name                        |
| `invitee.email`  | String   | Invitee email                            |
| `invitee.role`   | String   | Assigned role (Project Admin, BIM Manager, etc.) |
| `invitee.society`| String   | Company/society                          |
| `invitee.packages`| Array   | Feature access: ["BIM", "IoT", "FM", "AI", "Database"] |
| `status`         | String   | pending, accepted, declined              |
| `token`          | String   | Unique invite token                      |
| `createdAt`      | Date     | When invite was sent                     |
| `updatedAt`      | Date     | Last status change                       |

#### 12. `shareLinks`

Shareable public links for project content.

| Field       | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `projectId` | ObjectId | Reference to `projects._id`              |
| `token`     | String   | Unique share token                       |
| `expiresAt` | Date     | Link expiration                          |
| `createdAt` | Date     | Creation timestamp                       |

#### 13. `uploads.files`

GridFS metadata collection for large file storage.

```
Standard GridFS schema:
  filename, length, chunkSize, uploadDate, md5, metadata
```

#### 14. `zipShares`

Bundled file downloads as ZIP archives.

| Field       | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `token`     | String   | Unique download token                    |
| `projectId` | ObjectId | Source project                           |
| `files`     | Array    | File IDs to include                      |
| `expiresAt` | Date     | Download expiration                      |
| `createdAt` | Date     | Creation timestamp                       |

---

### Facility Management Collections

#### 15. `fm_assets`

Facility assets with comprehensive tracking data. The richest data model in the system.

| Field Group       | Key Fields                                                       |
| ----------------- | ---------------------------------------------------------------- |
| **Identity**      | assetCode, assetName, category, type, brand, model, serialNumber |
| **Classification**| assetClassification (STRUCTURAL, ARCHITECTURAL, MEP, FURNITURE, EQUIPMENT, OTHER) |
| **Technical**     | material, dimensions, weight, capacity, powerRating              |
| **Documentation** | manuals, warranties, certifications                              |
| **Lifecycle**     | condition, serviceDate, expectedLife                             |
| **Maintenance**   | maintenanceSchedule, lastService, nextService                    |
| **Financial**     | purchaseCost, maintenanceCost                                    |
| **Compliance**    | regulations, safetyNotes                                        |
| **Relations**     | parentAsset, location, suppliers                                 |
| **BIM Link**      | dbId, modelGuid, modelId                                        |
| **IFC Data**      | ifcGuid, ifcClass, ifcType, ifcPredefined, ifcCandidates        |
| **3D Position**   | placeholderX, placeholderY, placeholderZ, placeholderShape, placeholderSize |
| **Status**        | conflictWithId, linkedAssetId, hidden, userEdited                |
| **QR Tracking**   | qrCode, qrGeneratedAt                                           |
| **Source**        | source (BIM_MODEL or MANUAL)                                    |
| **Audit**         | createdAt, updatedAt                                             |

#### 16. `fm_spaces`

Building spaces and rooms with spatial data.

| Field          | Type     | Description                              |
| -------------- | -------- | ---------------------------------------- |
| `projectId`    | ObjectId | Reference to project                     |
| `modelGuid`    | String   | BIM model reference                      |
| `source`       | String   | BIM_MODEL or MANUAL                      |
| `name`         | String   | Space/room name                          |
| `level`        | String   | Floor/level                              |
| `building`     | String   | Building identifier                      |
| `spaceCode`    | String   | Space code                               |
| `description`  | String   | Description                              |
| `area`         | Number   | Floor area (sq meters)                   |
| `perimeter`    | Number   | Perimeter (meters)                       |
| `volume`       | Number   | Volume (cubic meters)                    |
| `occupancy`    | Number   | Max occupancy                            |
| `dbId`         | Number   | BIM model database ID                    |
| `footprint`    | Object   | `{ points: [], z: Number, levelIndex }` |
| `conflictWithId`| ObjectId| Conflict reference                      |
| `createdAt`    | Date     | Creation timestamp                       |
| `updatedAt`    | Date     | Last update                              |

#### 17. `fm_tickets`

Maintenance request tickets — first step in the FM workflow.

| Field               | Type     | Description                              |
| -------------------- | -------- | ---------------------------------------- |
| `projectId`         | ObjectId | Reference to project                     |
| `ticketCode`        | String   | Human-readable ticket code               |
| `qrCode`            | String   | QR code for physical tracking            |
| `requester`         | Object   | `{ name, surname, contact }`             |
| `location`          | Object   | `{ building, level, room, spaceCode }`   |
| `intervention`      | Object   | `{ discipline, category, item, itemDbId, descriptionShort, descriptionDetailed, attachments[] }` |
| `approvalStatus`    | String   | PENDING_APPROVAL, APPROVED, REJECTED     |
| `approvedBy`        | String   | Approver email                           |
| `approvedAt`        | Date     | Approval timestamp                       |
| `rejectionReason`   | String   | Why ticket was rejected                  |
| `priority`          | String   | Urgency level                            |
| `type`              | String   | MaintenanceType enum                     |
| `fmFields`          | Object   | FM-specific overrides                    |
| `status`            | String   | Current status                           |
| `createdAt`         | Date     | Creation timestamp                       |
| `updatedAt`         | Date     | Last update                              |

#### 18. `fm_work_orders`

Work orders derived from approved tickets — the most complex data model.

| Field Group           | Key Fields                                                   |
| --------------------- | ------------------------------------------------------------ |
| **Links**             | sourceTicketId, requestId                                    |
| **Requester**         | requester, contact                                           |
| **Location**          | location (building, level, room)                             |
| **Intervention**      | interventionDetails, discipline, category, description, attachments[] |
| **Assignment**        | responsibleTechnician, company, facilityManager, assignedTechnicians[] |
| **Status**            | status, priority, maintenanceType, ticketStatus              |
| **Lifecycle**         | maintenanceCycles[], currentCycle                             |
| **Resolution**        | resolvedBy, resolvedAt, tmClosingNotes                       |
| **Integration**       | integrationRequested, integrationRequestedBy, integrationReason |
| **Confirmation**      | resolutionConfirmed, resolutionConfirmedBy, resolutionConfirmedAt |
| **Time Tracking**     | totalTimeSpent, totalTimeToResolve                           |
| **Report**            | diagnosis, workPerformed, technicalNotes                     |
| **Comments**          | comments[]                                                   |
| **Outcome**           | interventionOutcome, assetCondition, nextPlannedActions      |
| **Materials**         | materials, timeSpent, additionalTechnicians                  |
| **Compliance**        | complianceCompleted, ppe, techSignature, clientSignature     |
| **Audit**             | createdAt, updatedAt, assignedAt, closureDate                |

#### 19. `fm_scheduled_maintenance`

Planned recurring maintenance tasks.

| Field       | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `projectId` | ObjectId | Reference to project                     |
| `discipline`| String   | Engineering discipline                   |
| `category`  | String   | Maintenance category                     |
| `code`      | String   | Maintenance code                         |
| `asset`     | Array    | Target assets                            |
| `tasks`     | Array    | Maintenance tasks to perform             |
| `frequency` | String   | Recurrence (daily, weekly, monthly, etc.)|
| `timeHours` | Number   | Estimated time in hours                  |
| `createdAt` | Date     | Creation timestamp                       |
| `updatedAt` | Date     | Last update                              |

#### 20. `deletedAssets`

Soft-deleted assets archive (same schema as `fm_assets`).

#### 21. `deletedSpaces`

Soft-deleted spaces archive (same schema as `fm_spaces`).

---

### IoT & Sensor Collections

#### 22. `iot_sensors`

Sensor definitions with provider-specific configuration.

| Field Group      | Key Fields                                                      |
| ---------------- | --------------------------------------------------------------- |
| **Identity**     | name, type, code, mark, model, externalId, devsn                |
| **Status**       | status (Online/Offline/Warning), batteryLevel, lastUpdate       |
| **Position**     | position {x,y,z}, modelPosition {x,y,z}                        |
| **Reading**      | value, color                                                    |
| **Room Mapping** | room, roomId, roomData                                          |
| **Project**      | projectId                                                       |
| **Provider**     | sensorProvider (ubibot / shelly / generic)                      |
| **UbiBot**       | ubibotChannelId, ubibotDeviceSerial                             |
| **Shelly**       | shellyDeviceId, shellyAuthKey, shellyIpAddress, shellyServerUri |
| **Meta**         | link, createdAt, updatedAt                                      |

#### 23. `iot_sensor_readings`

Time-series sensor data for historical analysis.

| Field       | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `sensorId`  | ObjectId | Reference to `iot_sensors._id`           |
| `projectId` | ObjectId | Reference to project                     |
| `reading`   | Object   | `{ value: Number, unit: String, timestamp: Date }` |
| `createdAt` | Date     | Record creation timestamp                |

---

### Operational Collections

#### 24. `activity_logs`

Comprehensive audit trail for maintenance operations.

| Field         | Type     | Description                              |
| ------------- | -------- | ---------------------------------------- |
| `projectId`   | ObjectId | Reference to project                     |
| `ticketId`    | ObjectId | Reference to ticket (optional)           |
| `workOrderId` | ObjectId | Reference to work order (optional)       |
| `author`      | String   | Actor's email address                    |
| `authorRole`  | String   | Actor's role at time of action           |
| `action`      | String   | Action performed (e.g., "STATUS_CHANGE") |
| `fieldChanged`| String   | Which field was modified                 |
| `oldValue`    | Mixed    | Previous value                           |
| `newValue`    | Mixed    | New value                                |
| `notes`       | String   | Additional context                       |
| `metadata`    | Object   | Extra structured data                    |
| `timestamp`   | String   | ISO timestamp                            |
| `createdAt`   | Date     | Record creation                          |

#### 25. `forge_models`

Autodesk Forge model cache and translation status.

| Field       | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `urn`       | String   | Forge model URN                          |
| `bucketKey` | String   | S3 bucket key                            |
| `objectKey` | String   | Object storage key                       |
| `status`    | String   | Translation status                       |
| `manifest`  | Object   | Forge manifest data                      |
| `createdAt` | Date     | Creation timestamp                       |
| `updatedAt` | Date     | Last update                              |

#### 26. `notifications`

User notification messages.

| Field       | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `userId`    | ObjectId | Target user                              |
| `projectId` | ObjectId | Related project                          |
| `type`      | String   | Notification type                        |
| `message`   | String   | Notification text                        |
| `read`      | Boolean  | Read status                              |
| `createdAt` | Date     | Creation timestamp                       |

#### 27. `annotations`

Model annotations and markups.

| Field       | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `projectId` | ObjectId | Reference to project                     |
| `fileId`    | ObjectId | Reference to file/model                  |
| `userId`    | ObjectId | Who created the annotation               |
| `data`      | Object   | Annotation position, text, styling       |
| `createdAt` | Date     | Creation timestamp                       |

---

## Entity Relationship Diagram

```
                            ┌──────────────┐
                            │    users     │
                            │              │
                            │  _id         │
                            │  email       │
                            │  password    │
                            │  role        │
                            └──────┬───────┘
                                   │
                  ┌────────────────┼────────────────┐
                  │                │                │
                  v                v                v
          ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
          │   accounts   │ │   sessions   │ │   projects   │
          │              │ │              │ │              │
          │  userId ──→  │ │  userId ──→  │ │  userId ──→  │
          │  provider    │ │  token       │ │  name        │
          │  OAuth data  │ │  expires     │ │  location    │
          └──────────────┘ └──────────────┘ │  models[]    │
                                            └──────┬───────┘
                                                   │
                    ┌──────────────┬────────────────┼────────────────┬──────────────┐
                    │              │                │                │              │
                    v              v                v                v              v
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │  fm_assets   │ │  fm_spaces   │ │  fm_tickets  │ │  iot_sensors │ │    files     │
            │              │ │              │ │              │ │              │ │              │
            │  projectId→  │ │  projectId→  │ │  projectId→  │ │  projectId→  │ │  projectId→  │
            │  assetCode   │ │  name        │ │  ticketCode  │ │  name        │ │  fileName    │
            │  modelGuid   │ │  area/volume │ │  requester   │ │  provider    │ │  GridFS ref  │
            │  ifcGuid     │ │  footprint   │ │  location    │ │  position    │ │              │
            │  qrCode      │ │              │ │  status      │ │  value       │ │              │
            └──────────────┘ └──────────────┘ └──────┬───────┘ └──────┬───────┘ └──────────────┘
                                                     │                │
                                                     v                v
                                              ┌──────────────┐ ┌─────────────────────┐
                                              │fm_work_orders│ │iot_sensor_readings  │
                                              │              │ │                     │
                                              │sourceTicketId│ │  sensorId ──→       │
                                              │  status      │ │  reading {value}    │
                                              │  technician  │ │  timestamp          │
                                              │  lifecycle   │ │                     │
                                              └──────────────┘ └─────────────────────┘

    Also linked to projects:
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │   invites    │ │ shareLinks   │ │activity_logs │ │notifications │ │ annotations  │
    │  projectId→  │ │  projectId→  │ │  projectId→  │ │  projectId→  │ │  projectId→  │
    │  invitee{}   │ │  token       │ │  action      │ │  message     │ │  data        │
    │  role/pkgs   │ │  expiresAt   │ │  author      │ │  userId→     │ │  userId→     │
    └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Indexing Strategy

The application defines 20 strategic indexes via `scripts/create-indexes.js`.

### Index List

| Collection              | Index Fields                      | Type     | Purpose                                     |
| ----------------------- | --------------------------------- | -------- | ------------------------------------------- |
| `users`                 | `{ email: 1 }`                    | Unique   | Fast user lookup by email                   |
| `projects`              | `{ userId: 1 }`                   | Standard | List projects by owner                      |
| `projects`              | `{ "location.lat": 1, "location.lng": 1 }` | Compound | Geo-spatial project queries      |
| `invites`               | `{ projectId: 1 }`               | Standard | List invites by project                     |
| `invites`               | `{ "invitee.email": 1 }`         | Standard | Find invites by email                       |
| `invites`               | `{ token: 1 }`                   | Unique   | Token-based invite lookup                   |
| `files`                 | `{ projectId: 1 }`               | Standard | List files by project                       |
| `folders`               | `{ projectId: 1, parentId: 1 }`  | Compound | Navigate folder hierarchy                   |
| `fm_assets`             | `{ projectId: 1, modelGuid: 1 }` | Compound | Assets per model in project                 |
| `fm_assets`             | `{ projectId: 1, assetCode: 1 }` | Compound | Asset lookup by code                        |
| `fm_spaces`             | `{ projectId: 1, modelGuid: 1 }` | Compound | Spaces per model                            |
| `fm_tickets`            | `{ projectId: 1 }`               | Standard | Tickets per project                         |
| `fm_tickets`            | `{ projectId: 1, status: 1 }`    | Compound | Filter tickets by status                    |
| `fm_work_orders`        | `{ projectId: 1 }`               | Standard | Work orders per project                     |
| `fm_work_orders`        | `{ projectId: 1, status: 1 }`    | Compound | Filter work orders by status                |
| `fm_work_orders`        | `{ sourceTicketId: 1 }`          | Standard | Link work orders to tickets                 |
| `iot_sensors`           | `{ projectId: 1 }`               | Standard | Sensors per project                         |
| `iot_sensor_readings`   | `{ sensorId: 1, createdAt: -1 }` | Compound | Latest readings per sensor (desc sort)      |
| `activity_logs`         | `{ projectId: 1, createdAt: -1 }`| Compound | Recent activity per project                 |
| `notifications`         | `{ userId: 1, read: 1 }`         | Compound | Unread notifications per user               |

### Running the Index Script

```bash
# Create all indexes (safe to run multiple times — idempotent)
node scripts/create-indexes.js
```

---

## Caching Architecture

### Client-Side: IndexedDB Cache (BIM Models)

**File:** `app/services/model-cache-service.ts`

```
Database: IndexedDB ("bim-cache")
Object Store: "models"
Key Path: fileHash (SHA-256)

Cached Data:
  - fileHash      → SHA-256 of model file
  - fileName      → Original filename
  - size          → File size
  - urn           → Forge model URN
  - status        → Translation status
  - manifest      → Forge manifest
  - cacheHits     → Usage counter
  - createdAt     → When cached
  - lastAccessAt  → Last access timestamp
```

### Server-Side: API Response Cache

**File:** `app/lib/api-cache.ts`

In-memory caching layer for frequently accessed API responses to reduce MongoDB queries.

### No External Cache

The application does not use Redis, Memcached, or other external caching. MongoDB's built-in connection pooling and the application-level caches handle performance needs.

---

## Data Flow Patterns

### Multi-Tenant Isolation

Every query includes `projectId` filtering to ensure data isolation between projects:

```
// All API routes follow this pattern:
const db = await getDb();
const data = await db
  .collection("fm_assets")
  .find({ projectId: new ObjectId(projectId) })
  .toArray();
```

### Soft-Delete Pattern

FM assets and spaces use soft-delete — records move to archive collections instead of permanent deletion:

```
Delete Asset:
  1. Read from fm_assets
  2. Insert into deletedAssets (with deletion metadata)
  3. Remove from fm_assets

This preserves data for compliance and audit trail purposes.
```

### Audit Trail Pattern

All FM operations are logged to `activity_logs`:

```
Every status change, field update, or action creates:
  {
    projectId, ticketId, workOrderId,
    author: "user@email.com",
    authorRole: "TM",
    action: "STATUS_CHANGE",
    fieldChanged: "status",
    oldValue: "ASSIGNED",
    newValue: "IN_PROGRESS",
    timestamp: "2026-03-18T..."
  }
```

---

## Scripts & Tooling

| Script                      | Command                        | Purpose                              |
| --------------------------- | ------------------------------ | ------------------------------------ |
| `scripts/create-indexes.js` | `node scripts/create-indexes.js`| Create all 20 database indexes      |
| `scripts/cleanup.js`        | `node scripts/cleanup.js`      | Reset database (development only)   |
| `scripts/seed-sensors.js`   | `node scripts/seed-sensors.js`  | Seed sample IoT sensor data         |
| `scripts/verify-ubibot.py`  | `python scripts/verify-ubibot.py`| Verify UbiBot API connectivity     |

---

## Related Documentation

| Document                                                          | Description                                   |
| ----------------------------------------------------------------- | --------------------------------------------- |
| [Project Overview](../../README.md)                          | High-level project summary                     |
| [Backend API Reference](./BACKEND_API_REFERENCE.md)                | API endpoints that interact with these collections |
| [Authentication & Security](./AUTHENTICATION_AND_SECURITY.md)      | Auth-related collections and security          |

---

*Last updated: March 2026*

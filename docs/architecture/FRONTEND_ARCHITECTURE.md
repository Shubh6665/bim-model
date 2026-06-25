# Frontend Architecture — BIM Platform

> Complete documentation of the React 19 + Next.js 15 frontend: 25 routes, 41+ components, state management, 3D visualization, and UI design system.

---

## Table of Contents

- [Overview](#overview)
- [Routing & Pages](#routing--pages)
- [Component Architecture](#component-architecture)
- [State Management](#state-management)
- [3D Visualization Engine](#3d-visualization-engine)
- [IoT Dashboard System](#iot-dashboard-system)
- [Facility Management UI](#facility-management-ui)
- [UI Design System](#ui-design-system)
- [Custom Hooks](#custom-hooks)
- [Form Handling](#form-handling)
- [In-App Documentation](#in-app-documentation)
- [Service Layer (Client-Side)](#service-layer-client-side)
- [Related Documentation](#related-documentation)

---

## Overview

| Attribute              | Detail                                        |
| ---------------------- | --------------------------------------------- |
| **Framework**          | Next.js 15.5.9 (App Router)                   |
| **UI Library**         | React 19                                      |
| **Language**           | TypeScript 5                                  |
| **Styling**            | Tailwind CSS 4                                |
| **State Management**   | React Context API + Custom Hooks              |
| **3D Graphics**        | Three.js 0.178 + Autodesk Forge Viewer        |
| **Icons**              | Lucide React 0.525                            |
| **Notifications**      | React Hot Toast 2.6                           |
| **Total Pages**        | 25 routes                                     |
| **Total Components**   | 41+                                           |
| **Total Hooks**        | 2 custom hooks                                |

---

## Routing & Pages

The application uses the Next.js App Router with file-based routing.

### Public Pages (No Authentication Required)

| Route               | File                              | Purpose                                    |
| -------------------- | --------------------------------- | ------------------------------------------ |
| `/`                  | `app/page.tsx`                    | Home page — login/signup entry point       |
| `/auth/error`        | `app/auth/error/page.tsx`         | Authentication error display               |
| `/shared/[token]`    | `app/shared/[token]/page.tsx`     | View shared project content via token      |
| `/invite/accept`     | `app/invite/accept/page.tsx`      | Accept team invitation via link            |

### Protected Pages (JWT Authentication Required)

| Route                                                | File                                                      | Purpose                              |
| ---------------------------------------------------- | --------------------------------------------------------- | ------------------------------------ |
| `/dashboard`                                         | `app/dashboard/page.tsx`                                  | Main BIM dashboard — project list, 3D viewer, maps |
| `/fm-standalone`                                     | `app/fm-standalone/page.tsx`                              | Standalone Facility Management panel |
| `/sensor-dashboard/[roomName]/[sensorName]`          | `app/sensor-dashboard/[roomName]/[sensorName]/page.tsx`   | General sensor monitoring            |
| `/energy-dashboard/[roomName]/[sensorName]`          | `app/energy-dashboard/[roomName]/[sensorName]/page.tsx`   | Energy consumption dashboard         |
| `/seismic-dashboard/[roomName]/[sensorName]`         | `app/seismic-dashboard/[roomName]/[sensorName]/page.tsx`  | Seismic activity monitoring          |
| `/pv-dashboard/[roomName]/[sensorName]`              | `app/pv-dashboard/[roomName]/[sensorName]/page.tsx`       | Photovoltaic solar monitoring        |

### Documentation Pages (Protected)

| Route                          | Purpose                              |
| ------------------------------ | ------------------------------------ |
| `/manual`                      | Manual home page                     |
| `/manual/introduction`         | Platform introduction                |
| `/manual/dashboard`            | Dashboard usage guide                |
| `/manual/projects`             | Project management guide             |
| `/manual/bim`                  | BIM features guide                   |
| `/manual/iot`                  | IoT sensor guide                     |
| `/manual/fm`                   | Facility management guide            |
| `/manual/ai`                   | AI features guide                    |
| `/manual/vt`                   | Virtual tour guide                   |
| `/manual/database`             | Database features guide              |
| `/manual/notifications`        | Notification system guide            |
| `/manual/glossary`             | Technical glossary                   |
| `/manual/sign-in-invites`      | Sign-in and invite guide             |

### Route Protection Flow

```
User navigates to /dashboard
        │
        v
┌──────────────────────────┐
│     middleware.ts         │
│                          │
│  Is path protected?      │──── No ──→ Allow request
│  (/dashboard, /admin,    │
│   /manual)               │
└──────────┬───────────────┘
           │ Yes
           v
┌──────────────────────────┐
│  Extract JWT token from  │
│  httpOnly cookie         │
│  (getToken from NextAuth)│
└──────────┬───────────────┘
           │
     ┌─────┴─────┐
     │ Has valid  │
     │  token?    │
     └─────┬─────┘
      No   │   Yes
       │   │    │
       v   │    v
  Redirect │  Allow
  to "/"   │  request
  with     │
  callback │
  URL      │
```

---

## Component Architecture

### Component Tree Overview

```
app/
├── layout.tsx                          # Root layout (SessionWrapper, global styles)
│   └── page.tsx                        # Home page
│       └── auth/auth-panel.tsx         # Login/signup panel
│
├── dashboard/page.tsx                  # Main dashboard
│   └── dashboard/components/
│       ├── dashboard-header.tsx        # Top navigation bar
│       ├── enhanced-bim-dashboard.tsx  # Main BIM viewing interface
│       ├── enhanced-project-panel.tsx  # Project & file browser sidebar
│       ├── google-earth-map.tsx        # Google Maps integration
│       └── 3d-viewer.tsx              # Three.js 3D model viewer
│
├── components/viewer/
│   ├── forge-viewer.tsx               # Autodesk Forge viewer (171KB)
│   ├── 3d-viewer.tsx                  # Three.js-based viewer
│   └── [viewer utilities]             # Viewer helper components
│
├── components/sensors/
│   ├── sensor-graphs-dashboard.tsx    # Multi-sensor graph view
│   ├── seismic-sensor-dashboard.tsx   # Seismic data display
│   ├── pv-sensor-dashboard.tsx        # Photovoltaic data display
│   ├── energy-dashboard-overlay.tsx   # Energy consumption overlay
│   ├── sensor-insertion-form.tsx      # Add new sensor form
│   ├── sensor-edit-form.tsx           # Edit sensor configuration
│   └── iot-panel.tsx                  # IoT management panel
│
├── components/fm/
│   ├── fm-panel.tsx                   # Main FM panel container
│   ├── fm-maintenance-report.tsx      # Maintenance report generator
│   ├── fm-panel-types.ts             # FM TypeScript type definitions (336 lines)
│   └── fm-modules/
│       ├── work-orders.tsx            # Work order list & management
│       ├── service-requests.tsx       # Service request tickets
│       ├── planned-maintenance.tsx    # Maintenance schedule planning
│       ├── scheduled-maintenance.tsx  # Scheduled maintenance view
│       ├── pending-approvals.tsx      # Approval queue for TM/FM roles
│       ├── activity-timeline.tsx      # Audit trail timeline view
│       ├── ticket-form.tsx            # Create/edit ticket form
│       ├── enhanced-maintenance-report.tsx  # Detailed report view
│       └── [5+ more FM modules]
│
├── components/floor/
│   ├── floor-plan-viewer.tsx          # 2D floor plan rendering
│   └── [floor utilities]
│
├── components/shared/
│   ├── session-wrapper.tsx            # NextAuth SessionProvider
│   ├── auto-logout-guard.tsx          # Inactivity session timeout
│   └── [shared utilities]
│
└── components/ui/
    └── navbar.tsx                     # Global navigation bar
```

### Component Count by Domain

| Domain              | Count | Key Components                                    |
| ------------------- | ----- | ------------------------------------------------- |
| **Facility Mgmt**   | 14    | FM panel, work orders, tickets, reports, approvals |
| **IoT Sensors**     | 7     | Graphs, seismic, PV, energy, forms                |
| **Dashboard**       | 4     | Header, BIM view, project panel, maps             |
| **3D Viewer**       | 3     | Forge viewer, Three.js viewer, utilities          |
| **Shared/UI**       | 4     | Session wrapper, navbar, auto-logout              |
| **Auth**            | 1     | Login/signup panel                                |
| **Floor Plans**     | 2     | Floor plan viewer and utilities                   |
| **Manual**          | 6+    | Documentation page components                    |
| **TOTAL**           | **41+** |                                                 |

---

## State Management

The application uses React Context API with three context providers and two custom hooks.

### Context Providers

```
┌─────────────────────────────────────────────────────────┐
│                    Root Layout                           │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              SessionProvider                       │  │
│  │           (NextAuth session context)               │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │           AuthContext                        │  │  │
│  │  │    (Custom auth state & user data)           │  │  │
│  │  │                                             │  │  │
│  │  │  ┌───────────────────────────────────────┐  │  │  │
│  │  │  │       ProjectContext                   │  │  │  │
│  │  │  │  (Current project, viewer state)       │  │  │  │
│  │  │  │                                       │  │  │  │
│  │  │  │        Page Components                │  │  │  │
│  │  │  │                                       │  │  │  │
│  │  │  └───────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### State Distribution

| State Category      | Storage Method         | Example Data                             |
| ------------------- | ---------------------- | ---------------------------------------- |
| **User session**    | NextAuth SessionProvider | user email, name, image, JWT token      |
| **Auth state**      | AuthContext             | isAuthenticated, user object, role       |
| **Project state**   | ProjectContext          | current project, selected model, viewer  |
| **Component state** | useState hooks          | form data, UI toggles, local filters    |
| **BIM model cache** | IndexedDB              | model files, translation status          |

### React Hook Usage

The codebase uses 570+ React hook calls across all components:

| Hook           | Approximate Usage | Purpose                              |
| -------------- | ----------------- | ------------------------------------ |
| `useState`     | ~250              | Local component state                |
| `useEffect`    | ~120              | Side effects, data fetching          |
| `useContext`   | ~80               | Access context providers             |
| `useCallback`  | ~50               | Memoized callbacks                   |
| `useMemo`      | ~30               | Memoized computations                |
| `useRef`       | ~40               | DOM refs, viewer instances           |

---

## 3D Visualization Engine

The platform supports two 3D viewing modes:

### Autodesk Forge Viewer

**File:** `app/components/viewer/forge-viewer.tsx` (171KB — the largest component)

```
Features:
├── Full Forge Viewer SDK integration
├── RVT, DWG, IFC file format support
├── Model tree navigation (asset hierarchy)
├── Property inspector panel
├── Section plane tools
├── Measurement tools
├── Markup/annotation overlay
├── Heatmap data overlay (IoT sensor data)
├── Space identification and highlighting
├── Multi-model federated viewing
└── Asset extraction from model tree

Data Flow:
  1. User selects model → /api/forge/token (get viewer token)
  2. Initialize Forge Viewer with token
  3. Load model URN into viewer
  4. Extract model tree → asset-extraction-service.ts
  5. Map spaces to sensors → room-mapping.ts
  6. Overlay sensor data → dataviz-service.ts / heatmap-service.ts
```

### Three.js Viewer

**File:** `app/components/dashboard/3d-viewer.tsx`

```
Features:
├── @react-three/fiber integration
├── @react-three/drei utilities
├── Orbit controls (pan, zoom, rotate)
├── DXF file support (via three-dxf)
├── Custom lighting setup
├── Sensor marker positioning in 3D space
└── Fallback viewer when Forge unavailable
```

### Client-Side Model Cache

**File:** `app/services/model-cache-service.ts`

```
IndexedDB Cache ("bim-cache"):
├── Key: SHA-256 hash of model file
├── Stored: fileName, size, URN, status, manifest
├── Tracks: cacheHits, lastAccessAt
├── Purpose: Avoid re-downloading large BIM models
└── Effect: Significantly faster repeat model loads
```

---

## IoT Dashboard System

Five specialized dashboard pages, each with dedicated visualization components:

### Dashboard Types

| Dashboard     | Route                                          | Sensors         | Visualization                       |
| ------------- | ---------------------------------------------- | --------------- | ----------------------------------- |
| **Sensor**    | `/sensor-dashboard/[room]/[sensor]`            | Temp, humidity   | Line charts, real-time values       |
| **Energy**    | `/energy-dashboard/[room]/[sensor]`            | Power, kWh      | Consumption graphs, overlays        |
| **Seismic**   | `/seismic-dashboard/[room]/[sensor]`           | Vibration        | Seismic wave visualization          |
| **PV**        | `/pv-dashboard/[room]/[sensor]`                | Solar output     | Production tracking, efficiency     |
| **Heatmap**   | Overlay on 3D viewer                           | Temperature      | Thermal gradient on building model  |

### Sensor Component Architecture

```
┌──────────────────────────────────────────────────┐
│              Sensor Dashboard Page                │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │         sensor-graphs-dashboard.tsx         │  │
│  │                                            │  │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ Temp    │  │ Humidity │  │ CO2      │  │  │
│  │  │ Chart   │  │ Chart    │  │ Chart    │  │  │
│  │  └─────────┘  └──────────┘  └──────────┘  │  │
│  │                                            │  │
│  │  ┌─────────────────────────────────────┐   │  │
│  │  │      Historical Data Timeline       │   │  │
│  │  └─────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │            iot-panel.tsx                    │  │
│  │  Sensor list, config, status indicators    │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Sensor Data Services

| Service                | File                               | Size  | Purpose                              |
| ---------------------- | ---------------------------------- | ----- | ------------------------------------ |
| Heatmap Generation     | `services/heatmap-service.ts`      | 14KB  | Thermal gradient overlays on 3D models |
| Data Visualization     | `services/dataviz-service.ts`      | 22KB  | Chart data processing and formatting |
| Room-Sensor Mapping    | `services/room-mapping.ts`         | 11KB  | Spatial association of sensors to rooms |
| UbiBot Integration     | `services/ubibot.ts`               | 7KB   | UbiBot API data fetching             |
| Shelly Integration     | `services/shelly.ts`               | 5KB   | Shelly device API interaction        |

---

## Facility Management UI

The FM module is the most component-rich area with 14 specialized components.

### FM Component Hierarchy

```
fm-panel.tsx (Main container)
│
├── work-orders.tsx
│   └── Work order list with status filters
│   └── Status badges: PENDING → APPROVED → ASSIGNED → IN_PROGRESS → RESOLVED → CONFIRMED
│   └── Expand/collapse for work order details
│   └── Action buttons based on user role (RBAC-gated)
│
├── service-requests.tsx
│   └── Ticket list with approval status
│   └── Quick-approve / quick-reject for TM role
│
├── ticket-form.tsx
│   └── Multi-section form:
│       ├── Requester info (name, contact)
│       ├── Location selector (building → level → room)
│       ├── Intervention details (discipline, category, description)
│       ├── Priority selector
│       ├── File attachment uploads
│       └── QR code auto-generation
│
├── pending-approvals.tsx
│   └── Queue of tickets awaiting TM/FM approval
│   └── Approve with priority/type assignment
│   └── Reject with reason
│
├── planned-maintenance.tsx
│   └── Create recurring maintenance schedules
│   └── Asset selection, task definition, frequency
│
├── scheduled-maintenance.tsx
│   └── Calendar view of upcoming maintenance
│
├── activity-timeline.tsx
│   └── Chronological audit trail
│   └── Shows: who, what, when, old value → new value
│
├── fm-maintenance-report.tsx
│   └── Generate printable maintenance reports
│
└── enhanced-maintenance-report.tsx
    └── Detailed report with technician data,
        time tracking, materials, compliance
```

### FM State Machine Visualization in UI

The work order status is displayed with color-coded badges and role-specific action buttons:

```
Status Badge Colors:
  PENDING_APPROVAL  → Yellow
  APPROVED          → Blue
  ASSIGNED          → Purple
  IN_PROGRESS       → Orange
  RESOLVED          → Green
  CONFIRMED         → Dark Green
  REJECTED          → Red
  CLOSED            → Gray

Role-Based Actions:
  TM sees: [Approve] [Reject] [Assign] [Resolve]
  FM sees: [Set Priority] [Confirm] [Request Integration]
  Technician sees: [Update Progress] [Add Notes]
  User sees: [View Only]
```

---

## UI Design System

### Tailwind CSS 4 Configuration

The application uses Tailwind CSS 4 with PostCSS integration:

```
Styling approach:
├── Utility-first classes (3,796+ className usages)
├── Dark mode via prefers-color-scheme
├── CSS custom properties for theming
├── Responsive breakpoints (sm, md, lg, xl)
└── WebKit compatibility fixes
```

### Color Scheme

```css
/* Light Mode */
--background: #ffffff;
--foreground: #171717;

/* Dark Mode (automatic) */
--background: #0a0a0a;
--foreground: #ededed;
```

### Notification System

Toast notifications via React Hot Toast:

```
Success:  Green toast (bottom-right)
Error:    Red toast (bottom-right)
Loading:  Spinner toast (bottom-right)
Info:     Blue toast (bottom-right)

Usage: toast.success("Project created successfully")
```

### Icons

Lucide React provides the icon library:

```
Examples used throughout:
  <Settings />, <Users />, <FileText />, <MapPin />,
  <ThermometerSun />, <Wrench />, <AlertTriangle />,
  <CheckCircle />, <Clock />, <Download />
```

---

## Custom Hooks

### `useAuth` (app/hooks/use-auth.ts)

```typescript
Purpose: Access authentication state anywhere in the component tree.

Returns:
  - session: NextAuth session object
  - user: Current user data (email, name, image)
  - isAuthenticated: Boolean
  - isLoading: Boolean
  - signIn(): Trigger login
  - signOut(): Trigger logout

Usage:
  const { user, isAuthenticated } = useAuth();
```

### `useUserRole` (app/hooks/useUserRole.ts)

```typescript
Purpose: Determine user's effective role in the current project context.

Returns:
  - role: String (platformOwner, admin, projectAdmin, tm, fm, maintainer, user)
  - isPlatformOwner: Boolean
  - isAdmin: Boolean
  - isProjectAdmin: Boolean
  - isTM: Boolean
  - isFM: Boolean
  - isMaintainer: Boolean
  - canApprove: Boolean
  - canAssign: Boolean
  - packages: String[] (accessible feature modules)
  - loading: Boolean

Usage:
  const { role, canApprove, packages } = useUserRole(projectId);

  // Gate UI elements by role:
  {canApprove && <ApproveButton />}
  {packages.includes("FM") && <FMPanel />}
```

---

## Form Handling

### Forms in the Application

| Form                      | Component                   | Fields                                  |
| ------------------------- | --------------------------- | --------------------------------------- |
| Login/Signup              | auth-panel.tsx              | email, password, firstName, lastName, OTP |
| Sensor Creation           | sensor-insertion-form.tsx   | name, type, provider, position, room    |
| Sensor Edit               | sensor-edit-form.tsx        | All sensor configuration fields         |
| Maintenance Ticket        | ticket-form.tsx             | requester, location, intervention, priority, attachments |
| Project Creation          | enhanced-project-panel.tsx  | name, code, address, location, company  |
| Work Order Update         | work-orders.tsx             | status, notes, technician, materials    |
| Maintenance Schedule      | planned-maintenance.tsx     | discipline, assets, tasks, frequency    |

### Validation Approach

```
Client-side:
├── HTML5 native validation (required, type="email", minLength)
├── Conditional field display (show/hide based on selection)
└── Basic format checks before submission

Server-side (API routes):
├── Required field presence checks
├── Email format normalization (toLowerCase)
├── Password minimum length (6 characters)
├── File type validation (MIME type)
├── File size limits (5MB avatars, 50MB documents)
├── OTP expiration verification
├── Token validity checks
└── MongoDB ObjectId format validation

Note: No schema validation library (zod, yup, joi) is currently used.
```

---

## In-App Documentation

The manual section provides 13 documentation pages accessible at `/manual/*`:

```
manual/
├── page.tsx                    # Manual home with navigation
├── _components/                # Shared documentation components
│   └── [layout, sidebar, etc.]
├── introduction/page.tsx       # What is BIM Platform?
├── dashboard/page.tsx          # Dashboard features & usage
├── projects/page.tsx           # Creating & managing projects
├── bim/page.tsx                # BIM 3D model viewing guide
├── iot/page.tsx                # IoT sensor setup & monitoring
├── fm/page.tsx                 # Facility management workflows
├── ai/page.tsx                 # AI-powered features
├── vt/page.tsx                 # Virtual tour features
├── database/page.tsx           # Database & data management
├── notifications/page.tsx      # Notification system usage
├── glossary/page.tsx           # Technical term definitions
└── sign-in-invites/page.tsx    # Account & invitation guide
```

---

## Service Layer (Client-Side)

These services run in the browser and handle complex client-side operations:

| Service                        | File                                    | Size  | Description                              |
| ------------------------------ | --------------------------------------- | ----- | ---------------------------------------- |
| **Asset Extraction**           | `services/asset-extraction-service.ts`  | 25KB  | Extract and categorize BIM model assets  |
| **APS Asset Extractor**        | `services/aps-asset-extractor.ts`       | 20KB  | Autodesk-specific asset extraction       |
| **Viewer Leaf Extractor**      | `services/viewer-leaf-asset-extractor.ts`| 44KB | Deep tree traversal for model components |
| **Data Visualization**         | `services/dataviz-service.ts`           | 22KB  | Chart data processing and rendering      |
| **Heatmap Generation**         | `services/heatmap-service.ts`           | 14KB  | Thermal heatmap overlay on 3D models     |
| **Room Mapping**               | `services/room-mapping.ts`              | 11KB  | Spatial sensor-to-room association       |
| **Model Cache**                | `services/model-cache-service.ts`       | 4KB   | IndexedDB cache for BIM model data       |
| **Forge Service**              | `services/forge-service.ts`             | 6KB   | Forge API token and upload management    |

---

## Related Documentation

| Document                                                          | Description                                   |
| ----------------------------------------------------------------- | --------------------------------------------- |
| [Project Overview](../../README.md)                          | High-level project summary                     |
| [Backend API Reference](./BACKEND_API_REFERENCE.md)                | API endpoints the frontend calls               |
| [Authentication & Security](./AUTHENTICATION_AND_SECURITY.md)      | Auth flow and RBAC the UI enforces             |
| [Database Architecture](./DATABASE_ARCHITECTURE.md)                | Data models behind the UI                      |

---

*Last updated: March 2026*

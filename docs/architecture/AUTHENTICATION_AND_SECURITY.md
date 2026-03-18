# Authentication & Security — BIM Platform

> Complete documentation of the authentication system, RBAC authorization, session management, password security, and security analysis.

---

## Table of Contents

- [Overview](#overview)
- [Authentication Providers](#authentication-providers)
- [Session Management](#session-management)
- [Signup & Login Flows](#signup--login-flows)
- [Password Security](#password-security)
- [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
- [Maintenance Role System](#maintenance-role-system)
- [Route Protection](#route-protection)
- [Audit Logging](#audit-logging)
- [External API Security](#external-api-security)
- [File Upload Security](#file-upload-security)
- [Database Security](#database-security)
- [Email Security](#email-security)
- [Security Analysis & Recommendations](#security-analysis--recommendations)
- [Related Documentation](#related-documentation)

---

## Overview

| Attribute               | Detail                                          |
| ----------------------- | ----------------------------------------------- |
| **Auth Framework**      | NextAuth.js v4.24.7                             |
| **Session Strategy**    | JWT (stateless, httpOnly cookie)                |
| **Providers**           | 3 (Google OAuth, Email Magic Link, Credentials) |
| **Password Hashing**    | bcryptjs v3.0.2 (10 salt rounds)                |
| **RBAC Tiers**          | 6+ hierarchical roles                           |
| **Auth Endpoints**      | 6 API routes                                    |
| **Protected Routes**    | /dashboard, /admin, /manual                     |
| **Audit Trail**         | activity_logs collection                        |

---

## Authentication Providers

### Provider 1: Google OAuth 2.0

```
Type:     OAuth 2.0 (Authorization Code flow)
Provider: GoogleProvider from next-auth

Flow:
  1. User clicks "Sign in with Google"
  2. Redirect to Google consent screen
  3. User authorizes → redirect back with auth code
  4. Server exchanges code for tokens
  5. Extract user info (email, name, image)
  6. Create/link account in MongoDB
  7. Issue JWT session cookie

Configuration:
  clientId:     GOOGLE_CLIENT_ID
  clientSecret: GOOGLE_CLIENT_SECRET
  allowDangerousEmailAccountLinking: true
```

### Provider 2: Email Magic Link

```
Type:     Passwordless (magic link via email)
Provider: EmailProvider from next-auth

Flow:
  1. User enters email address
  2. Server generates verification token
  3. Email sent via SMTP with magic link
  4. User clicks link → token validated
  5. Account created (if new) or logged in
  6. JWT session cookie issued

Configuration:
  server:   smtp.gmail.com:465 (SSL)
  maxAge:   24 hours (token validity)
```

### Provider 3: Credentials (Email + Password)

```
Type:     Traditional username/password
Provider: CredentialsProvider from next-auth

Flow:
  1. User enters email + password
  2. Server looks up user by email (case-insensitive)
  3. bcrypt.compare(input, stored_hash)
  4. If match → return user object
  5. JWT session cookie issued

Signup (separate endpoint):
  1. POST /api/auth/signup
  2. Validate OTP (if enabled)
  3. Check email uniqueness
  4. Hash password: bcrypt(password, 10)
  5. Insert user record
```

### Provider Comparison

| Feature              | Google OAuth     | Email Magic Link | Credentials      |
| -------------------- | ---------------- | ---------------- | ----------------- |
| Password required    | No               | No               | Yes               |
| External dependency  | Google servers   | SMTP server      | None              |
| MFA built-in         | Google handles   | No               | No                |
| Account linking      | Automatic        | By email match   | By email match    |
| Token validity       | N/A              | 24 hours         | N/A               |
| Signup required      | No (auto-create) | No (auto-create) | Yes (explicit)    |

---

## Session Management

### JWT Configuration

```
Strategy:       JWT (not database sessions)
Storage:        httpOnly cookie
Signing Secret: NEXTAUTH_SECRET environment variable
Default Expiry: 30 days
Cookie Flags:   httpOnly, Secure (production), SameSite=Lax
```

### JWT Token Contents

```json
{
  "sub": "user-mongodb-objectid",
  "email": "user@example.com",
  "name": "User Name",
  "image": "https://...",
  "accessToken": "google-oauth-token (if Google login)",
  "iat": 1710720000,
  "exp": 1713312000
}
```

### Session Callbacks

The NextAuth configuration uses four callbacks to customize the auth flow:

```
signIn(user, account, profile)
  → Validates account linking
  → Returns true to allow sign-in

jwt(token, user, account)
  → Enriches JWT with user data on first sign-in
  → Adds email, name, image to token
  → Stores OAuth access token (for Google)

session(session, token)
  → Builds session object from JWT token
  → Exposes: user.email, user.name, user.image
  → Returns session to client

redirect(url, baseUrl)
  → Handles post-login redirect
  → Respects callbackUrl parameter
```

### Auto-Logout Guard

**File:** `app/components/shared/auto-logout-guard.tsx`

```
Purpose: Detect user inactivity and auto-logout

Behavior:
├── Monitors user interaction events
├── Starts inactivity timer
├── After timeout → calls signOut()
├── Clears session cookie
└── Redirects to home page
```

---

## Signup & Login Flows

### Email + Password Signup

```
POST /api/auth/signup
Body: { email, password, firstName, lastName, otpCode? }

┌─────────────────────────────────┐
│ 1. Validate OTP (if enabled)    │
│    - Check emailOtps collection │
│    - Verify code matches        │
│    - Check not expired (10 min) │
└──────────────┬──────────────────┘
               │
               v
┌─────────────────────────────────┐
│ 2. Normalize email              │
│    - Convert to lowercase       │
│    - Trim whitespace            │
└──────────────┬──────────────────┘
               │
               v
┌─────────────────────────────────┐
│ 3. Check uniqueness             │
│    - Query users by email       │
│    - 400 if already exists      │
└──────────────┬──────────────────┘
               │
               v
┌─────────────────────────────────┐
│ 4. Hash password                │
│    - bcrypt.hash(password, 10)  │
│    - 10 salt rounds             │
└──────────────┬──────────────────┘
               │
               v
┌─────────────────────────────────┐
│ 5. Create user record           │
│    - email, name, password hash │
│    - role: "user" (default)     │
│    - provider: "credentials"    │
│    - createdAt: now             │
└──────────────┬──────────────────┘
               │
               v
     Response: { success: true }
```

### OTP Email Verification

```
POST /api/auth/otp/send
Body: { email }

1. Generate 6-digit code: Math.floor(100000 + Math.random() * 900000)
2. Set expiration: 10 minutes from now
3. Upsert into emailOtps collection (replaces any existing OTP for this email)
4. Send OTP via SMTP email
5. Response: { success: true }
```

### Password Reset Flow

```
Step 1: Request Reset
  POST /api/auth/forgot-password { email }
  │
  ├── Look up user by email
  ├── If not found → return success anyway (prevent user enumeration)
  ├── Generate token: crypto.randomBytes(32).toString('hex')
  ├── Store in passwordResetTokens with 1-hour expiry
  ├── Send email with reset link: {APP_BASE_URL}/reset-password?token={token}
  └── Response: { message: "If that email exists, we sent a reset link" }

Step 2: Reset Password
  POST /api/auth/reset-password { token, password }
  │
  ├── Look up token in passwordResetTokens
  ├── Verify not expired
  ├── Hash new password: bcrypt(password, 10)
  ├── Update user's password field
  ├── Delete token (single-use enforcement)
  └── Response: { message: "Password updated successfully" }
```

---

## Password Security

### Hashing Configuration

```
Algorithm:    bcrypt (Blowfish cipher)
Library:      bcryptjs v3.0.2
Salt Rounds:  10
Hash Output:  60-character string starting with $2b$10$

Example:
  Input:  "mypassword123"
  Output: "$2b$10$K4G7DG0FH1pJ3Xx8j7W9T.VwA8nK2mL5pQ9rS6tU0vX1yZ3bC4eF"
```

### Password Policy

```
Current Requirements:
├── Minimum length: 6 characters
├── No complexity rules
├── No expiration
├── No history tracking
└── No account lockout after failed attempts
```

### Token Security

| Token Type      | Generation Method              | Length   | Expiry     | Single-Use |
| --------------- | ------------------------------ | -------- | ---------- | ---------- |
| Password Reset  | `crypto.randomBytes(32).hex()` | 64 chars | 1 hour     | Yes        |
| Email OTP       | `Math.random()` (6 digits)     | 6 digits | 10 minutes | Yes (upsert) |
| Invite Token    | `crypto.randomUUID()`          | 36 chars | No expiry  | Yes        |
| Share Link      | `crypto.randomUUID()`          | 36 chars | Configurable | No       |

---

## Role-Based Access Control (RBAC)

The platform implements a multi-tier RBAC system defined across two files.

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      PLATFORM LEVEL                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PLATFORM OWNER                                          │   │
│  │  Defined by: PLATFORM_OWNER_EMAILS environment variable  │   │
│  │  Permissions: Everything (god mode)                       │   │
│  │  ├── Create/delete ANY project                            │   │
│  │  ├── Approve/reject admin requests                        │   │
│  │  ├── Access all projects regardless of membership         │   │
│  │  ├── Manage all users                                     │   │
│  │  └── Full system configuration                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ADMINISTRATOR                                            │   │
│  │  Defined by: users.adminCompanies[] (status: "approved")  │   │
│  │  Scope: Company-level                                     │   │
│  │  Permissions:                                             │   │
│  │  ├── Create projects for their company                    │   │
│  │  ├── Update project metadata                              │   │
│  │  ├── Manage project team and access                       │   │
│  │  ├── Upload and manage BIM models                         │   │
│  │  └── Delete own projects                                  │   │
│  │                                                           │   │
│  │  Approval Flow:                                           │   │
│  │    User requests admin → status: "pending"                │   │
│  │    Platform Owner approves → status: "approved"           │   │
│  │    Platform Owner rejects → status: "rejected"            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      PROJECT LEVEL                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PROJECT ADMIN                                            │   │
│  │  Defined by: invites.invitee.role = "Project Admin"       │   │
│  │  Permissions:                                             │   │
│  │  ├── Edit project information                             │   │
│  │  ├── Invite and manage team members                       │   │
│  │  ├── Manage BIM models                                    │   │
│  │  ├── Manage access controls                               │   │
│  │  └── Cannot appoint other admins                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  TEAM MEMBERS (with specific roles)                       │   │
│  │  Defined by: invites.invitee.role                         │   │
│  │                                                           │   │
│  │  Available Roles:                                         │   │
│  │  ├── BIM Specialist      (view models)                    │   │
│  │  ├── BIM Coordinator     (view models)                    │   │
│  │  ├── BIM Manager         (edit models)                    │   │
│  │  ├── Designer            (view only)                      │   │
│  │  ├── Contractor          (view only)                      │   │
│  │  ├── Planner             (view only)                      │   │
│  │  └── Other               (view only)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  DEFAULT USER                                             │   │
│  │  Permissions:                                             │   │
│  │  ├── Create maintenance tickets                           │   │
│  │  ├── View own resources                                   │   │
│  │  └── Read-only access to shared data                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Package-Based Feature Gating

Team members are assigned access to specific feature packages via their invite:

| Package      | Features Unlocked                                |
| ------------ | ------------------------------------------------ |
| **BIM**      | 3D model viewing, asset extraction, annotations  |
| **IoT**      | Sensor dashboards, heatmaps, energy monitoring   |
| **FM**       | Facility management, tickets, work orders        |
| **AI**       | AI-powered features                              |
| **Database** | Database management and export features          |

### RBAC Implementation (lib/rbac.ts)

Key functions exported by the RBAC module:

```
isPlatformOwnerEmail(email)
  → Checks email against PLATFORM_OWNER_EMAILS env var
  → Returns boolean

isProjectOwner(userId, project)
  → Checks if user created the project
  → Returns boolean

isProjectAdmin(email, projectId)
  → Queries invites collection for admin role
  → Returns boolean

isApprovedAdmin(user)
  → Checks user.adminCompanies for approved status
  → Returns boolean

getUserProjectRole(email, projectId)
  → Queries invites to determine effective role
  → Returns: { role, packages, invite }

canUserAccessProject(email, projectId)
  → Checks ownership OR invite OR platform owner
  → Returns boolean
```

---

## Maintenance Role System

**File:** `app/lib/maintenance-roles.ts`

The facility management module has its own role hierarchy layered on top of the project RBAC:

### Maintenance Roles

```
TM (Team Manager / Maintenance Team)
├── Role match: regex "maintenance.*team" on invite role
├── Permissions:
│   ├── Approve/reject maintenance tickets
│   ├── Set priority and maintenance type
│   ├── Assign technicians to work orders
│   ├── Mark work orders as RESOLVED
│   ├── Request integrations
│   └── View all maintenance data

FM (Facility Manager)
├── Role match: regex "facility.*manager" on invite role
├── Permissions:
│   ├── Modify priority and type at any time
│   ├── Confirm work order resolution
│   ├── Request integrations
│   └── View all facility data

Maintainer / Technician
├── Role match: regex "maintainer|technician" on invite role
├── Permissions:
│   ├── Update assigned work order progress
│   ├── Add notes, attachments, materials
│   ├── Log time spent
│   └── Cannot approve or assign

User (Default)
├── Permissions:
│   ├── Create maintenance tickets
│   ├── View own tickets
│   └── Read-only access
```

### Maintenance State Machine

**File:** `app/lib/maintenance-state-machine.ts`

Defines valid state transitions and which roles can trigger them:

```
PENDING_APPROVAL
  ├── TM/Owner can → APPROVED
  └── TM/Owner can → REJECTED

APPROVED
  └── TM/Owner can → ASSIGNED (assign technician)

ASSIGNED
  └── Technician/TM can → IN_PROGRESS

IN_PROGRESS
  ├── TM can → RESOLVED
  ├── TM/FM can → INTEGRATION_REQUESTED
  └── Technician can update work details

INTEGRATION_REQUESTED
  └── FM reviews → back to IN_PROGRESS or RESOLVED

RESOLVED
  └── FM can → RESOLUTION_CONFIRMED (CONFIRMED)

CONFIRMED
  └── Auto → CLOSED
```

---

## Route Protection

### Middleware-Level Protection (middleware.ts)

```
Protected paths:
  /dashboard/*
  /admin/*
  /manual/*

Mechanism:
  1. Intercept request via Next.js middleware
  2. Call getToken() from next-auth/jwt
  3. If token present and valid → pass through
  4. If no token → redirect to "/" with callbackUrl query param

Public paths (no protection):
  /
  /auth/*
  /api/auth/*
  /shared/[token]
  /invite/accept
  /api/health
  /api/cron/* (uses CRON_SECRET instead)
```

### API-Level Authorization

Each protected API route performs its own authorization check:

```typescript
// Typical pattern in API route handlers:

export async function GET(req) {
  // 1. Get session
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Check project access
  const hasAccess = await canUserAccessProject(session.user.email, projectId);
  if (!hasAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Check specific role permissions (for write operations)
  const { role } = await getUserProjectRole(session.user.email, projectId);
  if (role !== "admin" && role !== "platformOwner") {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // 4. Proceed with operation
  // ...
}
```

---

## Audit Logging

**File:** `app/lib/activity-logger.ts`

### What Gets Logged

All maintenance/FM operations are recorded in the `activity_logs` collection:

| Event Type              | Example                                          |
| ----------------------- | ------------------------------------------------ |
| Ticket created          | "User X created ticket TKT-001"                 |
| Ticket approved/rejected| "TM approved ticket, set priority: HIGH"         |
| Work order created      | "System created WO from approved ticket"         |
| Technician assigned     | "TM assigned John to WO-001"                    |
| Status changed          | "Status: ASSIGNED → IN_PROGRESS by technician"  |
| Priority changed        | "FM changed priority: MEDIUM → HIGH"             |
| Resolution confirmed    | "FM confirmed resolution of WO-001"             |
| Notes added             | "Technician added closing notes"                 |

### Log Record Structure

```json
{
  "projectId": "ObjectId",
  "ticketId": "ObjectId (optional)",
  "workOrderId": "ObjectId (optional)",
  "author": "user@example.com",
  "authorRole": "TM",
  "action": "STATUS_CHANGE",
  "fieldChanged": "status",
  "oldValue": "ASSIGNED",
  "newValue": "IN_PROGRESS",
  "notes": "Starting maintenance work",
  "metadata": { ... },
  "timestamp": "2026-03-18T10:30:00.000Z",
  "createdAt": "2026-03-18T10:30:00.000Z"
}
```

---

## External API Security

### Credential Management

All external API credentials are stored as environment variables (never in code):

| Service          | Credential Storage       | Auth Method                    |
| ---------------- | ------------------------ | ------------------------------ |
| Autodesk Forge   | FORGE_CLIENT_ID/SECRET   | OAuth 2.0 client credentials   |
| Google OAuth     | GOOGLE_CLIENT_ID/SECRET  | OAuth 2.0 authorization code   |
| Google Maps      | NEXT_PUBLIC_* key        | API key (client-exposed)       |
| UbiBot           | UBIBOT_ACCOUNT_KEY       | API key (server-side)          |
| Shelly Cloud     | SHELLY_AUTH_KEY           | API key (server-side)          |
| Gmail SMTP       | SMTP_USER/PASS           | Username + app password        |

### Forge Token Management

```
Token caching strategy:
├── Generate 2-legged OAuth token
├── Cache token in memory
├── Set expiry buffer: actual_expiry - 5 minutes
├── On request: check if cached token still valid
├── If expired: generate new token
└── Client never sees Forge credentials (server-side proxy)
```

### Google Maps API Key

```
Exposure: Client-side (NEXT_PUBLIC_ prefix)
Risk level: Medium
Mitigation:
├── Restrict key to specific domains in Google Console
├── Enable only Maps JavaScript API
├── Set usage quotas
└── Monitor usage in Google Cloud Console
```

---

## File Upload Security

### Avatar Upload (POST /api/uploads/avatar)

```
Restrictions:
├── MIME type: image/* only
├── Size limit: 5 MB
├── Auth required: Yes (valid session)
├── Storage: MongoDB GridFS (avatars collection)
└── Access: Public via /api/uploads/avatar/[id]
```

### BIM Model Upload (POST /api/forge)

```
Restrictions:
├── Size limit: 50 MB
├── Auth required: Yes (implied by project access)
├── Storage: Autodesk Forge S3 bucket (signed URL upload)
├── Two upload modes:
│   ├── JSON mode: init → get signed URL → direct S3 upload → complete
│   └── Form-data mode: legacy multipart upload
└── Post-upload: translation job triggered automatically
```

### Project File Upload

```
Restrictions:
├── Auth required: Yes
├── Project access required: Yes
├── Storage: MongoDB GridFS (uploads.files)
└── Metadata stored in: files collection
```

---

## Database Security

```
Connection Security:
├── TLS 1.2+ encryption in transit (mongodb+srv://)
├── Username/password authentication
├── IP whitelist in MongoDB Atlas
├── Connection pooling via MongoDB driver
└── Environment variable for connection string

Query Security:
├── Parameterized queries (no string concatenation)
├── ObjectId usage prevents injection
├── Multi-tenant isolation via projectId filtering
├── No raw MongoDB commands exposed to client
└── All queries through application service layer

Data Security:
├── Passwords: bcrypt hashed (never stored in plain text)
├── Tokens: cryptographically generated, time-limited
├── Soft-delete: Archived data preserved for compliance
├── Audit trail: All FM operations logged
└── GridFS: Binary files stored in database (not filesystem)
```

---

## Email Security

### SMTP Configuration

```
Host:       smtp.gmail.com
Port:       465 (SSL/TLS)
Encryption: SSL/TLS (implicit)
Auth:       Username + App Password
Library:    Nodemailer v6.10.1
```

### Email Types Sent

| Email Type           | Trigger                              | Token Expiry   |
| -------------------- | ------------------------------------ | -------------- |
| OTP Verification     | Signup with OTP enabled              | 10 minutes     |
| Password Reset       | Forgot password request              | 1 hour         |
| Magic Link Login     | Email provider sign-in               | 24 hours       |
| Team Invitation      | Admin invites team member            | No expiry      |
| Ticket Notification  | Ticket status changes                | N/A            |

### Email Templates

**File:** `app/lib/email-templates.ts` (9.8KB)

HTML email templates for all notification types with responsive design and branding.

---

## Security Analysis & Recommendations

### Current Security Posture

| Category              | Score  | Status  | Notes                                    |
| --------------------- | ------ | ------- | ---------------------------------------- |
| **Authentication**    | 7/10   | Good    | 3 providers, JWT sessions                |
| **Authorization**     | 8/10   | Good    | Multi-tier RBAC, state machine           |
| **Password Security** | 5/10   | Fair    | bcrypt but weak policy                   |
| **Input Validation**  | 4/10   | Weak    | Basic checks, no schema validation       |
| **API Security**      | 5/10   | Fair    | Auth checks but no rate limiting         |
| **Data Protection**   | 6/10   | Fair    | Encrypted transit, hashed passwords      |
| **Monitoring**        | 3/10   | Weak    | Activity logs but no alerting            |

### Priority 1: Critical Recommendations

```
1. Implement Rate Limiting
   Where: /api/auth/signup, /api/auth/forgot-password, /api/auth/otp/send
   Why: Prevents brute force attacks and abuse
   How: next-rate-limit or custom middleware

2. Add Input Schema Validation
   Where: All API endpoints
   Why: Prevents injection, ensures data integrity
   How: zod library for request body validation

3. Strengthen Password Policy
   Current: 6 character minimum
   Recommended: 12+ chars, 1 uppercase, 1 number, 1 special char

4. Add Security Headers
   Where: next.config.ts
   Headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
```

### Priority 2: High Recommendations

```
5. Implement CSRF Protection
   Why: Prevent cross-site request forgery
   How: NextAuth handles for auth routes; add for custom routes

6. Add API Versioning
   Why: Safe API evolution
   How: /api/v1/ prefix

7. Fix Email Account Linking
   Current: allowDangerousEmailAccountLinking: true
   Change to: false (require explicit consent)

8. Implement 2FA/MFA
   For: At minimum, admin and platform owner accounts
   How: TOTP via authenticator apps
```

### Priority 3: Recommended Improvements

```
9. Secrets Management
   Current: Environment variables
   Better: AWS Secrets Manager, HashiCorp Vault

10. Error Monitoring
    Tool: Sentry or LogRocket
    Purpose: Catch and alert on security-relevant errors

11. File Upload Hardening
    Add: Filename sanitization, extension whitelist, virus scanning

12. Database Field Encryption
    For: PII fields, sensitive data at rest
```

---

## Related Documentation

| Document                                                          | Description                                   |
| ----------------------------------------------------------------- | --------------------------------------------- |
| [Project Overview](./PROJECT_OVERVIEW.md)                          | High-level project summary                     |
| [Backend API Reference](./BACKEND_API_REFERENCE.md)                | All API endpoints including auth routes        |
| [Database Architecture](./DATABASE_ARCHITECTURE.md)                | Auth-related collections and models            |
| [Infrastructure & DevOps](./INFRASTRUCTURE_AND_DEVOPS.md)          | Deployment and environment configuration       |

---

*Last updated: March 2026*

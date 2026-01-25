# 🔔 Maintenance Ticket Notification System - Complete Implementation

## ✅ What's Implemented

### **1. Email Notifications to Maintenance Team** 📧

**Beautiful HTML Email Template** with:
- ✅ Professional gradient header with icon
- ✅ Large ticket code display
- ✅ QR Code embedded in email (300x300px)
- ✅ Requester information (Name, Contact)
- ✅ Location details (Building, Level, Room, Space Code)
- ✅ Issue details with discipline badge
- ✅ Short & detailed descriptions
- ✅ Timestamp
- ✅ "View in Dashboard" button
- ✅ Professional footer

**Who Receives Emails:**
- All users with "Maintenance Team" role in the project
- Automatically detected from RBAC system
- Emails sent to `invitee.email` from accepted invites

---

### **2. In-App Notifications** 🔔

**Notification Icon Updates:**
- ✅ New notification appears in bell icon
- ✅ Unread count badge
- ✅ Stored in MongoDB `notifications` collection
- ✅ Synced with NotificationContext
- ✅ Persistent across sessions

**Notification Contains:**
- Type: `maintenance_ticket`
- Title: "New Maintenance Ticket"
- Message: "Ticket TKT-xxx: [description] at [location]"
- Metadata: ticketCode, projectId, ticketId, discipline, location

---

### **3. Complete Flow** 🔄

```
User Submits Ticket
    ↓
Generate QR Code (300x300px with full data)
    ↓
Save to Database (fm_tickets collection)
    ↓
Query RBAC: Find all "Maintenance Team" members
    ↓
For each Maintenance Team member:
    ├─→ Send Email (HTML with QR code)
    └─→ Create In-App Notification (MongoDB)
    ↓
Show Success Modal to User
    ↓
Maintenance Team receives:
    ├─→ Email notification
    └─→ Bell icon notification
```

---

## 📁 Files Created/Modified

### **New Files:**

1. **`/app/lib/email-templates.ts`**
   - Beautiful HTML email template
   - `generateTicketNotificationEmail()` function
   - Responsive design with inline CSS

2. **`/app/api/notifications/route.ts`**
   - GET: Fetch user notifications from database
   - PATCH: Mark notifications as read
   - Auth-protected endpoints

### **Modified Files:**

1. **`/app/api/projects/[projectId]/tickets/route.ts`**
   - Added `sendNotificationsToMaintenanceTeam()` function
   - Queries RBAC for Maintenance Team members
   - Sends emails + creates in-app notifications
   - Non-blocking (doesn't fail ticket creation if notifications fail)

2. **`/app/components/fm-panel.tsx`**
   - Passes `qrCodeDataUrl` to backend
   - Generates QR code before submission
   - Beautiful success modal (no alerts!)

3. **`/app/context/notification-context.tsx`**
   - Added `maintenance_ticket` type
   - Loads notifications from database
   - Fallback to localStorage

4. **`/app/lib/email.ts`**
   - Already existed, used for sending emails

---

## 🎨 Email Template Preview

```html
┌─────────────────────────────────────────────┐
│  🔧 New Maintenance Ticket                  │
│     Action Required                         │
├─────────────────────────────────────────────┤
│                                             │
│         Ticket Code                         │
│      TKT-1760090045602                     │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│    Scan QR Code for Quick Access           │
│         [QR CODE IMAGE]                     │
│                                             │
├─────────────────────────────────────────────┤
│  👤 Requester Information                   │
│  Name: John Doe                             │
│  Contact: john@example.com                  │
├─────────────────────────────────────────────┤
│  📍 Location                                 │
│  Building: Building A                       │
│  Level: Level 2                             │
│  Room: Room 101                             │
│  Space Code: B-2(1500)                      │
├─────────────────────────────────────────────┤
│  🔧 Issue Details                            │
│  Discipline: [Plumbing]                     │
│  Category: Plumbing Fixtures                │
│  Item: Bathtub-TOTO-Nexus [420270]         │
│  Description: Leak detected                 │
│                                             │
│  Detailed Description:                      │
│  Water leaking from bathtub drain...       │
├─────────────────────────────────────────────┤
│  Created: October 10, 2025, 3:57 PM        │
├─────────────────────────────────────────────┤
│      [View Ticket in Dashboard]             │
│  Please review and assign to technician     │
├─────────────────────────────────────────────┤
│  BIM Model Platform - Maintenance System    │
│  This is an automated notification          │
└─────────────────────────────────────────────┘
```

---

## 🔧 Technical Details

### **Database Collections:**

#### **1. fm_tickets**
```typescript
{
  _id: ObjectId,
  projectId: string,
  ticketCode: "TKT-1760090045602",
  qrCode: "TICKET:TKT-...",
  requester: { name, surname, contact },
  location: { building, level, room, spaceCode },
  intervention: { discipline, category, item, descriptions, attachments },
  status: "Open",
  createdAt: ISO string,
  updatedAt: ISO string
}
```

#### **2. notifications**
```typescript
{
  _id: ObjectId,
  userEmail: "maintenance@company.com",
  type: "maintenance_ticket",
  title: "New Maintenance Ticket",
  message: "Ticket TKT-xxx: ...",
  read: false,
  timestamp: 1760090045602,
  meta: {
    ticketCode: "TKT-xxx",
    projectId: "...",
    ticketId: "...",
    discipline: "Plumbing",
    location: "Building A - Level 2 - Room 101"
  },
  createdAt: ISO string
}
```

#### **3. invites** (existing, used for RBAC)
```typescript
{
  _id: ObjectId,
  projectId: ObjectId,
  status: "accepted",
  invitee: {
    email: "maintenance@company.com",
    role: "Maintenance Team"  // Case-insensitive regex match
  }
}
```

---

### **RBAC Query:**

```typescript
// Find all Maintenance Team members for a project
db.collection('invites').find({
  projectId: new ObjectId(projectId),
  status: 'accepted',
  'invitee.role': { $regex: /maintenance\s*team/i }
})
```

**Matches:**
- "Maintenance Team"
- "MaintenanceTeam"
- "maintenance team"
- "MAINTENANCE TEAM"

---

### **Email Sending:**

```typescript
await sendEmail(
  email,                              // To
  "🔧 New Maintenance Ticket: TKT-xxx", // Subject
  emailHtml,                          // HTML body
  // Optional: QR code as attachment (already embedded in HTML)
);
```

**SMTP Configuration** (from `.env`):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM="BIM Platform <noreply@bimplatform.com>"
```

---

### **QR Code Data:**

```json
{
  "ticketCode": "TKT-1760090045602",
  "requester": "John Doe",
  "contact": "john@example.com",
  "location": "Building A-Level 2-Room 101",
  "item": "Bathtub-TOTO-Nexus [420270]",
  "category": "Arredi fissi e mobili / Furnishing Element",
  "discipline": "Plumbing",
  "timestamp": "2025-10-10T09:57:20.602Z"
}
```

**QR Code Library:** `qrcode` npm package
**Size:** 300x300px
**Format:** Data URL (base64 PNG)

---

## 🎯 User Experience

### **For Requester (Ticket Creator):**

1. Fill form in FM Panel
2. Click "Submit Ticket"
3. ✅ Beautiful success modal appears
4. See QR code + ticket number
5. Click "Close" → Form resets

### **For Maintenance Team:**

1. **Email arrives** with:
   - Subject: "🔧 New Maintenance Ticket: TKT-xxx"
   - Beautiful HTML email
   - QR code embedded
   - All ticket details
   - "View in Dashboard" button

2. **Bell icon notification** appears:
   - Red badge with count
   - Click to see notification
   - "New Maintenance Ticket"
   - Click to view details

3. **In Dashboard:**
   - Go to FM Panel → Work Orders
   - See new ticket in list
   - Assign to technician
   - Update status

---

## 🚀 Testing

### **Test Email Notifications:**

1. **Setup SMTP** in `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-test-email@gmail.com
   SMTP_PASS=your-app-password
   MAIL_FROM="BIM Test <test@bimplatform.com>"
   ```

2. **Add Maintenance Team member:**
   - Go to project settings
   - Invite user with "Maintenance Team" role
   - User accepts invite

3. **Create ticket:**
   - Fill ticket form
   - Click "Submit Ticket"
   - Check email inbox

### **Test In-App Notifications:**

1. Login as Maintenance Team member
2. Check bell icon (should have red badge)
3. Click bell → See notification
4. Click notification → Mark as read

---

## 📊 Monitoring & Logs

**Console Logs:**
```
[Tickets] Found 3 Maintenance Team members for project 507f1f77bcf86cd799439011
[Tickets] Email sent to maintenance1@company.com
[Tickets] Email sent to maintenance2@company.com
[Tickets] Email sent to maintenance3@company.com
[Tickets] In-app notification created for maintenance1@company.com
[Tickets] In-app notification created for maintenance2@company.com
[Tickets] In-app notification created for maintenance3@company.com
[Tickets] All notifications processed
```

**Error Handling:**
- Email failures don't block ticket creation
- Notification failures don't block ticket creation
- All errors logged to console
- Uses `Promise.allSettled()` for parallel processing

---

## 🎉 Summary

**Complete notification system with:**
- ✅ Beautiful HTML emails with QR codes
- ✅ In-app bell icon notifications
- ✅ RBAC-based recipient detection
- ✅ MongoDB persistence
- ✅ Non-blocking error handling
- ✅ Professional UI (no alerts!)
- ✅ Automatic QR code generation
- ✅ Cross-session notification sync

**All Maintenance Team members receive:**
1. Email notification (HTML + QR code)
2. In-app notification (bell icon)
3. Full ticket details
4. Direct link to dashboard

**Ready for production!** 🚀

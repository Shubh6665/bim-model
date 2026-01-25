# Complete Service Request & Maintenance Flow - Verification Guide

## 🎯 Overview
This guide will walk you through testing the **complete maintenance workflow** from ticket creation to resolution, including all role-based interactions (TM, FM, Maintainer, User).

---

## 📋 Prerequisites

### 1. **Users & Roles Setup** (Already Done ✅)
You mentioned: "maine TM aur FM ko invite kar diya hai"

Verify invites in your database:
```javascript
// In MongoDB or your DB client
db.invites.find({ projectId: "YOUR_PROJECT_ID" })
```

Expected roles:
- **TM (Maintenance Team)**: Can approve/reject tickets, manage work orders, resolve tickets
- **FM (Facility Manager)**: Can modify priority/type, request integration
- **Maintainer**: Can execute maintenance cycles (PLANNED → IN_PROGRESS → CLOSE)
- **User**: Can create service requests only

---

## 🧪 Complete Testing Flow

### **PHASE 1: User Creates Service Request**

#### **Step 1: Login as Regular User**
1. Navigate to your dashboard
2. Open the **BIM Viewer** for your project
3. Click on the **FM Panel** button (usually bottom-right or menu)
4. In the sidebar, click **"Maintenance"** group
5. Click **"Create ticket"** menu item

#### **Step 2: Create a Service Request**
Fill the form:
- **Title**: "Air Conditioning Not Working in Conference Room"
- **Description**: "AC unit stopped cooling, temperature rising"
- **Category**: Select "HVAC" or "Mechanical"
- **Priority**: Leave as suggested (TM will finalize this)
- **Location**: "Building A, Floor 2, Room 204"
- **Attach files** (optional): Before photos

**Important**: When ticket is created, it goes to `status: "PENDING_APPROVAL"` (NOT directly to work order)

Expected Result:
- ✅ Ticket created with `approvalStatus: "PENDING"`
- ✅ Notification sent to TM users
- ✅ Notification sent to FM users
- ✅ Activity log entry created

---

### **PHASE 2: TM (Maintenance Team) Approves/Rejects**

#### **Step 3: Login as TM User**
1. Open FM Panel
2. Navigate to **"Work Orders"** group
3. Click **"Pending approvals"** menu item

#### **Step 4: View Pending Tickets**
You should see:
- List of tickets with `status: "PENDING_APPROVAL"`
- Three tabs: **Pending** (default), **Approved**, **Rejected**
- Each ticket shows: Title, Description, Requester, Location, Created date

#### **Step 5A: APPROVE Ticket** ✅
1. Click **"Approve"** button on the AC ticket
2. Modal opens with:
   - **Priority**: Select "High" (it's hot!)
   - **Maintenance Type**: Select "Corrective"
   - Review details
3. Click **"Approve & Create Work Order"**

Expected Result:
- ✅ Ticket status → `"APPROVED"`
- ✅ New Work Order created with:
  - `status: "OPEN"`
  - `priority: "High"`
  - `maintenanceType: "Corrective"`
  - `maintenanceCycles: []` (empty array initially)
  - `ticketId`: Reference to original ticket
- ✅ Notifications sent to:
  - FM (work order created)
  - Original requester (ticket approved)
- ✅ Activity log: "TICKET_APPROVED"

**OR**

#### **Step 5B: REJECT Ticket** ❌
1. Click **"Reject"** button
2. Modal opens requiring rejection reason
3. Enter: "Duplicate request - already being handled in WO-2024-001"
4. Click **"Reject Ticket"**

Expected Result:
- ✅ Ticket status → `"REJECTED"`
- ✅ Rejection reason saved
- ✅ Notifications sent to requester and FM
- ✅ Activity log: "TICKET_REJECTED"

---

### **PHASE 3: Maintenance Execution (State Machine)**

After approval, the work order flows through: **OPEN → PLANNED → IN_PROGRESS → CLOSE → RESOLVED**

#### **Step 6: View Ongoing Maintenance**
1. Login as **TM** or **Maintainer**
2. Navigate to **"Upcoming Activities"** group
3. Click **"Ongoing"** menu item

You should see the approved work order in **OPEN** status.

#### **Step 7: Start First Cycle (OPEN → PLANNED)**
1. Find the AC work order
2. Click **"Move to PLANNED"** button
3. Confirm action

Expected Result:
- ✅ Status changes to `"PLANNED"`
- ✅ New cycle created in `maintenanceCycles` array:
  ```javascript
  {
    cycleNumber: 1,
    status: "PLANNED",
    startedBy: "tm@example.com",
    startedByRole: "TM",
    startedAt: "2024-01-15T10:00:00Z",
    endedAt: null,
    performedBy: "tm@example.com"
  }
  ```
- ✅ Activity log: "STATUS_CHANGED" (OPEN → PLANNED)
- ✅ Notification sent to FM

#### **Step 8: Begin Work (PLANNED → IN_PROGRESS)**
1. Click **"Move to IN_PROGRESS"** button
2. Maintenance technician starts work

Expected Result:
- ✅ Status → `"IN_PROGRESS"`
- ✅ Current cycle updated:
  - `status: "IN_PROGRESS"`
  - `inProgressAt: "2024-01-15T10:30:00Z"`
  - `inProgressBy: "maintainer@example.com"`
- ✅ Activity log created
- ✅ Notification sent

#### **Step 9: Complete Work (IN_PROGRESS → CLOSE)**
1. Technician finishes AC repair
2. Click **"Move to CLOSE"** button

Expected Result:
- ✅ Status → `"CLOSE"`
- ✅ Current cycle completed:
  - `status: "CLOSE"`
  - `endedAt: "2024-01-15T12:00:00Z"`
  - `closedBy: "maintainer@example.com"`
  - `duration: 90` (minutes)
- ✅ Activity log created
- ✅ Notification sent to TM (ready for resolution)

#### **Step 10: TM Final Resolution (CLOSE → RESOLVED)**
**Only TM can mark as RESOLVED**

1. Login as **TM**
2. In "Ongoing Maintenance", find the CLOSE work order
3. Click **"Mark as RESOLVED (Final)"** button
4. Confirm action

Expected Result:
- ✅ Status → `"RESOLVED"`
- ✅ Work order fields updated:
  - `resolvedBy: "tm@example.com"`
  - `resolvedAt: "2024-01-15T13:00:00Z"`
  - `totalTimeToResolve: 180` (minutes from creation to resolution)
- ✅ Activity log: "STATUS_CHANGED" (CLOSE → RESOLVED)
- ✅ Notification sent to requester and FM
- ✅ Work order no longer appears in "Ongoing Maintenance"

---

### **PHASE 4: FM Privileges (Anytime During Flow)**

#### **Step 11: FM Modifies Priority/Type**
**FM can do this at ANY STATUS (even during IN_PROGRESS)**

1. Login as **FM**
2. Navigate to **"Work Orders"** → **"FM priority editor"**
3. Find the work order
4. Click **"Edit Priority & Type"**
5. Change:
   - Priority: "High" → "Critical"
   - Type: "Corrective" → "Emergency"
6. Click **"Save Changes"**

Expected Result:
- ✅ Fields updated in work order
- ✅ Activity log: "FM_FIELD_UPDATED"
- ✅ Notification sent to TM
- ✅ Work continues normally (state not affected)

#### **Step 12: FM Requests Integration (Reopen RESOLVED)**
**FM can reopen RESOLVED tickets for additional work**

1. Login as **FM**
2. Go to **"Work Orders"** → **"Service requests"** (or create new component for integration)
3. Find a RESOLVED work order
4. Click **"Request Integration"** (add this button to service-requests component)
5. Provide reason: "Additional HVAC maintenance needed in adjacent rooms"

Expected Result:
- ✅ Status changes: `"RESOLVED"` → `"OPEN"`
- ✅ New cycle starts (cycleNumber increments)
- ✅ Activity log: "INTEGRATION_REQUESTED"
- ✅ Notification sent to TM
- ✅ Work order reappears in "Ongoing Maintenance"

---

## 🎛️ Navigation Map

### **Main FM Panel Menu Structure**

```
📁 Assets
   ├─ Asset list
   └─ Create asset

📁 Spaces
   ├─ Space list
   └─ Create space

📁 Maintenance
   ├─ Scheduled maintenance
   └─ Create ticket ⭐ (USER STARTS HERE)

📁 Work Orders
   ├─ Pending approvals ⭐ (TM APPROVES HERE)
   ├─ Service requests (View all work orders)
   ├─ FM priority editor ⭐ (FM EDITS HERE)
   └─ Maintenance reports

📁 Upcoming Activities
   ├─ Ongoing ⭐ (TM/MAINTAINER EXECUTES HERE)
   └─ Planned
```

---

## 🔐 Role-Based Access Control

### What Each Role Can See/Do:

| Action | User | Maintainer | TM | FM |
|--------|------|------------|----|----|
| Create Ticket | ✅ | ✅ | ✅ | ✅ |
| View Pending Approvals | ❌ | ❌ | ✅ | ✅ (view only) |
| Approve/Reject Ticket | ❌ | ❌ | ✅ | ❌ |
| View Ongoing Maintenance | ❌ | ✅ | ✅ | ✅ (view only) |
| Move PLANNED→IN_PROGRESS | ❌ | ✅ | ✅ | ❌ |
| Move IN_PROGRESS→CLOSE | ❌ | ✅ | ✅ | ❌ |
| Mark RESOLVED (final) | ❌ | ❌ | ✅ | ❌ |
| Edit Priority/Type | ❌ | ❌ | ❌ | ✅ |
| Request Integration | ❌ | ❌ | ❌ | ✅ |

---

## 🧪 Testing Checklist

### ✅ Backend API Endpoints
All created in Phase 1:
- [x] `POST /api/projects/[projectId]/tickets` (with approvalStatus)
- [x] `POST /api/projects/[projectId]/tickets/[ticketId]/approve`
- [x] `POST /api/projects/[projectId]/tickets/[ticketId]/reject`
- [x] `PATCH /api/projects/[projectId]/work-orders/[orderId]/status`
- [x] `POST /api/projects/[projectId]/work-orders/[orderId]/resolve`
- [x] `PATCH /api/projects/[projectId]/work-orders/[orderId]/fm-fields`
- [x] `POST /api/projects/[projectId]/work-orders/[orderId]/integration-request`

### ✅ Frontend Components
All created in Phase 2:
- [x] `useUserRole` hook - Role detection
- [x] `PendingApprovals` component - TM approval UI
- [x] `OngoingMaintenance` component - State machine execution UI
- [x] `FMFieldEditor` component - FM priority/type editor
- [x] All components integrated into FM Panel navigation

### ✅ Database Schema
- [x] `fm_tickets` collection (with approvalStatus, priority, maintenanceType)
- [x] `fm_work_orders` collection (with maintenanceCycles array, status, ticketId)
- [x] `activity_logs` collection (all actions logged)
- [x] `invites` collection (role assignment: TM, FM, Maintainer)
- [x] `notifications` collection (all stakeholders notified)

---

## 🐛 Troubleshooting

### Issue: "Pending Approvals" menu item not visible
**Solution**: Login as TM user (check invites collection: `role: "TM"`)

### Issue: Can't move to next status
**Solution**: 
1. Check role (TM or Maintainer required)
2. Verify current status matches transition rule
3. Check console for API errors

### Issue: Work order not created after approval
**Solution**: Check:
1. Ticket had `approvalStatus: "PENDING"`
2. Priority and Type were selected
3. Check `/api/projects/[projectId]/work-orders/` GET endpoint

### Issue: Integration Request not working
**Solution**: 
1. Ensure status is exactly "RESOLVED"
2. Login as FM user
3. Check `/api/projects/[projectId]/work-orders/[orderId]/integration-request` endpoint

---

## 📊 Expected Database State After Full Flow

### fm_tickets Collection
```json
{
  "_id": "ticket-001",
  "title": "AC Not Working",
  "description": "...",
  "status": "APPROVED",
  "approvalStatus": "APPROVED",
  "priority": "High",
  "maintenanceType": "Corrective",
  "createdBy": "user@example.com",
  "createdAt": "2024-01-15T09:00:00Z",
  "approvedBy": "tm@example.com",
  "approvedAt": "2024-01-15T09:30:00Z"
}
```

### fm_work_orders Collection
```json
{
  "_id": "wo-001",
  "ticketId": "ticket-001",
  "status": "RESOLVED",
  "priority": "Critical",  // FM changed from "High"
  "maintenanceType": "Emergency",  // FM changed from "Corrective"
  "maintenanceCycles": [
    {
      "cycleNumber": 1,
      "status": "CLOSE",
      "startedBy": "tm@example.com",
      "startedAt": "2024-01-15T10:00:00Z",
      "endedAt": "2024-01-15T12:00:00Z",
      "performedBy": "maintainer@example.com",
      "duration": 120
    }
  ],
  "resolvedBy": "tm@example.com",
  "resolvedAt": "2024-01-15T13:00:00Z",
  "totalTimeToResolve": 240
}
```

### activity_logs Collection (Sample)
```json
[
  { "action": "TICKET_CREATED", "performedBy": "user@example.com", "timestamp": "..." },
  { "action": "TICKET_APPROVED", "performedBy": "tm@example.com", "timestamp": "..." },
  { "action": "WORK_ORDER_CREATED", "performedBy": "tm@example.com", "timestamp": "..." },
  { "action": "STATUS_CHANGED", "details": { "from": "OPEN", "to": "PLANNED" }, "timestamp": "..." },
  { "action": "FM_FIELD_UPDATED", "performedBy": "fm@example.com", "timestamp": "..." },
  { "action": "STATUS_CHANGED", "details": { "from": "IN_PROGRESS", "to": "CLOSE" }, "timestamp": "..." },
  { "action": "STATUS_CHANGED", "details": { "from": "CLOSE", "to": "RESOLVED" }, "timestamp": "..." }
]
```

---

## 🎉 Success Criteria

✅ User creates ticket → TM sees in Pending Approvals  
✅ TM approves → Work order created in OPEN status  
✅ TM/Maintainer transitions: OPEN→PLANNED→IN_PROGRESS→CLOSE  
✅ Each transition creates/updates maintenanceCycle  
✅ TM marks RESOLVED → Final closure  
✅ FM can modify Priority/Type at any status  
✅ FM can request integration to reopen RESOLVED  
✅ All actions logged in activity_logs  
✅ Notifications sent to relevant stakeholders  
✅ Role-based UI shows/hides buttons correctly  

---

## 📧 Next Steps

1. **Test the complete flow** using this guide
2. **Report any issues** you find during testing
3. **Request additional features** if needed:
   - Integration Request button in Service Requests component
   - Maintenance Report generator (8 sections)
   - Email notifications (currently just in-app)
   - File attachments for cycles
   - Comments/notes system

---

## 📞 Developer Notes

All components follow these patterns:
- **Role Detection**: `useUserRole(projectId)` hook
- **State Machine**: Validated in backend via `maintenance-state-machine.ts`
- **Activity Logging**: Every action logged via `activity-logger.ts`
- **Notifications**: Sent to relevant users (check notification-context)
- **Error Handling**: Try-catch with user-friendly alerts

**Backend Files**:
- Types: `app/components/fm-panel-types.ts`
- Roles: `app/lib/maintenance-roles.ts`
- State Machine: `app/lib/maintenance-state-machine.ts`
- Activity Logger: `app/lib/activity-logger.ts`
- API Routes: `app/api/projects/[projectId]/{tickets,work-orders}/...`

**Frontend Files**:
- Hook: `app/hooks/useUserRole.ts`
- Components: `app/components/fm-modules/{pending-approvals,ongoing-maintenance,fm-field-editor}.tsx`
- Navigation: `app/components/fm-panel.tsx`

---

**END OF GUIDE** 🎯

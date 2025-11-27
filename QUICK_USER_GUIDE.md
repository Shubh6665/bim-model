# Quick Reference Guide - Maintenance Platform Features

## 🎯 For Maintenance Team (TM)

### Ongoing Maintenance
**Location:** FM Panel → Work Orders → Ongoing Maintenance

**What You Can Do:**
- ✅ **View** all active work orders (OPEN, PLANNED, IN_PROGRESS, CLOSE)
- ✅ **Assign Technicians** - Add/remove multiple technicians per work order
- ✅ **Transition Status** - Move work orders through state machine (with operational notes)
- ✅ **Mark as RESOLVED** - Requires TM closing notes (mandatory)
- ✅ **View Activity Timeline** - Complete audit trail of all actions
- ✅ **View Enhanced Report** - Edit work description, safety, results, signatures

**Key Buttons:**
- 🔵 "Move to [STATUS]" - Transition work order status
- 🟢 "Mark as RESOLVED" - Final closure (CLOSE→RESOLVED)
- 🔵 "Add Technician" - Assign additional technicians
- 🟣 "📄 View Enhanced Report" - Open comprehensive maintenance report

### Enhanced Maintenance Report (TM)
**Access:** Click "📄 View Enhanced Report" on any work order

**Sections You Can Edit:**
1. **Section 3: Work Description**
   - Diagnosis / Root Cause
   - Work Performed
   - Materials / Spare Parts Used

2. **Section 4: Safety & Compliance**
   - Compliance Check Completed (checkbox)
   - PPE Used

3. **Section 6: Result & Closure**
   - Asset Condition After Work
   - Technical Notes / Recommendations

4. **Section 7: Signatures**
   - Maintenance Team Signature

5. **Section 8: Additional Comments**
   - Free-form notes

**Actions:**
- 💾 "Save Report" - Saves all edits to database
- 📄 "Generate PDF" - Creates PDF with selected sections
- ✕ "Close" - Returns to ongoing maintenance

---

## 🎯 For Facility Managers (FM)

### Service Requests View
**Location:** FM Panel → Tickets → Service Requests

**What You Can Do:**
- ✅ **View** all APPROVED tickets (READ-ONLY)
- ✅ **Edit Priority** - Change work order priority
- ✅ **Edit Maintenance Type** - Change work order type

**Layout:**
1. **Service Request Information (READ-ONLY)**
   - All ticket details displayed, no editing

2. **FM Fields Section (EDITABLE - Purple Border)**
   - Priority dropdown
   - Maintenance Type dropdown
   - "Edit Priority/Type" button

### Enhanced Maintenance Report (FM)
**Access:** Click "📄 View Enhanced Report" on any work order

**Sections You Can Edit:**
1. **Section 7: Signatures**
   - Facility Manager Signature

2. **Section 8: Additional Comments**
   - Free-form notes

**All Other Sections:** READ-ONLY for FM

---

## 🎯 For Maintainers

### Ongoing Maintenance
**Location:** FM Panel → Work Orders → Ongoing Maintenance

**What You Can Do:**
- ✅ **View** all active work orders
- ✅ **Transition Status** - Move work orders (PLANNED→IN_PROGRESS→CLOSE)
- ✅ **Add Operational Notes** - Document work during transitions
- ✅ **View Activity Timeline** - See all actions on work order
- ✅ **View Enhanced Report** - View-only access to report

**Key Buttons:**
- 🔵 "Move to [STATUS]" - Change work order status
- 🟣 "📄 View Enhanced Report" - View maintenance report (read-only)

---

## 🔔 Notification Flows

### When You'll Receive Notifications

**Maintenance Team (TM):**
- 📧 New service request created → Email + In-App
- 📧 Maintainer marks work order as CLOSE → Email (ready for review)

**Facility Managers (FM):**
- 📧 New service request created → Email + In-App

**Assigned Technicians:**
- 📧 Assigned to work order → Email notification

---

## 📊 Work Order Lifecycle

### Status Flow (State Machine)
```
OPEN
  ↓
PLANNED (TM approves)
  ↓
IN_PROGRESS (Maintainer starts work)
  ↓
CLOSE (Maintainer finishes work)
  ↓
RESOLVED (TM validates & closes)
```

### Required Actions by Status

| Status | Who Can Transition | Next Status | Required Fields |
|--------|-------------------|-------------|-----------------|
| OPEN | TM | PLANNED | - |
| PLANNED | TM/Maintainer | IN_PROGRESS | Operational Notes (optional) |
| IN_PROGRESS | Maintainer | CLOSE | Operational Notes (optional) |
| CLOSE | TM | RESOLVED | **TM Closing Notes (REQUIRED)** |

---

## 🎨 UI Color Coding

### Status Colors
- 🟢 **Green** - RESOLVED (complete)
- 🔵 **Blue** - OPEN, PLANNED (pending work)
- 🟡 **Yellow** - IN_PROGRESS (active work)
- 🔴 **Red** - CLOSE (awaiting TM review)

### Role Colors (Activity Timeline)
- 🔵 **Blue** - Maintenance Team actions
- 🟣 **Purple** - Facility Manager actions
- 🟢 **Green** - Maintainer actions

### Section Colors (Enhanced Report)
- 🔵 **Blue** - Section 1: General Information
- 🟢 **Green** - Section 2: Assignment
- 🟣 **Purple** - Section 3: Work Description
- 🟡 **Yellow** - Section 4: Safety & Compliance
- 🟠 **Orange** - Section 5: Approval Workflow
- 🔴 **Red** - Section 6: Result & Closure
- 🌸 **Pink** - Section 7: Signatures
- 🔷 **Cyan** - Section 8: Additional Comments

---

## 📝 Forms & Validation

### TM Closing Notes (REQUIRED)
- **When:** Marking work order as RESOLVED
- **Validation:** Cannot be empty
- **UI:** Green "Mark as RESOLVED" button
- **Result:** Work order transitions to RESOLVED status

### Operational Notes (OPTIONAL)
- **When:** Any status transition
- **Validation:** Optional
- **UI:** Modal with textarea before status change
- **Result:** Notes logged in activity timeline

### Technician Assignment
- **When:** TM assigns technician
- **Required Fields:** Name + Email
- **Validation:** Both fields required, email format validated
- **Result:** Email sent to technician, added to work order

### FM Field Editing
- **When:** FM edits Priority or Type
- **Fields:** Priority dropdown, Maintenance Type dropdown
- **Validation:** Must select valid values
- **Result:** Work order updated, activity logged

---

## 🔍 Activity Timeline

### What's Logged
- ✅ Ticket created
- ✅ Ticket approved/rejected
- ✅ Status changes
- ✅ Priority changes
- ✅ Type changes
- ✅ Technician assigned/removed
- ✅ Notes added
- ✅ TM closed work order
- ✅ TM resolved work order
- ✅ FM field updated
- ✅ Report updated

### How to View
1. Go to Ongoing Maintenance
2. Find work order card
3. Scroll to bottom of card
4. Click to expand activity timeline
5. See all events with icons, colors, and timestamps

---

## 💾 Enhanced Report Features

### Section Visibility Toggles
- **Location:** Top of report below header
- **Purpose:** Control which sections appear in PDF
- **How to Use:** Check/uncheck sections before generating PDF
- **Default:** All sections visible

### Save Report
- **Button:** Green "💾 Save Report" button
- **What It Saves:** All edits in editable sections
- **Validation:** Only saves fields you have permission to edit
- **Result:** Success toast notification

### Generate PDF
- **Button:** Blue "📄 Generate PDF" button
- **Behavior:** Creates PDF with only VISIBLE sections
- **Customization:** Use section toggles to control content
- **Note:** PDF generation is placeholder (future feature)

---

## 🚨 Error Handling

### Common Errors & Solutions

**"TM Closing Notes are required"**
- **Cause:** Trying to resolve without entering closing notes
- **Solution:** Enter text in the TM Closing Notes textarea

**"You don't have permission to update work order status"**
- **Cause:** Not logged in as TM or Maintainer
- **Solution:** Contact admin to verify your role

**"Failed to assign technician"**
- **Cause:** Invalid email or missing fields
- **Solution:** Check email format and fill both Name + Email

**"Only Maintenance Team or Facility Manager can update report"**
- **Cause:** User role doesn't have report editing permission
- **Solution:** Contact admin if you should have access

---

## 📞 Quick Help

### Need to...

**See all active work?**
→ Go to: Work Orders → Ongoing Maintenance

**Edit Priority/Type as FM?**
→ Go to: Tickets → Service Requests → Click "Edit Priority/Type"

**Assign a technician?**
→ Go to: Ongoing Maintenance → Find work order → Click "Add Technician"

**Mark work order complete?**
→ Go to: Ongoing Maintenance → Find CLOSE status work order → Click "Mark as RESOLVED"

**View complete audit trail?**
→ Go to: Ongoing Maintenance → Expand activity timeline at bottom of work order card

**Fill out maintenance report?**
→ Go to: Ongoing Maintenance → Click "📄 View Enhanced Report" button

---

**Last Updated:** January 2025

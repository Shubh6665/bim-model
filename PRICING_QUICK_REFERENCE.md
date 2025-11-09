# QUICK REFERENCE GUIDE
## API Pricing Summary - 1 Page Overview

**Project:** BIM Model Application  
**Date:** November 7, 2025

---

## ONE GLANCE PRICING TABLE

| API | What It Does | Free Tier | Paid Rate | Your Current Usage | Monthly Cost |
|-----|-------------|-----------|-----------|-------------------|--------------|
| **Google OAuth** | User login | Unlimited | N/A | 3,000-150,000 logins | **$0** ✅ |
| **Google Maps** | Dashboard map display | 10,000 loads | $7/1000 | 1,500-13,600 loads | **$0-25** ✅ |
| **Autodesk Forge** | BIM file conversion | Free trial (90 days) | $0.10/token | 10-100 files/month | **$0 (now) → $1-2** |
| **MongoDB** | Database storage | 512 MB (M0) | $9+ for M2+ | 200-2000 MB | **$0-25** ✅ |
| **Gmail SMTP** | Email notifications | 500/day | N/A | 100-3,500 emails | **$0** ✅ |

---

## TOTAL MONTHLY COSTS BY STAGE

```
📍 RIGHT NOW (Development):              $0/month ✅
📍 SMALL (100-200 users):                $11/month ✅
📍 MEDIUM (500-1000 users):              $55/month ✅
📍 ENTERPRISE (5000+ users):             $1,216/month ⚠️
                                        ($900 after optimization)
```

---

## WHAT YOU'RE ACTUALLY PAYING FOR

### ✅ FREE FOREVER
```
✓ Google OAuth (User login)
✓ Gmail SMTP (Emails up to 500/day)
```

### ⚠️ PAY AS YOU GROW
```
✓ Google Maps ($0 until 10K loads, then $7/1000)
✓ Autodesk Forge ($0 now, $0.10/token after trial)
✓ MongoDB ($0 for M0, $9+ when you need M2+)
```

---

## 3-YEAR COST PROJECTION

```
Year 1 (Development + Small):
├─ Months 1-3: $0 (Free trial)
├─ Months 4-12: $11/month average
├─ Year 1 Total: ~$100

Year 2 (Growing to Medium):
├─ Months 1-6: $20-30/month
├─ Months 7-12: $50-60/month
├─ Year 2 Total: ~$500

Year 3 (Enterprise):
├─ Average: $1,000-1,200/month
├─ Year 3 Total: ~$12,000-15,000
```

---

## TOP 3 COST DRIVERS

1. **Google Maps** (50-65% of total costs)
   - Caused by: Dashboard map loads
   - Optimization: Implement caching (save 30-70%)

2. **MongoDB** (30-40% of total costs)  
   - Caused by: Database tier upgrades
   - Optimization: Archive old data (delay upgrades)

3. **Autodesk Forge** (5% or less)
   - Caused by: File conversions (actually very cheap)
   - Optimization: Already optimized

---

## QUICK ACTION ITEMS

### Immediate (This Month)
- [ ] Set up Google Cloud billing alerts at $50
- [ ] Set up MongoDB billing alerts at $25
- [ ] Configure API quotas to prevent overages
- [ ] Document baseline usage patterns

### Before Scaling (3-6 Months)
- [ ] Implement map caching
- [ ] Monitor Google Maps costs weekly
- [ ] Plan database tier upgrade strategy
- [ ] Consider static maps for non-interactive displays

### When Scaling Beyond 1000 Users
- [ ] Negotiate Google Maps volume discount (10-20% off)
- [ ] Contact Autodesk for enterprise pricing
- [ ] Plan multi-region database strategy
- [ ] Implement cost allocation by department

---

## KEY FACTS TO REMEMBER

```
✅ Development is completely FREE
✅ Costs are predictable and transparent  
✅ You only pay for what you actually use
✅ Costs scale linearly with users
✅ Optimization can reduce costs 30-60%
✅ Volume discounts available at scale
✅ No surprises - all APIs have clear pricing
```

---

## COST COMPARISON: Common Scenarios

### Scenario 1: Small Team Testing (10-50 users)
```
Monthly Cost: $0-5
├─ Maps: $0 (within free tier)
├─ Database: $0 (M0 free)
├─ Autodesk: $0-2
└─ Others: $0

Verdict: TEST FOR FREE ✅
```

### Scenario 2: Growing Business (200-500 users)
```
Monthly Cost: $20-50
├─ Maps: $0-25
├─ Database: $9-25
├─ Autodesk: $2-5
└─ Others: $0

Verdict: VERY AFFORDABLE ✅
```

### Scenario 3: Established Company (1000-5000 users)
```
Monthly Cost: $200-600
├─ Maps: $100-300
├─ Database: $25-150
├─ Autodesk: $10-20
└─ Others: $5-10

Verdict: REASONABLE SCALING COSTS ✅
```

### Scenario 4: Enterprise (5000+ users)
```
Monthly Cost: $1,000-1,500 (or $600-900 with optimization)
├─ Maps: $630 (or $189 optimized)
├─ Database: $395-565
├─ Autodesk: $20-30
└─ Support: $100+

Verdict: SCALE COST JUSTIFIED BY REVENUE ✅
```

---

## MONTHLY BUDGET CHECKLIST

### For Accurate Cost Planning, Know:
- [ ] Number of expected monthly users
- [ ] Average number of map loads per user
- [ ] Number of new BIM files to process per month
- [ ] Total data volume for database
- [ ] Frequency of email notifications

### Monthly Monitoring Tasks
- [ ] Check Google Cloud billing dashboard
- [ ] Review MongoDB storage used
- [ ] Monitor Autodesk token balance
- [ ] Verify email usage below 500/day limit
- [ ] Check if any alerts were triggered

---

## CONTACT INFO FOR SUPPORT

### Billing Support
- **Google Maps**: https://mapsplatform.google.com/contact-us/
- **Autodesk Forge**: https://aps.autodesk.com/contact-sales
- **MongoDB**: support@mongodb.com
- **Gmail**: account.google.com/settings

### Cost Management Tools
- Google Cloud Console: https://console.cloud.google.com/billing
- MongoDB Atlas: https://cloud.mongodb.com
- Autodesk APS: https://aps.autodesk.com

---

## FINAL NOTE

**Costs are NOT Fixed - They Grow with Your Business**

This is actually GOOD because:
✅ You only pay when you have revenue
✅ Infrastructure scales with demand
✅ Early-stage is completely FREE
✅ Enterprise discounts available at scale

---

**For detailed breakdown of each API, see: FINAL_COMPLETE_API_PRICING.md**


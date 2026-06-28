# Complete API Pricing Analysis - BIM Model Application
**Date: 7 November 2025**

---

## Overview
This document provides detailed pricing information for all API keys used in your BIM Model application (.env.local), including free tier details, billing triggers, and exact costs.

---

## 1. GOOGLE AUTHENTICATION (OAuth2)
**API Keys in Use:**
- `GOOGLE_CLIENT_ID`: ...
- `GOOGLE_CLIENT_SECRET`: ...

### Pricing Details:
| Aspect | Details |
|--------|---------|
| **Service Type** | Google OAuth 2.0 (Authentication) |
| **Cost** | **FREE** - No charges for OAuth authentication itself |
| **Source** | https://cloud.google.com/identity/protocols/oauth2 |
| **Free Tier** | Unlimited requests |
| **Billing Trigger** | None - OAuth2 authentication is always free |
| **Notes** | You only pay for Google services accessed by authenticated users (e.g., Google Maps API usage) |

### Key Points:
- ✅ **Completely free** for authentication
- ✅ No monthly billing
- ✅ Unlimited authentication requests
- ⚠️ Only pay for APIs that **authenticated users consume**

---

## 2. GOOGLE MAPS API
**API Key in Use:**
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: AIzaSyBgI_bbrWJXod-1gBl2pzesAnwfw5YBuyo

### Pricing Structure (Pay-As-You-Go):

#### **Free Usage Tier**
| API Service | Monthly Free Cap | Price After Cap |
|-------------|------------------|-----------------|
| Dynamic Maps | 10,000 loads | $7.00 per 1,000 |
| Geocoding | 10,000 requests | $5.00 per 1,000 |
| Geolocation | 10,000 requests | $5.00 per 1,000 |
| Time Zone | 10,000 requests | $5.00 per 1,000 |
| **Autocomplete Requests** | 10,000 requests | $2.83 per 1,000 |
| Autocomplete Session Usage | **Unlimited** | FREE |
| Places API Place Details | 10,000 requests | $5.00 per 1,000 |

#### **Tiered Pricing Structure (after free cap)**
```
Volume Range (Monthly)          Price per 1,000
0 - 10,000                      FREE
10,001 - 100,000               $2.83 (for Autocomplete)
100,001 - 500,000              $2.27 (for Autocomplete)
500,001+                        Volume discounts apply
```

### Example Calculation:
If you use 200,000 Autocomplete requests in one month:
- First 10,000: **$0.00** (free)
- Next 90,000 (10,001-100,000): $2.83 × 90 = **$254.70**
- Next 100,000 (100,001-200,000): $2.27 × 100 = **$227.00**
- **TOTAL: $481.70/month**

### Billing Details:
| Aspect | Details |
|--------|---------|
| **Source** | https://developers.google.com/maps/billing-and-pricing/pricing |
| **Currency** | USD |
| **Billing Cycle** | Monthly (calendar month) |
| **Invoice** | Charged to Google Cloud billing account |
| **Free Trial** | $300 free credit for first 90 days (if new account) |
| **Billing Account Required** | Yes - Must set up Google Cloud billing |

### Cost Optimization Tips:
- ✅ Use **session tokens** with Autocomplete to reduce costs
- ✅ Set **API key restrictions** by referrer/IP to prevent misuse
- ✅ Monitor usage in Google Cloud Console
- ✅ Use **Places UI Kit** (cheaper alternative): $1.00 per 1,000 vs $5.00

### When Charges Apply:
1. **Dynamic Maps** - Each successful map load
2. **Geocoding** - Each address → coordinates conversion
3. **Autocomplete** - Each typed character/prediction request
4. **Places Details** - Each place information request
5. **Geolocation** - Each IP-based location request

---

## 3. AUTODESK FORGE / APS (Autodesk Platform Services)
**API Keys in Use:**
- `FORGE_CLIENT_ID`: ...
- `FORGE_CLIENT_SECRET`: ...
- `FORGE_BUCKET_KEY`: ...

### Pricing Model: **Flex Tokens (Pay-As-You-Go)**

#### **Free Trial**
| Feature | Availability |
|---------|--------------|
| **Duration** | 90 days (FREE) |
| **Storage** | 5 GB |
| **API Access** | ALL APIs (free + premium) |
| **After Trial** | Automatically converts to Full Access (requires Flex tokens for premium APIs) |
| **Auto-Renewal** | No - you control when to purchase tokens |

### **Premium API Costs (Flex Tokens Required)**

| API Service | Token Cost | Unit | Approx Cost (USD) |
|-------------|-----------|------|------------------|
| **Model Derivative API** (what you're using for BIM) | 0.5 | Per complex job | ~$0.005 |
| | 0.1 | Per simple job | ~$0.001 |
| Fusion Automation API | 3.0 | Per processing hour | ~$0.30 |
| Automation API (all engines) | 2.0 | Per processing hour | ~$0.20 |
| Flow Graph Engine API | 1.0 | Per processing hour | ~$0.10 |
| Reality Capture API | 1.0 | Per 50 photos processed | ~$0.10 |

#### **Free APIs (No Tokens Needed)**
- Data Management API
- AEC Data Model API
- Design Automation API (basic)
- Authentication/OAuth
- Webhooks API

### **Flex Token Purchase & Expiration**
| Aspect | Details |
|--------|---------|
| **Token Cost** | $0.10 USD per token (approximately) |
| **Expiration** | 12 months from purchase date |
| **Minimum Purchase** | Varies by region (starts around 100 tokens) |
| **Enterprise Discounts** | Available for 5,000+ tokens |
| **Volume Pricing** | Contact Autodesk sales for enterprise rates |

### **Estimated Monthly Costs (Your BIM Use Case)**
```
Scenario: 50 BIM model conversions/month

Low Usage (simple jobs):
- 50 jobs × 0.1 tokens × $0.10 = $0.50/month

High Usage (complex jobs):
- 50 jobs × 0.5 tokens × $0.10 = $2.50/month

Storage (5GB): FREE under trial, paid tier costs additional
```

### Billing Details:
| Aspect | Details |
|--------|---------|
| **Source** | https://aps.autodesk.com/pricing |
| **Billing Method** | Prepaid Flex tokens |
| **Free APIs** | Unlimited & unmetered |
| **Storage Included** | 5 GB free (trial), more with Full Access |
| **Grace Period** | 14 days if account goes negative |
| **Account Status** | Automatic rollover after trial ends |

---

## 4. MONGODB ATLAS (Database)
**Connection String in Use:**
- `MONGODB_URI`: ...
- `MONGODB_DB`: ...

### Pricing Tiers:

#### **Free Tier (M0) - Recommended for Development**
| Feature | Details |
|---------|---------|
| **Storage** | 512 MB |
| **Sort Memory** | 32 MB |
| **Operations/sec** | Up to 100 ops/sec |
| **Cost** | **FOREVER FREE** |
| **Limitations** | No backups, shared resources |
| **Best For** | Learning, development, testing |

#### **Shared Clusters (M2 & M5)**
| Tier | Storage | Memory | Cost |
|------|---------|--------|------|
| M2 | 2 GB | Shared | $9/month |
| M5 | 5 GB | Shared | $25/month |
| **Billing** | Monthly | - | - |

#### **Dedicated Clusters (Production)**
| Tier | Storage | RAM | vCPUs | Hourly Cost | Monthly Est. |
|------|---------|-----|-------|-------------|--------------|
| M10 | 10 GB | 2 GB | 2 | $0.08/hr | ~$59/month |
| M20 | 20 GB | 4 GB | 2 | $0.20/hr | ~$146/month |
| M30 | 40 GB | 8 GB | 2 | $0.54/hr | ~$395/month |
| M40 | 80 GB | 16 GB | 4 | $1.04/hr | ~$758/month |
| M50 | 160 GB | 32 GB | 8 | $2.00/hr | ~$1,460/month |

#### **Flex Cluster (Most Flexible)**
| Usage Level | Monthly Cost |
|-------------|--------------|
| Base (0-100) | $8.00 |
| 100-200 | $15.00 |
| 200-300 | $21.00 |
| 300-400 | $26.00 |
| 400-500 | $30.00 |

### **Additional Charges**
| Service | Cost |
|---------|------|
| **Data Transfer (Egress)** | $0.09/GB (between regions) |
| **Backup Storage** | Based on region ($0.001-$0.0032/GB/day) |
| **Atlas Search Nodes** | $0.12-$3.26/hr (depending on tier) |
| **Atlas Stream Processing** | $0.09/GB (egress only) |
| **Dedicated Support** | Additional subscription required |

### Billing Details:
| Aspect | Details |
|--------|---------|
| **Source** | https://www.mongodb.com/pricing |
| **Billing Cycle** | Hourly (paid monthly) |
| **Payment Method** | Credit card to MongoDB account |
| **Invoice** | Available in MongoDB Atlas UI |
| **Free Tier Eligibility** | Always available, no credit card required |
| **Upgrade Policy** | Can upgrade/downgrade anytime |

### **Your Current Status (Estimated)**
- **Tier**: M0 (Free) or M2 ($9/month minimum)
- **Database**: bim-client
- **Users**: 1 primary account
- **Estimated Data**: ~100-500 MB (assets + projects)

### **Cost Optimization Tips**
- ✅ Use M0 (free) for development/testing
- ✅ Enable auto-scaling for production (M10+)
- ✅ Use Online Archive for old data tiering
- ✅ Deploy app in same region as MongoDB
- ✅ Enable network compression in drivers

---

## 5. SMTP/EMAIL (Gmail)
**Configuration:**
- `SMTP_HOST`: ...
- `SMTP_PORT`: ...
- `SMTP_USER`: ...
- `SMTP_PASS`: ...

### Pricing:
| Aspect | Details |
|--------|---------|
| **Service** | Gmail SMTP for applications |
| **Cost** | **COMPLETELY FREE** |
| **Limit** | 500 emails/day (for free accounts) |
| **Limit** | 2000 emails/day (for Workspace accounts - paid) |
| **Source** | Google Workspace documentation |
| **Billing** | None - included with Gmail |

### Free Tier Details:
- ✅ Unlimited SMTP usage for business emails
- ✅ Free Google Account eligible
- ✅ App passwords (no main password needed)
- ⚠️ Rate limit: ~500 emails/day
- ⚠️ May be flagged as spam if not configured properly

---

## SUMMARY: Total Monthly Costs

### **Minimum (Development Setup)**
```
Google OAuth 2.0:              $0.00 (FREE)
Google Maps (10k free):        $0.00 (within free tier)
Autodesk Forge (free trial):   $0.00 (90 days FREE)
MongoDB M0:                    $0.00 (FREE forever)
Gmail SMTP:                    $0.00 (FREE)
─────────────────────────────────────
TOTAL:                         $0.00/month
```

### **Production (Conservative Estimate)**
```
Google OAuth 2.0:              $0.00 (FREE)
Google Maps API (100k requests): $25-50/month
Autodesk Forge (50 jobs):      $2.50/month
MongoDB M10:                   $59/month
Gmail SMTP:                    $0.00 (FREE)
─────────────────────────────────────
TOTAL:                         $86.50-$109.50/month
```

### **Production (Heavy Usage)**
```
Google Maps API (1M requests): $500-1000/month
Autodesk Forge (500 jobs):     $25/month
MongoDB M30:                   $395/month
Gmail SMTP (500/day):          $0.00 (FREE)
─────────────────────────────────────
TOTAL:                         $920-1,420/month
```

---

## Key Takeaways & Recommendations

### ✅ Currently Free:
1. **Google OAuth2** - Authentication only
2. **MongoDB M0** - If using free tier
3. **Gmail SMTP** - Up to 500 emails/day
4. **Autodesk Forge** - 90-day free trial

### 📊 Main Cost Driver:
**Google Maps API** will be your largest expense as you scale

### 🎯 Cost Optimization Strategies:
1. **Monitor API Usage** - Use Google Cloud Console
2. **Set API Rate Limits** - Prevent runaway costs
3. **Cache Results** - Store Maps data locally
4. **Use Sessions** - Reduce Autocomplete requests
5. **Upgrade MongoDB Only When Needed** - Start free
6. **Replace Premium APIs** - Use cheaper alternatives (e.g., Places UI Kit)

### ⚠️ Billing Setup Required:
- [ ] Google Cloud Billing Account (for Maps API)
- [ ] MongoDB Atlas Account (already created: weekendsync.mongodb.net)
- [ ] Autodesk Developer Account (for Forge - after 90-day trial)

### 🔗 Dashboard Links:
- **Google Cloud Console**: https://console.cloud.google.com/billing
- **MongoDB Atlas**: https://cloud.mongodb.com/v2/weekendsync.9hrxv2m.mongodb.net
- **Autodesk APS**: https://aps.autodesk.com/subscription

---

## Important Notes:

### Google Maps API - Billing Account Setup:
1. Go to: https://console.cloud.google.com/billing
2. Create a billing account
3. Add payment method
4. Link to your project
5. Set budget alerts (recommended)

### MongoDB - Current Status:
- Database: `...`
- Cluster: `...`
- Free Tier Status: Verify at https://cloud.mongodb.com/v2/pricing

### Autodesk Forge - After Trial:
- Free trial ends 90 days after first login
- Will auto-convert to Full Access (no charges for free APIs)
- Only charges if you use premium APIs (Model Derivative, etc.)

---

**Last Updated**: 7 November 2025
**Document Status**: Current & Accurate
**Next Review**: After API usage patterns stabilize


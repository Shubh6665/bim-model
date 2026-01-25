# 🏗️ Asset Extraction Complete Guide

## 🎯 What Are Assets in BIM Models?

**Assets** are all the physical objects/components in a building that can be:
- **Tracked** (location, condition, maintenance)
- **Managed** (lifecycle, costs, performance)
- **Maintained** (scheduled service, repairs)

### Examples of Assets:
```
🏗️ Structural: Beams, Columns, Walls, Slabs
🚪 Architectural: Doors, Windows, Stairs, Railings  
⚡ MEP: HVAC units, Electrical panels, Pumps, Pipes
🪑 Equipment: Furniture, Fixtures, Machinery
🔥 Safety: Fire extinguishers, Smoke detectors, Sprinklers
```

## 🔍 How to Check if Your BIM Model Has Assets

### Step 1: Open Browser Console
```javascript
// Check if viewer is loaded
console.log("Viewer:", window.viewer || "Not loaded");

// Check if model is loaded  
console.log("Model:", window.viewer?.model || "Not loaded");
```

### Step 2: Basic Asset Detection
```javascript
// Get total object count
if (window.viewer && window.viewer.model) {
    const model = window.viewer.model;
    const tree = model.getInstanceTree();
    if (tree) {
        console.log("Total objects in model:", tree.nodeAccess.numNodes);
        console.log("Root node ID:", tree.getRootId());
    }
}
```

### Step 3: Extract Sample Objects
```javascript
// Get first 10 objects and their properties
async function checkAssets() {
    if (!window.viewer || !window.viewer.model) {
        console.log("❌ Viewer or model not ready");
        return;
    }
    
    const model = window.viewer.model;
    const tree = model.getInstanceTree();
    
    if (!tree) {
        console.log("❌ No instance tree available");
        return;
    }
    
    console.log("🏗️ Checking first 10 objects for asset data...");
    
    for (let dbId = 1; dbId <= 10; dbId++) {
        try {
            const props = await new Promise(resolve => 
                model.getProperties(dbId, resolve)
            );
            
            if (props && props.properties) {
                console.log(`\n📦 Object ${dbId}:`, {
                    name: props.name,
                    category: props.properties.find(p => p.displayName === 'Category')?.displayValue,
                    type: props.properties.find(p => p.displayName === 'Type')?.displayValue,
                    material: props.properties.find(p => p.displayName === 'Material')?.displayValue,
                    totalProperties: props.properties.length
                });
            }
        } catch (error) {
            console.log(`❌ Error getting properties for ${dbId}:`, error);
        }
    }
}

// Run the check
checkAssets();
```

## 🔧 Asset Extraction Implementation

### 1. Basic Asset Extractor Service
```typescript
export class AssetExtractionService {
    private viewer: any;
    private model: any;
    
    constructor(viewer: any) {
        this.viewer = viewer;
        this.model = viewer?.model;
    }
    
    async extractAllAssets(): Promise<Asset[]> {
        if (!this.model) {
            throw new Error("No model loaded");
        }
        
        const tree = this.model.getInstanceTree();
        if (!tree) {
            throw new Error("No instance tree available");
        }
        
        const assets: Asset[] = [];
        const totalNodes = tree.nodeAccess.numNodes;
        
        console.log(`🔍 Scanning ${totalNodes} objects for assets...`);
        
        for (let dbId = 1; dbId < totalNodes; dbId++) {
            try {
                const asset = await this.extractAssetFromDbId(dbId);
                if (asset) {
                    assets.push(asset);
                }
            } catch (error) {
                // Skip objects that can't be processed
                continue;
            }
        }
        
        console.log(`✅ Found ${assets.length} assets`);
        return assets;
    }
    
    private async extractAssetFromDbId(dbId: number): Promise<Asset | null> {
        const props = await new Promise<any>(resolve => 
            this.model.getProperties(dbId, resolve)
        );
        
        if (!props || !props.properties) {
            return null;
        }
        
        // Filter out non-asset objects (like groups, levels, etc.)
        const category = this.getPropertyValue(props, 'Category');
        if (this.isNonAssetCategory(category)) {
            return null;
        }
        
        return {
            id: `asset-${dbId}`,
            dbId: dbId,
            name: props.name || `Object ${dbId}`,
            category: category,
            type: this.getPropertyValue(props, 'Type'),
            brand: this.getPropertyValue(props, 'Brand') || this.getPropertyValue(props, 'Manufacturer'),
            model: this.getPropertyValue(props, 'Model'),
            material: this.getPropertyValue(props, 'Material'),
            location: this.extractLocation(props),
            properties: props.properties,
            source: 'BIM_MODEL'
        };
    }
    
    private getPropertyValue(props: any, displayName: string): string | undefined {
        const prop = props.properties.find((p: any) => 
            p.displayName === displayName || 
            p.displayName.toLowerCase().includes(displayName.toLowerCase())
        );
        return prop?.displayValue;
    }
    
    private isNonAssetCategory(category: string | undefined): boolean {
        const nonAssetCategories = [
            'Levels', 'Grids', 'Views', 'Sheets', 'Schedules',
            'Project Information', 'Browser Organization'
        ];
        return !category || nonAssetCategories.some(cat => 
            category.toLowerCase().includes(cat.toLowerCase())
        );
    }
    
    private extractLocation(props: any): string {
        const level = this.getPropertyValue(props, 'Level');
        const room = this.getPropertyValue(props, 'Room');
        const phase = this.getPropertyValue(props, 'Phase Created');
        
        return [level, room, phase].filter(Boolean).join(' - ') || 'Unknown';
    }
}
```

### 2. Asset Interface
```typescript
interface Asset {
    id: string;
    dbId: number;
    name: string;
    category?: string;
    type?: string;
    brand?: string;
    model?: string;
    material?: string;
    location: string;
    properties: any[];
    source: 'BIM_MODEL' | 'MANUAL';
    
    // Extended fields for FM
    assetCode?: string;
    serialNumber?: string;
    installationDate?: string;
    condition?: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
    purchaseCost?: string;
    maintenanceCost?: string;
    lastService?: string;
    nextService?: string;
}
```

## 🧪 Testing Your BIM Model

### Console Commands to Run:

#### 1. Check Viewer Status
```javascript
console.log("Viewer ready:", !!window.viewer);
console.log("Model loaded:", !!window.viewer?.model);
console.log("Instance tree:", !!window.viewer?.model?.getInstanceTree());
```

#### 2. Count Objects by Category
```javascript
async function categorizeObjects() {
    if (!window.viewer?.model) return;
    
    const model = window.viewer.model;
    const tree = model.getInstanceTree();
    const categories = {};
    
    for (let dbId = 1; dbId < 100; dbId++) { // Check first 100
        try {
            const props = await new Promise(resolve => 
                model.getProperties(dbId, resolve)
            );
            
            const category = props?.properties?.find(p => 
                p.displayName === 'Category'
            )?.displayValue || 'Unknown';
            
            categories[category] = (categories[category] || 0) + 1;
        } catch {}
    }
    
    console.table(categories);
}

categorizeObjects();
```

#### 3. Find Specific Asset Types
```javascript
async function findAssetTypes() {
    const assetTypes = ['HVAC', 'Electrical', 'Plumbing', 'Door', 'Window'];
    
    for (const assetType of assetTypes) {
        console.log(`\n🔍 Looking for ${assetType} assets...`);
        
        for (let dbId = 1; dbId < 100; dbId++) {
            try {
                const props = await new Promise(resolve => 
                    window.viewer.model.getProperties(dbId, resolve)
                );
                
                const category = props?.properties?.find(p => 
                    p.displayName === 'Category'
                )?.displayValue || '';
                
                if (category.toLowerCase().includes(assetType.toLowerCase())) {
                    console.log(`✅ Found ${assetType}:`, {
                        dbId,
                        name: props.name,
                        category
                    });
                }
            } catch {}
        }
    }
}

findAssetTypes();
```

## 🚨 Common Issues & Solutions

### Issue 1: "viewer is not defined"
```javascript
// Solution: Make viewer globally accessible
window.viewer = viewer; // Add this in your viewer initialization
```

### Issue 2: "Cannot read properties of undefined"
```javascript
// Solution: Always check if objects exist
if (window.viewer && window.viewer.model && window.viewer.model.getInstanceTree()) {
    // Safe to proceed
}
```

### Issue 3: "Properties not loading"
```javascript
// Solution: Use Promise-based approach
const props = await new Promise((resolve, reject) => {
    model.getProperties(dbId, resolve, reject);
});
```

## 📊 Expected Results

After running the tests, you should see:
```
✅ Total objects: 1500+ (typical building)
✅ Categories found: Walls, Doors, Windows, HVAC, Electrical, etc.
✅ Properties per object: 10-50 properties
✅ Asset candidates: 200-800 objects (depends on model complexity)
```

## 🎯 Next Steps

1. **Run the console tests** to understand your model
2. **Identify asset-rich categories** in your specific model
3. **Implement the extraction service** based on findings
4. **Create category mapping** for Italian/English/IFC
5. **Build the FM panel integration**

---

## 🚀 **Step-by-Step Testing Process**

### **Step 1: Load Your BIM Model**
1. Open your BIM application
2. Load a model (any .rvt, .ifc, .dwg file)
3. Wait for model to fully load
4. Open browser console (F12)

### **Step 2: Check Viewer Status**
```javascript
// Run this first
AssetTestUtils.checkViewerStatus();
```

**Expected Output:**
```
🔍 Viewer Status Check:
- Viewer exists: true
- Model loaded: true  
- Instance tree: true
- Total objects: 1247
- Root ID: 1
```

### **Step 3: Quick Asset Test**
```javascript
// Run this to see sample assets
AssetTestUtils.quickTest();
```

**Expected Output:**
```
🧪 Running quick asset test...
📊 Model stats: {totalObjects: 1247, rootId: 1}
✅ Found 8 potential assets in first 20 objects

┌─────────┬──────┬─────────────────────────┬──────────────────┐
│ (index) │ dbId │          name           │     category     │
├─────────┼──────┼─────────────────────────┼──────────────────┤
│    0    │  3   │    'Basic Wall'         │     'Walls'      │
│    1    │  5   │    'Door - Single'      │     'Doors'      │
│    2    │  7   │    'Window - Fixed'     │    'Windows'     │
│    3    │  12  │    'HVAC Unit'          │  'Mechanical'    │
└─────────┴──────┴─────────────────────────┴──────────────────┘
```

### **Step 4: Full Asset Extraction**
```javascript
// Extract all assets from model
const service = new AssetExtractionService(window.viewer);
const allAssets = await service.extractAllAssets((progress, current, total) => {
    console.log(`Progress: ${progress.toFixed(1)}% (${current}/${total})`);
});

console.log(`Found ${allAssets.length} total assets`);
console.table(allAssets.slice(0, 10)); // Show first 10
```

### **Step 5: Category Analysis**
```javascript
// See what categories exist in your model
const stats = await service.getAssetStatistics();
console.log('📊 Assets by Category:');
console.table(stats);
```

**Expected Output:**
```
📊 Assets by Category:
┌─────────────────────────────────────┬───────┐
│              (index)                │ Values│
├─────────────────────────────────────┼───────┤
│        'Muro / Wall (IfcWall)'      │  45   │
│       'Porta / Door (IfcDoor)'      │  12   │
│     'Finestra / Window (IfcWindow)' │  18   │
│ 'Elemento Elettrico / Electrical'   │   8   │
└─────────────────────────────────────┴───────┘
```

## 🎯 **What This Tells You**

### **Rich BIM Model (Good for FM):**
```
✅ 500+ assets found
✅ Multiple categories (Walls, Doors, HVAC, Electrical)
✅ Properties include Brand, Model, Material
✅ Location information available
✅ Ready for full FM implementation
```

### **Basic BIM Model (Needs Enhancement):**
```
⚠️  50-100 assets found
⚠️  Limited categories (mostly structural)
⚠️  Basic properties only (Name, Category)
⚠️  No brand/model information
⚠️  Will need manual asset addition
```

### **Geometry-Only Model (Manual Work Required):**
```
❌ <20 assets found
❌ Only basic shapes/groups
❌ No meaningful properties
❌ Requires complete manual asset registry
❌ Focus on manual asset creation features
```

## 🔧 **Troubleshooting**

### **Problem: "viewer is not defined"**
**Solution:** Refresh page, wait for model to load completely

### **Problem: "0 assets found"**
**Possible Causes:**
- Model is geometry-only (CAD file)
- Model hasn't finished loading
- Categories are in different language
- Objects are grouped differently

**Debug Steps:**
```javascript
// Check what categories exist
for (let dbId = 1; dbId <= 50; dbId++) {
    try {
        const props = await new Promise(resolve => 
            window.viewer.model.getProperties(dbId, resolve)
        );
        console.log(`${dbId}: ${props.name} - Category: ${props.properties.find(p => p.displayName === 'Category')?.displayValue}`);
    } catch {}
}
```

### **Problem: "Properties missing"**
**Solution:** Check different property names:
```javascript
// See all available properties for an object
const props = await new Promise(resolve => 
    window.viewer.model.getProperties(5, resolve) // Try dbId 5
);
console.log('All properties:', props.properties.map(p => p.displayName));
```

## 📚 **Learning Resources**

### **Autodesk Forge Documentation:**
- [Viewer API Reference](https://forge.autodesk.com/en/docs/viewer/v7/reference/)
- [Property Database](https://forge.autodesk.com/en/docs/viewer/v7/developers_guide/viewer_basics/properties/)
- [Model Browser](https://forge.autodesk.com/en/docs/viewer/v7/developers_guide/viewer_basics/model_browser/)

### **GitHub Repositories:**
- [Forge Viewer Samples](https://github.com/Autodesk-Forge/forge-viewer-samples)
- [APS Extensions](https://github.com/autodesk-platform-services/aps-extensions)
- [DataViz Extension](https://github.com/autodesk-platform-services/aps-iot-extensions-demo)

### **Community Resources:**
- [Forge Community Forum](https://forge.autodesk.com/categories)
- [Stack Overflow - autodesk-forge](https://stackoverflow.com/questions/tagged/autodesk-forge)
- [Autodesk University Classes](https://www.autodesk.com/autodesk-university/)

---

**Remember**: Every BIM model is different. Some have rich asset data, others are just geometry. The key is to understand what YOUR specific model contains and build the FM system accordingly!

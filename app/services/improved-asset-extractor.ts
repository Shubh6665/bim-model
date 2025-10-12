/**
 * Improved Asset Extractor for Autodesk Forge Viewer
 * Uses Property Database APIs correctly as per APS documentation
 * Extracts ALL objects from BIM models properly
 */

export interface ImprovedAsset {
    id: string;
    dbId: number;
    name: string;
    category: string;
    type?: string;
    family?: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    material?: string;
    level?: string;
    room?: string;
    location: string;
    description?: string;
    
    // All properties for detailed viewing
    properties: Array<{
        displayName: string;
        displayValue: any;
        displayCategory: string;
        attributeName: string;
        type: number;
        units?: string;
    }>;
    
    source: 'BIM_MODEL';
    assetClassification: 'STRUCTURAL' | 'ARCHITECTURAL' | 'MEP' | 'FURNITURE' | 'EQUIPMENT' | 'OTHER';
}

export class ImprovedAssetExtractor {
    private viewer: any;
    private model: any;
    
    // Objects to EXCLUDE (metadata, not real assets)
    private readonly EXCLUDE_PATTERNS = [
        // Revit metadata
        /^revit/i,
        /project\s+information/i,
        /browser\s+organization/i,
        // View elements
        /^view/i,
        /^sheet/i,
        /^schedule/i,
        /^legend/i,
        /^section/i,
        /^elevation/i,
        // Annotation elements
        /^tag/i,
        /^annotation/i,
        /^dimension/i,
        /^text\s*note/i,
        /^callout/i,
        /^symbol/i,
        // Reference elements
        /^grid/i,
        /^level/i,
        /^scope\s+box/i,
        /^reference\s+plane/i,
        /^workset/i,
        /^design\s+option/i,
        /^phase/i,
        // Groups (we want individual elements, not groups)
        /^model\s+group/i,
        /^detail\s+group/i,
        /^group/i,
    ];
    
    // Categories that indicate real building assets
    private readonly ASSET_CATEGORIES = {
        STRUCTURAL: [
            'wall', 'walls', 'muro', 'muri',
            'structural framing', 'beam', 'beams', 'trave', 'travi',
            'structural column', 'column', 'columns', 'colonna', 'colonne',
            'floor', 'floors', 'slab', 'slabs', 'solaio', 'solai',
            'foundation', 'footing', 'pile',
            'structural foundation'
        ],
        ARCHITECTURAL: [
            'door', 'doors', 'porta', 'porte',
            'window', 'windows', 'finestra', 'finestre',
            'stair', 'stairs', 'railing', 'scala', 'scale',
            'roof', 'roofs', 'tetto', 'tetti',
            'ceiling', 'ceilings', 'soffitto',
            'curtain wall', 'curtain panel',
            'ramp', 'rampa'
        ],
        MEP: [
            'mechanical equipment', 'air terminal',
            'duct', 'ducts', 'pipe', 'pipes',
            'electrical equipment', 'electrical fixture',
            'lighting fixture', 'light fixture',
            'plumbing fixture', 'plumbing',
            'sprinkler', 'fire alarm',
            'cable tray', 'conduit'
        ],
        FURNITURE: [
            'furniture', 'casework',
            'furniture system'
        ],
        EQUIPMENT: [
            'specialty equipment',
            'mechanical equipment',
            'electrical equipment',
            'plumbing equipment'
        ]
    };

    constructor(viewer: any) {
        this.viewer = viewer;
        this.model = viewer?.model;
    }

    /**
     * Extract ALL assets from the model using PropertyDatabase API
     * This is the CORRECT way according to APS documentation
     */
    public async extractAllAssets(
        progressCallback?: (progress: number, found: number, total: number) => void
    ): Promise<ImprovedAsset[]> {
        if (!this.model) {
            throw new Error("No model loaded");
        }

        console.log("🔧 [Improved Extractor] Starting extraction using PropertyDatabase API...");
        
        const pdb = this.model.getPropertyDb();
        if (!pdb) {
            throw new Error("Property database not available");
        }

        // Step 1: Get all object IDs using PropertyDatabase
        const allDbIds = await this.getAllObjectIds();
        console.log(`📊 [Improved Extractor] Found ${allDbIds.length} total objects in model`);

        // Step 2: Get bulk properties for all objects (more efficient than one-by-one)
        const propertyResults = await this.getBulkPropertiesForAll(allDbIds);
        console.log(`📦 [Improved Extractor] Retrieved properties for ${propertyResults.length} objects`);

        // Step 3: Filter and convert to assets
        const assets: ImprovedAsset[] = [];
        let processed = 0;

        for (const propResult of propertyResults) {
            processed++;
            
            // Report progress
            if (progressCallback && processed % 50 === 0) {
                progressCallback((processed / propertyResults.length) * 100, assets.length, processed);
            }

            const asset = this.convertToAsset(propResult);
            if (asset) {
                assets.push(asset);
            }
        }

        console.log(`✅ [Improved Extractor] Extracted ${assets.length} real assets from ${allDbIds.length} objects`);
        
        return assets;
    }

    /**
     * Get all object IDs from the model using PropertyDatabase
     */
    private async getAllObjectIds(): Promise<number[]> {
        return new Promise((resolve, reject) => {
            const pdb = this.model.getPropertyDb();
            
            // Use executeUserFunction to run code in the worker thread where PropertyDb lives
            pdb.executeUserFunction((pdb: any) => {
                const dbIds: number[] = [];
                
                // enumObjects iterates over all objects in the property database
                pdb.enumObjects((dbId: number) => {
                    dbIds.push(dbId);
                });
                
                return dbIds;
            }).then((dbIds: number[]) => {
                resolve(dbIds);
            }).catch((error: any) => {
                console.error("Error getting object IDs:", error);
                reject(error);
            });
        });
    }

    /**
     * Get bulk properties for all objects efficiently
     */
    private async getBulkPropertiesForAll(dbIds: number[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            // Use getBulkProperties2 for better performance
            this.model.getBulkProperties2(
                dbIds,
                {
                    propFilter: [], // Empty array means get ALL properties
                    ignoreHidden: false, // Include all objects
                    needsExternalId: false
                },
                (results: any[]) => {
                    resolve(results);
                },
                (error: any) => {
                    console.error("Error getting bulk properties:", error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Convert property result to Asset object
     */
    private convertToAsset(propResult: any): ImprovedAsset | null {
        const dbId = propResult.dbId;
        const name = propResult.name || `Object ${dbId}`;
        const properties = propResult.properties || [];
        
        // Extract key properties
        const category = this.getPropertyValue(properties, 'Category') || 'Unknown';
        const type = this.getPropertyValue(properties, 'Type') || 
                    this.getPropertyValue(properties, 'Type Name') ||
                    this.getPropertyValue(properties, 'Family');
        
        // Check if this is a real asset or metadata/annotation
        if (this.shouldExcludeObject(name, category, properties)) {
            return null;
        }

        // Classify the asset
        const classification = this.classifyAsset(name, category, type);
        
        // Extract additional properties
        const brand = this.getPropertyValue(properties, 'Brand') || 
                     this.getPropertyValue(properties, 'Manufacturer');
        const model = this.getPropertyValue(properties, 'Model') ||
                     this.getPropertyValue(properties, 'Type Mark');
        const serialNumber = this.getPropertyValue(properties, 'Serial Number') ||
                           this.getPropertyValue(properties, 'Mark');
        const material = this.getPropertyValue(properties, 'Material') ||
                       this.getPropertyValue(properties, 'Structural Material');
        const level = this.getPropertyValue(properties, 'Level') ||
                     this.getPropertyValue(properties, 'Reference Level') ||
                     this.getPropertyValue(properties, 'Base Level');
        const room = this.getPropertyValue(properties, 'Room') ||
                    this.getPropertyValue(properties, 'Space') ||
                    this.getPropertyValue(properties, 'To Room') ||
                    this.getPropertyValue(properties, 'From Room');
        const description = this.getPropertyValue(properties, 'Description') ||
                          this.getPropertyValue(properties, 'Comments') ||
                          this.getPropertyValue(properties, 'Type Comments');
        const family = this.getPropertyValue(properties, 'Family') ||
                      this.getPropertyValue(properties, 'Family Name');

        // Build location string
        const locationParts = [
            this.getPropertyValue(properties, 'Building'),
            level,
            room
        ].filter(Boolean);
        const location = locationParts.length > 0 ? locationParts.join(' - ') : 'Unknown Location';

        // Get model GUID for stable ID
        const modelGuid = this.getModelGuid();
        
        return {
            id: `asset-${modelGuid}-${dbId}`,
            dbId,
            name,
            category,
            type,
            family,
            brand,
            model,
            serialNumber,
            material,
            level,
            room,
            location,
            description,
            properties: properties.map((p: any) => ({
                displayName: p.displayName || '',
                displayValue: p.displayValue,
                displayCategory: p.displayCategory || '',
                attributeName: p.attributeName || '',
                type: p.type || 0,
                units: p.units
            })),
            source: 'BIM_MODEL',
            assetClassification: classification
        };
    }

    /**
     * Check if object should be excluded (not a real asset)
     */
    private shouldExcludeObject(name: string, category: string, properties: any[]): boolean {
        const searchText = `${name} ${category}`.toLowerCase();
        
        // Check against exclude patterns
        for (const pattern of this.EXCLUDE_PATTERNS) {
            if (pattern.test(searchText)) {
                return true;
            }
        }

        // Additional heuristics: exclude if no physical properties
        const hasPhysicalProps = properties.some(p => {
            const pName = (p.displayName || '').toLowerCase();
            return pName.includes('volume') || 
                   pName.includes('area') || 
                   pName.includes('length') ||
                   pName.includes('width') ||
                   pName.includes('height') ||
                   pName.includes('material');
        });

        // If it has no physical properties and is not in our asset categories, exclude it
        if (!hasPhysicalProps) {
            const isKnownAsset = this.isKnownAssetCategory(category);
            if (!isKnownAsset) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if category is in our known asset categories
     */
    private isKnownAssetCategory(category: string): boolean {
        const catLower = category.toLowerCase();
        for (const keywords of Object.values(this.ASSET_CATEGORIES)) {
            if (keywords.some(kw => catLower.includes(kw.toLowerCase()))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Classify asset type
     */
    private classifyAsset(name: string, category: string, type?: string): 'STRUCTURAL' | 'ARCHITECTURAL' | 'MEP' | 'FURNITURE' | 'EQUIPMENT' | 'OTHER' {
        const searchText = `${name} ${category} ${type || ''}`.toLowerCase();
        
        for (const [classification, keywords] of Object.entries(this.ASSET_CATEGORIES)) {
            for (const keyword of keywords) {
                if (searchText.includes(keyword.toLowerCase())) {
                    return classification as 'STRUCTURAL' | 'ARCHITECTURAL' | 'MEP' | 'FURNITURE' | 'EQUIPMENT' | 'OTHER';
                }
            }
        }
        
        return 'OTHER';
    }

    /**
     * Get property value by name
     */
    private getPropertyValue(properties: any[], name: string): string | undefined {
        const prop = properties.find(p => 
            (p.displayName || '').toLowerCase() === name.toLowerCase() ||
            (p.displayName || '').toLowerCase().includes(name.toLowerCase()) ||
            (p.attributeName || '').toLowerCase() === name.toLowerCase()
        );
        return prop?.displayValue?.toString();
    }

    /**
     * Get stable model GUID
     */
    private getModelGuid(): string {
        try {
            const guid = this.model?.getData?.()?.guid;
            if (guid && typeof guid === 'string') return guid;
            const mid = this.model?.id;
            return (mid != null) ? String(mid) : 'm';
        } catch {
            const mid = this.model?.id;
            return (mid != null) ? String(mid) : 'm';
        }
    }

    /**
     * Get detailed statistics about extracted assets
     */
    public async getStatistics(): Promise<{
        total: number;
        byClassification: Record<string, number>;
        byCategory: Record<string, number>;
    }> {
        const assets = await this.extractAllAssets();
        
        const byClassification: Record<string, number> = {};
        const byCategory: Record<string, number> = {};

        assets.forEach(asset => {
            byClassification[asset.assetClassification] = (byClassification[asset.assetClassification] || 0) + 1;
            byCategory[asset.category] = (byCategory[asset.category] || 0) + 1;
        });

        return {
            total: assets.length,
            byClassification,
            byCategory
        };
    }
}

// Testing Utilities
export const ImprovedAssetExtractorUtils = {
    /**
     * Test the improved extractor
     */
    async testExtraction(): Promise<ImprovedAsset[]> {
        const viewer = (window as any).viewer;
        if (!viewer?.model) {
            console.error("❌ Viewer or model not ready");
            return [];
        }

        console.log("🔧 Testing Improved Asset Extraction...");
        const extractor = new ImprovedAssetExtractor(viewer);

        try {
            const assets = await extractor.extractAllAssets((progress, found, total) => {
                if (total % 100 === 0) {
                    console.log(`📊 Progress: ${progress.toFixed(1)}% - Found ${found} assets out of ${total} objects`);
                }
            });

            console.log(`✅ Extraction Complete!`);
            console.log(`📦 Total Assets Found: ${assets.length}`);

            // Show sample assets
            console.log("\n🎯 Sample Assets (first 10):");
            console.table(assets.slice(0, 10).map(a => ({
                dbId: a.dbId,
                name: a.name,
                category: a.category,
                type: a.type,
                classification: a.assetClassification,
                location: a.location
            })));

            // Show statistics
            const stats = await extractor.getStatistics();
            console.log("\n📊 Asset Statistics:");
            console.log("By Classification:", stats.byClassification);
            console.log("\nBy Category (top 10):");
            const topCategories = Object.entries(stats.byCategory)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10);
            console.table(Object.fromEntries(topCategories));

            return assets;

        } catch (error) {
            console.error("❌ Extraction failed:", error);
            return [];
        }
    },

    /**
     * Compare old vs new extractor
     */
    async compareExtractors(): Promise<void> {
        const viewer = (window as any).viewer;
        if (!viewer?.model) {
            console.error("❌ Viewer not ready");
            return;
        }

        console.log("🔄 Comparing Old vs New Extractor...\n");

        // Test new extractor
        console.log("1️⃣ Testing IMPROVED Extractor:");
        const improved = new ImprovedAssetExtractor(viewer);
        const improvedAssets = await improved.extractAllAssets();
        console.log(`✅ Improved: ${improvedAssets.length} assets\n`);

        // Test old extractor if available
        const UniversalAssetExtractor = (window as any).UniversalAssetExtractor;
        if (UniversalAssetExtractor) {
            console.log("2️⃣ Testing OLD Universal Extractor:");
            const old = new UniversalAssetExtractor(viewer);
            const oldAssets = await old.extractUniversalAssets();
            console.log(`✅ Old: ${oldAssets.length} assets\n`);

            console.log(`📊 Difference: ${improvedAssets.length - oldAssets.length} more assets with improved extractor`);
        }

        console.log("\n💡 Use: ImprovedAssetExtractorUtils.testExtraction() for detailed results");
    }
};

// Make available globally for console testing
if (typeof window !== 'undefined') {
    (window as any).ImprovedAssetExtractorUtils = ImprovedAssetExtractorUtils;
    (window as any).ImprovedAssetExtractor = ImprovedAssetExtractor;
}

/**
 * Universal Asset Extractor
 * Works with ANY BIM model - Revit, IFC, AutoCAD, Navisworks, etc.
 * Intelligently identifies real building assets vs metadata
 */

export interface UniversalAsset {
    id: string;
    dbId: number;
    name: string;
    category: string;
    type?: string;
    family?: string;
    material?: string;
    level?: string;
    room?: string;
    location: string;
    properties: any[];
    source: 'BIM_MODEL';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW'; // How confident we are this is a real asset
    assetType: 'STRUCTURAL' | 'ARCHITECTURAL' | 'MEP' | 'FURNITURE' | 'EQUIPMENT' | 'OTHER';
}

export class UniversalAssetExtractor {
    private viewer: any;
    private model: any;
    
    // Universal patterns for identifying real building assets
    private readonly ASSET_CATEGORIES = {
        // Structural Elements
        STRUCTURAL: [
            'wall', 'muro', 'walls', 'muri',
            'beam', 'trave', 'beams', 'travi', 'structural framing',
            'column', 'colonna', 'columns', 'colonne', 'pillar',
            'slab', 'solaio', 'slabs', 'solai', 'floor',
            'foundation', 'fondazione', 'footing', 'pile'
        ],
        
        // Architectural Elements  
        ARCHITECTURAL: [
            'door', 'porta', 'doors', 'porte',
            'window', 'finestra', 'windows', 'finestre',
            'stair', 'scala', 'stairs', 'scale', 'ramp', 'rampa',
            'roof', 'tetto', 'roofs', 'tetti', 'ceiling',
            'curtain wall', 'facciata continua', 'glazing'
        ],
        
        // MEP (Mechanical, Electrical, Plumbing)
        MEP: [
            'hvac', 'mechanical', 'air terminal', 'duct', 'pipe',
            'electrical', 'elettrico', 'lighting', 'illuminazione',
            'plumbing', 'idraulico', 'fixture', 'faucet',
            'fire protection', 'sprinkler', 'alarm',
            'equipment', 'apparecchio', 'device', 'terminal'
        ],
        
        // Furniture & Equipment
        FURNITURE: [
            'furniture', 'arredo', 'chair', 'table', 'desk',
            'cabinet', 'shelf', 'bed', 'sofa',
            'furnishing', 'elemento arredo'
        ],
        
        // Specialized Equipment
        EQUIPMENT: [
            'elevator', 'ascensore', 'escalator',
            'generator', 'pump', 'boiler', 'chiller',
            'transformer', 'panel', 'unit', 'system'
        ]
    };
    
    // Categories to EXCLUDE (metadata, not real assets)
    private readonly EXCLUDE_CATEGORIES = [
        'revit document', 'revit level', 'revit view', 'revit sheet', 
        'revit group', 'revit category', 'project information',
        'browser organization', 'levels', 'grids', 'views', 'sheets',
        'schedules', 'legend', 'detail', 'section', 'elevation',
        'materials', 'phases', 'workset', 'design option',
        'scope box', 'reference plane', 'model group', 'detail group',
        'area', 'room', 'space', 'zone', 'mass', 'generic model'
    ];

    constructor(viewer: any) {
        this.viewer = viewer;
        this.model = viewer?.model;
    }

    /**
     * Extract all real building assets from any BIM model
     */
    public async extractUniversalAssets(
        progressCallback?: (progress: number, found: number, total: number) => void
    ): Promise<UniversalAsset[]> {
        if (!this.model) {
            throw new Error("No model loaded");
        }

        const tree = this.model.getInstanceTree();
        if (!tree) {
            throw new Error("No instance tree available");
        }

        console.log("🌍 [Universal Extractor] Starting extraction from any BIM model type...");
        
        const assets: UniversalAsset[] = [];
        const totalNodes = tree.nodeAccess.numNodes;
        let processed = 0;

        // Process in batches to avoid UI blocking
        for (let dbId = 1; dbId < totalNodes; dbId++) {
            try {
                const asset = await this.analyzeObject(dbId);
                if (asset) {
                    assets.push(asset);
                }
            } catch (error) {
                // Skip problematic objects
            }
            
            processed++;
            if (progressCallback && processed % 50 === 0) {
                progressCallback((processed / totalNodes) * 100, assets.length, processed);
            }
        }

        // Sort by confidence and asset type
        assets.sort((a, b) => {
            if (a.confidence !== b.confidence) {
                const confidenceOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
                return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
            }
            return a.assetType.localeCompare(b.assetType);
        });

        console.log(`✅ [Universal Extractor] Found ${assets.length} real assets out of ${totalNodes} objects`);
        return assets;
    }

    /**
     * Analyze a single object to determine if it's a real building asset
     */
    private async analyzeObject(dbId: number): Promise<UniversalAsset | null> {
        try {
            const props = await this.getObjectProperties(dbId);
            if (!props || !props.properties || props.properties.length === 0) {
                return null;
            }

            // Extract key properties
            const name = props.name || `Object ${dbId}`;
            const category = this.getPropertyValue(props, 'Category') || 'Unknown';
            const type = this.getPropertyValue(props, 'Type') || 
                        this.getPropertyValue(props, 'Family') ||
                        this.getPropertyValue(props, 'Type Name');
            
            // Check if this is a real asset or metadata
            const analysis = this.analyzeAssetPotential(name, category, type, props.properties);
            
            if (analysis.confidence === 'LOW' && !analysis.isAsset) {
                return null; // Skip non-assets
            }

            return {
                id: `universal-${dbId}`,
                dbId,
                name,
                category: this.mapToStandardCategory(category),
                type,
                family: this.getPropertyValue(props, 'Family'),
                material: this.getPropertyValue(props, 'Material') || 
                         this.getPropertyValue(props, 'Structural Material'),
                level: this.getPropertyValue(props, 'Level') || 
                      this.getPropertyValue(props, 'Reference Level'),
                room: this.getPropertyValue(props, 'Room') || 
                     this.getPropertyValue(props, 'Space'),
                location: this.extractLocation(props),
                properties: props.properties,
                source: 'BIM_MODEL',
                confidence: analysis.confidence,
                assetType: analysis.assetType
            };

        } catch (error) {
            return null;
        }
    }

    /**
     * Analyze if an object is likely a real building asset
     */
    private analyzeAssetPotential(
        name: string, 
        category: string, 
        type: string | undefined, 
        properties: any[]
    ): { isAsset: boolean; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; assetType: 'STRUCTURAL' | 'ARCHITECTURAL' | 'MEP' | 'FURNITURE' | 'EQUIPMENT' | 'OTHER' } {
        
        const searchText = `${name} ${category} ${type || ''}`.toLowerCase();
        
        // First check: Exclude obvious non-assets
        if (this.EXCLUDE_CATEGORIES.some(exclude => searchText.includes(exclude))) {
            return { isAsset: false, confidence: 'LOW', assetType: 'OTHER' };
        }

        // Check against asset categories
        let bestMatch: { type: 'STRUCTURAL' | 'ARCHITECTURAL' | 'MEP' | 'FURNITURE' | 'EQUIPMENT' | 'OTHER'; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; score: number } = { 
            type: 'OTHER', 
            confidence: 'LOW', 
            score: 0 
        };

        for (const [assetType, keywords] of Object.entries(this.ASSET_CATEGORIES)) {
            for (const keyword of keywords) {
                if (searchText.includes(keyword.toLowerCase())) {
                    const score = keyword.length; // Longer matches are more specific
                    if (score > bestMatch.score) {
                        bestMatch = {
                            type: assetType as 'STRUCTURAL' | 'ARCHITECTURAL' | 'MEP' | 'FURNITURE' | 'EQUIPMENT' | 'OTHER',
                            confidence: score > 5 ? 'HIGH' : 'MEDIUM',
                            score
                        };
                    }
                }
            }
        }

        // Additional heuristics
        if (bestMatch.score === 0) {
            // Check if object has physical properties (likely a real asset)
            const hasPhysicalProps = properties.some(p => 
                ['material', 'volume', 'area', 'length', 'width', 'height', 'thickness']
                    .some(physical => p.displayName?.toLowerCase().includes(physical))
            );
            
            if (hasPhysicalProps) {
                bestMatch = { type: 'OTHER', confidence: 'MEDIUM', score: 1 };
            }
        }

        return {
            isAsset: bestMatch.score > 0,
            confidence: bestMatch.confidence,
            assetType: bestMatch.type as 'STRUCTURAL' | 'ARCHITECTURAL' | 'MEP' | 'FURNITURE' | 'EQUIPMENT' | 'OTHER'
        };
    }

    /**
     * Map category to standardized Italian/English/IFC format
     */
    private mapToStandardCategory(category: string): string {
        const categoryLower = category.toLowerCase();
        
        // Map common categories to Italian/English/IFC format
        const mappings: Record<string, string> = {
            'walls': 'Muro / Wall (IfcWall)',
            'wall': 'Muro / Wall (IfcWall)',
            'doors': 'Porta / Door (IfcDoor)',
            'door': 'Porta / Door (IfcDoor)',
            'windows': 'Finestra / Window (IfcWindow)',
            'window': 'Finestra / Window (IfcWindow)',
            'beams': 'Trave / Beam (IfcBeam)',
            'beam': 'Trave / Beam (IfcBeam)',
            'columns': 'Colonna / Column (IfcColumn)',
            'column': 'Colonna / Column (IfcColumn)',
            'slabs': 'Solaio / Slab (IfcSlab)',
            'slab': 'Solaio / Slab (IfcSlab)',
            'floors': 'Solaio / Slab (IfcSlab)',
            'floor': 'Solaio / Slab (IfcSlab)',
            'roofs': 'Tetto / Roof (IfcRoof)',
            'roof': 'Tetto / Roof (IfcRoof)',
            'stairs': 'Rampa Scala / StairFlight (IfcStairFlight)',
            'stair': 'Rampa Scala / StairFlight (IfcStairFlight)',
            'mechanical': 'Elemento Elettrico / Electrical Element (IfcElectricalElement)',
            'electrical': 'Elemento Elettrico / Electrical Element (IfcElectricalElement)',
            'plumbing': 'Elemento Flusso Distributivo / Distribution Flow Element (IfcDistributionFlowElement)',
            'furniture': 'Arredi fissi e mobili / Furnishing Element (IfcFurnishingElement)',
            'equipment': 'Materiale Elettrico / Equipment Element (IfcEquipmentElement)'
        };

        for (const [key, value] of Object.entries(mappings)) {
            if (categoryLower.includes(key)) {
                return value;
            }
        }

        return category; // Return original if no mapping found
    }

    /**
     * Get object properties with error handling
     */
    private async getObjectProperties(dbId: number): Promise<any> {
        return new Promise((resolve) => {
            this.model.getProperties(dbId, resolve, () => resolve(null));
        });
    }

    /**
     * Get property value by display name
     */
    private getPropertyValue(props: any, displayName: string): string | undefined {
        const prop = props.properties.find((p: any) => 
            p.displayName?.toLowerCase() === displayName.toLowerCase() ||
            p.displayName?.toLowerCase().includes(displayName.toLowerCase())
        );
        return prop?.displayValue?.toString();
    }

    /**
     * Extract location information
     */
    private extractLocation(props: any): string {
        const level = this.getPropertyValue(props, 'Level') || 
                     this.getPropertyValue(props, 'Reference Level');
        const room = this.getPropertyValue(props, 'Room') || 
                    this.getPropertyValue(props, 'Space');
        const building = this.getPropertyValue(props, 'Building');

        const locationParts = [building, level, room].filter(Boolean);
        return locationParts.length > 0 ? locationParts.join(' - ') : 'Unknown Location';
    }

    /**
     * Get asset statistics by type and confidence
     */
    public async getUniversalStatistics(): Promise<{
        byType: Record<string, number>;
        byConfidence: Record<string, number>;
        byCategory: Record<string, number>;
    }> {
        const assets = await this.extractUniversalAssets();
        
        const byType: Record<string, number> = {};
        const byConfidence: Record<string, number> = {};
        const byCategory: Record<string, number> = {};

        assets.forEach(asset => {
            byType[asset.assetType] = (byType[asset.assetType] || 0) + 1;
            byConfidence[asset.confidence] = (byConfidence[asset.confidence] || 0) + 1;
            byCategory[asset.category] = (byCategory[asset.category] || 0) + 1;
        });

        return { byType, byConfidence, byCategory };
    }
}

// Universal Testing Utilities
export const UniversalTestUtils = {
    /**
     * Test the universal extractor with any BIM model
     */
    async testUniversalExtraction(): Promise<UniversalAsset[]> {
        const viewer = (window as any).viewer;
        if (!viewer?.model) {
            console.log("❌ Viewer or model not ready");
            return [];
        }

        console.log("🌍 Testing Universal Asset Extraction...");
        const extractor = new UniversalAssetExtractor(viewer);

        try {
            // Quick test with progress
            const assets = await extractor.extractUniversalAssets((progress, found, total) => {
                if (total % 100 === 0) { // Log every 100 objects
                    console.log(`📊 Progress: ${progress.toFixed(1)}% - Found ${found} assets out of ${total} objects`);
                }
            });

            console.log(`✅ Universal Extraction Complete!`);
            console.log(`📦 Total Assets Found: ${assets.length}`);

            // Show top 10 high-confidence assets
            const highConfidence = assets.filter(a => a.confidence === 'HIGH').slice(0, 10);
            if (highConfidence.length > 0) {
                console.log("🎯 Top High-Confidence Assets:");
                console.table(highConfidence.map(a => ({
                    dbId: a.dbId,
                    name: a.name,
                    category: a.category,
                    type: a.type,
                    assetType: a.assetType,
                    confidence: a.confidence
                })));
            }

            // Show statistics
            const stats = await extractor.getUniversalStatistics();
            console.log("📊 Asset Statistics:");
            console.log("By Type:", stats.byType);
            console.log("By Confidence:", stats.byConfidence);
            console.table(stats.byCategory);

            return assets;

        } catch (error) {
            console.error("❌ Universal extraction failed:", error);
            return [];
        }
    },

    /**
     * Deep dive into a specific object
     */
    async analyzeSpecificObject(dbId: number): Promise<void> {
        const viewer = (window as any).viewer;
        if (!viewer?.model) {
            console.log("❌ Viewer not ready");
            return;
        }

        try {
            const props: any = await new Promise<any>((resolve) =>
                viewer.model.getProperties(dbId, resolve)
            );

            console.log(`🔍 Deep Analysis of Object ${dbId}:`);
            console.log("Name:", props.name);
            console.log("Total Properties:", props.properties.length);
            
            console.log("\n📋 All Properties:");
            props.properties.forEach((prop: any, index: number) => {
                console.log(`${index + 1}. ${prop.displayName}: ${prop.displayValue}`);
            });

        } catch (error) {
            console.error(`❌ Failed to analyze object ${dbId}:`, error);
        }
    }
};

// Make available globally for console testing
if (typeof window !== 'undefined') {
    (window as any).UniversalTestUtils = UniversalTestUtils;
    (window as any).UniversalAssetExtractor = UniversalAssetExtractor;
}

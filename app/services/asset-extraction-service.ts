/**
 * Asset Extraction Service
 * Extracts assets from BIM models and integrates with FM Panel
 */

export interface AssetProperty {
    displayName: string;
    displayValue: string;
    type: number;
    units?: string;
}

export interface Asset {
    id: string;
    dbId: number;
    name: string;
    category?: string;
    type?: string;
    brand?: string;
    model?: string;
    material?: string;
    location: string;
    properties: AssetProperty[];
    source: 'BIM_MODEL' | 'MANUAL';
    
    // Extended FM fields
    assetCode?: string;
    serialNumber?: string;
    installationDate?: string;
    condition?: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
    purchaseCost?: string;
    maintenanceCost?: string;
    lastService?: string;
    nextService?: string;
    description?: string;
}

// Italian/English/IFC Category Mapping
export const CATEGORY_MAPPING = {
    "Trave": { english: "Beam", ifc: "IfcBeam" },
    "Elemento Generico": { english: "Building Element Proxy", ifc: "IfcBuildingElementProxy" },
    "Colonna": { english: "Column", ifc: "IfcColumn" },
    "Finitura": { english: "Covering", ifc: "IfcCovering" },
    "Facciata Continua": { english: "Curtain Wall", ifc: "IfcCurtainWall" },
    /* 'Porte' mapping already exists above; skip duplicate */
    "Fondazione": { english: "Footing", ifc: "IfcFooting" },
    "Elemento-Strutturale": { english: "Member", ifc: "IfcMember" },
    "Apertura": { english: "Opening Element", ifc: "IfcOpeningElement" },
    "Palificazione": { english: "Pile", ifc: "IfcPile" },
    "Piante": { english: "Plant", ifc: "IfcFurnishingElement" },
    "Piastra": { english: "Plate", ifc: "IfcPlate" },
    "Corrente": { english: "Railing", ifc: "IfcRailing" },
    "Rampa": { english: "Ramp", ifc: "IfcRampFlight" },
    "Elemento Rinforzo": { english: "Reinforcing Element", ifc: "IfcReinforcingElement" },
    /* 'Tetti' mapping already exists above; skip duplicate */
    "Solaio": { english: "Slab", ifc: "IfcSlab" },
    "Rampa Scala": { english: "StairFlight", ifc: "IfcStairFlight" },
    "Muro": { english: "Wall", ifc: "IfcWall" },
    "Finestra": { english: "Window", ifc: "IfcWindow" },
    "Elemento Camera Distribuzione": { english: "Distribution Chamber Element", ifc: "IfcDistributionChamberElement" },
    "Elemento Controllo Distribuzione": { english: "Distribution Control Element", ifc: "IfcDistributionControlElement" },
    "Elemento Flusso Distributivo": { english: "Distribution Flow Element", ifc: "IfcDistributionFlowElement" },
    "Elemento Elettrico": { english: "Electrical Element", ifc: "IfcElectricalElement" },
    "Apparecchio Conversione Energia": { english: "Energy Conversion Device", ifc: "IfcEnergyConversionDevice" },
    "Controllo Flusso": { english: "Flow Controller", ifc: "IfcFlowController" },
    "Raccordo": { english: "Flow Fitting", ifc: "IfcFlowFitting" },
    "Apparecchio Movimentazione Fluidi": { english: "Flow Moving Device", ifc: "IfcFlowMovingDevice" },
    "Segmento": { english: "Flow Segment", ifc: "IfcFlowSegment" },
    "Apparecchio Immagazzinamento Fluidi": { english: "Flow Storage Device", ifc: "IfcFlowStorageDevice" },
    "Terminale": { english: "Flow Terminal", ifc: "IfcFlowTerminal" },
    "Dispositivo di trattamento del flusso": { english: "Flow Treatment Device", ifc: "IfcFlowTreatmentDevice" },
    "Materiale Elettrico": { english: "Equipment Element", ifc: "IfcEquipmentElement" },
    "Elemento Trasporto": { english: "Transport Element", ifc: "IfcTransportElement" },
    "Macchine di cantiere": { english: "Construction Equipment", ifc: "IfcFurnishingElement" },
    "Arredi fissi e mobili": { english: "Furnishing Element", ifc: "IfcFurnishingElement" },
    "Terminale antincendio": { english: "Fire Suppression Terminal", ifc: "IfcFireSuppressionTerminal" }
    ,
    // Additional Revit-class mappings (added per request) - keep existing mappings untouched
    "Accessori per tubazioni": { english: "Pipe Accessories", ifc: "IfcFlowFitting" },
    "Accessori per condotti": { english: "Duct Accessories", ifc: "IfcFlowFitting" },
    "Apparecchi elettrici": { english: "Electrical Devices", ifc: "IfcElectricalElement" },
    "Apparecchi idraulici": { english: "Plumbing Fixtures", ifc: "IfcFlowTerminal" },
    "Apparecchi per illuminazione": { english: "Lighting Fixtures", ifc: "IfcLightFixture" },
    "Aree": { english: "Areas", ifc: "IfcSpace" },
    "Aree di rete strutturale": { english: "Structural Grid Areas", ifc: "IfcGrid" },
    "Aree pavimentate e costruite": { english: "Paved Areas", ifc: "IfcSite" },
    "Armatura strutturale": { english: "Structural Reinforcement", ifc: "IfcReinforcingElement" },
    "Armatura su area strutturale": { english: "Area Reinforcement", ifc: "IfcReinforcingElement" },
    "Armatura su percorso strutturale": { english: "Path Reinforcement", ifc: "IfcReinforcingElement" },
    "Arredi": { english: "Furniture", ifc: "IfcFurnishingElement" },
    "Arredi fissi": { english: "Built-in Furnishings", ifc: "IfcFurnishingElement" },
    "Attrezzatura elettrica": { english: "Electrical Equipment", ifc: "IfcElectricalElement" },
    "Attrezzatura idraulica": { english: "Plumbing Equipment", ifc: "IfcFlowTerminal" },
    "Attrezzatura meccanica": { english: "Mechanical Equipment", ifc: "IfcMechanicalEquipment" },
    "Attrezzatura medica": { english: "Medical Equipment", ifc: "IfcFurnishingElement" },
    "Attrezzatura per servizi alimentari": { english: "Food Service Equipment", ifc: "IfcEquipmentElement" },
    "Attrezzatura per servizi alimentazione": { english: "Food Service Equipment", ifc: "IfcEquipmentElement" },
    "Attrezzature speciali": { english: "Special Equipment", ifc: "IfcEquipmentElement" },
    "Bocchettoni": { english: "Hatches", ifc: "IfcOpeningElement" },
    "Canaline di fabbricazione MEP": { english: "MEP Fabrication Trays", ifc: "IfcCableCarrierSegment" },
    "Cavedi": { english: "Shafts", ifc: "IfcBuildingElementProxy" },
    "Cavi": { english: "Cables", ifc: "IfcCableCarrierSegment" },
    "Circolazione verticale": { english: "Vertical Circulation", ifc: "IfcStair" },
    "Collegamenti strutturali": { english: "Structural Connections", ifc: "IfcConnectionElement" },
    "Collocazioni condotto": { english: "Duct Locations", ifc: "IfcDistributionElement" },
    "Collocazioni tubazione": { english: "Pipe Locations", ifc: "IfcDistributionElement" },
    "Condotti di fabbricazione MEP": { english: "MEP Fabrication Ducts", ifc: "IfcDuctSegment" },
    "Condotto": { english: "Duct", ifc: "IfcDuctSegment" },
    "Condotto flessibile": { english: "Flexible Duct", ifc: "IfcDuctSegment" },
    "Contesto": { english: "Context", ifc: "IfcProject" },
    "Controsoffitti": { english: "Ceilings", ifc: "IfcCovering" },
    "Dispositivi allarme incendio": { english: "Fire Alarm Devices", ifc: "IfcAlarm" },
    "Dispositivi audiovisivi": { english: "AV Devices", ifc: "IfcDistributionControlElement" },
    "Dispositivi chiamata infermiera": { english: "Nurse Call Devices", ifc: "IfcDistributionControlElement" },
    "Dispositivi dati": { english: "Data Devices", ifc: "IfcDistributionControlElement" },
    "Dispositivi di comunicazione": { english: "Communication Devices", ifc: "IfcDistributionControlElement" },
    "Dispositivi di controllo meccanico": { english: "Mechanical Control Devices", ifc: "IfcDistributionControlElement" },
    "Dispositivi di illuminazione": { english: "Lighting Devices", ifc: "IfcLightFixture" },
    "Dispositivi di sicurezza": { english: "Safety Devices", ifc: "IfcDistributionControlElement" },
    "Dispositivi telefonici": { english: "Telephone Devices", ifc: "IfcDistributionControlElement" },
    "Elementi di dettaglio": { english: "Detail Items", ifc: "IfcBuildingElementProxy" },
    "Estintori": { english: "Fire Extinguishers", ifc: "IfcFlowTerminal" },
    "Finestre": { english: "Windows", ifc: "IfcWindow" },
    "Fondazioni strutturali": { english: "Structural Foundations", ifc: "IfcFooting" },
    "Irrigidimenti condotti di fabbricazione MEP": { english: "MEP Duct Stiffeners", ifc: "IfcDuctFitting" },
    "Irrigidimenti strutturali": { english: "Structural Stiffeners", ifc: "IfcReinforcingElement" },
    "Isolamenti condotti": { english: "Duct Insulations", ifc: "IfcBuildingElementProxy" },
    "Isolamenti tubazioni": { english: "Pipe Insulations", ifc: "IfcBuildingElementProxy" },
    "Linee": { english: "Lines", ifc: "IfcDistributionElement" },
    "Locali": { english: "Rooms", ifc: "IfcSpace" },
    "Manicotti armatura strutturale": { english: "Structural Reinforcement Sleeves", ifc: "IfcReinforcingElement" },
    "Massa": { english: "Mass", ifc: "IfcBuildingElementProxy" },
    "Modelli generici": { english: "Generic Models", ifc: "IfcBuildingElementProxy" },
    "Montanti della facciata continua": { english: "Curtain Wall Mullions", ifc: "IfcMember" },
    "Muri": { english: "Walls", ifc: "IfcWall" },
    "Pannelli di facciata continua": { english: "Curtain Wall Panels", ifc: "IfcCurtainWall" },
    "Passerelle": { english: "Walkways", ifc: "IfcBuildingElementProxy" },
    "Pavimenti": { english: "Floors", ifc: "IfcSlab" },
    "Pilastri": { english: "Pillars", ifc: "IfcColumn" },
    "Pilastri strutturali": { english: "Structural Columns", ifc: "IfcColumn" },
    "Planimetria": { english: "Plans", ifc: "IfcBuildingElementProxy" },
    "Porte": { english: "Door", ifc: "IfcDoor" },
    "Posti auto": { english: "Parking Spaces", ifc: "IfcSpace" },
    "Protezione antincendio": { english: "Fire Protection", ifc: "IfcDistributionControlElement" },
    "Raccordi condotto": { english: "Duct Fittings", ifc: "IfcFlowFitting" },
    "Raccordi passerella": { english: "Walkway Connectors", ifc: "IfcBuildingElementProxy" },
    "Raccordi tubazione": { english: "Pipe Fittings", ifc: "IfcFlowFitting" },
    "Raccordi tubo protettivo": { english: "Protective Tube Fittings", ifc: "IfcFlowFitting" },
    "Rampe inclinate": { english: "Inclined Ramps", ifc: "IfcRamp" },
    "Rinforzo rete strutturale": { english: "Structural Mesh Reinforcement", ifc: "IfcReinforcingElement" },
    "Ringhiere": { english: "Railings", ifc: "IfcRailing" },
    "Rivestimenti condotti": { english: "Duct Linings", ifc: "IfcCovering" },
    "Scale": { english: "Stairs", ifc: "IfcStair" },
    "Segnaletica": { english: "Signage", ifc: "IfcFurnishingElement" },
    "Sistemi di arredo": { english: "Furniture Systems", ifc: "IfcFurnishingElement" },
    "Sistemi di facciata continua": { english: "Curtain Wall Systems", ifc: "IfcCurtainWall" },
    "Sistemi di travi strutturali": { english: "Structural Beam Systems", ifc: "IfcBeam" },
    "Solido topografico": { english: "Topographic Solid", ifc: "IfcTopography" },
    "Staffe di fabbricazione MEP": { english: "MEP Fabrication Brackets", ifc: "IfcBuildingElementProxy" },
    "Strade": { english: "Roads", ifc: "IfcSite" },
    "Stratigrafia": { english: "Stratigraphy", ifc: "IfcBuildingElementProxy" },
    "Strutture temporanee": { english: "Temporary Structures", ifc: "IfcBuildingElementProxy" },
    "Telaio ausiliario MEP": { english: "MEP Auxiliary Frame", ifc: "IfcBuildingElementProxy" },
    "Telaio strutturale": { english: "Structural Frame", ifc: "IfcMember" },
    "Tetti": { english: "Roof", ifc: "IfcRoof" },
    "Topografia": { english: "Topography", ifc: "IfcTopography" },
    "Travi reticolari strutturali": { english: "Structural Trusses", ifc: "IfcTruss" },
    "Tubazioni": { english: "Pipes", ifc: "IfcFlowSegment" },
    "Tubazioni di fabbricazione MEP": { english: "Fabrication Pipes", ifc: "IfcFlowSegment" },
    "Tubazioni flessibili": { english: "Flexible Pipes", ifc: "IfcFlowSegment" },
    "Tubi protettivi": { english: "Protective Tubes", ifc: "IfcCovering" },
    "Vani": { english: "Voids/Compartments", ifc: "IfcSpace" },
    "Verde": { english: "Plant", ifc: "IfcPlant" },
    "Zone riscaldamento ventilazione e aria condizionata": { english: "HVAC Zones", ifc: "IfcZone" }
};

export class AssetExtractionService {
    private viewer: any;
    private model: any;
    private extractionInProgress = false;

    constructor(viewer: any) {
        this.viewer = viewer;
        this.model = viewer?.model;
    }

    /**
     * Test if viewer and model are ready for asset extraction
     */
    public isReady(): boolean {
        return !!(this.viewer && this.model && this.model.getInstanceTree());
    }

    /**
     * Get basic model statistics
     */
    public getModelStats(): { totalObjects: number; rootId: number } | null {
        if (!this.isReady()) return null;

        const tree = this.model.getInstanceTree();
        return {
            totalObjects: tree.nodeAccess.numNodes,
            rootId: tree.getRootId()
        };
    }

    /**
     * Extract all assets from the BIM model
     */
    public async extractAllAssets(
        progressCallback?: (progress: number, current: number, total: number) => void
    ): Promise<Asset[]> {
        if (!this.isReady()) {
            throw new Error("Viewer or model not ready for asset extraction");
        }

        if (this.extractionInProgress) {
            throw new Error("Asset extraction already in progress");
        }

        this.extractionInProgress = true;
        const assets: Asset[] = [];

        try {
            const tree = this.model.getInstanceTree();
            const totalNodes = tree.nodeAccess.numNodes;
            
            console.log(`🔍 Starting asset extraction from ${totalNodes} objects...`);

            // Process objects in batches to avoid blocking UI
            const batchSize = 50;
            let processed = 0;

            for (let startId = 1; startId < totalNodes; startId += batchSize) {
                const endId = Math.min(startId + batchSize, totalNodes);
                
                for (let dbId = startId; dbId < endId; dbId++) {
                    try {
                        const asset = await this.extractAssetFromDbId(dbId);
                        if (asset) {
                            assets.push(asset);
                        }
                    } catch (error) {
                        // Skip objects that can't be processed
                        console.warn(`Failed to extract asset from dbId ${dbId}:`, error);
                    }
                    
                    processed++;
                    if (progressCallback) {
                        progressCallback((processed / totalNodes) * 100, processed, totalNodes);
                    }
                }

                // Small delay to prevent UI blocking
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            console.log(`✅ Asset extraction complete. Found ${assets.length} assets out of ${totalNodes} objects`);
            return assets;

        } finally {
            this.extractionInProgress = false;
        }
    }

    /**
     * Extract asset data from a specific dbId
     */
    private async extractAssetFromDbId(dbId: number): Promise<Asset | null> {
        const props = await this.getObjectProperties(dbId);
        
        if (!props || !props.properties || props.properties.length === 0) {
            return null;
        }

        // Filter out non-asset objects
        const category = this.getPropertyValue(props, 'Category');
        if (this.isNonAssetCategory(category)) {
            return null;
        }

        // Map category to Italian/English/IFC format
        const mappedCategory = this.mapCategory(category);

        return {
            id: `bim-asset-${dbId}`,
            dbId: dbId,
            name: props.name || `Object ${dbId}`,
            category: mappedCategory,
            type: this.getPropertyValue(props, 'Type') || this.getPropertyValue(props, 'Family'),
            // Brand: Priority check for Manufacturer/Produttore attributes
            // If found, use it. Otherwise defaults to undefined (will be 'Unknown' in fm-panel)
            brand: this.getPropertyValue(props, 'Manufacturer') ||
                   this.getPropertyValue(props, 'Produttore') ||
                   this.getPropertyValue(props, 'Brand') ||
                   this.getPropertyValue(props, 'Marca') ||
                   this.getPropertyValue(props, 'Fabbricante') ||
                   this.getPropertyValue(props, 'Costruttore') ||
                   this.getPropertyValue(props, 'Make'),
            // Model: Priority check for Model/Modello attributes
            // If found, use it. Otherwise defaults to undefined (will be 'Unknown' in fm-panel)
            model: this.getPropertyValue(props, 'Model') ||
                   this.getPropertyValue(props, 'Modello') ||
                   this.getPropertyValue(props, 'Type Name') ||
                   this.getPropertyValue(props, 'Nome del tipo'),
            material: this.getPropertyValue(props, 'Material') || 
                     this.getPropertyValue(props, 'Structural Material'),
            location: this.extractLocation(props),
            properties: props.properties,
            source: 'BIM_MODEL',
            assetCode: `AUTO-${dbId}`,
            condition: 'Good', // Default condition for BIM assets
            description: this.generateDescription(props)
        };
    }

    /**
     * Get properties for a specific object
     */
    private async getObjectProperties(dbId: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.model.getProperties(dbId, (result: any) => resolve(result), (error: any) => reject(error));
        });
    }

    /**
     * Get property value by display name (case-insensitive)
     */
    private getPropertyValue(props: any, displayName: string): string | undefined {
        const prop = props.properties.find((p: any) => 
            p.displayName?.toLowerCase() === displayName.toLowerCase() ||
            p.displayName?.toLowerCase().includes(displayName.toLowerCase())
        );
        return prop?.displayValue?.toString();
    }

    /**
     * Check if category represents a non-asset object
     */
    private isNonAssetCategory(category: string | undefined): boolean {
        if (!category) return true;

        const nonAssetCategories = [
            'levels', 'grids', 'views', 'sheets', 'schedules',
            'project information', 'browser organization', 'scope boxes',
            'reference planes', 'model groups', 'detail groups',
            'areas', 'rooms', 'spaces', 'zones'
        ];

        return nonAssetCategories.some(cat => 
            category.toLowerCase().includes(cat)
        );
    }

    /**
     * Map category to Italian/English/IFC format
     */
    private mapCategory(category: string | undefined): string {
        if (!category) return 'Unknown';

        // Check if category matches any Italian category
        for (const [italian, mapping] of Object.entries(CATEGORY_MAPPING)) {
            if (category.toLowerCase().includes(italian.toLowerCase()) ||
                category.toLowerCase().includes(mapping.english.toLowerCase()) ||
                category.toLowerCase().includes(mapping.ifc.toLowerCase())) {
                return `${italian} / ${mapping.english} (${mapping.ifc})`;
            }
        }

        // Return original category if no mapping found
        return category;
    }

    /**
     * Extract location information from properties
     */
    private extractLocation(props: any): string {
        const level = this.getPropertyValue(props, 'Level') || 
                     this.getPropertyValue(props, 'Reference Level');
        const room = this.getPropertyValue(props, 'Room') || 
                    this.getPropertyValue(props, 'Space');
        const phase = this.getPropertyValue(props, 'Phase Created');
        const building = this.getPropertyValue(props, 'Building');

        const locationParts = [building, level, room, phase].filter(Boolean);
        return locationParts.length > 0 ? locationParts.join(' - ') : 'Unknown Location';
    }

    /**
     * Generate description from available properties
     */
    private generateDescription(props: any): string {
        const relevantProps = [
            'Comments', 'Description', 'Mark', 'Assembly Code',
            'Fire Rating', 'Acoustic Rating', 'Thermal Properties'
        ];

        const descriptions: string[] = [];
        
        for (const propName of relevantProps) {
            const value = this.getPropertyValue(props, propName);
            if (value && value.trim()) {
                descriptions.push(`${propName}: ${value}`);
            }
        }

        return descriptions.length > 0 ? descriptions.join('; ') : '';
    }

    /**
     * Get assets by category
     */
    public async getAssetsByCategory(category: string): Promise<Asset[]> {
        const allAssets = await this.extractAllAssets();
        return allAssets.filter(asset => 
            asset.category?.toLowerCase().includes(category.toLowerCase())
        );
    }

    /**
     * Search assets by name or properties
     */
    public async searchAssets(searchTerm: string): Promise<Asset[]> {
        const allAssets = await this.extractAllAssets();
        const term = searchTerm.toLowerCase();
        
        return allAssets.filter(asset => 
            asset.name.toLowerCase().includes(term) ||
            asset.category?.toLowerCase().includes(term) ||
            asset.type?.toLowerCase().includes(term) ||
            asset.brand?.toLowerCase().includes(term) ||
            asset.model?.toLowerCase().includes(term) ||
            asset.location.toLowerCase().includes(term)
        );
    }

    /**
     * Get asset statistics by category
     */
    public async getAssetStatistics(): Promise<Record<string, number>> {
        const allAssets = await this.extractAllAssets();
        const stats: Record<string, number> = {};

        allAssets.forEach(asset => {
            const category = asset.category || 'Unknown';
            stats[category] = (stats[category] || 0) + 1;
        });

        return stats;
    }
}

// Console testing utilities
export const AssetTestUtils = {
    /**
     * Test if viewer is ready for asset extraction
     */
    checkViewerStatus(): void {
        const viewer = (window as any).viewer;
        console.log("🔍 Viewer Status Check:");
        console.log("- Viewer exists:", !!viewer);
        console.log("- Model loaded:", !!viewer?.model);
        console.log("- Instance tree:", !!viewer?.model?.getInstanceTree());
        
        if (viewer?.model?.getInstanceTree()) {
            const tree = viewer.model.getInstanceTree();
            console.log("- Total objects:", tree.nodeAccess.numNodes);
            console.log("- Root ID:", tree.getRootId());
        }
    },

    /**
     * Quick asset extraction test
     */
    async quickTest(): Promise<void> {
        const viewer = (window as any).viewer;
        if (!viewer?.model) {
            console.log("❌ Viewer or model not ready");
            return;
        }

        const service = new AssetExtractionService(viewer);
        console.log("🧪 Running quick asset test...");

        try {
            // Test first 20 objects
            const stats = service.getModelStats();
            console.log("📊 Model stats:", stats);

            // Extract sample assets
            const sampleAssets: Asset[] = [];
            for (let dbId = 1; dbId <= 20; dbId++) {
                try {
                    const props: any = await new Promise(resolve => 
                        viewer.model.getProperties(dbId, resolve)
                    );
                    
                    if (props && props.properties && props.properties.length > 0) {
                        const category = props.properties.find((p: any) => 
                            p.displayName === 'Category'
                        )?.displayValue;
                        
                        if (category && !service['isNonAssetCategory'](category)) {
                            sampleAssets.push({
                                id: `test-${dbId}`,
                                dbId,
                                name: props.name,
                                category,
                                location: 'Test Location',
                                properties: props.properties,
                                source: 'BIM_MODEL'
                            } as Asset);
                        }
                    }
                } catch (error) {
                    // Skip failed objects
                }
            }

            console.log(`✅ Found ${sampleAssets.length} potential assets in first 20 objects`);
            console.table(sampleAssets.map(a => ({
                dbId: a.dbId,
                name: a.name,
                category: a.category
            })));

        } catch (error) {
            console.error("❌ Test failed:", error);
        }
    }
};

// Make utilities available globally for console testing
if (typeof window !== 'undefined') {
    (window as any).AssetTestUtils = AssetTestUtils;
}

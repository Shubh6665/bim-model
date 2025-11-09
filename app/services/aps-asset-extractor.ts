/**
 * APS Asset Extractor - Uses Official Autodesk Platform Services Model Derivative API
 * 
 * This extractor uses the proper APS APIs to extract assets from Revit models:
 * - GET /modelderivative/v2/designdata/:urn/metadata - Get model GUIDs
 * - GET /modelderivative/v2/designdata/:urn/metadata/:guid/properties - Get all properties
 * 
 * Reference: https://aps.autodesk.com/en/docs/model-derivative/v2/reference/http/metadata/urn-metadata-guid-properties-GET/
 */

export interface APSAsset {
  id: string;
  objectId: number;
  name: string;
  category: string;
  externalId?: string;
  
  // Revit-specific properties
  family?: string;
  type?: string;
  level?: string;
  phase?: string;
  
  // Physical properties
  material?: string;
  volume?: string;
  area?: string;
  length?: string;
  
  // Location
  room?: string;
  building?: string;
  location: string;
  
  // Asset management
  brand?: string;
  model?: string;
  serialNumber?: string;
  mark?: string;
  
  // All raw properties from API
  properties: Record<string, any>;
  
  // Metadata
  source: 'APS_API';
  modelGuid: string;
  urn: string;
}

export interface APSExtractionResult {
  assets: APSAsset[];
  categories: string[];
  statistics: {
    totalObjects: number;
    extractedAssets: number;
    byCategory: Record<string, number>;
  };
}

export class APSAssetExtractor {
  private urn: string;
  private baseUrl: string;

  constructor(urn: string, baseUrl: string = '') {
    this.urn = urn;
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  }

  /**
   * Extract all assets from the model using APS Model Derivative API
   */
  async extractAllAssets(
    progressCallback?: (progress: number, current: number, total: number) => void
  ): Promise<APSExtractionResult> {
    console.log('🚀 [APS Extractor] Starting extraction using Model Derivative API...');
    console.log('📦 [APS Extractor] URN:', this.urn);

    try {
      // Step 1: Get model metadata (viewables/GUIDs)
      console.log('📋 [APS Extractor] Step 1: Fetching model metadata...');
      const metadata = await this.getMetadata();
      
      if (!metadata.data?.metadata || metadata.data.metadata.length === 0) {
        throw new Error('No viewables found in model');
      }

      console.log(`✅ [APS Extractor] Found ${metadata.data.metadata.length} viewable(s)`);

      // Prefer only 3D viewables
      const viewables = (metadata.data.metadata as any[]).filter(v => (v?.role || '').toLowerCase() === '3d');
      const targets = viewables.length > 0 ? viewables : metadata.data.metadata;
      if (viewables.length === 0) {
        console.warn('⚠️ [APS Extractor] No role="3d" viewables found; falling back to all viewables');
      }

      // Step 2: Extract properties from each target viewable
      const allAssets: APSAsset[] = [];
      const allCategories = new Set<string>();

      for (let i = 0; i < targets.length; i++) {
        const viewable = targets[i];
        const guid = viewable.guid;
        
        console.log(`🔍 [APS Extractor] Processing viewable ${i + 1}/${targets.length}: ${guid}`);
        
        // Step 3: Get all properties for this viewable
        const properties = await this.getProperties(guid);
        
        if (!properties.data?.collection) {
          console.warn(`⚠️ [APS Extractor] No properties found for viewable ${guid}`);
          continue;
        }

        const objects = properties.data.collection;
        console.log(`📊 [APS Extractor] Found ${objects.length} objects in viewable ${guid}`);

        // Debug: Log first object structure
        if (objects.length > 0) {
          console.log(`🔍 [APS Extractor] Sample object structure:`, {
            objectid: objects[0].objectid,
            name: objects[0].name,
            hasProperties: !!objects[0].properties,
            propertiesType: typeof objects[0].properties,
            isArray: Array.isArray(objects[0].properties),
            propertiesLength: Array.isArray(objects[0].properties) ? objects[0].properties.length : 'N/A'
          });
        }

        // Step 4: Convert to assets
        for (let j = 0; j < objects.length; j++) {
          const obj = objects[j];
          
          // Progress callback
          if (progressCallback && j % 100 === 0) {
            const progress = ((i * objects.length + j) / (targets.length * Math.max(1, objects.length))) * 100;
            progressCallback(progress, allAssets.length, objects.length);
          }

          const asset = this.convertToAsset(obj, guid);
          if (asset) {
            allAssets.push(asset);
            allCategories.add(asset.category);
          }
        }
      }

      // Step 5: Calculate statistics
      const statistics = this.calculateStatistics(allAssets);

      console.log(`✅ [APS Extractor] Extraction complete!`);
      console.log(`📦 Total Assets: ${allAssets.length}`);
      console.log(`📂 Categories: ${allCategories.size}`);

      return {
        assets: allAssets,
        categories: Array.from(allCategories).sort(),
        statistics
      };

    } catch (error) {
      console.error('❌ [APS Extractor] Extraction failed:', error);
      throw error;
    }
  }

  /**
   * Get model metadata (viewables/GUIDs)
   */
  private async getMetadata(): Promise<any> {
    const url = `${this.baseUrl}/api/forge/metadata/${encodeURIComponent(this.urn)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch metadata: ${error.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all properties for a specific viewable (GUID)
   */
  private async getProperties(guid: string): Promise<any> {
    const url = `${this.baseUrl}/api/forge/properties/${encodeURIComponent(this.urn)}/${guid}?forceget=true`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch properties: ${error.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Convert API object to Asset
   */
  private convertToAsset(obj: any, modelGuid: string): APSAsset | null {
    if (!obj) {
      return null;
    }

    const objectId = obj.objectid;
    const name = obj.name || `Object ${objectId}`;
    
    // Extract properties into a flat map
    const propsMap: Record<string, any> = {};
    
    // Handle APS properties which may be an ARRAY or a GROUPED OBJECT
    const rawProps = obj.properties ?? {};
    if (Array.isArray(rawProps)) {
      for (const prop of rawProps) {
        const key = prop?.displayName || prop?.attributeName || (prop as any)?.name || (prop as any)?.externalName;
        const value = (prop as any)?.displayValue ?? (prop as any)?.value ?? (prop as any)?.val;
        if (key && value !== undefined && value !== null) {
          propsMap[key] = value;
        }
      }
    } else if (rawProps && typeof rawProps === 'object') {
      // Flatten grouped properties that may be arrays OR nested objects
      for (const [groupName, group] of Object.entries(rawProps)) {
        if (Array.isArray(group)) {
          for (const prop of group as any[]) {
            const key = (prop as any)?.displayName || (prop as any)?.attributeName;
            const value = (prop as any)?.displayValue;
            if (key && value !== undefined && value !== null) {
              propsMap[key] = value;
            }
          }
        } else if (group && typeof group === 'object') {
          for (const [k2, v2] of Object.entries(group as any)) {
            if (v2 && typeof v2 === 'object') {
              const disp = (v2 as any).displayValue ?? (v2 as any).value ?? (v2 as any).val;
              if (disp !== undefined && disp !== null) {
                propsMap[k2] = disp;
              }
            } else if (v2 !== undefined && v2 !== null) {
              propsMap[k2] = v2 as any;
            }
          }
        } else if (group !== undefined && group !== null) {
          // Primitive directly under group key
          propsMap[groupName] = group as any;
        }
      }
    } else {
      console.warn(`⚠️ [convertToAsset] Unexpected properties shape for object ${objectId}:`, typeof rawProps);
    }

    // Get category (robust, case-insensitive, fuzzy)
    const entries = Object.entries(propsMap);
    const pickByKeys = (keys: string[]) => {
      const targets = keys.map(k => k.toLowerCase());
      // exact (case-insensitive)
      let hit = entries.find(([k]) => targets.includes(k.toLowerCase()));
      if (hit) return hit[1];
      // substring contains
      hit = entries.find(([k]) => targets.some(t => k.toLowerCase().includes(t)));
      return hit ? hit[1] : undefined;
    };
    let category = pickByKeys(['Category','Categoria']);
    if (!category) {
      // Some datasets put category-like value under different keys
      category = pickByKeys(['Revit Category','IfcCategory','Class','Type','Type Name']);
    }
    if (!category) {
      // Name-based fallback mapping (Italian/English)
      const nameLower = (name || '').toLowerCase();
      const map: Array<{ test: RegExp; cat: string }> = [
        { test: /\bmuro|\bparete/, cat: 'Muri' },
        { test: /\bpaviment/, cat: 'Pavimenti' },
        { test: /\bporta\b/, cat: 'Porte' },
        { test: /\bfinestr/, cat: 'Finestre' },
        { test: /\btetto|\broof/, cat: 'Tetti' },
        { test: /\bscala|\bstair/, cat: 'Scale' },
        { test: /\bringhier/, cat: 'Ringhiere' },
        { test: /\bcondott/, cat: 'Condotto' },
        { test: /\btubaz|\bpipe/, cat: 'Tubazioni' },
        { test: /\bcolonn|\bpilastr/, cat: 'Pilastri strutturali' },
        { test: /\btrave|\bbeam/, cat: 'Travi reticolari strutturali' },
        { test: /\bsoffitt|\bceiling/, cat: 'Controsoffitti' },
        { test: /\barred|\bfurnitur|\bletto/, cat: 'Arredi' },
        { test: /\bgeneric model|modelli generici/, cat: 'Modelli generici' }
      ];
      const m = map.find(x => x.test.test(nameLower));
      if (m) category = m.cat;
    }
    if (!category) {
      const keys = Object.keys(propsMap);
      console.warn(`⚠️ [convertToAsset] Missing category for object ${objectId} (${name}). Keys:`, keys.slice(0, 30));
      category = 'Unknown';
    }

    // Inclusion lists from client (Revit categories in Italian) + common English + IFC classes
    const catLower = (category || '').toLowerCase();
    const includeRevit = [
      'accessori per tubazioni','accessori per condotti','apparecchi elettrici','apparecchi idraulici','apparecchi per illuminazione','aree','aree di rete strutturale','aree pavimentate e costruite','armatura strutturale','armatura su area strutturale','armatura su percorso strutturale','arredi','arredi fissi','attrezzatura elettrica','attrezzatura idraulica','attrezzatura meccanica','attrezzatura medica','attrezzatura per servizi alimentari','attrezzatura per servizi alimentazione','attrezzature speciali','bocchettoni','canaline di fabbricazione mep','cavedi','cavi','circolazione verticale','collegamenti strutturali','collocazioni condotto','collocazioni tubazione','condotti di fabbricazione mep','condotto','condotto flessibile','contesto','controsoffitti','dispositivi allarme incendio','dispositivi audiovisivi','dispositivi chiamata infermiera','dispositivi dati','dispositivi di comunicazione','dispositivi di controllo meccanico','dispositivi di illuminazione','dispositivi di sicurezza','dispositivi telefonici','elementi di dettaglio','estintori','finestre','fondazioni strutturali','irrigidimenti condotti di fabbricazione mep','irrigidimenti strutturali','isolamenti condotti','isolamenti tubazioni','linee','locali','manicotti armatura strutturale','massa','modelli generici','montanti della facciata continua','muri','pannelli di facciata continua','passerelle','pavimenti','pilastri','pilastri strutturali','planimetria','porte','posti auto','protezione antincendio','raccordi condotto','raccordi passerella','raccordi tubazione','raccordi tubo protettivo','rampe inclinate','rinforzo rete strutturale','ringhiere','rivestimenti condotti','scale','segnaletica','sistemi di arredo','sistemi di facciata continua','sistemi di travi strutturali','solido topografico','staffe di fabbricazione mep','strade','stratigrafia','strutture temporanee','telaio ausiliario mep','telaio strutturale','tetti','topografia','travi reticolari strutturali','tubazioni','tubazioni di fabbricazione mep','tubazioni flessibili','tubi protettivi','vani','verde','zone riscaldamento ventilazione e aria condizionata'
    ];
    const includeEnglish = [
      'doors','windows','walls','floors','ceilings','roofs','stairs','ramps','railings','curtain wall','curtain panels','columns','beams','structural columns','structural foundations','generic models','furniture','casework','mechanical equipment','electrical equipment','plumbing fixtures','ducts','duct fittings','duct accessories','pipe fittings','pipe accessories','pipes','flex ducts','flex pipes','sprinklers','lighting fixtures','communication devices','data devices','fire alarm devices','security devices','nurse call devices','mechanical control devices','conduit fittings','cable trays','cable tray fittings','cable','topography','parking','site','mass'
    ];
    const includeIfc = [
      'ifcbuildingelementproxy','ifcairterminal','ifcalarmtype','ifcassembly','ifcaudiovisualappliance','ifcbeam','ifcbuildingelementpart','ifcbuildingstorey','ifccablecarrierfitting','ifccablecarrierfittingtype','ifccablecarriersegment','ifccolumn','ifccontroller','ifccovering','ifccurtainwall','ifcdoor','ifcductfitting','ifcductsegment','ifcelectricappliancetype','ifcelementassembly','ifcfiresuppressionterminaltype','ifcflowterminal','ifcfurniture','ifcgeographicelement','ifcgrid','ifcgroup','ifclightfixturetype','ifcmechanicalfastener','ifcmedicaldevice','ifcmember','ifcopeningelement','ifcpipefitting','ifcpipesegment','ifcplate','ifcrailing','ifcramp','ifcreinforcementmesh','ifcreinforcingbar','ifcreinforcingmesh','ifcroof','ifcsite','ifcslab','ifcspace','ifcstair','ifcswitchingdevicetype','ifcsystemfurnitureelement','ifctransportelement','ifcvalvetype','ifcwall','ifcwindow','ifczone','ifcspaceheater'
    ];

    const isIncludedRevit = [...includeRevit, ...includeEnglish].some(term => catLower.includes(term));
    const ifcKey = (propsMap['IfcClass'] || propsMap['IFC Class'] || propsMap['IFC Export As'] || propsMap['IFCExportAs'] || propsMap['IFCExportType'] || propsMap['IFC Type'] || '').toString().toLowerCase();
    const isIncludedIfc = !!ifcKey && includeIfc.some(term => ifcKey.includes(term));
    // Fallback inclusion by name when category is missing
    const nameLower = (name || '').toLowerCase();
    const includeNameIt = ['muro','parete','porta','finestra','pavimento','tetto','scala','ringhiera','condotto','tubazione','apparecchio','dispositivo','arredo','letto','pannello','montante','pilastro','trave','soffitto','impianto'];
    const includeByName = [...includeRevit, ...includeEnglish, ...includeNameIt].some(term => nameLower.includes(term));
    // Positive signals from properties
    const keysLower = Object.keys(propsMap).map(k => k.toLowerCase());
    const assetSignalTokens = ['category','categoria','ifc','level','livello','family','famiglia','type','tipo','room','space','locale','material','marca','manufacturer','model','modello'];
    const hasAssetSignal = keysLower.some(k => assetSignalTokens.some(tok => k.includes(tok)));
    let isAllowed = isIncludedRevit || isIncludedIfc || includeByName || hasAssetSignal;

    // Positive inclusion only
    if (!isAllowed) {
      return null;
    }

    // Extract common properties
    const family = propsMap['Family'] || propsMap['Family Name'] || propsMap['Famiglia'];
    const type = propsMap['Type'] || propsMap['Type Name'] || propsMap['Tipo'];
    const level = propsMap['Level'] || propsMap['Reference Level'] || propsMap['Base Level'] || propsMap['Livello'];
    const phase = propsMap['Phase Created'] || propsMap['Phase'] || propsMap['Fase'];
    const material = propsMap['Material'] || propsMap['Structural Material'] || propsMap['Materiale'];
    const room = propsMap['Room'] || propsMap['Space'] || propsMap['To Room'] || propsMap['From Room'] || propsMap['Locale'];
    const building = propsMap['Building'] || propsMap['Edificio'];
    
    // Brand: Priority check for Manufacturer/Produttore attributes
    // If found, use it. Otherwise defaults to undefined (will be 'Unknown' in fm-panel)
    const brand = propsMap['Manufacturer'] || propsMap['Produttore'] || propsMap['Brand'] || 
                  propsMap['Marca'] || propsMap['Fabbricante'] || propsMap['Costruttore'];
    
    // Model: Priority check for Model/Modello attributes
    // If found, use it. Otherwise defaults to undefined (will be 'Unknown' in fm-panel)
    const model = propsMap['Model'] || propsMap['Modello'] || propsMap['Type Name'] || propsMap['Nome del tipo'];
    
    const serialNumber = propsMap['Serial Number'] || propsMap['Numero di Serie'];
    const mark = propsMap['Mark'] || propsMap['Contrassegno'];
    const volume = propsMap['Volume'] || propsMap['Volumen'];
    const area = propsMap['Area'] || propsMap['Superficie'];
    const length = propsMap['Length'] || propsMap['Lunghezza'];

    // Build location string
    const locationParts = [building, level, room].filter(Boolean);
    const location = locationParts.length > 0 ? locationParts.join(' - ') : 'Unknown Location';

    return {
      id: `aps-${modelGuid}-${objectId}`,
      objectId,
      name,
      category,
      externalId: obj.externalId,
      family,
      type,
      level,
      phase,
      material,
      volume,
      area,
      length,
      room,
      building,
      location,
      brand,
      model,
      serialNumber,
      mark,
      properties: propsMap,
      source: 'APS_API',
      modelGuid,
      urn: this.urn
    };
  }

  /**
   * Calculate statistics
   */
  private calculateStatistics(assets: APSAsset[]): APSExtractionResult['statistics'] {
    const byCategory: Record<string, number> = {};

    for (const asset of assets) {
      byCategory[asset.category] = (byCategory[asset.category] || 0) + 1;
    }

    return {
      totalObjects: assets.length,
      extractedAssets: assets.length,
      byCategory
    };
  }

  /**
   * Extract assets filtered by category
   */
  async extractByCategory(category: string): Promise<APSAsset[]> {
    const result = await this.extractAllAssets();
    return result.assets.filter(asset => 
      asset.category.toLowerCase().includes(category.toLowerCase())
    );
  }

  /**
   * Get all available categories in the model
   */
  async getAvailableCategories(): Promise<string[]> {
    const result = await this.extractAllAssets();
    return result.categories;
  }
}

// Testing utilities
export const APSAssetExtractorUtils = {
  /**
   * Test extraction with a URN
   */
  async testExtraction(urn: string): Promise<void> {
    console.log('🧪 [APS Test] Testing APS Asset Extraction...');
    console.log('📦 [APS Test] URN:', urn);

    const extractor = new APSAssetExtractor(urn);

    try {
      const result = await extractor.extractAllAssets((progress, current, total) => {
        if (current % 100 === 0) {
          console.log(`📊 [APS Test] Progress: ${progress.toFixed(1)}% - ${current}/${total} objects`);
        }
      });

      console.log('\n✅ [APS Test] Extraction Complete!');
      console.log(`📦 Total Assets: ${result.assets.length}`);
      console.log(`📂 Categories: ${result.categories.length}`);
      
      console.log('\n📊 Statistics by Category:');
      const sortedCategories = Object.entries(result.statistics.byCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20);
      console.table(Object.fromEntries(sortedCategories));

      console.log('\n🎯 Sample Assets (first 10):');
      console.table(result.assets.slice(0, 10).map(a => ({
        objectId: a.objectId,
        name: a.name,
        category: a.category,
        type: a.type,
        level: a.level,
        location: a.location
      })));

      console.log('\n📂 All Categories:');
      console.log(result.categories.join(', '));

    } catch (error) {
      console.error('❌ [APS Test] Extraction failed:', error);
    }
  }
};

// Make available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).APSAssetExtractor = APSAssetExtractor;
  (window as any).APSAssetExtractorUtils = APSAssetExtractorUtils;
}

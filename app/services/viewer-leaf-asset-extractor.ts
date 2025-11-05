/**
 * PROVEN APPROACH: Viewer Leaf Node Asset Extractor
 * 
 * Based on official Autodesk research and samples:
 * - https://aps.autodesk.com/blog/enumerating-leaf-nodes-viewer
 * - https://aps.autodesk.com/blog/getbulkproperties-method
 * 
 * This approach:
 * ✅ Only gets LEAF nodes (real, selectable elements)
 * ✅ Automatically excludes views, levels, grids, metadata
 * ✅ Uses official Viewer API (supported, stable)
 * ✅ Fast and efficient (no downloading unnecessary data)
 * ✅ Works with any model type (Revit, Inventor, IFC)
 */

export interface ViewerAsset {
  dbId: number;
  externalId: string;
  name: string;
  category: string;
  family?: string;
  type?: string;
  level?: string;
  material?: string;
  room?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  elementId?: string;  // ElementId for unique asset identification
  mark?: string;       // Mark field as fallback identifier
  modelId?: number;
  properties: Record<string, any>;
}

export interface ExtractionProgress {
  stage: 'enumeration' | 'filtering' | 'properties' | 'complete';
  progress: number;
  current: number;
  total: number;
  message: string;
}

export class ViewerLeafAssetExtractor {
  private viewer: any;

  constructor(viewer: any) {
    if (!viewer || !viewer.model) {
      throw new Error('Viewer with loaded model is required');
    }
    this.viewer = viewer;
  }

  private getActiveModels(): any[] {
    try {
      const arr = typeof (this.viewer as any).getAllModels === 'function' ? (this.viewer as any).getAllModels() : null;
      if (arr && Array.isArray(arr) && arr.length) return arr;
    } catch {}
    return [this.viewer.model].filter(Boolean);
  }

  private async getLeafNodesForModel(model: any): Promise<number[]> {
    return new Promise((resolve) => {
      try {
        const tree = typeof model.getInstanceTree === 'function' ? model.getInstanceTree() : null;
        if (tree) {
          const rootId = tree.getRootId?.() ?? 1;
          const comps: number[] = [];
          const walk = (id: number) => {
            const cc = tree.getChildCount(id);
            if (cc && cc > 0) tree.enumNodeChildren(id, (c: number) => walk(c), false);
            else comps.push(id);
          };
          walk(rootId);
          resolve(comps);
          return;
        }
        if (typeof model.getObjectTree === 'function') {
          model.getObjectTree((t: any) => {
            if (!t) return resolve([]);
            const comps: number[] = [];
            const walk = (id: number) => {
              const cc = t.getChildCount(id);
              if (cc && cc > 0) t.enumNodeChildren(id, (c: number) => walk(c), false);
              else comps.push(id);
            };
            const rootId = t.getRootId?.() ?? 1;
            walk(rootId);
            resolve(comps);
          });
          return;
        }
      } catch {}
      resolve([]);
    });
  }

  private async getAllLeafNodesAllModels(): Promise<Array<{ model: any; dbIds: number[] }>> {
    const models = this.getActiveModels();
    const out: Array<{ model: any; dbIds: number[] }> = [];
    for (const m of models) {
      // eslint-disable-next-line no-await-in-loop
      const ids = await this.getLeafNodesForModel(m);
      out.push({ model: m, dbIds: ids });
    }
    return out;
  }

  private async getBulkPropertiesForFilterPerModel(model: any, dbIds: number[], props: string[]): Promise<any[]> {
    if (!dbIds.length) return [];
    const results: any[] = [];
    const chunkSize = 1000;
    for (let i = 0; i < dbIds.length; i += chunkSize) {
      // eslint-disable-next-line no-await-in-loop
      const chunk = await new Promise<any[]>((resolve, reject) => {
        model.getBulkProperties(
          dbIds.slice(i, i + chunkSize),
          props,
          (res: any[]) => resolve(res),
          (err: any) => reject(err)
        );
      });
      results.push(...chunk);
    }
    return results;
  }

  private async filterByAssetCategoriesMulti(allLeafByModel: Array<{ model: any; dbIds: number[] }>): Promise<Array<{ model: any; dbIds: number[] }>> {
    const assetCategories = [
      'Porte', 'Finestre', 'Muri', 'Pavimenti', 'Tetti', 'Scale', 'Ringhiere',
      'Arredi', 'Arredi fissi', 'Apparecchi elettrici', 'Apparecchi idraulici',
      'Apparecchi per illuminazione', 'Attrezzatura elettrica', 'Attrezzatura idraulica',
      'Attrezzatura meccanica', 'Attrezzature meccaniche', 'Attrezzature elettriche',
      'Apparecchiature meccaniche', 'Apparecchiature elettriche',
      'Terminale Elettrico', 'Ventilconvettore', 'Fancoil', 'Condizionatore', 'Unità Interna',
      'Caldaia', 'Illuminazione',
      'Condotti', 'Tubazioni', 'Pilastri', 'Travi',
      'Controsoffitti', 'Locali', 'Aree',
      'Doors', 'Windows', 'Walls', 'Floors', 'Roofs', 'Stairs', 'Railings',
      'Furniture', 'Casework', 'Electrical Fixtures', 'Plumbing Fixtures',
      'Lighting', 'Lighting Fixtures', 'Lamp', 'Electrical Equipment', 'Plumbing Equipment',
      'Mechanical Equipment', 'Convector', 'Fan Coil', 'Fancoil', 'Air Terminal', 'Duct Terminal',
      'Diffuser', 'Grille', 'Boiler', 'Space Heater',
      'Ducts', 'Pipes', 'Columns', 'Beams',
      'Ceilings', 'Rooms', 'Spaces'
    ];
    const attributes = [
      'Category', 'Categoria', 'IFC Class', 'IfcClass', 'OmniClass Number', 'Numero OmniClass', 'OmniClass Title', 'Titolo OmniClass',
      'Family', 'Famiglia', 'Type', 'Type Name', 'Nome del tipo',
      'Description', 'Descrizione'
    ];
    const termsLower = assetCategories.map(t => t.toLowerCase());
    const out: Array<{ model: any; dbIds: number[] }> = [];
    for (const entry of allLeafByModel) {
      const props = Array.from(new Set([
        ...attributes,
        'Brand','Manufacturer','Marca','Produttore','Fabbricante','Costruttore','Model','Modello','Serial Number','Numero di Serie','Numero di serie','Matricola','Seriale'
      ]));
      // eslint-disable-next-line no-await-in-loop
      const res = await this.getBulkPropertiesForFilterPerModel(entry.model, entry.dbIds, props);
      const leafSet = new Set(entry.dbIds);
      const matched = res
        .filter(r => {
          const arr = (r.properties || []) as Array<{ displayName: string; displayValue: any }>;
          const map: Record<string, string> = {};
          for (const p of arr) {
            if (p.displayName && p.displayValue != null) map[p.displayName] = String(p.displayValue);
          }
          const catVal = (map['Category'] || map['Categoria'] || '').toLowerCase();
          const classVal = (map['IFC Class'] || map['IfcClass'] || map['Classe IFC'] || '').toLowerCase();
          const omniTitle = (map['OmniClass Title'] || map['Titolo OmniClass'] || '').toLowerCase();
          const omniNum = (map['OmniClass Number'] || map['Numero OmniClass'] || '').toLowerCase();
          const family = (map['Family'] || map['Famiglia'] || '').toLowerCase();
          const type = (map['Type'] || map['Type Name'] || map['Nome del tipo'] || map['Nome Tipo'] || map['Tipo'] || '').toLowerCase();
          const desc = (map['Description'] || map['Descrizione'] || '').toLowerCase();
          const hasManuModel = !!(map['Manufacturer'] || map['Brand'] || map['Marca'] || map['Produttore'] || map['Fabbricante'] || map['Costruttore'] || map['Model'] || map['Modello']);
          const hasSerial = !!(map['Serial Number'] || map['Numero di Serie'] || map['Numero di serie'] || map['Matricola'] || map['Seriale']);
          const termHit = termsLower.some(t => catVal.includes(t)) || termsLower.some(t => family.includes(t)) || termsLower.some(t => type.includes(t)) || termsLower.some(t => desc.includes(t));
          const ifcHit = /(ifclamp|ifcboiler|ifcspaceheater|ifcairterminal|ifcfan|ifcunitaryequipment|ifcdiscreteaccessory|ifcflowterminal)/i.test(classVal);
          const descHit = /(ventilconvettore|condizionatore|fancoil|lamp|boiler|caldaia|terminal|space heater|convector|lampada|illuminazione)/i.test(desc);
          const omniHit = !!(omniTitle || omniNum);
          return termHit || ifcHit || descHit || omniHit || hasManuModel || hasSerial;
        })
        .map(r => r.dbId)
        .filter(id => leafSet.has(id));
      out.push({ model: entry.model, dbIds: Array.from(new Set(matched)) });
    }
    return out;
  }

  private async getBulkPropertiesForAssetsPerModel(entries: Array<{ model: any; dbIds: number[] }>): Promise<ViewerAsset[]> {
    const all: ViewerAsset[] = [];
    
    // CRITICAL FIX: Request ALL properties instead of specific list
    // When you specify properties, getBulkProperties sometimes misses the Name field
    // By not specifying properties (passing null/undefined), we get EVERYTHING
    for (const entry of entries) {
      if (!entry.dbIds.length) continue;
      // eslint-disable-next-line no-await-in-loop
      const results = await new Promise<any[]>((resolve, reject) => {
        // Call getBulkProperties WITHOUT the properties parameter to get ALL properties
        entry.model.getBulkProperties(
          entry.dbIds,
          undefined,  // ← Changed from propertiesToFetch to undefined = get ALL properties
          (res: any[]) => resolve(res),
          (error: any) => reject(error)
        );
      });
      try {
        const sample = results.slice(0, Math.min(3, results.length));
        const samples = sample.map(r => ({ 
          dbId: r.dbId, 
          propCount: Array.isArray(r.properties) ? r.properties.length : 0,
          hasName: Array.isArray(r.properties) ? r.properties.some((p:any) => p.displayName === 'Name' || p.displayName === 'Nome') : false,
          nameValue: Array.isArray(r.properties) ? r.properties.find((p:any) => p.displayName === 'Name' || p.displayName === 'Nome')?.displayValue : null,
          sampleKeys: Array.isArray(r.properties) ? r.properties.slice(0, 10).map((p:any)=>p.displayName) : []
        }));
        console.log(`[ViewerLeafExtractor][bulk] Properties fetched for ${results.length} items. Samples with Name check:`, samples);
      } catch {}
      const mid = (typeof entry.model?.getModelId === 'function') ? entry.model.getModelId() : (entry.model?.id ?? undefined);
      const assets: ViewerAsset[] = results.map(result => ({ ...this.convertToAsset(result), modelId: mid }));
      all.push(...assets);
    }
    try {
      const breakdown: Record<string, number> = {};
      for (const a of all) breakdown[a.category] = (breakdown[a.category] || 0) + 1;
      console.log('[ViewerLeafExtractor][bulk] Category breakdown:', breakdown);
    } catch {}
    return all;
  }

  /**
   * Main extraction method - gets all leaf nodes and filters by asset categories
   */
  async extractAssets(
    onProgress?: (progress: ExtractionProgress) => void
  ): Promise<ViewerAsset[]> {
    try {
      onProgress?.({
        stage: 'enumeration',
        progress: 10,
        current: 0,
        total: 0,
        message: 'Enumerating leaf nodes (physical elements)...'
      });
      const allLeafByModel = await this.getAllLeafNodesAllModels();
      const leafDbIds = allLeafByModel.reduce((acc: number[], e) => acc.concat(e.dbIds), [] as number[]);
      console.log(`✅ Found ${leafDbIds.length} leaf nodes (physical elements)`);
      onProgress?.({
        stage: 'filtering',
        progress: 40,
        current: 0,
        total: leafDbIds.length,
        message: `Filtering ${leafDbIds.length} elements by asset categories...`
      });
      const filteredByModel = await this.filterByAssetCategoriesMulti(allLeafByModel);
      const assetDbIds = filteredByModel.reduce((acc: number[], e) => acc.concat(e.dbIds), [] as number[]);
      console.log(`✅ Filtered to ${assetDbIds.length} assets`);
      onProgress?.({
        stage: 'properties',
        progress: 70,
        current: 0,
        total: assetDbIds.length,
        message: `Fetching properties for ${assetDbIds.length} assets...`
      });
      const assets = await this.getBulkPropertiesForAssetsPerModel(filteredByModel);
      onProgress?.({
        stage: 'complete',
        progress: 100,
        current: assets.length,
        total: assets.length,
        message: `Extraction complete: ${assets.length} assets`
      });

      return assets;
    } catch (error) {
      console.error('❌ [ViewerLeafExtractor] Extraction failed:', error);
      throw error;
    }
  }

  /**
   * Get all leaf nodes (selectable, physical elements only)
   * This is the KEY method from official Autodesk blog
   */
  private getAllLeafNodes(): Promise<number[]> {
    return new Promise((resolve, reject) => {
      try {
        let cbCount = 0;
        const components: number[] = [];
        let tree: any;

        const getLeafComponentsRec = (parent: number) => {
          cbCount++;
          const childCount = tree.getChildCount(parent);
          
          if (childCount !== 0) {
            // Has children - not a leaf, recurse
            tree.enumNodeChildren(parent, (child: number) => {
              getLeafComponentsRec(child);
            }, false);
          } else {
            // No children - this is a LEAF = real physical element
            components.push(parent);
          }
          
          if (--cbCount === 0) {
            resolve(components);
          }
        };

        this.viewer.getObjectTree((objectTree: any) => {
          if (!objectTree) {
            reject(new Error('Failed to get object tree'));
            return;
          }
          tree = objectTree;
          const rootId = tree.getRootId();
          getLeafComponentsRec(rootId);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Filter leaf nodes by asset categories using viewer.search()
   * Much faster than checking properties one by one
   */
  private async filterByAssetCategories(leafDbIds: number[]): Promise<number[]> {
    // Define asset categories (Italian + English)
    const assetCategories = [
      // Italian Revit categories
      'Porte', 'Finestre', 'Muri', 'Pavimenti', 'Tetti', 'Scale', 'Ringhiere',
      'Arredi', 'Arredi fissi', 'Apparecchi elettrici', 'Apparecchi idraulici',
      'Apparecchi per illuminazione', 'Attrezzatura elettrica', 'Attrezzatura idraulica',
      'Attrezzatura meccanica', 'Attrezzature meccaniche', 'Attrezzature elettriche',
      'Apparecchiature meccaniche', 'Apparecchiature elettriche',
      'Terminale Elettrico', 'Ventilconvettore', 'Fancoil', 'Condizionatore', 'Unità Interna',
      'Caldaia', 'Illuminazione',
      'Condotti', 'Tubazioni', 'Pilastri', 'Travi',
      'Controsoffitti', 'Locali', 'Aree',
      // English equivalents
      'Doors', 'Windows', 'Walls', 'Floors', 'Roofs', 'Stairs', 'Railings',
      'Furniture', 'Casework', 'Electrical Fixtures', 'Plumbing Fixtures',
      'Lighting', 'Lighting Fixtures', 'Lamp', 'Electrical Equipment', 'Plumbing Equipment',
      'Mechanical Equipment', 'Convector', 'Fan Coil', 'Fancoil', 'Air Terminal', 'Duct Terminal',
      'Diffuser', 'Grille', 'Boiler', 'Space Heater',
      'Ducts', 'Pipes', 'Columns', 'Beams',
      'Ceilings', 'Rooms', 'Spaces'
    ];
    // Use per-term search and UNION results (viewer.search does NOT support regex OR)
    const attributes = [
      // Category / Class
      'Category', 'Categoria', 'IFC Class', 'IfcClass', 'OmniClass Number', 'Numero OmniClass', 'OmniClass Title', 'Titolo OmniClass',
      // Family / Type
      'Family', 'Famiglia', 'Type', 'Type Name', 'Nome del tipo',
      // Description
      'Description', 'Descrizione'
    ];
    const union = new Set<number>();

    for (const term of assetCategories) {
      // Skip empty terms defensively
      if (!term || !term.trim()) continue;
      // eslint-disable-next-line no-await-in-loop
      const ids = await new Promise<number[]>((resolve) => {
        this.viewer.search(
          term,
          (dbIds: number[]) => resolve(dbIds || []),
          (_: any) => resolve([]),
          attributes
        );
      });
      try { console.log(`[ViewerLeafExtractor][filter] Term "${term}" -> ${ids.length}`); } catch {}
      ids.forEach(id => union.add(id));
    }

    // Intersection: leaf nodes AND matching categories
    const leafSet = new Set(leafDbIds);
    let assetDbIds = Array.from(union).filter(id => leafSet.has(id));

    // Fallback: broaden using properties-based heuristics for remaining leaf nodes
    // Run if nothing matched OR union looks too small compared to leaf count
    const shouldHeuristic = (assetDbIds.length === 0) || (assetDbIds.length < Math.min(leafDbIds.length * 0.5, 200));
    if (shouldHeuristic && leafDbIds.length > 0) {
      try {
        const filterProps = Array.from(new Set([
          ...attributes,
          'Brand','Manufacturer','Marca','Model','Modello','Serial Number','Numero di Serie'
        ]));
        const remainingLeaf = leafDbIds.filter(id => !union.has(id));
        const leafProps = await this.getBulkPropertiesForFilter(remainingLeaf.length ? remainingLeaf : leafDbIds, filterProps);
        const termsLower = assetCategories.map(t => t.toLowerCase());
        const matched = leafProps
          .filter(r => {
            const propsArr = (r.properties || []) as Array<{ displayName: string; displayValue: any }>;
            const props: Record<string,string> = {};
            for (const p of propsArr) {
              if (p.displayName && p.displayValue != null) props[p.displayName] = String(p.displayValue);
            }
            const catVal = (props['Category'] || props['Categoria'] || '').toLowerCase();
            const classVal = (props['IFC Class'] || props['IfcClass'] || props['Classe IFC'] || '').toLowerCase();
            const omniTitle = (props['OmniClass Title'] || props['Titolo OmniClass'] || '').toLowerCase();
            const omniNum = (props['OmniClass Number'] || props['Numero OmniClass'] || '').toLowerCase();
            const family = (props['Family'] || props['Famiglia'] || '').toLowerCase();
            const type = (props['Type'] || props['Type Name'] || props['Nome del tipo'] || props['Nome Tipo'] || props['Tipo'] || '').toLowerCase();
            const desc = (props['Description'] || props['Descrizione'] || '').toLowerCase();
            const hasManuModel = !!(props['Manufacturer'] || props['Brand'] || props['Marca'] || props['Produttore'] || props['Fabbricante'] || props['Costruttore'] || props['Model'] || props['Modello']);
            const hasSerial = !!(props['Serial Number'] || props['Numero di Serie'] || props['Numero di serie'] || props['Matricola'] || props['Seriale']);

            const termHit = termsLower.some(t => catVal.includes(t))
              || termsLower.some(t => family.includes(t))
              || termsLower.some(t => type.includes(t))
              || termsLower.some(t => desc.includes(t));

            const ifcHit = /(ifclamp|ifcboiler|ifcspaceheater|ifcairterminal|ifcfan|ifcunitaryequipment|ifcdiscreteaccessory|ifcflowterminal)/i.test(classVal);
            const descHit = /(ventilconvettore|condizionatore|fancoil|lamp|boiler|caldaia|terminal|space heater|convector|lampada|illuminazione)/i.test(desc);
            const omniHit = !!(omniTitle || omniNum);

            return termHit || ifcHit || descHit || omniHit || hasManuModel || hasSerial;
          })
          .map(r => r.dbId);
        // Merge union results with heuristic matches (keep within leaf set)
        const merged = new Set<number>(assetDbIds);
        matched.forEach(id => { if (leafSet.has(id)) merged.add(id); });
        assetDbIds = Array.from(merged);
      } catch (e) {
        console.warn('⚠️ [ViewerLeafExtractor] Fallback local category filtering failed:', e);
      }
    }

    return assetDbIds;
  }

  /**
   * Get bulk properties for asset dbIds
   * Uses viewer.model.getBulkProperties for efficiency
   */
  private async getBulkPropertiesForAssets(dbIds: number[]): Promise<ViewerAsset[]> {
    if (dbIds.length === 0) return [];

    // Define properties to fetch (multilingual)
    const propertiesToFetch = [
      // Instance name (most important - shows actual element name like "ACE-RIS-Ventilconvettore-01 [180402]")
      'Name', 'Nome', 'Label', 'Etichetta', 'Element Name', 'Nome elemento', 'Instance Name', 'Nome istanza',
      'Category', 'Categoria',
      'Family', 'Family Name', 'Famiglia',
      'Type', 'Type Name', 'Tipo', 'Nome del tipo', 'Nome Tipo', 'Tipologia',
      'Level', 'Reference Level', 'Base Level', 'Schedule Level', 'Livello', 'Livello abaco', 'Livello di base', 'Livello superiore', 'Vincolo di base', 'Vincolo parte superiore', 'Base Constraint', 'Top Constraint', 'Constraint', 'Vincolo', 'Piano',
      'Material', 'Structural Material', 'Materiale', 'Materiale strutturale',
      'Room', 'Space', 'To Room', 'From Room', 'Locale', 'Locali', 'Aree',
      'Brand', 'Manufacturer', 'Marca', 'Produttore', 'Fabbricante', 'Costruttore',
      'Model', 'Modello',
      'Serial Number', 'Numero di Serie', 'Numero di serie', 'Matricola', 'Seriale',
      'Mark', 'Contrassegno',
      'Volume', 'Volumen', 'Volume (netto)', 'Volume (lordo)',
      'Area', 'Superficie',
      'Length', 'Lunghezza',
      // IFC related keys (class/type/GUID) including Italian export/type names
      'IFC Class', 'IfcClass', 'Classe IFC',
      'Esporta tipo in formato IFC con nome',
      'Esporta in formato IFC con nome',
      'Esporta tipo in IFC con nome',
      'Export type in IFC with name',
      'Export type to IFC as name',
      'Export IFC Type',
      'Predefined Type', 'PredefinedType', 'Tipo predefinito IFC', 'Tipo: Tipo predefinito IFC',
      'IfcGUID', 'IFC GUID', 'IFC GlobalId', 'GlobalId', 'Tipo IfcGUID',
      'Number', 'Numero'
    ];

    // Get bulk properties (fast, batched request). getBulkProperties expects an array of property names.
    const results = await new Promise<any[]>((resolve, reject) => {
      this.viewer.model.getBulkProperties(
        dbIds,
        propertiesToFetch,
        (res: any[]) => resolve(res),
        (error: any) => reject(error)
      );
    });

    try {
      const sample = results.slice(0, Math.min(3, results.length));
      const samples = sample.map(r => ({ dbId: r.dbId, keys: Array.isArray(r.properties) ? r.properties.map((p:any)=>p.displayName) : [] }));
      console.log(`[ViewerLeafExtractor][bulk] Properties fetched for ${results.length} items. Samples:`, samples);
    } catch {}

    // Convert to ViewerAsset format
    const assets: ViewerAsset[] = results.map(result => this.convertToAsset(result));

    try {
      const breakdown: Record<string, number> = {};
      for (const a of assets) breakdown[a.category] = (breakdown[a.category] || 0) + 1;
      console.log('[ViewerLeafExtractor][bulk] Category breakdown:', breakdown);
    } catch {}

    return assets;
  }

  /**
   * Helper: fetch bulk properties for filtering (only a few props) in chunks to avoid overload
   */
  private async getBulkPropertiesForFilter(dbIds: number[], props: string[]): Promise<any[]> {
    const results: any[] = [];
    const chunkSize = 1000;
    for (let i = 0; i < dbIds.length; i += chunkSize) {
      // eslint-disable-next-line no-await-in-loop
      const chunk = await new Promise<any[]>((resolve, reject) => {
        this.viewer.model.getBulkProperties(
          dbIds.slice(i, i + chunkSize),
          props,
          (res: any[]) => resolve(res),
          (err: any) => reject(err)
        );
      });
      results.push(...chunk);
    }
    return results;
  }

  /**
   * Convert viewer property result to ViewerAsset
   */
  private convertToAsset(result: any): ViewerAsset {
    const propsMap: Record<string, any> = {};
    
    // Flatten properties array
    if (result.properties && Array.isArray(result.properties)) {
      for (const prop of result.properties) {
        if (prop.displayName && prop.displayValue !== undefined) {
          propsMap[prop.displayName] = prop.displayValue;
        }
      }
    }

    const lowerMap: Record<string, any> = {};
    for (const k of Object.keys(propsMap)) {
      lowerMap[k.toLowerCase().trim()] = propsMap[k];
    }
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        if (propsMap[k] !== undefined) return propsMap[k];
        const lk = k.toLowerCase().trim();
        if (lowerMap[lk] !== undefined) return lowerMap[lk];
      }
      return undefined;
    };

    const category = pick('Category','Categoria') || 'Unknown';
    const family = pick('Family','Family Name','Famiglia');
    const type = pick('Type','Type Name','Tipo','Nome del tipo','Nome Tipo','Tipologia');
    // Level: try multiple Italian variants that contain full level names like "0 - Piano Terra"
    // Prioritize constraint/abaco fields which have full names, then fall back to generic level fields
    const level = pick(
      'Livello abaco','Vincolo di base','Vincolo parte superiore',
      'Base Level','Reference Level','Schedule Level',
      'Livello di base','Livello superiore',
      'Base Constraint','Top Constraint','Constraint','Vincolo',
      'Livello','Level','Piano'
    );
    const material = pick('Material','Structural Material','Materiale','Materiale strutturale');
    const room = pick('Room','Space','To Room','From Room','Locale','Locali','Aree');
    const brand = pick('Brand','Manufacturer','Marca','Produttore','Fabbricante','Costruttore');
    const model = pick('Model','Modello');
    const serialNumber = pick('Serial Number','Numero di Serie','Numero di serie','Matricola','Seriale') || pick('Mark','Contrassegno');
    
    // Extract ElementId and Mark explicitly for asset code priority
    const elementId = pick('ElementId', 'Element Id', 'elementId', 'element id');
    const mark = pick('Mark', 'Contrassegno');
    
    // Try to get instance name from properties (not family/type name)
    // Common instance name properties: 'Name', 'Nome', 'Mark', 'Contrassegno', 'Label', 'Etichetta'
    // These typically contain values like "ACE-RIS-Ventilconvettore-01 [180402]" or "RPC Tree - Deciduous [947273]"
    // CRITICAL: Use properties FIRST, never fall back to result.name which is often just "Element {dbId}"
    const nameFromProps = pick(
      'Name', 'Nome', 'Label', 'Etichetta', 
      'Element Name', 'Nome elemento',
      'Instance Name', 'Nome istanza'
    );
    
    // Use properties-based name if available, otherwise use type or category as fallback
    // NEVER use result.name as it's unreliable (often just "Element {dbId}")
    const displayName = nameFromProps || type || category || `Element ${result.dbId}`;

    // Log the name extraction for debugging - ALWAYS log to see what's happening
    try {
      const allProps = Object.keys(propsMap);
      const hasNameProp = allProps.some(k => k === 'Name' || k === 'Nome' || k.toLowerCase() === 'name');
      
      const allNameCandidates = {
        'dbId': result.dbId,
        'Total properties': allProps.length,
        'Has Name property': hasNameProp,
        'Name (exact)': propsMap['Name'],
        'Nome (exact)': propsMap['Nome'],
        'name (lowercase map)': lowerMap['name'],
        'nome (lowercase map)': lowerMap['nome'],
        'Label': propsMap['Label'],
        'Mark': propsMap['Mark'],
        'result.name (API default)': result.name,
        '---': '---',
        'nameFromProps (picked)': nameFromProps,
        'type (fallback)': type,
        'category (fallback)': category,
        'Final displayName': displayName,
        '---properties sample': allProps.slice(0, 15).join(', ')
      };
      
      // ALWAYS log for debugging
      console.log(`[ViewerLeafExtractor][convertToAsset] dbId ${result.dbId}:`, allNameCandidates);
    } catch {}

    return {
      dbId: result.dbId,
      externalId: result.externalId || '',
      name: displayName || `Element ${result.dbId}`,
      category,
      family,
      type,
      level,
      material,
      room,
      brand,
      model,
      serialNumber,
      elementId,  // Add explicitly for asset code priority
      mark,       // Add explicitly for asset code fallback
      properties: propsMap
    };
  }

  /**
   * Get asset statistics by category
   */
  getStatistics(assets: ViewerAsset[]): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const asset of assets) {
      stats[asset.category] = (stats[asset.category] || 0) + 1;
    }
    return stats;
  }

  /**
   * Filter assets by category
   */
  filterByCategory(assets: ViewerAsset[], categoryPattern: string): ViewerAsset[] {
    const regex = new RegExp(categoryPattern, 'i');
    return assets.filter(asset => regex.test(asset.category));
  }
}

// Utility: Test extraction in browser console
if (typeof window !== 'undefined') {
  (window as any).ViewerLeafAssetExtractor = ViewerLeafAssetExtractor;
  
  // Quick test function
  (window as any).testLeafExtraction = async function() {
    const viewer = (window as any).NOP_VIEWER;
    if (!viewer) {
      console.error('❌ No viewer found. Load a model first.');
      return;
    }
    
    console.log('🚀 [Test] Starting leaf node asset extraction...');
    const extractor = new ViewerLeafAssetExtractor(viewer);
    
    const assets = await extractor.extractAssets((progress) => {
      console.log(`📊 [${progress.stage}] ${progress.message} (${progress.progress}%)`);
    });
    
    console.log(`✅ [Test] Extracted ${assets.length} assets`);
    console.table(assets.slice(0, 10).map(a => ({
      dbId: a.dbId,
      name: a.name,
      category: a.category,
      family: a.family,
      level: a.level
    })));
    
    const stats = extractor.getStatistics(assets);
    console.log('📊 [Test] Statistics by category:');
    console.table(stats);
    
    return assets;
  };
}

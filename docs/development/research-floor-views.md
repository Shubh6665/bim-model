# Floor Views, AEC Levels, SVF2, and Viewer Versioning – Curated References

This document summarizes key APS (Autodesk Platform Services) resources, community answers, and sample repos relevant to implementing robust floor views and troubleshooting AEC Levels in the Viewer, especially with SVF2 and federated models.

---

## 1) Viewer Versioning (Stability)
- Versioning your Viewer-based app
  - https://aps.autodesk.com/blog/versioning-your-viewer-based-app
  - Pin Viewer to a specific major.minor (or exact) instead of wildcards to avoid unexpected behavior changes across releases.
- Always use versioning in production code (mirror post)
  - https://adndevblog.typepad.com/cloud_and_mobile/2016/09/forge-viewer-always-use-versioning-in-production-code.html

Action:
- Replace `7.*` with a stable `7.x.*` (or a known-good exact version) in script and stylesheet URLs.

---

## 2) Cut-Planes and AEC Levels (Core Mechanics)
- Viewer setCutPlanes (how to inspect/apply planes)
  - https://aps.autodesk.com/blog/viewer-setcutplanes
  - Shows Vector4 plane representation and using `getState().cutplanes`.
- Add Revit Levels and 2D Minimap to your 3D
  - https://aps.autodesk.com/blog/add-revit-levels-and-2d-minimap-your-3d
  - Uses `AECModelData.json`, discusses `globalOffset`, and integrating levels data into UX.
- Consume AEC Data from Model Derivative API
  - https://aps.autodesk.com/blog/consume-aec-data-which-are-model-derivative-api
  - Explains AEC derivatives (levels, grids, rooms). This is the data the Levels extension relies on.

Notes:
- The AEC Levels extension manipulates cut planes to create a floor “band.” If `sectionCap` is enabled, top may appear visually closed (capped). Toggle capping via `viewer.prefs.set('sectionCap', false)`.
- Ensure all models share consistent `globalOffset` and unit scales when federating.

---

## 3) AEC Levels Limitations (NWC/NWD, IFC)
- Not able to retrieve floor data using `Autodesk.AEC.LevelsExtension` in NWC file
  - https://stackoverflow.com/questions/65506902/not-able-retrieve-floor-data-using-autodesk-aec-levelsextension-in-nwc-file
  - Floor data may be unavailable for NWC; Levels extension primarily targets Revit AEC data.
- About floor level and height in SVF conversion of NWD file
  - https://stackoverflow.com/questions/59818712/about-floor-level-and-height-in-svf-conversion-of-nwd-file
  - NWD → SVF/SVF2 may not contain Revit-like AEC level info; you may need to compute levels yourself.
- How to locate the level/floor of an object
  - https://stackoverflow.com/questions/65122237/how-to-locale-the-level-or-floor-of-the-object-in-autodesk-forge-viewer/65123106#65123106
  - Use AEC data where available; otherwise infer via elevation, categories, or custom mapping.

Action:
- If AEC data is missing, implement a fallback: compute levels from element elevations or use a vertical explode pattern for navigation.

---

## 4) 2D Views (RVT/DWG, SVF2)
- Advanced option for RVT/DWG 2D views on SVF(2) POST Job
  - https://aps.autodesk.com/blog/advanced-option-rvtdwg-2d-views-svf2-post-job
  - `advanced: { "2dviews": "pdf" }` controls 2D output; RVT 2022+ defaults to PDFs. Useful if you need 2D sheets.
- Navigating between 2D views
  - https://aps.autodesk.com/blog/navigating-between-2d-views
  - Patterns for switching among 2D sheets.

Note:
- 2D sheets are separate from AEC Levels (which slice 3D). Both can be combined in UX.

---

## 5) Vertical Explode / Alternative Floor Navigation
- View each floor using Vertical Explode (blog)
  - https://aps.autodesk.com/blog/view-each-floor-using-vertical-explode
- Sample repo (live demo)
  - https://github.com/wallabyway/floor-animation
- Selective explode in the viewer (control which parts explode)
  - https://aps.autodesk.com/blog/selective-explode-viewer

Use when:
- AEC Levels data is missing (IFC/NWD), or you want “exploded floors” UX instead of slicing.

---

## 6) SVF2 Data Caveats
- SVF2 format retrieves missing/incorrect data on IFC/RVT (discussion)
  - https://stackoverflow.com/questions/72815637/svf2-format-retrieves-missing-or-incorrect-data-from-model-derivative-on-ifc-and/72817870#72817870

Notes:
- Some IFC/RVT properties can be inconsistent in SVF2. If you rely on `Level` properties or IFC GUIDs, validate against AEC derivatives or implement fallbacks.

---

## 7) Boolean/CSG (Advanced Sectioning)
- Boolean Operations in the Viewer
  - https://aps.autodesk.com/blog/boolean-operations-forge-viewer
- ThreeCSG
  - https://github.com/chandlerprall/ThreeCSG

Use when:
- You want custom section shapes or advanced cutouts beyond standard cut planes.

---

## 8) Misc. Floor View Q&A
- Suggestions for 2D view of floor view
  - https://stackoverflow.com/questions/39533258/autodesk-viewer-suggestions-for-2d-view-of-floor-view
  - Discussion on combining 2D/3D, floor plans, isolation, and UI patterns.

---

## Actionable Checklist for Our App
1) Pin Viewer version
   - Change Viewer script/css URLs from `7.*` to a specific `7.x.*` or exact version to stabilize behavior.
2) Verify translation payload
   - Ensure `svf2` is used with `advanced.generateMasterViews: true` (for robust AEC & rooms). For RVT/DWG 2D sheets, set `advanced: { "2dviews": "pdf" }` where applicable.
3) Validate AEC data presence
   - For Revit-based URNs, confirm `AECModelData.json` exists in the manifest; otherwise provide fallback level detection.
4) Federated alignment
   - Load primary first, then overlays with `keepCurrentModels: true`, consistent `globalOffset`, and `applyRefPoint`.
5) Cut-plane UX
   - When using AEC Levels, temporarily set `viewer.prefs.set('sectionCap', false)` to keep the top open; clear named cut-planes when leaving floor mode.
6) Fallback navigation
   - If AEC data absent (IFC/NWD), consider vertical explode with per-floor isolation.

---

## Where This Is Used in Our Code
- Viewer setup & versioning: `app/components/forge-viewer.tsx` (script/style URLs, Levels extension integration)
- Floor/Levels UX: `app/components/floor-data-view.tsx` and `app/components/bim-panel.tsx`
- Multi-model loading & visibility: `app/components/forge-viewer.tsx`
- Debug helpers added:
  - Cut-plane dumps, AEC floor event logging, model meta logging (globalOffset, unitScale, bbox)

---

## Quick Console Snippets
- Toggle cap surfaces off while testing floors:
  ```js
  __VIEWER__.prefs.set('sectionCap', false);
  __AEC_DBG__.dump('after toggling cap');
  ```
- Clear floor-selector cut planes and restore 3D:
  ```js
  __VIEWER__.setCutPlanes([], 'Autodesk.AEC.FloorSelector');
  ```
- Inspect floors detected by AEC Levels:
  ```js
  __AEC_DBG__.getFloors();
  ```

---

## References (Full List)
- Versioning your Viewer-based app — https://aps.autodesk.com/blog/versioning-your-viewer-based-app
- Always use versioning in production — https://adndevblog.typepad.com/cloud_and_mobile/2016/09/forge-viewer-always-use-versioning-in-production-code.html
- Viewer setCutPlanes — https://aps.autodesk.com/blog/viewer-setcutplanes
- Boolean Operations — https://aps.autodesk.com/blog/boolean-operations-forge-viewer
- ThreeCSG — https://github.com/chandlerprall/ThreeCSG
- Suggestions for 2D floor view — https://stackoverflow.com/questions/39533258/autodesk-viewer-suggestions-for-2d-view-of-floor-view
- AEC search — https://aps.autodesk.com/search/?s=floor+aec+rvt+svf2&from=https%3A%2F%2Faps.autodesk.com%2F
- LevelsExtension in NWC — https://stackoverflow.com/questions/65506902/not-able-retrieve-floor-data-using-autodesk-aec-levelsextension-in-nwc-file
- Floor data from NWD — https://stackoverflow.com/questions/59818712/about-floor-level-and-height-in-svf-conversion-of-nwd-file
- Locate object floor — https://stackoverflow.com/questions/65122237/how-to-locale-the-level-or-floor-of-the-object-in-autodesk-forge-viewer/65123106#65123106
- SVF2 missing/incorrect data — https://stackoverflow.com/questions/72815637/svf2-format-retrieves-missing-or-incorrect-data-from-model-derivative-on-ifc-and/72817870#72817870
- Displaying SVF/SVF2 in Viewer — https://aps.autodesk.com/en/docs/model-derivative/v2/developers_guide/basics/preperation/#displaying-svf-svf2-files-in-the-viewer
- Advanced option for 2D views — https://aps.autodesk.com/blog/advanced-option-rvtdwg-2d-views-svf2-post-job
- View each floor using Vertical Explode — https://aps.autodesk.com/blog/view-each-floor-using-vertical-explode
- Selective explode — https://aps.autodesk.com/blog/selective-explode-viewer
- Floor animation demo repo — https://github.com/wallabyway/floor-animation
- Add Revit Levels & 2D Minimap — https://aps.autodesk.com/blog/add-revit-levels-and-2d-minimap-your-3d
- Navigating between 2D views — https://aps.autodesk.com/blog/navigating-between-2d-views

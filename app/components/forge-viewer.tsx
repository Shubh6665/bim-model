"use client";

import React, { useEffect, useRef, useState } from "react";

const SENSOR_TYPE_COLORS: Record<string, string> = {
  Temperature: "#ef4444",
  CO2: "#22c55e",
  Light: "#fde047",
  Humidity: "#3b82f6",
  "Seismic and accelerometric": "#a21caf",
  "Energy consumption": "#14b8a6",
};

const SENSOR_TYPE_ICONS: Record<string, string> = {
  Temperature: "T",
  CO2: "C",
  Light: "L",
  Humidity: "H",
  "Seismic and accelerometric": "S",
  "Energy consumption": "E",
};

interface ForgeViewerProps {
  accessToken: string;
  urn: string;
  insertMode?: string | null; // sensor type or null
  onSensorPlaced?: (sensor: any) => void;
}

const ForgeViewer: React.FC<ForgeViewerProps> = ({
  accessToken,
  urn,
  insertMode,
  onSensorPlaced,
}) => {
  const viewerContainer = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataVizExt, setDataVizExt] = useState<any>(null);
  const [viewableData, setViewableData] = useState<any>(null);
  const [sensorStyles, setSensorStyles] = useState<Record<string, any>>({});

  // Helper: create SVG icon data URL
  function createIconDataUrl(type: string, color: string) {
    const icon = SENSOR_TYPE_ICONS[type] || "•";
    const svg = `<svg width='32' height='32' xmlns='http://www.w3.org/2000/svg'><circle cx='16' cy='16' r='14' fill='${color}' stroke='white' stroke-width='2'/><text x='16' y='22' text-anchor='middle' font-size='16' fill='white'>${icon}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // On mount: load viewer and DataViz
  useEffect(() => {
    if (!viewerContainer.current || !accessToken || !urn) return;
    let viewerInstance: any = null;
    let dataViz: any = null;
    let viewableDataObj: any = null;
    let styles: Record<string, any> = {};

    const initializeViewer = () => {
      const Autodesk = (window as any).Autodesk;
      if (!Autodesk || !Autodesk.Viewing) {
        setError("Forge Viewer SDK not loaded");
        return;
      }
      const options = {
        env: "AutodeskProduction",
        getAccessToken: (callback: (token: string, expire: number) => void) => {
          callback(accessToken, 3600);
        },
      };
      Autodesk.Viewing.Initializer(options, () => {
        viewerInstance = new Autodesk.Viewing.GuiViewer3D(viewerContainer.current);
        const startedCode = viewerInstance.start();
        if (startedCode > 0) {
          setError("Failed to create a Viewer: WebGL not supported.");
          return;
        }
        setViewer(viewerInstance);
        const documentId = `urn:${urn}`;
        Autodesk.Viewing.Document.load(
          documentId,
          (doc: any) => {
            const viewables = doc.getRoot().getDefaultGeometry();
            if (viewables) {
              viewerInstance.loadDocumentNode(doc, viewables).then(async () => {
                setIsLoading(false);
                await new Promise((resolve) => setTimeout(resolve, 1000));
                // Load DataViz extension
                try {
                  dataViz = await viewerInstance.loadExtension("Autodesk.DataVisualization");
                  setDataVizExt(dataViz);
                  console.log("[DataViz] Extension loaded:", dataViz);
                  // Set up styles for each sensor type
                  const DataVizCore = (window as any).Autodesk.DataVisualization.Core;
                  for (const type of Object.keys(SENSOR_TYPE_COLORS)) {
                    const color = SENSOR_TYPE_COLORS[type];
                    const iconUrl = createIconDataUrl(type, color);
                    styles[type] = new DataVizCore.ViewableStyle(
                      DataVizCore.ViewableType.SPRITE,
                      new (window as any).THREE.Color(color),
                      iconUrl,
                      undefined, // highlightedColor
                      false      // occlusion: false = always on top
                    );
                    console.log(`[DataViz] Created style for ${type}:`, styles[type]);
                  }
                  setSensorStyles(styles);
                  // Set up viewable data
                  viewableDataObj = new DataVizCore.ViewableData();
                  viewableDataObj.spriteSize = 48; // Increase sprite size
                  viewableDataObj.screenSpace = true; // Keep sprite size constant on zoom
                  setViewableData(viewableDataObj);
                  console.log("[DataViz] ViewableData created:", viewableDataObj);
                } catch (err) {
                  setError("Failed to load Data Visualization extension");
                  console.error("[DataViz] Error loading extension:", err);
                }
              });
            } else {
              setError("No viewable content found");
              setIsLoading(false);
            }
          },
          (errorCode: any) => {
            setError(`Failed to load document: ${errorCode}`);
            setIsLoading(false);
          }
        );
      });
    };
    // Load Forge Viewer SDK if not already loaded
    if (!(window as any).Autodesk) {
      const script = document.createElement("script");
      script.src = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
      script.onload = initializeViewer;
      script.onerror = () => setError("Failed to load Forge Viewer SDK");
      document.head.appendChild(script);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.type = "text/css";
      link.href = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css";
      document.head.appendChild(link);
    } else {
      initializeViewer();
    }
    return () => {
      if (viewerInstance) {
        viewerInstance.finish();
      }
    };
  }, [accessToken, urn]);

  // Insert mode: listen for clicks in the viewer and add DataViz sprite
  useEffect(() => {
    if (!viewer || !dataVizExt || !viewableData || !insertMode || !sensorStyles[insertMode]) {
      if (!viewer) console.log("[InsertMode] Viewer not ready");
      if (!dataVizExt) console.log("[InsertMode] DataViz extension not ready");
      if (!viewableData) console.log("[InsertMode] ViewableData not ready");
      if (!insertMode) console.log("[InsertMode] Not in insert mode");
      if (insertMode && !sensorStyles[insertMode]) console.log(`[InsertMode] No style for type: ${insertMode}`);
      return;
    }
    console.log(`[InsertMode] Ready for placement: type=${insertMode}`);
    const DataVizCore = (window as any).Autodesk.DataVisualization.Core;
    const handleClick = (event: MouseEvent) => {
      const rect = viewerContainer.current?.getBoundingClientRect();
      if (!rect) {
        console.log("[InsertMode] No bounding rect for viewer container");
        return;
      }
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hit = viewer.impl?.hitTest(x, y, true);
      console.log(`[InsertMode] Click at (${x}, ${y}), hit=`, hit);
      if (hit && hit.intersectPoint) {
        const position = hit.intersectPoint;
        console.log(`[InsertMode] Placing sprite at:`, position);
        // Create sprite viewable
        try {
          const sprite = new DataVizCore.SpriteViewable(
            new (window as any).THREE.Vector3(position.x, position.y, position.z),
            sensorStyles[insertMode],
            Date.now() // unique id
          );
          viewableData.addViewable(sprite);
          dataVizExt.addViewables(viewableData);
          viewer.impl.invalidate(true, true, true); // Force redraw so sprites appear immediately
          console.log(`[InsertMode] Sprite created and rendered for type ${insertMode}`);
          if (onSensorPlaced) {
            onSensorPlaced({
              id: `sensor_${Date.now()}`,
              type: insertMode,
              position,
              color: SENSOR_TYPE_COLORS[insertMode] || "#888",
            });
          }
        } catch (err) {
          console.error("[InsertMode] Error creating/rendering sprite:", err);
        }
      } else {
        console.log("[InsertMode] No intersection point found for click");
      }
    };
    const container = viewerContainer.current;
    if (container) {
      container.addEventListener("click", handleClick);
      container.style.cursor = "crosshair";
    }
    return () => {
      if (container) {
        container.removeEventListener("click", handleClick);
        container.style.cursor = "default";
      }
    };
  }, [viewer, dataVizExt, viewableData, insertMode, sensorStyles, onSensorPlaced]);

  if (error) {
    return (
      <div className="forge-viewer-error">
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        ref={viewerContainer}
        style={{ width: "100%", height: "100vh", background: "#222" }}
      />
      {isLoading && (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", color: "#fff", zIndex: 10 }}>
          Loading model...
        </div>
      )}
    </div>
  );
};

export default ForgeViewer; 
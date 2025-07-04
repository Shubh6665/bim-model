"use client";

import React, { useRef, useCallback, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Environment,
  Html,
  useGLTF,
} from "@react-three/drei";
import { AxesHelper as ThreeAxesHelper } from "three";
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move3D,
  FileText,
  AlertCircle,
} from "lucide-react";
import { RVTConversionInterface } from "./rvt-conversion-interface";
import { ConversionResult } from "@/app/services/rvt-converter";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} dispose={null} />;
}

function Scene({ modelUrl }: { modelUrl?: string }) {
  const meshRef = useRef<any>(null);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.1;
  });

  if (modelUrl) {
    return <Model url={modelUrl} />;
  }

  return (
    <group ref={meshRef}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#4f46e5" />
      </mesh>
      <mesh position={[3, 0, 0]}>
        <cylinderGeometry args={[1, 1, 2]} />
        <meshStandardMaterial color="#06b6d4" />
      </mesh>
      <mesh position={[-3, 0, 0]}>
        <sphereGeometry args={[1]} />
        <meshStandardMaterial color="#10b981" />
      </mesh>
    </group>
  );
}

function ViewCube() {
  const { camera } = useThree();

  const handleViewChange = useCallback(
    (direction: string) => {
      const distance = 10;
      switch (direction) {
        case "front":
          camera.position.set(0, 0, distance);
          break;
        case "back":
          camera.position.set(0, 0, -distance);
          break;
        case "left":
          camera.position.set(-distance, 0, 0);
          break;
        case "right":
          camera.position.set(distance, 0, 0);
          break;
        case "top":
          camera.position.set(0, distance, 0);
          break;
        case "bottom":
          camera.position.set(0, -distance, 0);
          break;
      }
      camera.lookAt(0, 0, 0);
    },
    [camera]
  );

  return (
    <Html position={[8, 6, 0]} style={{ pointerEvents: "auto" }}>
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-2 border border-gray-600">
        <div className="grid grid-cols-3 gap-1 w-16 h-16">
          <div></div>
          <button
            onClick={() => handleViewChange("top")}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xs rounded flex items-center justify-center transition-colors"
          >
            T
          </button>
          <div></div>
          <button
            onClick={() => handleViewChange("left")}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xs rounded flex items-center justify-center transition-colors"
          >
            L
          </button>
          <button
            onClick={() => handleViewChange("front")}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xs rounded flex items-center justify-center transition-colors"
          >
            F
          </button>
          <button
            onClick={() => handleViewChange("right")}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xs rounded flex items-center justify-center transition-colors"
          >
            R
          </button>
          <div></div>
          <button
            onClick={() => handleViewChange("bottom")}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xs rounded flex items-center justify-center transition-colors"
          >
            B
          </button>
          <div></div>
        </div>
      </div>
    </Html>
  );
}

interface ThreeDViewerProps {
  modelUrl?: string;
  hasProject: boolean;
  onResetView: () => void;
  selectedFile?: {
    id: string;
    name: string;
    type: string;
    size: string;
    modified: string;
    isRVT?: boolean;
  } | null;
}

// Add mock BIM viewer component
function MockBIMViewer({ fileName }: { fileName: string }) {
  const [viewMode, setViewMode] = useState<"3d" | "floor" | "section">("3d");

  return (
    <div className="absolute inset-0 bg-gray-900 flex flex-col">
      {/* Mock BIM Toolbar */}
      <div className="bg-gray-800 border-b border-gray-600 p-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
              <FileText className="w-3 h-3 text-white" />
            </div>
            <span className="text-white text-sm font-medium">{fileName}</span>
            <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded">
              MOCK
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode("3d")}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              viewMode === "3d"
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            3D View
          </button>
          <button
            onClick={() => setViewMode("floor")}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              viewMode === "floor"
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            Floor Plan
          </button>
          <button
            onClick={() => setViewMode("section")}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              viewMode === "section"
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            Section
          </button>
        </div>
      </div>

      {/* Mock 3D Content */}
      <div className="flex-1 relative bg-gradient-to-br from-gray-700 to-gray-900">
        {/* Simulated building model */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Building outline */}
            <div className="w-48 h-32 bg-gray-600 border-2 border-gray-400 relative transform rotate-12 shadow-2xl">
              {/* Floors */}
              <div className="absolute inset-x-2 top-2 h-6 bg-gray-500 border border-gray-400"></div>
              <div className="absolute inset-x-2 top-10 h-6 bg-gray-500 border border-gray-400"></div>
              <div className="absolute inset-x-2 top-18 h-6 bg-gray-500 border border-gray-400"></div>

              {/* Windows */}
              <div className="absolute top-4 left-4 w-4 h-2 bg-blue-300"></div>
              <div className="absolute top-4 right-4 w-4 h-2 bg-blue-300"></div>
              <div className="absolute top-12 left-4 w-4 h-2 bg-blue-300"></div>
              <div className="absolute top-12 right-4 w-4 h-2 bg-blue-300"></div>
              <div className="absolute top-20 left-4 w-4 h-2 bg-blue-300"></div>
              <div className="absolute top-20 right-4 w-4 h-2 bg-blue-300"></div>
            </div>

            {/* Shadow */}
            <div className="absolute top-2 left-2 w-48 h-32 bg-black/20 transform rotate-12 -z-10"></div>
          </div>
        </div>

        {/* Mock controls overlay */}
        <div className="absolute bottom-4 left-4 bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 border border-gray-600">
          <p className="text-white text-sm font-medium mb-2">Mock BIM Viewer</p>
          <p className="text-gray-300 text-xs mb-3">
            This demonstrates how your RVT file would appear after conversion
          </p>
          <div className="space-y-2">
            <div className="flex items-center text-xs text-gray-300">
              <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
              <span>Structural Elements: 156</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
              <span>MEP Systems: 89</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
              <span>Architectural: 203</span>
            </div>
          </div>
        </div>

        {/* Mock properties panel */}
        <div className="absolute top-4 right-4 bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 border border-gray-600 w-48">
          <p className="text-white text-sm font-medium mb-2">
            Element Properties
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-gray-300">
              <span>Type:</span>
              <span>Wall</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Height:</span>
              <span>3.2m</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Material:</span>
              <span>Concrete</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Level:</span>
              <span>Ground Floor</span>
            </div>
          </div>
        </div>

        {/* Watermark */}
        <div className="absolute bottom-4 right-4 text-gray-500 text-xs opacity-50">
          Powered by BIM Viewer Pro
        </div>
      </div>
    </div>
  );
}

export function ThreeDViewer({
  modelUrl,
  hasProject,
  onResetView,
  selectedFile,
}: ThreeDViewerProps) {
  const controlsRef = useRef<any>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showRVTInterface, setShowRVTInterface] = useState(false);
  const [showMockViewer, setShowMockViewer] = useState(false);

  // Check if selected file is RVT
  React.useEffect(() => {
    if (selectedFile?.isRVT) {
      setShowRVTInterface(true);
      setShowMockViewer(false);
    } else {
      setShowRVTInterface(false);
      setShowMockViewer(false);
    }
  }, [selectedFile]);

  const handleResetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
    onResetView();
  };

  const handleInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      setShowInstructions(false);
    }
  };

  const handleConversionComplete = (result: ConversionResult) => {
    console.log("Conversion completed:", result);
    setShowRVTInterface(false);
    // Here you would load the converted file
    // For now, we'll show the mock viewer
    setShowMockViewer(true);
  };

  const handleCloseConversion = () => {
    setShowRVTInterface(false);
  };

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* RVT Conversion Interface */}
      {showRVTInterface && selectedFile && (
        <RVTConversionInterface
          fileName={selectedFile.name}
          fileSize={
            parseInt(selectedFile.size.replace(" MB", "")) * 1024 * 1024
          }
          onConversionComplete={handleConversionComplete}
          onClose={handleCloseConversion}
        />
      )}

      {/* Mock BIM Viewer */}
      {showMockViewer && selectedFile && (
        <MockBIMViewer fileName={selectedFile.name} />
      )}

      {/* 3D Canvas */}
      <div
        onMouseDown={handleInteraction}
        onWheel={handleInteraction}
        onTouchStart={handleInteraction}
        className="w-full h-full"
      >
        <Canvas
          camera={{ position: [5, 5, 5], fov: 60 }}
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          }}
        >
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-10, -10, -10]} intensity={0.3} />

          {/* Environment */}
          <Environment preset="studio" />

          {/* Professional Grid System */}
          <Grid
            args={[50, 50]}
            cellSize={1}
            cellThickness={0.8}
            cellColor="#374151"
            sectionSize={10}
            sectionThickness={1.2}
            sectionColor="#4b5563"
            fadeDistance={50}
            fadeStrength={1}
            followCamera={false}
            infiniteGrid={true}
          />

          {/* Main Axes Helper */}
          <primitive object={useMemo(() => new ThreeAxesHelper(5), [])} />

          {/* 3D Scene */}
          <Scene modelUrl={modelUrl} />

          {/* View Cube */}
          <ViewCube />

          {/* Controls */}
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={1}
            maxDistance={100}
            maxPolarAngle={Math.PI}
          />
        </Canvas>
      </div>

      {/* Pixel Perfect Corner Axis Indicator - Bottom Left */}
      <div className="absolute bottom-4 left-4 w-20 h-20 bg-gray-800/95 backdrop-blur-sm rounded-lg border border-gray-600/50 flex items-center justify-center shadow-lg">
        <div className="relative w-12 h-12">
          {/* X Axis - Red */}
          <div className="absolute top-6 left-6 w-5 h-0.5 bg-red-500 origin-left"></div>
          <span className="absolute top-5 left-11 text-red-500 text-xs font-bold">
            X
          </span>

          {/* Y Axis - Green */}
          <div className="absolute top-1 left-6 w-0.5 h-5 bg-green-500 origin-bottom"></div>
          <span className="absolute -top-1 left-5 text-green-500 text-xs font-bold">
            Y
          </span>

          {/* Z Axis - Blue (diagonal) */}
          <div className="absolute top-6 left-2 w-4 h-0.5 bg-blue-500 transform rotate-45 origin-left"></div>
          <span className="absolute top-4 left-0 text-blue-500 text-xs font-bold">
            Z
          </span>

          {/* Center dot */}
          <div className="absolute top-6 left-6 w-1 h-1 bg-white rounded-full transform -translate-x-0.5 -translate-y-0.5"></div>
        </div>
      </div>

      {/* Navigation Controls - Top Right */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          className="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 text-white border border-gray-600 rounded-md flex items-center justify-center transition-colors"
          onClick={() => {
            handleResetView();
            handleInteraction();
          }}
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          className="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 text-white border border-gray-600 rounded-md flex items-center justify-center transition-colors"
          onClick={handleInteraction}
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          className="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 text-white border border-gray-600 rounded-md flex items-center justify-center transition-colors"
          onClick={handleInteraction}
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          className="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 text-white border border-gray-600 rounded-md flex items-center justify-center transition-colors"
          onClick={handleInteraction}
          title="Pan Mode"
        >
          <Move3D className="w-4 h-4" />
        </button>
      </div>

      {/* Instructions Overlay - Show initially, hide on interaction */}
      {showInstructions && !hasProject && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="p-8 bg-gray-800/90 border border-gray-700 rounded-lg text-center backdrop-blur-sm shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">
              3D BIM Viewer
            </h3>
            <p className="text-gray-300 mb-6">
              Upload your 3D models to get started
            </p>
            <div className="text-sm text-gray-400 space-y-2 border-t border-gray-600 pt-4">
              <p className="font-medium text-gray-300 mb-3">
                Navigation Controls:
              </p>
              <div className="grid grid-cols-1 gap-2 text-left max-w-xs mx-auto">
                <p>
                  • <span className="text-blue-400">Left click + drag</span> to
                  rotate
                </p>
                <p>
                  • <span className="text-green-400">Right click + drag</span>{" "}
                  to pan
                </p>
                <p>
                  • <span className="text-yellow-400">Scroll wheel</span> to
                  zoom
                </p>
                <p>
                  • <span className="text-purple-400">View cube</span> for quick
                  angles
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

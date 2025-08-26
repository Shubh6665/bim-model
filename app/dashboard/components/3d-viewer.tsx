"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { RVTForgeInterface } from "./rvt-forge-interface";
import ForgeViewer from "../../components/forge-viewer";
import type { ProjectModel } from "@/app/types/projects";
import { forgeAuthService } from "@/app/services/forge-service";

interface ThreeDViewerProps {
  selectedFile?: {
    id: string;
    name: string;
    type: string;
    size: string;
    modified: string;
    isRVT?: boolean;
    urn?: string; // Add URN support for pre-processed files
    lat?: number;
    lng?: number;
    description?: string;
  } | null;
  models?: ProjectModel[]; // optional federated models for overlay
  enabledModelIds?: Set<string>; // Track which models should be visible
  onViewerReady?: (viewer: any, iotExtension: any) => void;
  insertMode?: string | null;
  onExitInsertMode?: () => void;
  onSensorClick?: (sensorId: string) => void;
  onEmptyClick?: () => void;
  activePanel?: 'bim' | 'iot' | 'database' | 'ai' | 'fm' | null;
  wireframeMode?: boolean;
  onWireframeModeChange?: (wireframe: boolean) => void;
  sensorsVisible?: boolean;
  onModelProcessed?: (modelId: string, urn: string) => void;
}

export function ThreeDViewer({
  selectedFile,
  models,
  enabledModelIds,
  onViewerReady,
  insertMode,
  onExitInsertMode,
  onSensorClick,
  onEmptyClick,
  activePanel,
  wireframeMode,
  onWireframeModeChange,
  sensorsVisible,
  onModelProcessed,
}: ThreeDViewerProps) {
  const [showRVTInterface, setShowRVTInterface] = useState(false);
  const [forgeData, setForgeData] = useState<{
    accessToken: string;
    urn: string;
  } | null>(null);
  const [isLoadingForge, setIsLoadingForge] = useState(false);

  // Check if selected file is RVT or has existing URN
  useEffect(() => {
    if (selectedFile?.urn) {
      // File already has URN, load directly
      setShowRVTInterface(false);
      setIsLoadingForge(true);

      forgeAuthService
        .getAccessToken()
        .then((accessToken) => {
          setForgeData({ accessToken, urn: selectedFile.urn! });
        })
        .catch((error) => {
          console.error("Failed to get access token for viewer:", error);
        })
        .finally(() => {
          setIsLoadingForge(false);
        });
    } else if (selectedFile?.isRVT) {
      // File needs processing
      setShowRVTInterface(true);
      setForgeData(null);
    } else {
      // No file selected or unsupported file type
      setShowRVTInterface(false);
      setForgeData(null);
    }
  }, [selectedFile]);

  const handleProcessingComplete = async (urn: string) => {
    console.log("Processing completed, URN:", urn);
    setShowRVTInterface(false);
    setIsLoadingForge(true);

    try {
      // Get access token for the viewer
      const accessToken = await forgeAuthService.getAccessToken();
      setForgeData({ accessToken, urn });
      // If the file is a model that was just processed, find the corresponding model
      // in the project's model list and update its URN.
      if (onModelProcessed && selectedFile && selectedFile.isRVT) {
        // Find the first model that doesn't have a URN yet, as it's the one being processed.
        const modelToUpdate = models?.find((m) => !m.urn);
        if (modelToUpdate) {
          onModelProcessed(modelToUpdate.id, urn);
        } else {
          console.warn(
            "Could not find a model to update with the new URN. Please check project data."
          );
        }
      }
    } catch (error) {
      console.error("Failed to get access token for viewer:", error);
    } finally {
      setIsLoadingForge(false);
    }
  };

  const handleCloseProcessing = () => {
    setShowRVTInterface(false);
  };

  // Determine what to render
  const shouldShowForgeViewer = forgeData && selectedFile;
  const shouldShowRVTInterface = showRVTInterface && selectedFile;
  const shouldShowEmptyState = !forgeData && !showRVTInterface;

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* RVT Processing Interface */}
      {shouldShowRVTInterface && (
        <RVTForgeInterface
          fileName={selectedFile!.name}
          fileSize={
            parseInt(selectedFile!.size.replace(" MB", "")) * 1024 * 1024
          }
          onProcessingComplete={handleProcessingComplete}
          onClose={handleCloseProcessing}
        />
      )}

      {/* Forge Viewer */}
      {shouldShowForgeViewer && (
        <ForgeViewer
          accessToken={forgeData!.accessToken}
          urn={forgeData!.urn}
          models={models}
          enabledModelIds={enabledModelIds}
          insertMode={insertMode}
          onExitInsertMode={onExitInsertMode}
          onSensorClick={onSensorClick}
          onEmptyClick={onEmptyClick}
          activePanel={activePanel}
          wireframeMode={wireframeMode}
          onWireframeModeChange={onWireframeModeChange}
          onViewerReady={onViewerReady}
          sensorsVisible={sensorsVisible}
        />
      )}

      {/* Loading Forge */}
      {isLoadingForge && (
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-600 shadow-xl">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="text-white font-medium">
                Loading Forge viewer...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State - Show when no file is selected */}
      {shouldShowEmptyState && (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <div className="text-center">
            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              Select a Project to View
            </h3>
            <p className="text-gray-400 mb-4">
              Choose an RVT file from the project panel to start viewing your
              BIM model
            </p>
            <div className="text-sm text-gray-500">
              <p>• Click on any RVT file to process and view</p>
              <p>• Files will be processed using Autodesk Forge</p>
              <p>• View your models with professional BIM tools</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

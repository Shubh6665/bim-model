"use client";

import React, { useState, useRef } from "react";
import {
  FileText,
  AlertCircle,
  Upload,
  Download,
  Settings,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Globe,
  Monitor,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import {
  rvtConverter,
  ConversionOptions,
  ConversionResult,
} from "@/app/services/rvt-converter";

interface RVTConversionInterfaceProps {
  fileName: string;
  fileSize: number;
  onConversionComplete: (result: ConversionResult) => void;
  onClose: () => void;
}

export function RVTConversionInterface({
  fileName,
  fileSize,
  onConversionComplete,
  onClose,
}: RVTConversionInterfaceProps) {
  const [selectedMethod, setSelectedMethod] = useState<
    "forge" | "local" | "manual"
  >("forge");
  const [conversionOptions, setConversionOptions] = useState<ConversionOptions>(
    {
      format: "gltf",
      quality: "medium",
      includeMetadata: true,
    }
  );
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [conversionResult, setConversionResult] =
    useState<ConversionResult | null>(null);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recommendations = rvtConverter.getConversionRecommendations(fileSize);

  const handleConversion = async () => {
    if (!fileInputRef.current?.files?.[0]) return;

    const file = fileInputRef.current.files[0];
    setIsConverting(true);
    setConversionProgress(0);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setConversionProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      let result: ConversionResult;

      if (selectedMethod === "forge") {
        result = await rvtConverter.convertWithForge(file, conversionOptions);
      } else {
        result = await rvtConverter.convertLocally(file, conversionOptions);
      }

      clearInterval(progressInterval);
      setConversionProgress(100);
      setConversionResult(result);

      if (result.success) {
        setTimeout(() => {
          onConversionComplete(result);
        }, 1000);
      }
    } catch (error) {
      clearInterval(progressInterval);
      setConversionResult({
        success: false,
        error: "Conversion failed",
        format: conversionOptions.format,
        fileSize: 0,
      });
    } finally {
      setIsConverting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="bg-gray-800 rounded-xl p-8 max-w-2xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mr-4">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">
                RVT File Conversion
              </h3>
              <p className="text-gray-300 text-sm">{fileName}</p>
              <p className="text-gray-400 text-xs">
                {formatFileSize(fileSize)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Conversion Methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Forge API Method */}
          <div
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedMethod === "forge"
                ? "border-blue-500 bg-blue-500/10"
                : "border-gray-600 hover:border-gray-500"
            }`}
            onClick={() => setSelectedMethod("forge")}
          >
            <div className="flex items-center mb-2">
              <Globe className="w-5 h-5 text-blue-400 mr-2" />
              <span className="font-medium text-white">Forge API</span>
            </div>
            <p className="text-gray-300 text-sm mb-2">
              Cloud-based conversion using Autodesk's API
            </p>
            <div className="flex items-center text-xs text-gray-400">
              <Zap className="w-3 h-3 mr-1" />
              <span>Fast & Reliable</span>
            </div>
          </div>

          {/* Local Conversion */}
          <div
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedMethod === "local"
                ? "border-green-500 bg-green-500/10"
                : "border-gray-600 hover:border-gray-500"
            }`}
            onClick={() => setSelectedMethod("local")}
          >
            <div className="flex items-center mb-2">
              <Monitor className="w-5 h-5 text-green-400 mr-2" />
              <span className="font-medium text-white">Local Conversion</span>
            </div>
            <p className="text-gray-300 text-sm mb-2">
              Convert using your browser's processing power
            </p>
            <div className="flex items-center text-xs text-gray-400">
              <Clock className="w-3 h-3 mr-1" />
              <span>Slower but Private</span>
            </div>
          </div>

          {/* Manual Guide */}
          <div
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedMethod === "manual"
                ? "border-purple-500 bg-purple-500/10"
                : "border-gray-600 hover:border-gray-500"
            }`}
            onClick={() => setSelectedMethod("manual")}
          >
            <div className="flex items-center mb-2">
              <BookOpen className="w-5 h-5 text-purple-400 mr-2" />
              <span className="font-medium text-white">Manual Guide</span>
            </div>
            <p className="text-gray-300 text-sm mb-2">
              Step-by-step instructions for manual conversion
            </p>
            <div className="flex items-center text-xs text-gray-400">
              <ExternalLink className="w-3 h-3 mr-1" />
              <span>External Software</span>
            </div>
          </div>
        </div>

        {/* Conversion Options */}
        {selectedMethod !== "manual" && (
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <div className="flex items-center mb-4">
              <Settings className="w-5 h-5 text-gray-300 mr-2" />
              <h4 className="text-white font-medium">Conversion Options</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Format
                </label>
                <select
                  value={conversionOptions.format}
                  onChange={(e) =>
                    setConversionOptions((prev) => ({
                      ...prev,
                      format: e.target.value as any,
                    }))
                  }
                  className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white text-sm"
                >
                  <option value="gltf">GLTF (Recommended)</option>
                  <option value="ifc">IFC (BIM Data)</option>
                  <option value="obj">OBJ (Geometry)</option>
                  <option value="fbx">FBX (High Quality)</option>
                </select>
              </div>

              {/* Quality Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quality
                </label>
                <select
                  value={conversionOptions.quality}
                  onChange={(e) =>
                    setConversionOptions((prev) => ({
                      ...prev,
                      quality: e.target.value as any,
                    }))
                  }
                  className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white text-sm"
                >
                  <option value="low">Low (Fast)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="high">High (Slow)</option>
                </select>
              </div>

              {/* Metadata Option */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Include Metadata
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={conversionOptions.includeMetadata}
                    onChange={(e) =>
                      setConversionOptions((prev) => ({
                        ...prev,
                        includeMetadata: e.target.checked,
                      }))
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-300">BIM Properties</span>
                </label>
              </div>
            </div>

            {/* Recommendations */}
            <div className="mt-4 p-3 bg-blue-900/30 border border-blue-600/30 rounded">
              <p className="text-blue-200 text-sm">
                <strong>Recommended:</strong>{" "}
                {recommendations[0]?.format.toUpperCase()} format for best web
                performance
              </p>
            </div>
          </div>
        )}

        {/* Manual Guide Content */}
        {selectedMethod === "manual" && (
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <div className="prose prose-invert max-w-none">
              <div className="text-sm text-gray-300 whitespace-pre-line">
                {rvtConverter.getManualConversionGuide()}
              </div>
            </div>
          </div>
        )}

        {/* File Upload */}
        {selectedMethod !== "manual" && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select RVT File for Conversion
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".rvt"
              className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white text-sm"
            />
          </div>
        )}

        {/* Conversion Progress */}
        {isConverting && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">
                Converting...
              </span>
              <span className="text-sm text-gray-300">
                {conversionProgress}%
              </span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${conversionProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Conversion Result */}
        {conversionResult && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              conversionResult.success
                ? "bg-green-900/30 border border-green-600/30"
                : "bg-red-900/30 border border-red-600/30"
            }`}
          >
            <div className="flex items-center">
              {conversionResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 mr-2" />
              )}
              <span
                className={`font-medium ${
                  conversionResult.success ? "text-green-300" : "text-red-300"
                }`}
              >
                {conversionResult.success
                  ? "Conversion Successful!"
                  : "Conversion Failed"}
              </span>
            </div>
            {conversionResult.success && (
              <p className="text-green-200 text-sm mt-1">
                File converted to {conversionResult.format.toUpperCase()} format
              </p>
            )}
            {conversionResult.error && (
              <p className="text-red-200 text-sm mt-1">
                {conversionResult.error}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {selectedMethod !== "manual" && (
            <button
              onClick={handleConversion}
              disabled={isConverting || !fileInputRef.current?.files?.[0]}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
            >
              {isConverting ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Conversion
                </>
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

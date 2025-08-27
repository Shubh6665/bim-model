"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Play,
  Clock,
  Zap,
  Globe,
} from "lucide-react";
import { forgeAuthService } from "@/app/services/forge-service";
import { modelCache, type CachedModel } from "@/app/services/model-cache-service";

interface RVTForgeInterfaceProps {
  fileName: string;
  fileSize: number;
  existingUrn?: string; // Add support for existing URN
  onProcessingComplete: (urn: string) => void;
  onClose: () => void;
}

export function RVTForgeInterface({
  fileName,
  fileSize,
  existingUrn,
  onProcessingComplete,
  onClose,
}: RVTForgeInterfaceProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'translate' | 'complete'>('upload');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<null | 'client-hit' | 'server-hit' | 'miss'>(null);
  const [cacheUrn, setCacheUrn] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Safely parse JSON; if not JSON, return text for better error reporting
  const parseJsonSafe = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { __nonJson: true, text } as any;
    }
  };

  // Validate existing URN to ensure it's still accessible
  const validateExistingUrn = async (urn: string) => {
    console.log('🔍 Validating existing URN:', urn);
    setIsProcessing(true);
    setError(null);
    setProgress(50);
    setCurrentStep('translate');

    try {
      // Check if the URN is still valid by checking its status
      const statusResponse = await fetch(`/api/forge/status/${urn}`);
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        if (statusData.status === 'success') {
          console.log('✅ Existing URN is valid, using cached model');
          setProgress(100);
          setCurrentStep('complete');
          
          // Use the existing URN immediately
          setTimeout(() => {
            onProcessingComplete(urn);
          }, 500);
          return;
        }
      }
      
      // If validation fails, start fresh processing
      console.log('⚠️ Existing URN is invalid, starting fresh processing');
      handleStartProcessing();
      
    } catch (error) {
      console.log('⚠️ URN validation failed, starting fresh processing');
      handleStartProcessing();
    }
  };

  // Check for existing URN and validate it, or start processing
  useEffect(() => {
    if (existingUrn) {
      validateExistingUrn(existingUrn);
    } else {
      handleStartProcessing();
    }
  }, [existingUrn]);

  const handleStartProcessing = async () => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setCurrentStep('upload');

    try {
      // Step 0: Prepare file and compute hash
      setProgress(10);
      console.log('🔍 Checking cache for optimized loading...');

      // Demo file from public folder (replace with actual file selection in production)
      const response = await fetch('/SAM0001-ADD-SA1067001-ZZ-M3-S-S00001.rvt');
      const fileBlob = await response.blob();
      const file = new File([fileBlob], fileName, { type: 'application/octet-stream' });
      const arrayBuffer0 = await file.arrayBuffer();
      const fileHash = await modelCache.sha256(arrayBuffer0);

      // Client cache check (IndexedDB)
      const local = await modelCache.getByHash(fileHash);
      if (local?.status === 'success' && local.urn) {
        console.log('⚡ Client cache hit. Loading instantly.');
        setCacheStatus('client-hit');
        setCacheUrn(local.urn);
        await modelCache.touchHit(fileHash);
        // Touch server cache (best-effort)
        fetch('/api/forge/cache', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'touch', fileHash }) }).catch(()=>{});
        setProgress(100);
        setCurrentStep('complete');
        setTimeout(() => onProcessingComplete(local.urn), 200);
        return;
      }

      // Server cache check (Mongo)
      const checkRes = await fetch('/api/forge/cache', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', fileHash })
      });
      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        if (checkJson.hit && checkJson.model?.urn && checkJson.model?.status === 'success') {
          console.log('⚡ Server cache hit. Loading instantly.');
          setCacheStatus('server-hit');
          setCacheUrn(checkJson.model.urn);
          // Persist to client cache for next time
          const entry: CachedModel = {
            fileHash,
            fileName,
            size: file.size,
            urn: checkJson.model.urn,
            status: 'success',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastAccessAt: Date.now(),
            cacheHits: 1,
          };
          await modelCache.upsert(entry);
          await modelCache.prune();
          setProgress(100);
          setCurrentStep('complete');
          setTimeout(() => onProcessingComplete(checkJson.model.urn as string), 200);
          return;
        }
      }

      setCacheStatus('miss');
      // Step 1: Upload file to Forge via signed URL (Vercel-safe, large files)
      console.log('📤 Starting file upload (signed URL flow)...');

      // INIT → get signed URL + uploadKey
      const initRes = await fetch('/api/forge/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init: true, fileName: file.name }),
      });
      const initData = await parseJsonSafe(initRes);
      if (!initRes.ok) {
        console.error('❌ INIT error:', initData);
        const msg = initData?.error || initData?.text || `Init failed (${initRes.status})`;
        throw new Error(msg);
      }
      const uploadUrl: string = initData.uploadUrl;
      const uploadKey: string = initData.uploadKey;

      // PUT → upload file directly to Autodesk S3 using signed URL
      const arrayBuffer = arrayBuffer0; // reuse buffer used for hash
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: arrayBuffer,
      });
      if (!putRes.ok) {
        const putText = await putRes.text();
        console.error('❌ S3 PUT error:', putText);
        throw new Error(`S3 upload failed (${putRes.status}): ${putText}`);
      }

      // COMPLETE → finalize upload, get objectId and urn
      const completeRes = await fetch('/api/forge/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complete: true, fileName: file.name, uploadKey }),
      });
      const completeData = await parseJsonSafe(completeRes);
      if (!completeRes.ok) {
        console.error('❌ COMPLETE error:', completeData);
        const msg = completeData?.error || completeData?.text || `Complete failed (${completeRes.status})`;
        throw new Error(msg);
      }
      const urn: string = completeData.urn;
      console.log('✅ File uploaded, URN:', urn);
      // Record pending in server cache
      fetch('/api/forge/cache', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'record', fileHash, fileName, size: file.size, urn, status: 'pending' }) }).catch(()=>{});
      
      setProgress(30);
      setCurrentStep('translate');

      // Step 2: Start translation
      console.log('🔄 Starting translation...');
      const translateResponse = await fetch('/api/forge/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urn }),
      });
      
      if (!translateResponse.ok) {
        const errorData = await translateResponse.json();
        console.error('❌ Translate response error:', errorData);
        throw new Error(errorData.error || `Translation failed to start with status ${translateResponse.status}`);
      }
      
      const translateData = await translateResponse.json();
      console.log('✅ Translation started:', translateData);
      
      setProgress(50);

      // If conflict, just start polling status
      if (translateData.conflict) {
        console.log('⚠️ Translation already in progress, polling status...');
      }

      // Step 3: Poll for translation status
      console.log('⏳ Polling for translation status...');
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5-second intervals
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        const statusResponse = await fetch(`/api/forge/status/${urn}`);
        if (!statusResponse.ok) {
          console.log('Status check failed, retrying...');
          attempts++;
          continue;
        }
        
        const statusData = await statusResponse.json();
        console.log('Translation status:', statusData);
        
        if (statusData.status === 'success') {
          setProgress(100);
          setCurrentStep('complete');
          console.log('🎉 Translation completed successfully!');
          // Record success in caches
          const successEntry: CachedModel = {
            fileHash,
            fileName,
            size: file.size,
            urn,
            status: 'success',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastAccessAt: Date.now(),
            cacheHits: 1,
          };
          await modelCache.upsert(successEntry);
          await modelCache.prune();
          fetch('/api/forge/cache', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'record', fileHash, fileName, size: file.size, urn, status: 'success' }) }).catch(()=>{});
          
          // Notify parent component
          setTimeout(() => {
            onProcessingComplete(urn);
          }, 1000);
          return;
        } else if (statusData.status === 'failed') {
          throw new Error(statusData.message || 'Translation failed');
        }
        
        // Update progress based on status
        const progressMatch = statusData.progress?.match(/(\d+)%/);
        if (progressMatch) {
          const progressPercent = parseInt(progressMatch[1]);
          setProgress(50 + (progressPercent * 0.5)); // Scale 0-100% to 50-100%
        }
        
        attempts++;
      }
      
      throw new Error('Translation timeout - took longer than expected');

    } catch (error) {
      console.error('Processing error:', error);
      setError(error instanceof Error ? error.message : 'Processing failed');
      setIsProcessing(false);
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'upload':
        return 'Uploading RVT file to Autodesk Forge...';
      case 'translate':
        return 'Converting RVT to web-viewable format...';
      case 'complete':
        return 'Processing complete! Loading viewer...';
      default:
        return '';
    }
  };

  const getStepIcon = () => {
    switch (currentStep) {
      case 'upload':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'translate':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="bg-gray-800 rounded-xl p-8 max-w-2xl w-full mx-4 border border-gray-600">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mr-4">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">
                RVT File Processing
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
            disabled={isProcessing}
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Forge Info */}
        <div className="bg-blue-900/30 border border-blue-600/30 rounded-lg p-4 mb-6">
          <div className="flex items-center mb-2">
            <Globe className="w-5 h-5 text-blue-400 mr-2" />
            <span className="font-medium text-white">Autodesk Forge Processing</span>
          </div>
          <p className="text-gray-300 text-sm mb-2">
            Your RVT file will be uploaded to Autodesk Forge and converted to a web-viewable format.
          </p>
          <div className="flex items-center text-xs text-gray-400">
            <Zap className="w-3 h-3 mr-1" />
            <span>Cloud-based processing • Secure • Fast</span>
          </div>
        </div>

        {/* Processing Progress */}
        {isProcessing && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              {getStepIcon()}
              <div>
                <span className="text-sm font-medium text-white">
                  {getStepDescription()}
                </span>
                {cacheStatus && (
                  <div className="mt-1 text-xs">
                    {cacheStatus === 'client-hit' && (
                      <span className="px-2 py-0.5 rounded bg-green-600/20 text-green-300 border border-green-600/40">Instant load from browser cache</span>
                    )}
                    {cacheStatus === 'server-hit' && (
                      <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-300 border border-blue-600/40">Instant load from server cache</span>
                    )}
                    {cacheStatus === 'miss' && (
                      <span className="px-2 py-0.5 rounded bg-gray-600/30 text-gray-300 border border-gray-500/40">No cache available, processing...</span>
                    )}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  Step {currentStep === 'upload' ? '1' : currentStep === 'translate' ? '2' : '3'} of 3
                </div>
              </div>
            </div>
            
            <div className="w-full bg-gray-600 rounded-full h-3 mb-2">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-gray-400">
              <span>Upload</span>
              <span>Translate</span>
              <span>Complete</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600/30 rounded-lg">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-400 mr-2" />
              <span className="font-medium text-red-300">Processing Failed</span>
            </div>
            <p className="text-red-200 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Success Display */}
        {currentStep === 'complete' && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-600/30 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
              <span className="font-medium text-green-300">Processing Successful!</span>
            </div>
            <p className="text-green-200 text-sm mt-1">
              Your RVT file has been converted and is ready for viewing.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 text-white rounded-lg transition-colors"
          >
            {isProcessing ? 'Processing...' : 'Close'}
          </button>
        </div>

        {/* Processing Info */}
        {isProcessing && (
          <div className="mt-4 p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center text-xs text-gray-300 mb-2">
              <Clock className="w-3 h-3 mr-1" />
              <span>Processing time: ~2-5 minutes</span>
            </div>
            <p className="text-xs text-gray-400">
              Large files may take longer. You can close this window and return later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 
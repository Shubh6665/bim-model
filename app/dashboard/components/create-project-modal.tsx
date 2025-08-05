import React, { useState, useRef, useEffect } from "react";

interface CreateProjectModalProps {
  show: boolean;
  onClose: () => void;
  onProjectCreated: (project: any) => void;
  apiKey: string;
}

// GoogleMapPicker component for picking a single lat/lng
function GoogleMapPicker({ apiKey, lat, lng, onChange }: { apiKey: string, lat: number | null, lng: number | null, onChange: (lat: number, lng: number) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Default to New Delhi, India if no location is provided
  const defaultLat = 28.6139;
  const defaultLng = 77.2090;

  useEffect(() => {
    let loader: any;
    let mapInstance: google.maps.Map;
    if (!mapRef.current || !apiKey) return;
    const initMap = async () => {
      try {
        const { Loader } = await import("@googlemaps/js-api-loader");
        loader = new Loader({ apiKey, version: "weekly", libraries: ["places"] });
        await loader.load();
        // Use provided coordinates or default to New Delhi
        const centerLat = lat ?? defaultLat;
        const centerLng = lng ?? defaultLng;
        
        mapInstance = new google.maps.Map(mapRef.current!, {
          center: { lat: centerLat, lng: centerLng },
          zoom: (lat && lng) ? 15 : 4,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          disableDefaultUI: false,
        });
        setMap(mapInstance);
        // Place marker if lat/lng provided
        if (lat && lng) {
          markerRef.current = new google.maps.Marker({
            position: { lat, lng },
            map: mapInstance,
            draggable: true,
          });
          markerRef.current.addListener("dragend", (e: google.maps.MapMouseEvent) => {
            const latLng = e.latLng;
            if (latLng) {
              const latVal = latLng.lat();
              const lngVal = latLng.lng();
              onChange(latVal, lngVal);
            }
          });
        }
        // Click to set marker
        mapInstance.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (markerRef.current) {
            markerRef.current.setMap(null);
          }
          markerRef.current = new google.maps.Marker({
            position: e.latLng,
            map: mapInstance,
            draggable: true,
          });
          onChange(e.latLng?.lat() ?? 0, e.latLng?.lng() ?? 0);
          markerRef.current.addListener("dragend", (ev: google.maps.MapMouseEvent) => {
            const latLng = ev.latLng;
            if (latLng) {
              const latVal = latLng.lat();
              const lngVal = latLng.lng();
              onChange(latVal, lngVal);
            }
          });
        });
      } catch (err) {
        setError("Failed to load Google Maps. Check your API key and connection.");
      }
    };
    initMap();
    // Cleanup
    return () => {
      if (markerRef.current) markerRef.current.setMap(null);
      if (mapInstance) mapInstance = null as any;
    };
    // eslint-disable-next-line
  }, [apiKey]);

  useEffect(() => {
    // If lat/lng changes externally, update marker
    if (map && lat && lng) {
      if (markerRef.current) {
        markerRef.current.setPosition({ lat, lng });
      } else {
        markerRef.current = new google.maps.Marker({
          position: { lat, lng },
          map,
          draggable: true,
        });
        markerRef.current.addListener("dragend", (e: google.maps.MapMouseEvent) => {
          const latLng = e.latLng;
          if (latLng) {
            const latVal = latLng.lat();
            const lngVal = latLng.lng();
            onChange(latVal, lngVal);
          }
        });
      }
      map.setCenter({ lat, lng });
      map.setZoom(15);
    }
    // eslint-disable-next-line
  }, [lat, lng, map]);

  return (
    <div className="w-full h-56 rounded overflow-hidden border border-gray-700 bg-gray-800 relative">
      <div ref={mapRef} className="absolute inset-0 w-full h-full" />
      {error && <div className="absolute inset-0 flex items-center justify-center text-red-400 bg-gray-900/80 z-10">{error}</div>}
    </div>
  );
}

export function CreateProjectModal({ show, onClose, onProjectCreated, apiKey }: CreateProjectModalProps) {
  // Step state
  const [step, setStep] = useState(0);
  // Project Info
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  // Location
  const [country, setCountry] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [address, setAddress] = useState("");
  const [cadastral, setCadastral] = useState("");
  // Client/Manager
  const [company, setCompany] = useState("");
  const [surname, setSurname] = useState("");
  const [name, setName] = useState("");
  // File
  const [file, setFile] = useState<File | null>(null);
  // Default location (New Delhi, India)
  const [lat, setLat] = useState<number | null>(28.6139);
  const [lng, setLng] = useState<number | null>(77.2090);
  // Error
  const [error, setError] = useState<string | null>(null);
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [processingUrn, setProcessingUrn] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Step validation - Project Name, Project Code, and File are required
  const canNext = () => {
    if (step === 0) return !!projectName && !!projectCode;
    if (step === 3) return !!file; // File upload is required
    return true; // Other steps are optional
  };
  
  // Handle skip for current step
  const handleSkip = () => {
    setStep((s) => s + 1);
  };

  const handleNext = () => {
    setError(null);
    if (!canNext()) {
      setError("Please fill all required fields.");
      return;
    }
    setStep((s) => s + 1);
  };
  const handleBack = () => {
    setError(null);
    setStep((s) => s - 1);
  };

  // Processing steps for progress tracking
  const processingSteps = [
    "Preparing file for upload...",
    "Uploading file to Autodesk Forge...",
    "Starting BIM file translation...",
    "Converting file to 3D format...",
    "Finalizing conversion...",
    "Saving project to database...",
    "Project created successfully!"
  ];

  // Handle project creation (full async flow)
  const handleCreate = async () => {
    if (!canNext()) {
      setError("Please fill all required fields.");
      return;
    }
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setCurrentStepIndex(0);
    setProcessingStep(processingSteps[0]);
    setProcessingUrn(null);
    
    try {
      // 1. Prepare upload
      setProgress(5);
      await new Promise(res => setTimeout(res, 500)); // Small delay for UX
      
      // 2. Upload file to Forge
      if (!file) throw new Error("No file selected");
      const fileType = file.name.split('.').pop()?.toUpperCase() || "UNKNOWN";
      setCurrentStepIndex(1);
      setProcessingStep(processingSteps[1]);
      setProgress(15);
      
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/forge/upload", {
        method: "POST",
        body: uploadForm,
      });
      // --- Improved error handling for non-JSON responses (e.g., file too large) ---
      let uploadData: any = {};
      const contentType = uploadRes.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        uploadData = await uploadRes.json();
      } else {
        const text = await uploadRes.text();
        if (uploadRes.status === 413 || text.toLowerCase().includes("too large")) {
          throw new Error("File too large. Please upload a smaller file (max 4MB). If you need to upload larger files, contact support.");
        }
        throw new Error(text || "Upload failed (unexpected server response). Please try again or contact support.");
      }
      if (!uploadRes.ok || !uploadData.urn) throw new Error(uploadData.error || "Upload failed");
      
      const urn = uploadData.urn;
      setProcessingUrn(urn);
      setProgress(30);
      
      // 3. Start translation
      setCurrentStepIndex(2);
      setProcessingStep(processingSteps[2]);
      const translateRes = await fetch("/api/forge/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urn }),
      });
      const translateData = await translateRes.json();
      if (!translateRes.ok) throw new Error(translateData.error || "Translation failed");
      setProgress(40);
      
      // 4. Poll for status with progress updates
      setCurrentStepIndex(3);
      setProcessingStep(processingSteps[3]);
      let status = "pending";
      let pollCount = 0;
      const maxPolls = 60; // up to 5 min
      
      while (status !== "success" && pollCount < maxPolls) {
        await new Promise(res => setTimeout(res, 5000));
        const statusRes = await fetch(`/api/forge/status/${urn}`);
        const statusData = await statusRes.json();
        
        // Update progress based on polling
        const conversionProgress = 40 + (pollCount / maxPolls) * 40; // 40% to 80%
        setProgress(Math.min(conversionProgress, 75));
        
        if (statusData.status === "success") {
          status = "success";
          setCurrentStepIndex(4);
          setProcessingStep(processingSteps[4]);
          setProgress(80);
          break;
        } else if (statusData.status === "failed") {
          throw new Error("Forge translation failed");
        }
        
        // Update step message with time estimate
        const timeElapsed = (pollCount + 1) * 5;
        setProcessingStep(`${processingSteps[3]} (${timeElapsed}s elapsed)`);
        pollCount++;
      }
      
      if (status !== "success") throw new Error("Forge translation timed out");
      
      // 5. Save project to DB
      setCurrentStepIndex(5);
      setProcessingStep(processingSteps[5]);
      setProgress(85);
      
      const saveRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          code: projectCode,
          country,
          municipality,
          address,
          cadastral,
          company,
          surname,
          clientName: name,
          lat,
          lng,
          urn,
          fileType,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save project");
      
      // 6. Complete
      setCurrentStepIndex(6);
      setProcessingStep(processingSteps[6]);
      setProgress(100);
      
      // Wait a moment to show completion
      await new Promise(res => setTimeout(res, 1000));
      
      // 7. Call onProjectCreated
      onProjectCreated({
        id: saveData.project._id || saveData.project.id,
        name: saveData.project.name,
        code: saveData.project.code,
        country: saveData.project.country,
        municipality: saveData.project.municipality,
        address: saveData.project.address,
        cadastral: saveData.project.cadastral,
        company: saveData.project.company,
        surname: saveData.project.surname,
        clientName: saveData.project.clientName,
        lat: saveData.project.location?.lat,
        lng: saveData.project.location?.lng,
        urn: saveData.project.urn,
        description: saveData.project.description || "",
        fileType: saveData.project.fileType || fileType,
      });
      
    } catch (err: any) {
      setError(err.message);
      setProgress(0);
    } finally {
      setIsProcessing(false);
      setProcessingStep(null);
      setCurrentStepIndex(0);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-gray-900 rounded-xl shadow-2xl w-full max-w-xl mx-4 flex flex-col" style={{ maxHeight: '90vh' }}>
        <button className="absolute top-4 right-4 text-gray-400 hover:text-white z-20" onClick={onClose}>&times;</button>
        <h3 className="text-2xl font-bold text-white mb-4 text-center pt-6">Create New Project</h3>
        {/* Stepper */}
        <div className="flex justify-center gap-2 mb-4 px-4">
          {["Project Info", "Location", "Client", "File", "Map"].map((label, i) => (
            <div key={label} className={`flex items-center gap-1 ${i < step ? 'text-blue-400' : i === step ? 'text-white' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 ${i === step ? 'border-blue-500 bg-blue-700' : i < step ? 'border-blue-400 bg-blue-900' : 'border-gray-700 bg-gray-800'}`}>{i+1}</div>
              <span className="text-xs font-medium whitespace-nowrap">{label}</span>
              {i < 4 && <span className="w-6 h-0.5 bg-gray-700 mx-1" />}
            </div>
          ))}
        </div>
        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ minHeight: 320 }}>
          {step === 0 && (
            <div>
              <h4 className="text-lg font-semibold text-blue-400 mb-2">Project Info <span className="text-xs text-gray-400">(Fields marked with <span className="text-red-500">*</span> are required)</span></h4>
              <label className="block text-gray-300 mb-1">Project Name <span className="text-red-500">*</span></label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={projectName} onChange={e => setProjectName(e.target.value)} required placeholder="e.g. Main Building" />
              <label className="block text-gray-300 mb-1">Project Code <span className="text-red-500">*</span></label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={projectCode} onChange={e => setProjectCode(e.target.value)} required placeholder="e.g. PRJ-2024-001" />
            </div>
          )}
          {step === 1 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-lg font-semibold text-blue-400">Location</h4>
                <button 
                  type="button" 
                  onClick={handleSkip}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Skip for now
                </button>
              </div>
              <label className="block text-gray-300 mb-1">Country</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Germany" />
              <label className="block text-gray-300 mb-1">Municipality</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={municipality} onChange={e => setMunicipality(e.target.value)} placeholder="e.g. Berlin" />
              <label className="block text-gray-300 mb-1">Address</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Alexanderplatz 1, 10178 Berlin" />
              <label className="block text-gray-300 mb-1">Cadastral Data</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={cadastral} onChange={e => setCadastral(e.target.value)} placeholder="e.g. Parcel 1234, Section A" />
            </div>
          )}
          {step === 2 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-lg font-semibold text-blue-400">Client / Manager Data</h4>
                <button 
                  type="button" 
                  onClick={handleSkip}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Skip for now
                </button>
              </div>
              <label className="block text-gray-300 mb-1">Company Name</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. ACME Construction" />
              <label className="block text-gray-300 mb-1">Surname</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={surname} onChange={e => setSurname(e.target.value)} placeholder="e.g. Smith" />
              <label className="block text-gray-300 mb-1">Name</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John" />
            </div>
          )}
          {step === 3 && (
            <div>
              <h4 className="text-lg font-semibold text-blue-400 mb-2">BIM File Upload <span className="text-red-500">*</span></h4>
              <label className="block text-gray-300 mb-2">BIM File</label>
              <div className="mb-3">
                <label htmlFor="bim-upload" className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${file ? 'border-green-500 bg-green-900/10' : 'border-blue-500 bg-gray-800 hover:bg-blue-900/20'}`} tabIndex={0}>
                  {file ? (
                    <span className="flex items-center gap-2 text-green-400 font-medium">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {file.name}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-blue-300 font-medium">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      Click or drag RVT, IFC, DWG, or NWD file here
                    </span>
                  )}
                  <input id="bim-upload" type="file" accept=".rvt,.ifc,.dwg,.nwd" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} required />
                </label>
              </div>
            </div>
          )}
          {step === 4 && (
            <div>
              <h4 className="text-lg font-semibold text-blue-400 mb-2">Project Location (Coordinates)</h4>
              <p className="text-gray-400 text-xs mb-2">Pick a location on the map or enter coordinates manually.</p>
              <GoogleMapPicker
                apiKey={apiKey}
                lat={lat}
                lng={lng}
                onChange={(newLat, newLng) => {
                  setLat(newLat);
                  setLng(newLng);
                }}
              />
              <div className="flex flex-wrap gap-2 mb-3 mt-3 w-full">
                <input type="number" step="any" placeholder="Latitude" className="flex-1 min-w-0 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={lat ?? ""} onChange={e => setLat(Number(e.target.value))} style={{ minWidth: 0 }} />
                <input type="number" step="any" placeholder="Longitude" className="flex-1 min-w-0 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={lng ?? ""} onChange={e => setLng(Number(e.target.value))} style={{ minWidth: 0 }} />
              </div>
            </div>
          )}
        </div>
        {/* Enhanced Progress Bar - fixed at bottom */}
        {(isProcessing || error) && (
          <div className="absolute left-0 right-0 bottom-0 px-6 pb-4 z-10">
            <div className="p-4 bg-gray-800 border border-blue-700 rounded-lg text-blue-300 flex flex-col gap-3 shadow-xl">
              {/* Progress Header */}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">{processingStep || (isProcessing ? "Processing..." : "")}</span>
                <span className="text-sm font-medium">{progress}%</span>
              </div>
              
              {/* Progress Bar */}
              {isProcessing && (
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-green-500 rounded-full transition-all duration-500 ease-out relative"
                    style={{ width: `${progress}%` }}
                  >
                    {/* Animated shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                  </div>
                </div>
              )}
              
              {/* Step Indicators */}
              {isProcessing && (
                <div className="flex justify-between text-xs">
                  {processingSteps.slice(0, -1).map((step, index) => (
                    <div 
                      key={index}
                      className={`flex flex-col items-center gap-1 ${
                        index < currentStepIndex ? 'text-green-400' : 
                        index === currentStepIndex ? 'text-blue-300' : 'text-gray-500'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${
                        index < currentStepIndex ? 'bg-green-400' : 
                        index === currentStepIndex ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'
                      }`}></div>
                      <span className="text-xs text-center whitespace-nowrap">{
                        index === 0 ? 'Prep' :
                        index === 1 ? 'Upload' :
                        index === 2 ? 'Start' :
                        index === 3 ? 'Convert' :
                        index === 4 ? 'Finalize' :
                        'Save'
                      }</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Additional Info */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-blue-200">
                  {isProcessing ? "This may take a few minutes for large BIM files." : ""}
                </span>
                {processingUrn && (
                  <span className="text-green-400 text-xs font-mono">
                    File ID: {processingUrn.substring(0, 20)}...
                  </span>
                )}
                {error && (
                  <span className="text-red-400 text-sm font-medium bg-red-900/20 p-2 rounded">
                    ❌ {error}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Stepper Controls */}
        <div className="flex gap-2 mt-4 px-6 pb-6">
          {step > 0 && <button type="button" className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded" onClick={handleBack} disabled={isProcessing}>Back</button>}
          {step < 3 && <button type="button" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-60" onClick={handleNext} disabled={!canNext() || isProcessing}>Next</button>}
          {step === 3 && <button type="button" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-60" onClick={handleNext} disabled={!canNext() || isProcessing}>Next</button>}
          {step === 4 && <button type="button" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded disabled:opacity-60" onClick={handleCreate} disabled={isProcessing}>Create Project</button>}
        </div>
      </div>
    </div>
  );
} 
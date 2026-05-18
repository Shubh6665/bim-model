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
  
  // Default to Rome, Italy if no location is provided
  const defaultLat = 41.9028;
  const defaultLng = 12.4964;

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
  // Optional single Administrator Email (for pending admin invitation)
  const [adminEmail, setAdminEmail] = useState("");
  // Models (multi-file) state
  type Discipline = "architecture" | "structure" | "mep" | "electrical" | "plumbing" | "hvac" | "other";
  type ModelItem = {
    tempId: string;
    file?: File;
    name: string;
    discipline: Discipline;
    urn?: string;
    fileType?: string;
    status?: "pending" | "uploading" | "translating" | "done" | "error";
    error?: string;
    progress?: number;
  };
  const [models, setModels] = useState<ModelItem[]>([]);
  const disciplineOptions: { label: string; value: Discipline }[] = [
    { label: "Architecture", value: "architecture" },
    { label: "Structure", value: "structure" },
    { label: "MEP", value: "mep" },
    { label: "Electrical", value: "electrical" },
    { label: "Plumbing", value: "plumbing" },
    { label: "HVAC", value: "hvac" },
    { label: "Other", value: "other" },
  ];
  // Default location (Rome, Italy)
  const [lat, setLat] = useState<number | null>(41.9028);
  const [lng, setLng] = useState<number | null>(12.4964);
  // Error
  const [error, setError] = useState<string | null>(null);
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [processingUrn, setProcessingUrn] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Step validation - Project Name, Project Code, and at least one Model are required
  const canNext = () => {
    if (step === 0) return !!projectName && !!projectCode;
    if (step === 3) return models.length > 0; // At least one model required
    return true; // Other steps are optional, including company
  };

  // Company validation removed; company is optional and unrestricted.
  
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
    "Preparing models for upload...",
    "Uploading models to Autodesk Forge...",
    "Starting BIM model translations...",
    "Converting models to 3D format...",
    "Finalizing conversions...",
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
      // 1. Prepare uploads
      setProgress(5);
      await new Promise(res => setTimeout(res, 300));

      // 2-4. Upload and translate each selected model sequentially
      setCurrentStepIndex(1);
      setProcessingStep(processingSteps[1]);
      let completed = 0;
      const total = models.length;
      const updatedModels: ModelItem[] = [...models];

      for (let i = 0; i < updatedModels.length; i++) {
        const m = updatedModels[i];
        if (!m.file) {
          updatedModels[i] = { ...m, status: "error", error: "Missing file" };
          continue;
        }
        // Upload via signed URL (init -> PUT -> complete)
        updatedModels[i] = { ...m, status: "uploading", progress: 10 };
        setModels([...updatedModels]);
        const fileType = m.file.name.split('.').pop()?.toUpperCase() || "UNKNOWN";
        // INIT
        const initRes = await fetch("/api/forge/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ init: true, fileName: m.file.name })
        });
        const initData = await initRes.json();
        if (!initRes.ok || !initData.uploadUrl || !initData.uploadKey) {
          throw new Error(initData.error || "Failed to initialize upload");
        }
        // PUT file directly to signed URL with progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", initData.uploadUrl, true);
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              updatedModels[i] = { ...updatedModels[i], status: "uploading", progress: 10 + percent * 0.2 };
              setModels([...updatedModels]);
              // Overall progress from 10% to 30% for this model
              const overall = 10 + Math.floor((i / total) * 70) + Math.floor((percent / 100) * (70 / total) * 0.28);
              setProgress(Math.min(overall, 80));
            }
          };
          
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Direct upload failed: ${xhr.status} ${xhr.responseText}`));
            }
          };
          
          xhr.onerror = () => reject(new Error("Network error during direct S3 upload"));
          xhr.send(m.file);
        });
        // COMPLETE
        const completeRes = await fetch("/api/forge/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ complete: true, fileName: m.file.name, uploadKey: initData.uploadKey })
        });
        const completeData = await completeRes.json();
        if (!completeRes.ok || !completeData.urn) {
          throw new Error(completeData.error || "Failed to finalize upload");
        }

        const urn = completeData.urn;
        setProcessingUrn(urn);

        // Translate
        setCurrentStepIndex(2);
        setProcessingStep(`${processingSteps[2]} (${i + 1}/${total})`);
        updatedModels[i] = { ...updatedModels[i], status: "translating", progress: 30 };
        setModels([...updatedModels]);

        const translateRes = await fetch("/api/forge/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urn }),
        });
        const translateData = await translateRes.json();
        if (!translateRes.ok) throw new Error(translateData.error || "Translation failed");

        // Poll status
        setCurrentStepIndex(3);
        setProcessingStep(`${processingSteps[3]} (${i + 1}/${total})`);
        let status = "pending";
        let pollCount = 0;
        // Adaptive backoff: start 5s, cap 30s. Up to ~45 minutes max.
        let delayMs = 5000;
        const maxPolls = 540; // 5s..30s backoff ~ <= 45min
        let lastProgressPct = 0;
        while (status !== "success" && pollCount < maxPolls) {
          await new Promise(res => setTimeout(res, delayMs));
          // increase delay gradually up to 30s to reduce API load
          delayMs = Math.min(delayMs + 2000, 30000);
          const statusRes = await fetch(`/api/forge/status/${urn}`);
          const statusData = await statusRes.json();
          // Update UI progress when available (e.g., "85% complete")
          const progStr: string | undefined = statusData?.progress || statusData?.derivatives?.[0]?.progress;
          if (typeof progStr === 'string' && progStr.includes('%')) {
            const match = progStr.match(/(\d{1,3})%/);
            const pct = match ? Math.min(99, Math.max(0, parseInt(match[1], 10))) : lastProgressPct;
            lastProgressPct = pct;
            // Keep overall between 10..95 during translation
            const overall = 10 + Math.floor((pct / 100) * 85);
            setProgress(Math.max(progress, Math.min(overall, 95)));
          }
          if (statusData.status === "success") {
            status = "success";
            break;
          } else if (statusData.status === "failed") {
            throw new Error("Forge translation failed");
          }
          pollCount++;
        }
        if (status !== "success") {
          // Do not hard-fail for large files. Proceed and let translation finish in background.
          console.warn("Translation still in progress; proceeding with background completion.");
        }

        // Mark model done and store urn/fileType
        updatedModels[i] = { ...updatedModels[i], status: "done", urn, fileType, progress: 100 };
        setModels([...updatedModels]);
        completed++;
        // Update overall progress roughly 10%..80%
        const overall = 10 + Math.floor((completed / total) * 70);
        setProgress(Math.min(overall, 80));
      }

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
          adminEmails: adminEmail && adminEmail.trim().length > 0
            ? [adminEmail.trim().toLowerCase()]
            : [],
          models: updatedModels
            .filter(m => m.urn && m.fileType)
            .map(m => ({
              name: m.name || (m.file ? m.file.name : ""),
              discipline: m.discipline,
              urn: m.urn,
              fileType: m.fileType,
              transform: null,
            })),
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
        models: saveData.project.models || [],
        description: saveData.project.description || "",
        access: saveData.project.access || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="relative bg-[#0B0F19] border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.5)] w-full max-w-xl mx-4 flex flex-col" style={{ maxHeight: '90vh' }}>
        <button className="absolute top-4 right-4 text-gray-500 hover:text-white z-20 transition-colors" onClick={onClose}>&times;</button>
        <h3 className="text-2xl font-semibold text-white mb-4 text-center pt-6 tracking-wide">Create New Project</h3>
        {/* Stepper */}
        <div className="flex justify-center gap-2 mb-4 px-4">
          {["Project Info", "Location", "Client", "Models", "Map"].map((label, i) => (
            <div key={label} className={`flex items-center gap-1 ${i < step ? 'text-blue-400' : i === step ? 'text-white' : 'text-gray-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 transition-all duration-300 ${i === step ? 'border-blue-400 bg-blue-600/30 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : i < step ? 'border-blue-400/50 bg-blue-900/50' : 'border-white/10 bg-white/5'}`}>{i+1}</div>
              <span className="text-xs font-medium whitespace-nowrap">{label}</span>
              {i < 4 && <span className="w-6 h-0.5 bg-white/10 mx-1" />}
            </div>
          ))}
        </div>
        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ minHeight: 320 }}>
          {step === 0 && (
            <div>
              <h4 className="text-lg font-semibold text-blue-400 mb-2">Project Info <span className="text-xs text-gray-400">(Fields marked with <span className="text-red-500">*</span> are required)</span></h4>
              <label className="block text-gray-300 mb-1">Project Name <span className="text-red-500">*</span></label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" value={projectName} onChange={e => setProjectName(e.target.value)} required placeholder="e.g. Main Building" />
              <label className="block text-gray-300 mb-1">Project Code <span className="text-red-500">*</span></label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" value={projectCode} onChange={e => setProjectCode(e.target.value)} required placeholder="e.g. PRJ-2024-001" />
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
              <input type="text" className="w-full mb-3 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Germany" />
              <label className="block text-gray-300 mb-1">Municipality</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" value={municipality} onChange={e => setMunicipality(e.target.value)} placeholder="e.g. Berlin" />
              <label className="block text-gray-300 mb-1">Address</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Alexanderplatz 1, 10178 Berlin" />
              <label className="block text-gray-300 mb-1">Cadastral Data</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" value={cadastral} onChange={e => setCadastral(e.target.value)} placeholder="e.g. Parcel 1234, Section A" />
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
              <label className="block text-gray-300 mb-1">Company Name (optional)</label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white mb-1 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="e.g. ACME Construction"
              />
              <label className="block text-gray-300 mb-1">Surname</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" value={surname} onChange={e => setSurname(e.target.value)} placeholder="e.g. Smith" />
              <label className="block text-gray-300 mb-1">Name</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John" />

              <div className="mt-4">
                <label className="block text-gray-300 mb-1">Project Admin Email (optional)</label>
                <input
                  type="email"
                  className="w-full mb-2 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="projectadmin@example.com"
                />
                
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <h4 className="text-lg font-semibold text-blue-400 mb-2">BIM Models <span className="text-red-500">*</span></h4>
              <label className="block text-gray-300 mb-2">Add one or more BIM files</label>
              <div className="mb-4">
                <label htmlFor="bim-uploads" className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${models.length > 0 ? 'border-green-500 bg-green-900/10' : 'border-blue-500 bg-gray-800 hover:bg-blue-900/20'}`} tabIndex={0}>
                  <span className="flex items-center gap-2 text-blue-300 font-medium">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    Click or drag multiple RVT, IFC, DWG, or NWD files
                  </span>
                  <input id="bim-uploads" type="file" accept=".rvt,.ifc,.dwg,.nwd" multiple className="hidden" onChange={e => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    const newItems: ModelItem[] = files.map((f) => ({
                      tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      file: f,
                      name: f.name.replace(/\.[^.]+$/, ''),
                      discipline: "architecture",
                      status: "pending",
                      progress: 0,
                    }));
                    setModels(prev => [...prev, ...newItems]);
                  }} />
                </label>
              </div>

              {models.length > 0 && (
                <div className="space-y-3 max-h-56 overflow-auto pr-1">
                  {models.map((m, idx) => (
                    <div key={m.tempId} className="border border-gray-700 rounded-lg p-3 bg-gray-800/60">
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="flex-1 min-w-0 px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white"
                              value={m.name}
                              onChange={e => setModels(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                              placeholder="Model name"
                            />
                            <select
                              className="w-40 px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white"
                              value={m.discipline}
                              onChange={e => setModels(prev => prev.map((x, i) => i === idx ? { ...x, discipline: e.target.value as Discipline } : x))}
                            >
                              {disciplineOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white rounded"
                              onClick={() => setModels(prev => prev.filter((x) => x.tempId !== m.tempId))}
                            >Remove</button>
                          </div>
                          <div className="mt-2 text-xs text-gray-400 flex items-center gap-2">
                            <span className={`${m.status === 'done' ? 'text-green-400' : m.status === 'error' ? 'text-red-400' : 'text-gray-400'}`}>{m.status || 'pending'}</span>
                            {m.error && <span className="text-red-400">• {m.error}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
          {step > 0 && <button type="button" className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2 rounded-lg transition-all duration-300" onClick={handleBack} disabled={isProcessing}>Back</button>}
          {step < 3 && <button type="button" className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white py-2 rounded-lg disabled:opacity-60 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]" onClick={handleNext} disabled={!canNext() || isProcessing}>Next</button>}
          {step === 3 && <button type="button" className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white py-2 rounded-lg disabled:opacity-60 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]" onClick={handleNext} disabled={!canNext() || isProcessing}>Next</button>}
          {step === 4 && <button type="button" className="flex-1 bg-green-600/80 hover:bg-green-600 text-white py-2 rounded-lg disabled:opacity-60 transition-all duration-300 shadow-[0_0_15px_rgba(34,197,94,0.2)]" onClick={handleCreate} disabled={isProcessing}>Create Project</button>}
        </div>
      </div>
    </div>
  );
} 
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

  useEffect(() => {
    let loader: any;
    let mapInstance: google.maps.Map;
    if (!mapRef.current || !apiKey) return;
    const initMap = async () => {
      try {
        const { Loader } = await import("@googlemaps/js-api-loader");
        loader = new Loader({ apiKey, version: "weekly", libraries: ["places"] });
        await loader.load();
        mapInstance = new google.maps.Map(mapRef.current!, {
          center: lat && lng ? { lat, lng } : { lat: 28.6139, lng: 77.2090 },
          zoom: lat && lng ? 15 : 4,
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
  // Location Picker
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  // Error
  const [error, setError] = useState<string | null>(null);
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [processingUrn, setProcessingUrn] = useState<string | null>(null);

  // Step validation
  const canNext = () => {
    if (step === 0) return !!projectName && !!projectCode;
    if (step === 1) return !!country && !!municipality && !!address && !!cadastral;
    if (step === 2) return !!company && !!surname && !!name;
    if (step === 3) return !!file;
    if (step === 4) return lat !== null && lng !== null;
    return true;
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

  // Handle project creation (full async flow)
  const handleCreate = async () => {
    if (!canNext()) {
      setError("Please fill all required fields.");
      return;
    }
    setIsProcessing(true);
    setError(null);
    setProcessingStep("Uploading file to Forge...");
    setProcessingUrn(null);
    try {
      // 1. Upload file to Forge
      if (!file) throw new Error("No file selected");
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/forge/upload", {
        method: "POST",
        body: uploadForm,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.urn) throw new Error(uploadData.error || "Upload failed");
      const urn = uploadData.urn;
      setProcessingStep("Starting translation...");
      // 2. Start translation
      const translateRes = await fetch("/api/forge/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urn }),
      });
      const translateData = await translateRes.json();
      if (!translateRes.ok) throw new Error(translateData.error || "Translation failed");
      // 3. Poll for status
      setProcessingStep("Waiting for conversion...");
      let status = "pending";
      let pollCount = 0;
      while (status !== "success" && pollCount < 60) { // up to 5 min
        await new Promise(res => setTimeout(res, 5000));
        const statusRes = await fetch(`/api/forge/status/${urn}`);
        const statusData = await statusRes.json();
        if (statusData.status === "success") {
          status = "success";
          break;
        } else if (statusData.status === "failed") {
          throw new Error("Forge translation failed");
        }
        pollCount++;
      }
      if (status !== "success") throw new Error("Forge translation timed out");
      setProcessingStep("Saving project to database...");
      setProcessingUrn(urn);
      // 4. Save project to DB
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
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save project");
      // 5. Call onProjectCreated
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
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStep(null);
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
              <h4 className="text-lg font-semibold text-blue-400 mb-2">Project Info</h4>
              <label className="block text-gray-300 mb-1">Project Name</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={projectName} onChange={e => setProjectName(e.target.value)} required placeholder="e.g. Main Building" />
              <label className="block text-gray-300 mb-1">Project Code</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={projectCode} onChange={e => setProjectCode(e.target.value)} required placeholder="e.g. PRJ-2024-001" />
            </div>
          )}
          {step === 1 && (
            <div>
              <h4 className="text-lg font-semibold text-blue-400 mb-2">Location</h4>
              <label className="block text-gray-300 mb-1">Country</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={country} onChange={e => setCountry(e.target.value)} required placeholder="e.g. Germany" />
              <label className="block text-gray-300 mb-1">Municipality</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={municipality} onChange={e => setMunicipality(e.target.value)} required placeholder="e.g. Berlin" />
              <label className="block text-gray-300 mb-1">Address</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={address} onChange={e => setAddress(e.target.value)} required placeholder="e.g. Alexanderplatz 1, 10178 Berlin" />
              <label className="block text-gray-300 mb-1">Cadastral Data</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={cadastral} onChange={e => setCadastral(e.target.value)} required placeholder="e.g. Parcel 1234, Section A" />
            </div>
          )}
          {step === 2 && (
            <div>
              <h4 className="text-lg font-semibold text-blue-400 mb-2">Client / Manager Data</h4>
              <label className="block text-gray-300 mb-1">Company Name</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={company} onChange={e => setCompany(e.target.value)} required placeholder="e.g. ACME Construction" />
              <label className="block text-gray-300 mb-1">Surname</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={surname} onChange={e => setSurname(e.target.value)} required placeholder="e.g. Smith" />
              <label className="block text-gray-300 mb-1">Name</label>
              <input type="text" className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. John" />
            </div>
          )}
          {step === 3 && (
            <div>
              <h4 className="text-lg font-semibold text-blue-400 mb-2">BIM File Upload</h4>
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
                <input type="number" step="any" placeholder="Latitude" className="flex-1 min-w-0 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={lat ?? ""} onChange={e => setLat(Number(e.target.value))} required style={{ minWidth: 0 }} />
                <input type="number" step="any" placeholder="Longitude" className="flex-1 min-w-0 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white" value={lng ?? ""} onChange={e => setLng(Number(e.target.value))} required style={{ minWidth: 0 }} />
              </div>
            </div>
          )}
        </div>
        {/* Status/Progress Bar - fixed at bottom */}
        {(isProcessing || error) && (
          <div className="absolute left-0 right-0 bottom-0 px-6 pb-4 z-10">
            <div className="p-3 bg-gray-800 border border-blue-700 rounded text-blue-300 flex flex-col gap-2 shadow-xl">
              <span className="font-medium">{processingStep || (isProcessing ? "Processing..." : "")}</span>
              <span className="text-xs text-blue-200">This may take a few minutes for large files.</span>
              {processingUrn && <span className="text-green-400 text-xs">URN: {processingUrn}</span>}
              {error && <span className="text-red-400 text-xs">{error}</span>}
            </div>
          </div>
        )}
        {/* Stepper Controls */}
        <div className="flex gap-2 mt-4 px-6 pb-6">
          {step > 0 && <button type="button" className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded" onClick={handleBack} disabled={isProcessing}>Back</button>}
          {step < 4 && <button type="button" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-60" onClick={handleNext} disabled={!canNext() || isProcessing}>Next</button>}
          {step === 4 && <button type="button" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded disabled:opacity-60" onClick={handleCreate} disabled={!canNext() || isProcessing}>{isProcessing ? "Processing..." : "Create Project"}</button>}
        </div>
      </div>
    </div>
  );
} 
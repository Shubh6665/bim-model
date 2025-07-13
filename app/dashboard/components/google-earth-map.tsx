"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";

interface Project {
  id: string;
  name: string;
  lat: number;
  lng: number;
  urn?: string;
  description?: string;
}

interface GoogleEarthMapProps {
  projects: Project[];
  selectedProject: Project | null;
  onProjectSelect: (project: Project) => void;
  apiKey: string;
}

export function GoogleEarthMap({
  projects,
  selectedProject,
  onProjectSelect,
  apiKey,
}: GoogleEarthMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current || !apiKey) return;

      try {
        const loader = new Loader({
          apiKey: apiKey,
          version: "weekly",
          libraries: ["places"],
        });

        await loader.load();

        const mapInstance = new google.maps.Map(mapRef.current, {
          center: { lat: 28.6139, lng: 77.2090 }, // Default to Delhi, India
          zoom: 10,
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          tilt: 45,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_CENTER,
            mapTypeIds: [
              google.maps.MapTypeId.ROADMAP,
              google.maps.MapTypeId.TERRAIN,
              google.maps.MapTypeId.SATELLITE,
              google.maps.MapTypeId.HYBRID,
            ],
          },
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER,
          },
          scaleControl: true,
          streetViewControl: true,
          streetViewControlOptions: {
            position: google.maps.ControlPosition.RIGHT_TOP,
          },
          fullscreenControl: true,
        });

        setMap(mapInstance);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading Google Maps:", error);
        setError("Failed to load Google Maps. Please check your API key and internet connection.");
        setIsLoading(false);
      }
    };

    initMap();
  }, [apiKey]);

  // Create markers for projects
  useEffect(() => {
    if (!map || !projects.length) return;

    // Clear existing markers
    markers.forEach((marker) => marker.setMap(null));

    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();

    projects.forEach((project) => {
      const marker = new google.maps.Marker({
        position: { lat: project.lat, lng: project.lng },
        map: map,
        title: project.name,
        icon: {
          url: "data:image/svg+xml;base64," + btoa(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#FF6B35"/>
              <circle cx="12" cy="9" r="2.5" fill="white"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(30, 30),
          anchor: new google.maps.Point(15, 30),
        },
      });

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="p-3 max-w-xs">
            <h3 class="font-semibold text-gray-900 mb-1">${project.name}</h3>
            <p class="text-sm text-gray-600 mb-2">${project.description || 'BIM Project'}</p>
            <p class="text-xs text-orange-600 mb-2"><strong>Demo:</strong> All projects process the same SAM0001 RVT model</p>
            <button 
              onclick="window.selectProject('${project.id}')" 
              class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
            >
              Process & Load 3D Model
            </button>
          </div>
        `,
      });

      marker.addListener("click", () => {
        // Close all other info windows
        newMarkers.forEach((m) => {
          const iw = (m as any).infoWindow;
          if (iw) iw.close();
        });
        
        infoWindow.open(map, marker);
        onProjectSelect(project);
      });

      // Store info window reference
      (marker as any).infoWindow = infoWindow;

      newMarkers.push(marker);
      bounds.extend({ lat: project.lat, lng: project.lng });
    });

    // Fit map to show all markers
    if (newMarkers.length > 0) {
      if (newMarkers.length === 1) {
        map.setCenter({ lat: projects[0].lat, lng: projects[0].lng });
        map.setZoom(15);
      } else {
        map.fitBounds(bounds);
      }
    }

    setMarkers(newMarkers);
  }, [map, projects, onProjectSelect]);

  // Handle external project selection (from sidebar)
  useEffect(() => {
    if (!map || !selectedProject || !markers.length) return;

    const selectedMarker = markers.find((marker, index) => 
      projects[index]?.id === selectedProject.id
    );

    if (selectedMarker) {
      map.setCenter({ lat: selectedProject.lat, lng: selectedProject.lng });
      map.setZoom(16);
      
      // Trigger marker click to show info window
      google.maps.event.trigger(selectedMarker, "click");
    }
  }, [selectedProject, map, markers, projects]);

  // Global function for info window button clicks
  useEffect(() => {
    (window as any).selectProject = (projectId: string) => {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        onProjectSelect(project);
      }
    };

    return () => {
      delete (window as any).selectProject;
    };
  }, [projects, onProjectSelect]);

  if (error) {
    return (
      <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-red-400 mb-2">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">Map Loading Error</h3>
          <p className="text-gray-400 text-sm max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-sm text-gray-400">Loading Google Earth...</p>
          </div>
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Map Legend */}
      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white">
        <h4 className="text-sm font-semibold mb-2">Project Locations</h4>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
          <span>BIM Projects ({projects.length})</span>
        </div>
      </div>
    </div>
  );
}

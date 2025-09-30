"use client";
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import EnergyDashboardOverlay from '../components/energy-dashboard-overlay';
import { Sensor } from '../context/sensor-context';

function EnergyDashboardContent() {
  const searchParams = useSearchParams();
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const [projectLocation, setProjectLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  } | undefined>(undefined);

  useEffect(() => {
    // Parse sensor data from URL parameters
    const sensorParam = searchParams.get('sensor');
    const projectLocationParam = searchParams.get('projectLocation');

    if (sensorParam) {
      try {
        setSensor(JSON.parse(sensorParam));
      } catch (error) {
        console.error('Failed to parse sensor data:', error);
      }
    }

    if (projectLocationParam) {
      try {
        setProjectLocation(JSON.parse(projectLocationParam));
      } catch (error) {
        console.error('Failed to parse project location data:', error);
      }
    }
  }, [searchParams]);

  const handleClose = () => {
    window.close();
  };

  return (
    <EnergyDashboardOverlay
      sensor={sensor}
      onClose={handleClose}
      projectLocation={projectLocation}
      standalone={true}
    />
  );
}

// This file is deprecated in favor of dynamic routes
// Use /energy-dashboard/[roomName]/[sensorName] instead
export default function EnergyDashboardPage() {
  return (
    <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white text-lg">
        This route is deprecated. Please use the new dashboard format from the application.
      </div>
    </div>
  );
}
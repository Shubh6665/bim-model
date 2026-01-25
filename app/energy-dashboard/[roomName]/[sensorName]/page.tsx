"use client";
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import EnergyDashboardOverlay from '../../../components/sensors/energy-dashboard-overlay';
import { Sensor } from '../../../context/sensor-context';

function EnergyDashboardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const [projectLocation, setProjectLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  } | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSensorData = async () => {
      try {
        const sensorId = searchParams.get('id');
        if (!sensorId) {
          throw new Error('Sensor ID is required');
        }

        // Fetch sensor data from API
        const response = await fetch(`/api/sensors/${sensorId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch sensor data');
        }
        
        const sensorData = await response.json();
        setSensor(sensorData);

        // If sensor has project info, fetch project location
        if (sensorData.projectId) {
          try {
            const projectResponse = await fetch(`/api/projects/${sensorData.projectId}`);
            if (projectResponse.ok) {
              const projectData = await projectResponse.json();
              if (projectData.location) {
                setProjectLocation(projectData.location);
              }
            }
          } catch (error) {
            console.warn('Failed to fetch project location:', error);
          }
        }
      } catch (error) {
        console.error('Error loading sensor data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load sensor data');
      } finally {
        setLoading(false);
      }
    };

    loadSensorData();
  }, [searchParams]);

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading sensor data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-950">
      <EnergyDashboardOverlay
        sensor={sensor}
        onClose={handleClose}
        projectLocation={projectLocation}
        standalone={true}
      />
    </div>
  );
}

export default function EnergyDashboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    }>
      <EnergyDashboardContent />
    </Suspense>
  );
}
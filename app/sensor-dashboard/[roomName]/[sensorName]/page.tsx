"use client";
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import SensorGraphsDashboard from '../../../components/sensor-graphs-dashboard';
import { Sensor } from '../../../context/sensor-context';

function SensorDashboardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const [allSensors, setAllSensors] = useState<Sensor[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSensorData = async () => {
      try {
        const sensorId = searchParams.get('id');
        const projectIdParam = searchParams.get('projectId');
        
        if (!sensorId) {
          throw new Error('Sensor ID is required');
        }

        setProjectId(projectIdParam || '');

        // Fetch sensor data from API
        const response = await fetch(`/api/sensors/${sensorId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch sensor data');
        }
        
        const sensorData = await response.json();
        setSensor(sensorData);

        // Fetch all sensors for the project if projectId is available
        if (projectIdParam) {
          try {
            const allSensorsResponse = await fetch(`/api/projects/${projectIdParam}/sensors`);
            if (allSensorsResponse.ok) {
              const allSensorsData = await allSensorsResponse.json();
              setAllSensors(allSensorsData);
            }
          } catch (error) {
            console.warn('Failed to fetch all sensors:', error);
            // Continue with just the single sensor
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

  if (!sensor) {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Sensor not found</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-950">
      <SensorGraphsDashboard
        sensor={sensor}
        allSensors={allSensors}
        onClose={handleClose}
        projectId={projectId}
        standalone={true}
      />
    </div>
  );
}

export default function SensorDashboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    }>
      <SensorDashboardContent />
    </Suspense>
  );
}
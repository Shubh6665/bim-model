"use client";
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import PVSensorDashboard from '../../../components/sensors/pv-sensor-dashboard';
import { Sensor } from '../../../context/sensor-context';

function PVDashboardContent() {
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

        // Fetch all sensors first to get the full list
        const sensorsResponse = await fetch(`/api/iot/sensors?projectId=${projectIdParam || ''}`);
        if (!sensorsResponse.ok) {
          throw new Error('Failed to fetch sensors');
        }
        const allSensorsData = await sensorsResponse.json();
        setAllSensors(allSensorsData);

        // Fetch real-time data
        const realtimeResponse = await fetch(`/api/iot/realtime?projectId=${projectIdParam || ''}`);
        if (!realtimeResponse.ok) {
          throw new Error('Failed to fetch real-time data');
        }
        
        const { updates } = await realtimeResponse.json();
        
        // Find current sensor in all sensors list
        const sensorData = allSensorsData.find((s: Sensor) => s.id === sensorId);
        
        if (!sensorData) {
          throw new Error('Sensor not found in project');
        }
        
        // Update sensor value from real-time data
        const realtimeUpdate = updates.find((u: any) => u.id === sensorId);
        if (realtimeUpdate) {
          sensorData.value = realtimeUpdate.value;
          sensorData.status = realtimeUpdate.status;
          sensorData.lastUpdate = realtimeUpdate.lastUpdate;
        }
        
        setSensor(sensorData);
        
        console.log('[PV Dashboard Page] Loaded sensor:', sensorData.name, 'Value:', sensorData.value);
      } catch (error) {
        console.error('Error loading sensor data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load sensor data');
      } finally {
        setLoading(false);
      }
    };

    loadSensorData();
    
    // Poll for updates every 15 seconds (independent real-time updates)
    const pollInterval = setInterval(() => {
      loadSensorData();
    }, 15000);
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [searchParams]);

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading PV sensor data...</div>
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
        <div className="text-white text-lg">PV Sensor not found</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-950">
      <PVSensorDashboard
        sensor={sensor}
        allSensors={allSensors}
        onClose={handleClose}
        projectId={projectId}
        standalone={true}
      />
    </div>
  );
}

export default function PVDashboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading PV Dashboard...</div>
      </div>
    }>
      <PVDashboardContent />
    </Suspense>
  );
}

"use client";
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import PVSensorDashboard from '../../../components/pv-sensor-dashboard';
import { Sensor } from '../../../context/sensor-context';

// BroadcastChannel for syncing sensor data across windows
let sensorSyncChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined') {
  try {
    sensorSyncChannel = new BroadcastChannel('sensor-sync');
  } catch (e) {
    console.warn('[PV Dashboard] BroadcastChannel not supported');
  }
}

function PVDashboardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const [allSensors, setAllSensors] = useState<Sensor[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMainWindow, setIsMainWindow] = useState(false);

  useEffect(() => {
    const loadSensorData = async () => {
      try {
        const sensorId = searchParams.get('id');
        const projectIdParam = searchParams.get('projectId');
        
        if (!sensorId) {
          throw new Error('Sensor ID is required');
        }

        setProjectId(projectIdParam || '');

        // Check if this is the main window (has opener) or standalone
        setIsMainWindow(!window.opener);

        // Fetch sensor data from IoT API (includes real-time value)
        const response = await fetch(`/api/iot/sensors?projectId=${projectIdParam || ''}`);
        if (!response.ok) {
          throw new Error('Failed to fetch sensor data');
        }
        
        const allSensorsData = await response.json();
        const sensorData = allSensorsData.find((s: Sensor) => s.id === sensorId);
        
        if (!sensorData) {
          throw new Error('Sensor not found in project');
        }
        
        setSensor(sensorData);
        setAllSensors(allSensorsData);
        
        console.log('[PV Dashboard Page] Loaded sensor:', sensorData.name, 'Value:', sensorData.value);
      } catch (error) {
        console.error('Error loading sensor data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load sensor data');
      } finally {
        setLoading(false);
      }
    };

    loadSensorData();
    
    // Listen for sensor updates from other windows via BroadcastChannel
    if (sensorSyncChannel) {
      const handleMessage = (event: MessageEvent) => {
        const { type, updates } = event.data;
        
        if (type === 'sensor-update') {
          const sensorId = searchParams.get('id');
          
          // Update current sensor
          setSensor(prevSensor => {
            if (!prevSensor) return prevSensor;
            const update = updates.find((u: any) => u.id === sensorId);
            if (update) {
              console.log('[PV Dashboard Page] Received broadcast update:', update.value);
              return {
                ...prevSensor,
                value: update.value,
                status: update.status,
                lastUpdate: update.lastUpdate
              };
            }
            return prevSensor;
          });
          
          // Update all sensors
          setAllSensors(prevSensors => {
            return prevSensors.map(s => {
              const update = updates.find((u: any) => u.id === s.id);
              if (update) {
                return {
                  ...s,
                  value: update.value,
                  status: update.status,
                  lastUpdate: update.lastUpdate
                };
              }
              return s;
            });
          });
        }
      };
      
      sensorSyncChannel.addEventListener('message', handleMessage);
      
      return () => {
        sensorSyncChannel?.removeEventListener('message', handleMessage);
      };
    }
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

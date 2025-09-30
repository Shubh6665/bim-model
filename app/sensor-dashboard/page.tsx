"use client";
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import SensorGraphsDashboard from '../components/sensor-graphs-dashboard';
import { Sensor } from '../context/sensor-context';

function SensorDashboardContent() {
  const searchParams = useSearchParams();
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const [allSensors, setAllSensors] = useState<Sensor[]>([]);
  const [projectId, setProjectId] = useState<string>('');

  useEffect(() => {
    // Parse sensor data from URL parameters
    const sensorParam = searchParams.get('sensor');
    const allSensorsParam = searchParams.get('allSensors');
    const projectIdParam = searchParams.get('projectId');

    if (sensorParam) {
      try {
        setSensor(JSON.parse(sensorParam));
      } catch (error) {
        console.error('Failed to parse sensor data:', error);
      }
    }

    if (allSensorsParam) {
      try {
        setAllSensors(JSON.parse(allSensorsParam));
      } catch (error) {
        console.error('Failed to parse all sensors data:', error);
      }
    }

    if (projectIdParam) {
      setProjectId(projectIdParam);
    }
  }, [searchParams]);

  const handleClose = () => {
    window.close();
  };

  if (!sensor) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-white text-lg">Loading sensor data...</div>
      </div>
    );
  }

  return (
    <SensorGraphsDashboard
      sensor={sensor}
      allSensors={allSensors}
      onClose={handleClose}
      projectId={projectId}
      standalone={true}
    />
  );
}

export default function SensorDashboardPage() {
  return (
    <div className="h-screen w-screen bg-gray-950">
      <Suspense fallback={
        <div className="h-full w-full flex items-center justify-center">
          <div className="text-white text-lg">Loading dashboard...</div>
        </div>
      }>
        <SensorDashboardContent />
      </Suspense>
    </div>
  );
}
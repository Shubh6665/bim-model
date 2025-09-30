// This file is deprecated in favor of dynamic routes
// Use /sensor-dashboard/[roomName]/[sensorName] instead
export default function SensorDashboardPage() {
  return (
    <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white text-lg">
        This route is deprecated. Please use the new dashboard format from the application.
      </div>
    </div>
  );
}
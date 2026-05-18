// This file is deprecated in favor of dynamic routes
// Use /sensor-dashboard/[roomName]/[sensorName] instead
export default function SensorDashboardPage() {
  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center">
      <div className="text-foreground text-lg">
        This route is deprecated. Please use the new dashboard format from the application.
      </div>
    </div>
  );
}
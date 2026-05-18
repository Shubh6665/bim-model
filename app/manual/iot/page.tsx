import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualIotPage() {
  return (
    <div className="space-y-6">
      <ScreenshotPlaceholder title="IoT Panel (All Sensors)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">What the IoT module is for</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          Use IoT to view sensors for a project and (if allowed) place new sensors inside the 3D model.
        </div>
      </div>

      <ScreenshotPlaceholder title="IoT Panel (Insert New Sensor)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Viewing sensors</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          In the sensor list, you can see sensor name, status, type, value, room, and battery level.
          <div className="mt-2">
            If you click a sensor in the list, the system can show:
            <div className="mt-1">
              - Info
              <br />- Graphs
              <br />- Statistics
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Placing a new sensor (step-by-step)</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">1)</span> Open IoT → choose “Insert new sensor”.
            </div>
            <div>
              <span className="font-semibold text-foreground">2)</span> Select the sensor type.
            </div>
            <div>
              <span className="font-semibold text-foreground">3)</span> Click inside the 3D model where you want to place the sensor.
            </div>
            <div>
              <span className="font-semibold text-foreground">4)</span> Fill any sensor details requested by the form.
            </div>
            <div>
              <span className="font-semibold text-foreground">Result:</span> the sensor is saved and appears in the list.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
        <div className="font-semibold text-foreground">Removing a sensor</div>
        <div className="mt-1">Use the remove action for that sensor and confirm the removal.</div>
      </div>
    </div>
  );
}

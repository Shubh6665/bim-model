import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualDashboardPage() {
  return (
    <div className="space-y-6">
      <ScreenshotPlaceholder title="Dashboard Overview (Map/Viewer + Right Panel)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">What you see on the Dashboard</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Main work area</div>
            <div className="mt-1">
              This is where you see either the map view (project location) or the 3D viewer (project model).
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Right-side panel</div>
            <div className="mt-1">
              This panel changes based on the top navigation (BIM / IoT / Database / FM / etc.).
            </div>
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="Dashboard Header (Top Navigation + Icons)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Top navigation (buttons)</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          Click a module button to open its tools in the right-side panel.
          <div className="mt-2">
            Examples:
            <div className="mt-1">
              - Click <span className="font-semibold text-foreground">BIM</span> to work with the 3D model tools.
              <br />- Click <span className="font-semibold text-foreground">IoT</span> to view/place sensors.
              <br />- Click <span className="font-semibold text-foreground">Database</span> to manage folders/files.
              <br />- Click <span className="font-semibold text-foreground">FM</span> for tickets and maintenance.
            </div>
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="Profile Menu (includes Project Info and User Manual)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Profile menu (top-right)</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">Profile:</span> opens your profile information.
            </div>
            <div>
              <span className="font-semibold text-foreground">My Projects:</span> returns to project selection.
            </div>
            <div>
              <span className="font-semibold text-foreground">Project Info:</span> opens project administration (if
              allowed).
            </div>
            <div>
              <span className="font-semibold text-foreground">User Manual:</span> opens this manual in a new tab.
            </div>
            <div>
              <span className="font-semibold text-foreground">Sign out:</span> logs you out.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Notifications</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          Use the bell icon to view notifications (alerts). Unread notifications appear as a badge count.
        </div>
      </div>
    </div>
  );
}

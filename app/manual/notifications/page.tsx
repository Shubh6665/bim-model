import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualNotificationsPage() {
  return (
    <div className="space-y-6">
      <ScreenshotPlaceholder title="Notifications Bell (top-right) + Notifications list" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">What notifications are</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          Notifications are small alerts that keep you updated about important changes in your projects.
          <div className="mt-2">For example: a request was approved, a file was shared, or maintenance was completed.</div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">How to open notifications</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">Step 1:</span> Click the bell icon in the dashboard header.
            </div>
            <div>
              <span className="font-semibold text-foreground">Step 2:</span> Read the list of recent notifications.
            </div>
            <div>
              <span className="font-semibold text-foreground">Unread count:</span> If you see a number badge, it means you have unread notifications.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Common examples you may see</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Project access</div>
            <div className="mt-1">Invites accepted, access changes, or role updates.</div>
          </div>
          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">FM (maintenance)</div>
            <div className="mt-1">New service request, work order resolved, or integration requested.</div>
          </div>
          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Documents</div>
            <div className="mt-1">File uploaded, shared, or downloaded (depending on what your role can see).</div>
          </div>
          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">System messages</div>
            <div className="mt-1">Important confirmations or warnings.</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
        <div className="font-semibold text-foreground">Good practice</div>
        <div className="mt-1">
          If a notification mentions a project action, open that project and check the related area (FM, Database, etc.) to see the full details.
        </div>
      </div>
    </div>
  );
}

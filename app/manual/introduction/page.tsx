import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualIntroductionPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-foreground">
          This manual explains how to use the platform in simple, client-friendly language.
        </p>
        <p className="text-muted-foreground">
          The platform helps you manage BIM projects with a 3D model viewer, optional IoT sensors, project
          documents, and Facility Management (FM) workflows.
        </p>
      </div>

      <ScreenshotPlaceholder title="Landing Page (Login)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">What the platform is used for</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">Project & location:</span> create projects and store
              basic information (name, location, description).
            </div>
            <div>
              <span className="font-semibold text-foreground">BIM viewing:</span> open the 3D model to explore the
              building and its elements.
            </div>
            <div>
              <span className="font-semibold text-foreground">IoT sensors (if enabled):</span> view and place
              sensors inside the model.
            </div>
            <div>
              <span className="font-semibold text-foreground">Documents:</span> keep project files in folders,
              download, and share them.
            </div>
            <div>
              <span className="font-semibold text-foreground">FM:</span> create maintenance requests and follow the
              maintenance process until closure.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Who uses the system</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Platform Owner / Administrator</div>
            <div className="mt-1">
              Manages high-level access and project creation permissions (depending on your company setup).
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Project members</div>
            <div className="mt-1">
              Work inside a project (BIM, IoT, Documents, FM) according to their invitation and role.
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">FM roles</div>
            <div className="mt-1">
              TM (Maintenance Team), FM (Facility Manager), Maintainer/Technician, and regular Users.
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Non-technical users</div>
            <div className="mt-1">
              Can open projects, view information, download documents, and create service requests.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">High-level journey (simple)</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">1)</span> Sign in.
            </div>
            <div>
              <span className="font-semibold text-foreground">2)</span> Open the dashboard.
            </div>
            <div>
              <span className="font-semibold text-foreground">3)</span> Select a project.
            </div>
            <div>
              <span className="font-semibold text-foreground">4)</span> Choose what you want to do:
              <div className="mt-1">
                - Explore the 3D model
                <br />- Work with sensors
                <br />- Manage documents
                <br />- Manage FM maintenance process
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

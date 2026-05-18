export default function ManualGlossaryPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-sm text-muted-foreground">
        This glossary explains common words you will see in the platform in simple language.
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card/30 p-4">
          <div className="text-sm font-semibold text-foreground">Project</div>
          <div className="mt-1 text-sm text-muted-foreground">A workspace that contains a building model, documents, sensors, and FM tasks.</div>
        </div>

        <div className="rounded-lg border border-border bg-card/30 p-4">
          <div className="text-sm font-semibold text-foreground">Model (3D Model)</div>
          <div className="mt-1 text-sm text-muted-foreground">The building’s 3D representation that you can open and explore.</div>
        </div>

        <div className="rounded-lg border border-border bg-card/30 p-4">
          <div className="text-sm font-semibold text-foreground">BIM</div>
          <div className="mt-1 text-sm text-muted-foreground">A structured way to represent building information in a digital model.</div>
        </div>

        <div className="rounded-lg border border-border bg-card/30 p-4">
          <div className="text-sm font-semibold text-foreground">Module</div>
          <div className="mt-1 text-sm text-muted-foreground">A section of the system (BIM, IoT, Database, FM, etc.).</div>
        </div>

        <div className="rounded-lg border border-border bg-card/30 p-4">
          <div className="text-sm font-semibold text-foreground">IoT Sensor</div>
          <div className="mt-1 text-sm text-muted-foreground">A device that reports readings (temperature, humidity, etc.). In the platform it can be shown in the 3D model.</div>
        </div>

        <div className="rounded-lg border border-border bg-card/30 p-4">
          <div className="text-sm font-semibold text-foreground">Database (Documents)</div>
          <div className="mt-1 text-sm text-muted-foreground">Your project document library (folders and files).</div>
        </div>

        <div className="rounded-lg border border-border bg-card/30 p-4">
          <div className="text-sm font-semibold text-foreground">Service Request (Ticket)</div>
          <div className="mt-1 text-sm text-muted-foreground">A request raised by a user when something needs maintenance.</div>
        </div>

        <div className="rounded-lg border border-border bg-card/30 p-4">
          <div className="text-sm font-semibold text-foreground">Work Order</div>
          <div className="mt-1 text-sm text-muted-foreground">A maintenance task created after a ticket is approved.</div>
        </div>

        <div className="rounded-lg border border-border bg-card/30 p-4">
          <div className="text-sm font-semibold text-foreground">Notification</div>
          <div className="mt-1 text-sm text-muted-foreground">An alert shown under the bell icon to keep you updated.</div>
        </div>

        <div className="rounded-lg border border-border bg-card/30 p-4">
          <div className="text-sm font-semibold text-foreground">Role</div>
          <div className="mt-1 text-sm text-muted-foreground">Your access level in a project (what actions you can perform).</div>
        </div>
      </div>
    </div>
  );
}

import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualDatabasePage() {
  return (
    <div className="space-y-6">
      <ScreenshotPlaceholder title="Database Panel (Folders & Files)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">What the Database module is for</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          Use Database to manage project documents (folders and files). This is your project file library.
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Folders (step-by-step)</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">Create a folder:</span> choose the create folder option and give it a name.
            </div>
            <div>
              <span className="font-semibold text-foreground">Open a folder:</span> click the folder to view its contents.
            </div>
            <div>
              <span className="font-semibold text-foreground">Rename or delete:</span> use the actions next to the item.
            </div>
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="Upload File" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Files (step-by-step)</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">Upload:</span> select a folder → upload the file.
            </div>
            <div>
              <span className="font-semibold text-foreground">Download:</span> click download for the file.
            </div>
            <div>
              <span className="font-semibold text-foreground">Rename:</span> change the file name using rename.
            </div>
            <div>
              <span className="font-semibold text-foreground">Delete:</span> remove the file if you no longer need it.
            </div>
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="Share Options (Link / Email / ZIP)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Sharing (what happens)</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          The platform provides sharing options such as:
          <div className="mt-2">
            - Create a share link
            <br />- Send by email
            <br />- Send as ZIP
          </div>
          <div className="mt-2">
            Use the option that matches what you need. For example, ZIP is useful when sharing an entire folder.
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
        <div className="font-semibold text-foreground">Access assignment (if enabled)</div>
        <div className="mt-1">
          Some projects allow assigning access for a file or folder to specific users.
        </div>
      </div>
    </div>
  );
}

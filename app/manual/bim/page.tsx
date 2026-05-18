import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualBimPage() {
  return (
    <div className="space-y-6">
      <ScreenshotPlaceholder title="BIM Module Panel (right side)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">What the BIM module is for</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          Use BIM when you want to explore the 3D building model, focus on specific parts, or understand the model structure.
        </div>
      </div>

      <ScreenshotPlaceholder title="3D Viewer (Model Loaded)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Common actions (step-by-step)</h3>
        <div className="space-y-2 rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          <div>
            <span className="font-semibold text-foreground">Switch visible models (if multiple):</span>
            <div className="mt-1">
              Select which model(s) you want to see (for example Architecture / Structure / MEP). The system keeps at least one model visible.
            </div>
          </div>
          <div>
            <span className="font-semibold text-foreground">Filter what you see:</span>
            <div className="mt-1">
              Use available filters (such as category or a search field) to focus the view. When you apply a filter, only matching items remain visible/selected.
            </div>
          </div>
          <div>
            <span className="font-semibold text-foreground">Select an object in the model:</span>
            <div className="mt-1">
              Click an element in the 3D model to focus it. The right panel can then provide additional context or actions.
            </div>
          </div>
          <div>
            <span className="font-semibold text-foreground">Reset the view:</span>
            <div className="mt-1">
              If you get lost, use reset/visibility actions in the panel to return to a normal view.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
        <div className="font-semibold text-foreground">Tip</div>
        <div className="mt-1">
          If your project uses sensors, you may switch to the IoT module to see sensor overlays clearly.
        </div>
      </div>
    </div>
  );
}

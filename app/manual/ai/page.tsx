import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualAiPage() {
  return (
    <div className="space-y-6">
      <ScreenshotPlaceholder title="AI Panel" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">What AI is for</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          The AI area is a place reserved for future smart features (for example: answering questions about the project, helping users find information, or assisting with workflows).
        </div>
      </div>

      <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 p-4 text-sm text-muted-foreground">
        <div className="font-semibold text-amber-200">Current status</div>
        <div className="mt-1">
          In the current build, the AI panel exists but is mostly a placeholder.
        </div>
      </div>
    </div>
  );
}

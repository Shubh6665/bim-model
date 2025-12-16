import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualAiPage() {
  return (
    <div className="space-y-6">
      <ScreenshotPlaceholder title="AI Panel" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">What AI is for</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          The AI area is a place reserved for future smart features (for example: answering questions about the project, helping users find information, or assisting with workflows).
        </div>
      </div>

      <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 p-4 text-sm text-gray-300">
        <div className="font-semibold text-amber-200">Current status</div>
        <div className="mt-1">
          In the current build, the AI panel exists but is mostly a placeholder.
        </div>
      </div>
    </div>
  );
}

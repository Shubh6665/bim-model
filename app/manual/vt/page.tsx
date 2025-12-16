import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualVtPage() {
  return (
    <div className="space-y-6">
      <ScreenshotPlaceholder title="VT Panel (Virtual Tours / Cameras tabs)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">What VT is for</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          VT (Virtual Tours) is a space where virtual tours and cameras can be organized for a project.
        </div>
      </div>

      <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 p-4 text-sm text-gray-300">
        <div className="font-semibold text-amber-200">Current status</div>
        <div className="mt-1">
          In the current build, the VT panel UI is present (tabs and search), but the main content area is intentionally minimal.
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">How to use (what you can do today)</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-gray-200">1)</span> Open a project.
            </div>
            <div>
              <span className="font-semibold text-gray-200">2)</span> Click VT in the top navigation.
            </div>
            <div>
              <span className="font-semibold text-gray-200">3)</span> Use the tabs (Virtual Tours / Cameras) and the search field.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

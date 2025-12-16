import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualProjectsPage() {
  return (
    <div className="space-y-6">
      <ScreenshotPlaceholder title="My Projects Panel (Projects/Models tabs)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">Selecting a project</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-gray-200">1)</span> Open <span className="font-semibold">My Projects</span>.
            </div>
            <div>
              <span className="font-semibold text-gray-200">2)</span> Use the search box if you have many projects.
            </div>
            <div>
              <span className="font-semibold text-gray-200">3)</span> Click a project card to select it.
            </div>
            <div>
              <span className="font-semibold text-gray-200">Result:</span> the system loads the project details and makes the map/3D viewer available.
            </div>
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="Project Card Actions (Open in 3D / Show on Map)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">Opening the map or the 3D model</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
            <div className="font-semibold text-gray-200">Show on map</div>
            <div className="mt-1">
              Use this when you want to view the project location.
            </div>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
            <div className="font-semibold text-gray-200">Open in 3D</div>
            <div className="mt-1">
              Use this when you want to explore the building model.
            </div>
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="Create Project Wizard" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">Creating a project (if you have permission)</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          The system shows the Create Project option only to users who are allowed to create projects.
          <div className="mt-3 space-y-2">
            <div>
              <span className="font-semibold text-gray-200">Step 1:</span> Enter project name and code.
            </div>
            <div>
              <span className="font-semibold text-gray-200">Step 2:</span> Add location details (optional).
            </div>
            <div>
              <span className="font-semibold text-gray-200">Step 3:</span> Add client/manager information (optional).
            </div>
            <div>
              <span className="font-semibold text-gray-200">Step 4:</span> Upload one or more BIM model files.
            </div>
            <div>
              <span className="font-semibold text-gray-200">Step 5:</span> Pick the coordinates on the map.
            </div>
            <div>
              <span className="font-semibold text-gray-200">Result:</span> the project is created and appears in your project list.
            </div>
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="Project Info Panel (selected project details)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">Project Info</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          When a project is selected, the right panel shows project details (company/client/location and the list of models). Use it to understand what is available in the project.
        </div>
      </div>
    </div>
  );
}

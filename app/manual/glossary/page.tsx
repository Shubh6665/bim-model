export default function ManualGlossaryPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-sm text-gray-300">
        This glossary explains common words you will see in the platform in simple language.
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
          <div className="text-sm font-semibold text-gray-200">Project</div>
          <div className="mt-1 text-sm text-gray-300">A workspace that contains a building model, documents, sensors, and FM tasks.</div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
          <div className="text-sm font-semibold text-gray-200">Model (3D Model)</div>
          <div className="mt-1 text-sm text-gray-300">The building’s 3D representation that you can open and explore.</div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
          <div className="text-sm font-semibold text-gray-200">BIM</div>
          <div className="mt-1 text-sm text-gray-300">A structured way to represent building information in a digital model.</div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
          <div className="text-sm font-semibold text-gray-200">Module</div>
          <div className="mt-1 text-sm text-gray-300">A section of the system (BIM, IoT, Database, FM, etc.).</div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
          <div className="text-sm font-semibold text-gray-200">IoT Sensor</div>
          <div className="mt-1 text-sm text-gray-300">A device that reports readings (temperature, humidity, etc.). In the platform it can be shown in the 3D model.</div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
          <div className="text-sm font-semibold text-gray-200">Database (Documents)</div>
          <div className="mt-1 text-sm text-gray-300">Your project document library (folders and files).</div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
          <div className="text-sm font-semibold text-gray-200">Service Request (Ticket)</div>
          <div className="mt-1 text-sm text-gray-300">A request raised by a user when something needs maintenance.</div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
          <div className="text-sm font-semibold text-gray-200">Work Order</div>
          <div className="mt-1 text-sm text-gray-300">A maintenance task created after a ticket is approved.</div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
          <div className="text-sm font-semibold text-gray-200">Notification</div>
          <div className="mt-1 text-sm text-gray-300">An alert shown under the bell icon to keep you updated.</div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
          <div className="text-sm font-semibold text-gray-200">Role</div>
          <div className="mt-1 text-sm text-gray-300">Your access level in a project (what actions you can perform).</div>
        </div>
      </div>
    </div>
  );
}

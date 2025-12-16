import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualFmPage() {
  return (
    <div className="space-y-6">
      <ScreenshotPlaceholder title="FM Panel (tabs: Assets / Spaces / Maintenance / Work Orders / Ongoing / Reports)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">What the FM module is for</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          FM (Facility Management) helps you manage maintenance requests from start to finish.
          <div className="mt-2">The typical flow is:</div>
          <div className="mt-1">
            Service Request (ticket) → TM decision → Work Order → Maintenance progress → Closure → Report
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="FM: Ticket Form (create service request)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">1) Creating a Service Request (User)</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-gray-200">When to use:</span> when you need maintenance for an asset/area.
            </div>
            <div>
              <span className="font-semibold text-gray-200">What you do:</span> fill the request details (who you are, where the issue is, and what happened).
            </div>
            <div>
              <span className="font-semibold text-gray-200">What happens next:</span> the request is sent to the Maintenance Team (TM) and Facility Manager (FM) for review.
            </div>
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="FM: Pending Approvals (TM actions)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">2) TM review (approve or reject)</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-gray-200">Approve:</span> TM selects Priority and Type. A work order is created.
            </div>
            <div>
              <span className="font-semibold text-gray-200">Reject:</span> TM writes a reason. The requester and FM are informed.
            </div>
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="FM: Work Orders list" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">3) Work Order (after approval)</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          A work order is the operational task that the maintenance team works on.
          <div className="mt-2">In the work order you typically see:</div>
          <div className="mt-1">
            Request ID, requester/contact, location, short description, priority/type, technician assignment, and status.
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="FM: Ongoing Maintenance (status changes)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">4) Ongoing Maintenance (Maintainer / TM)</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          During maintenance, the work order moves through these stages:
          <div className="mt-2">
            - <span className="font-semibold text-gray-200">Planned</span>: work is planned and prepared
            <br />- <span className="font-semibold text-gray-200">In Progress</span>: the work is being executed
            <br />- <span className="font-semibold text-gray-200">Close</span>: the maintainer finished work and submits notes
          </div>
          <div className="mt-3">
            <span className="font-semibold text-gray-200">Important:</span> when the maintainer sets “Close”, the system notifies TM to review.
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="FM: Technician Assignment" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">5) Assigning technicians (TM)</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          TM can add or remove technicians on a work order. When a technician is assigned, the system sends them an email notification.
        </div>
      </div>

      <ScreenshotPlaceholder title="FM: FM edits Priority/Type" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">6) FM can adjust Priority/Type</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          FM can change Priority/Type even after approval. When FM changes these values, the system informs the Maintenance Team.
        </div>
      </div>

      <ScreenshotPlaceholder title="FM: TM marks RESOLVED" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">7) Final operational closure (TM)</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          After the work is closed and reviewed, TM marks the work order as <span className="font-semibold text-gray-200">Resolved</span> and adds closing notes.
          <div className="mt-2">FM is notified after a resolution.</div>
        </div>
      </div>

      <ScreenshotPlaceholder title="FM: FM Integration Request (reopen)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">8) FM integration request (optional)</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          If FM needs more work or corrections after resolution, FM can request integration and provide a reason.
          <div className="mt-2">This reopens the work order and a new maintenance cycle can start.</div>
        </div>
      </div>

      <ScreenshotPlaceholder title="FM: FM confirms resolution" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">9) FM confirms the resolution</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          When the work is resolved, FM can confirm the resolution. After confirmation, the requester receives an email confirmation.
        </div>
      </div>

      <ScreenshotPlaceholder title="FM: Maintenance Report (view / fill / export PDF)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">10) Maintenance Report</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-300">
          The report collects what happened during the maintenance.
          <div className="mt-2">In the report:</div>
          <div className="mt-1">
            - TM fills work details and closing notes
            <br />- FM signs/approves (and can add comments)
            <br />- The report can be printed or saved as PDF
          </div>
        </div>
      </div>
    </div>
  );
}

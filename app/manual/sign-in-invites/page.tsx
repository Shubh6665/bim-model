import { ScreenshotPlaceholder } from "@/app/manual/_components/screenshot-placeholder";

export default function ManualSignInInvitesPage() {
  return (
    <div className="space-y-6">
      <ScreenshotPlaceholder title="Landing Page (Sign in / Sign up)" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Sign in (simple)</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">Step 1:</span> Open the website.
            </div>
            <div>
              <span className="font-semibold text-foreground">Step 2:</span> Use the sign-in panel to log in.
            </div>
            <div>
              <span className="font-semibold text-foreground">Step 3:</span> After login you are taken to the dashboard.
            </div>
          </div>
        </div>
      </div>

      <ScreenshotPlaceholder title="Forgot Password / Reset Password" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Forgot password</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          If you forgot your password, use the “Forgot password” option on the login panel. Follow the steps shown on screen.
        </div>
      </div>

      <ScreenshotPlaceholder title="Invite Acceptance Screen" />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Accepting a project invite</h3>
        <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">1)</span> Open the invite link from your email.
            </div>
            <div>
              <span className="font-semibold text-foreground">2)</span> If you are not logged in, the system will ask you to sign in.
            </div>
            <div>
              <span className="font-semibold text-foreground">3)</span> Important: sign in using the same email address that received the invite.
            </div>
            <div>
              <span className="font-semibold text-foreground">Result:</span> the project becomes visible in your “My Projects” list.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
        <div className="font-semibold text-foreground">If you used the wrong email</div>
        <div className="mt-1">
          The platform can log you out and ask you to sign in again with the correct invited account.
        </div>
      </div>
    </div>
  );
}

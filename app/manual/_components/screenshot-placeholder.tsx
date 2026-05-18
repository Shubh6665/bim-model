export function ScreenshotPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/40 p-4">
      <div className="text-sm font-semibold text-foreground">Screenshot Placeholder</div>
      <div className="mt-1 text-sm text-muted-foreground">[{title}]</div>
    </div>
  );
}

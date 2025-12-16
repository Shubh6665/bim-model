export function ScreenshotPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-600 bg-gray-950/40 p-4">
      <div className="text-sm font-semibold text-gray-200">Screenshot Placeholder</div>
      <div className="mt-1 text-sm text-gray-400">[{title}]</div>
    </div>
  );
}

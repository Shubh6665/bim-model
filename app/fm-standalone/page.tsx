"use client";
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const FMPanel = dynamic(() => import('../components/fm/fm-panel'), { ssr: false });

function FMStandaloneContent() {
  const params = useSearchParams();
  const sectionParam = params.get('section');
  const projectId = params.get('projectId') || undefined;
  const assetId = params.get('assetId') || undefined;

  let parsedSection = undefined;
  try { if (sectionParam) parsedSection = JSON.parse(sectionParam); } catch { parsedSection = undefined; }

  // Removed debug overlay state/effect

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      {/* Standalone debug overlay removed for production */}
      <FMPanel projectId={projectId} viewer={undefined} standalone={true} initialSection={parsedSection} initialAssetId={assetId} />
    </div>
  );
}

// Diagnostic: log what the standalone page reads from localStorage on first mount.
// This is intentionally non-invasive and only emits console logs to help debug
// cases where the standalone tab shows the wrong project or missing metrics.
function useStandaloneDiagnostics(projectId?: string, sectionParam?: string | null) {
  React.useEffect(() => {
    try {
      console.log(`[FMStandalone] opened with section=${String(sectionParam)} projectId=${String(projectId)}`);
      const keyCtx = projectId ? `fm-context-${projectId}` : null;
      const keySpaces = projectId ? `fm-spaces-${projectId}` : null;
      try {
        if (keyCtx) console.log('[FMStandalone] fm-context key:', keyCtx, 'value:', localStorage.getItem(keyCtx));
        else {
          // scan for any fm-context-* keys when projectId not provided
          const found: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) || '';
            if (k.startsWith('fm-context-')) found.push(k);
          }
          console.log('[FMStandalone] no projectId param; fm-context-* keys present:', found);
        }
      } catch (err) { console.warn('[FMStandalone] reading fm-context failed', err); }

      try {
        if (keySpaces) console.log('[FMStandalone] fm-spaces key:', keySpaces, 'value length:', (localStorage.getItem(keySpaces) || '').length);
      } catch (err) { console.warn('[FMStandalone] reading fm-spaces failed', err); }
    } catch (err) {
      // swallow
    }
  // run once on mount
  }, []);
}

export default function StandalonePage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <FMStandaloneContent />
    </Suspense>
  );
}


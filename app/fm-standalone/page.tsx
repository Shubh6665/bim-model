"use client";
import React, { Suspense } from 'react';
import FMPanel from '../components/fm-panel';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

function FMStandaloneContent() {
  const params = useSearchParams();
  const sectionParam = params.get('section');
  const projectId = params.get('projectId') || undefined;

  let parsedSection = undefined;
  try { if (sectionParam) parsedSection = JSON.parse(sectionParam); } catch { parsedSection = undefined; }

  const [debugCtx, setDebugCtx] = useState<any>(null);
  const [debugSpaces, setDebugSpaces] = useState<any[]>([]);

  useEffect(() => {
    try {
      const keyCtx = projectId ? `fm-context-${projectId}` : null;
      const keySpaces = projectId ? `fm-spaces-${projectId}` : null;
      const rawCtx = keyCtx ? localStorage.getItem(keyCtx) : null;
      const rawSpaces = keySpaces ? localStorage.getItem(keySpaces) : null;
      const ctx = rawCtx ? JSON.parse(rawCtx) : null;
      const spaces = rawSpaces ? JSON.parse(rawSpaces) : [];
      console.log('[Standalone] URL projectId=', projectId, 'section=', parsedSection);
      console.log('[Standalone] read', keyCtx, ctx);
      console.log('[Standalone] read', keySpaces, Array.isArray(spaces) ? `${spaces.length} rows` : rawSpaces);
      setDebugCtx(ctx);
      setDebugSpaces(Array.isArray(spaces) ? spaces : []);
    } catch (err) {
      console.error('[Standalone] debug read error', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <div style={{ position: 'absolute', right: 12, top: 12, zIndex: 9999 }}>
        <div style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', padding: 8, borderRadius: 6, fontSize: 12, maxWidth: 420 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Standalone debug</div>
          <div><strong>projectId</strong>: {String(projectId)}</div>
          <div style={{ marginTop: 6 }}><strong>Context</strong>:</div>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(debugCtx, null, 2)}</pre>
          <div style={{ marginTop: 6 }}><strong>Spaces (count)</strong>: {debugSpaces.length}</div>
          {debugSpaces.slice(0,5).map((r,i) => (
            <div key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginTop: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{r.name || r.id}</div>
              <div style={{ fontSize: 11 }}>area: {typeof r.area === 'number' ? r.area : String(r.area)}</div>
              <div style={{ fontSize: 11 }}>perimeter: {typeof r.perimeter === 'number' ? r.perimeter : String(r.perimeter)}</div>
              <div style={{ fontSize: 11 }}>volume: {typeof r.volume === 'number' ? r.volume : String(r.volume)}</div>
              <div style={{ fontSize: 11 }}>modelGuid: {String(r.modelGuid)}</div>
            </div>
          ))}
        </div>
      </div>
      <FMPanel projectId={projectId} viewer={undefined} standalone={true} initialSection={parsedSection} />
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


"use client";
import React, { Suspense } from 'react';
import FMPanel from '../components/fm-panel';
import { useSearchParams } from 'next/navigation';

function FMStandaloneContent() {
  const params = useSearchParams();
  const sectionParam = params.get('section');
  const projectId = params.get('projectId') || undefined;

  let parsedSection = undefined;
  try { if (sectionParam) parsedSection = JSON.parse(sectionParam); } catch { parsedSection = undefined; }

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <FMPanel projectId={projectId} viewer={undefined} standalone={true} />
    </div>
  );
}

export default function StandalonePage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <FMStandaloneContent />
    </Suspense>
  );
}


"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FMPanel from "../components/fm-panel";

function FMControlContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;

  return (
    <div className="h-screen w-screen bg-gray-950">
      <FMPanel projectId={projectId} viewer={undefined} standalone={true} />
    </div>
  );
}

export default function FMControlPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <FMControlContent />
    </Suspense>
  );
}

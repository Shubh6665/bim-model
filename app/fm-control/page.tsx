"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import FMPanel from "../components/fm-panel";

export default function FMControlPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;

  return (
    <div className="h-screen w-screen bg-gray-950">
      <FMPanel projectId={projectId} viewer={undefined} standalone={true} />
    </div>
  );
}

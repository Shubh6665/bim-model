import type { ReactNode } from "react";

import { ManualShell } from "@/app/manual/_components/manual-shell";

export default function ManualLayout({ children }: { children: ReactNode }) {
  return <ManualShell>{children}</ManualShell>;
}

"use client";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/app/context/auth-context";

export default function SessionWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AuthProvider>{children}</AuthProvider>
    </SessionProvider>
  );
}

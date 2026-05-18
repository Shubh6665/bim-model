"use client";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/app/context/auth-context";
import { ThemeProvider } from "@/app/context/theme-context";

export default function SessionWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

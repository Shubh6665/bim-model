import { NextResponse } from "next/server";

// Clears NextAuth cookies so the client becomes effectively logged out
export async function POST() {
  const res = new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  // Clear common NextAuth cookies (handle both secure/non-secure names)
  const expire = new Date(0).toUTCString();
  const cookies = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "next-auth.callback-url",
  ];

  for (const name of cookies) {
    res.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Expires=${expire}; HttpOnly; SameSite=Lax`
    );
  }

  return res;
}

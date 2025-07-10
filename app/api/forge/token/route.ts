import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.FORGE_CLIENT_ID;
    const clientSecret = process.env.FORGE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Forge credentials not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      "https://developer.api.autodesk.com/authentication/v1/authenticate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
          scope: "data:read data:write data:create bucket:create bucket:read",
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Forge API error: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
    });
  } catch (error) {
    console.error("Error getting Forge token:", error);
    return NextResponse.json(
      { error: "Failed to get access token" },
      { status: 500 }
    );
  }
}

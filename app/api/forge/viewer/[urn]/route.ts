import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ urn: string }> }
): Promise<NextResponse> {
  const { urn } = await params;
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "No authorization header" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // Get model derivatives
    const response = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get manifest: ${response.statusText}`);
    }

    const manifest = await response.json();

    // Find SVF derivatives for viewing
    const svfDerivatives = manifest.derivatives?.find(
      (d: any) => d.outputType === "svf"
    );

    if (!svfDerivatives) {
      return NextResponse.json(
        { error: "No SVF derivatives found" },
        { status: 404 }
      );
    }

    // Return viewer configuration
    return NextResponse.json({
      success: true,
      urn: urn,
      viewerConfig: {
        urn: urn,
        accessToken: accessToken,
        derivatives: svfDerivatives,
      },
    });
  } catch (error) {
    console.error("Error getting viewer data:", error);
    return NextResponse.json(
      { error: "Failed to get viewer data" },
      { status: 500 }
    );
  }
} 
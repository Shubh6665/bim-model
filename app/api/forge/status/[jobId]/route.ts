import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "No authorization header" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // Check job status
    const response = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${jobId}/manifest`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }

    const manifest = await response.json();

    // Check if translation is complete
    if (manifest.status === "success") {
      // Get the URN from the manifest
      const urn = manifest.urn;

      // Create viewer URL
      const viewerUrl = `/api/forge/viewer/${encodeURIComponent(urn)}`;

      return NextResponse.json({
        status: "success",
        urn: urn,
        viewerUrl: viewerUrl,
        manifest: manifest,
      });
    } else if (manifest.status === "failed") {
      return NextResponse.json({
        status: "failed",
        error: manifest.progress || "Translation failed",
      });
    } else {
      // Still processing
      return NextResponse.json({
        status: "processing",
        progress: manifest.progress || "Processing...",
      });
    }
  } catch (error) {
    console.error("Error checking translation status:", error);
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}

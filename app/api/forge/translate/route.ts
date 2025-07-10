import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urn, format, quality, includeMetadata } = body;
    const authHeader = request.headers.get("authorization");

    if (!urn) {
      return NextResponse.json(
        { error: "No URN provided" },
        { status: 400 }
      );
    }

    if (!authHeader) {
      return NextResponse.json(
        { error: "No authorization header" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // Map format to Forge output format
    const formatMap: { [key: string]: string } = {
      ifc: "IFC",
      obj: "OBJ",
      gltf: "GLTF",
      fbx: "FBX",
    };

    const outputFormat = formatMap[format] || "IFC";

    // Create translation job payload
    const jobPayload = {
      input: {
        urn: urn,
        compressedUrn: false,
        rootFilename: "model.rvt",
      },
      output: {
        formats: [
          {
            type: "svf",
            views: ["2d", "3d"],
          },
          {
            type: outputFormat.toLowerCase(),
            advanced: {
              generateMasterViews: true,
              extractSheetImages: true,
              extractSheetProperties: true,
              extractElementProperties: includeMetadata || false,
            },
          },
        ],
      },
    };

    // Start translation job
    const response = await fetch(
      "https://developer.api.autodesk.com/modelderivative/v2/designdata/job",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-ads-force": "true",
        },
        body: JSON.stringify(jobPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Translation job failed:", errorText);
      throw new Error(`Translation failed: ${response.statusText}`);
    }

    const jobData = await response.json();

    return NextResponse.json({
      success: true,
      jobId: jobData.result,
      urn: urn,
    });
  } catch (error) {
    console.error("Error starting translation:", error);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}

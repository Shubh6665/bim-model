import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const authHeader = request.headers.get("authorization");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!authHeader) {
      return NextResponse.json(
        { error: "No authorization header" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");
    const bucketKey = process.env.FORGE_BUCKET_KEY || "bim-model-bucket";

    // Step 1: Create bucket if it doesn't exist
    try {
      await fetch(`https://developer.api.autodesk.com/oss/v2/buckets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bucketKey: bucketKey,
          policyKey: "transient", // Files are deleted after 24 hours
        }),
      });
    } catch (error) {
      // Bucket might already exist, continue
      console.log("Bucket creation skipped (might already exist)");
    }

    // Step 2: Upload file
    const fileName = `${Date.now()}-${file.name}`;
    const fileBuffer = await file.arrayBuffer();

    const uploadResponse = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${fileName}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
        },
        body: fileBuffer,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const uploadData = await uploadResponse.json();

    // Step 3: Get URN
    const urn = Buffer.from(
      `urn:adsk.objects:os.object:${bucketKey}:${fileName}`
    )
      .toString("base64")
      .replace(/=/g, "");

    return NextResponse.json({
      success: true,
      urn: urn,
      fileName: fileName,
      bucketKey: bucketKey,
    });
  } catch (error) {
    console.error("Error uploading to Forge:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// app/config.ts
// Centralized server-only environment variable access

export const serverConfig = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    FORGE_CLIENT_ID: process.env.FORGE_CLIENT_ID,
    FORGE_CLIENT_SECRET: process.env.FORGE_CLIENT_SECRET,
    FORGE_BUCKET_KEY: process.env.FORGE_BUCKET_KEY,
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB: process.env.MONGODB_DB || "bim-client",
    // Only expose NEXT_PUBLIC_ variables to the client
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  }; 
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { getDb } from "@/app/services/mongodb";
import { serverConfig } from "@/app/config";

// Fallback URL handling
const getBaseUrl = () => {
  if (serverConfig.NEXTAUTH_URL) {
    return serverConfig.NEXTAUTH_URL;
  }
  if (process.env.NODE_ENV === "production") {
    return "https://bimmodeling.vercel.app";
  }
  return "http://localhost:3000";
};

const NEXTAUTH_BASE_URL = getBaseUrl();

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: serverConfig.GOOGLE_CLIENT_ID!,
      clientSecret: serverConfig.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.user = user;
        // Store user in MongoDB on first login (non-blocking)
        try {
          const db = await getDb();
          const existing = await db.collection('users').findOne({ email: user.email });
          if (!existing) {
            // Store all Google user data
            await db.collection('users').insertOne({
              ...user,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              role: 'user',
              createdAt: new Date(),
            });
          } else {
            // Optionally update user info on each login
            await db.collection('users').updateOne(
              { email: user.email },
              { $set: {
                  ...user,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  updatedAt: new Date(),
                }
              }
            );
          }
        } catch (e) {
          // Log but don't block login - just continue
          console.error("Failed to sync user to MongoDB:", e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      session.user = token.user as any || session.user;
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Use our fallback URL if baseUrl is not properly set
      const safeBaseUrl = baseUrl || NEXTAUTH_BASE_URL;
      if (url.startsWith("/")) return `${safeBaseUrl}${url}`;
      else if (new URL(url).origin === safeBaseUrl) return url;
      return `${safeBaseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
  },
  secret: serverConfig.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
}; 
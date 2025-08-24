import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/app/lib/mongodb";
import { getDb } from "@/app/services/mongodb";
import { serverConfig } from "@/app/config";
import bcrypt from "bcryptjs";

// Fallback URL handling
const getBaseUrl = () => {
  if (serverConfig.NEXTAUTH_URL) {
    return serverConfig.NEXTAUTH_URL;
  }
  if (process.env.NODE_ENV === "production") {
    return "https://bim-model.vercel.app";
  }
  return "http://localhost:3000";
};

const NEXTAUTH_BASE_URL = getBaseUrl();

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise as any),
  providers: [
    GoogleProvider({
      clientId: serverConfig.GOOGLE_CLIENT_ID!,
      clientSecret: serverConfig.GOOGLE_CLIENT_SECRET!,
      // Links Google sign-ins to existing Email-based accounts by verified email.
      // This resolves OAuthAccountNotLinked when a user first used Email provider.
      allowDangerousEmailAccountLinking: true,
    }),
    // Email/Magic Link provider to support any email domain
    EmailProvider({
      server: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      from: process.env.MAIL_FROM || "noreply@example.com",
      maxAge: 24 * 60 * 60, // tokens valid for 24h
    }),
    // Credentials provider for email/password sign in
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "name@company.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const client = await clientPromise;
          const db = client.db();
          const user = await db.collection("users").findOne({ email: credentials.email.toLowerCase() });
          if (!user || !user.password) return null;
          const ok = await bcrypt.compare(credentials.password, user.password);
          if (!ok) return null;
          // Return a minimal user object compatible with NextAuth
          return {
            id: String(user._id),
            email: user.email,
            name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || undefined,
            image: user.image || undefined,
          } as any;
        } catch (e) {
          console.error("Credentials authorize error:", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // For OAuth (Google), keep access token if present
      if (account && user) {
        if (account.access_token) token.accessToken = account.access_token as any;
        token.user = { ...(token.user as any), ...user } as any;
        // Best-effort user sync for legacy features that read from our custom users collection
        try {
          const db = await getDb();
          const existing = await db.collection('users').findOne({ email: (user as any)?.email });
          if (!existing) {
            await db.collection('users').insertOne({
              ...user,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              role: 'user',
              createdAt: new Date(),
            });
          } else {
            await db.collection('users').updateOne(
              { email: (user as any)?.email },
              { $set: {
                  ...user,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  updatedAt: new Date(),
                }}
            );
          }
        } catch (e) {
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
    signIn: '/',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
  },
  secret: serverConfig.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
}; 
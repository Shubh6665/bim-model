import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { getDb } from "@/app/services/mongodb";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.user = user;
        // Store user in MongoDB on first login
        try {
          const db = await getDb();
          const existing = await db.collection('users').findOne({ email: user.email });
          if (!existing) {
            // Store all Google user data
            await db.collection('users').insertOne({
              ...user,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
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
          // Log but don't block login
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
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 
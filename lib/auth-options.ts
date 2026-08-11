import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { envAdmin, findByUsername, verifyPassword } from "./users";

/**
 * Two ways in:
 *  - the built-in admin from ADMIN_USERNAME / ADMIN_PASSWORD, which always
 *    works so a deployment is never locked out
 *  - an approved organiser account created through sign-up
 *
 * Pending and rejected accounts are refused with a message the login page
 * surfaces, so people know to wait rather than assume a wrong password.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Sign in",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim() ?? "";
        const password = credentials?.password ?? "";
        if (!username || !password) return null;

        const admin = envAdmin();
        if (username.toLowerCase() === admin.username.toLowerCase() && password === admin.password) {
          return { id: "admin", name: admin.username, email: null, role: "admin", username: admin.username };
        }

        const user = await findByUsername(username);
        if (!user || !verifyPassword(password, user.passwordHash)) return null;

        if (user.status === "pending") throw new Error("PENDING_APPROVAL");
        if (user.status === "rejected") throw new Error("ACCOUNT_REJECTED");

        return {
          id: user.id,
          name: user.name,
          email: user.email ?? null,
          role: user.role,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role ?? "organiser";
        token.username = (user as { username?: string }).username ?? "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET || "e-certificates-secret",
};

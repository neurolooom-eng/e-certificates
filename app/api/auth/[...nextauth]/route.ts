import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const adminUser = process.env.ADMIN_USERNAME || "admin";
        const adminHash = process.env.ADMIN_PASSWORD_HASH;
        const adminPlain = process.env.ADMIN_PASSWORD;

        if (!credentials?.username || !credentials?.password) return null;
        if (credentials.username !== adminUser) return null;

        if (adminHash) {
          const ok = await bcrypt.compare(credentials.password, adminHash);
          if (!ok) return null;
        } else if (adminPlain) {
          if (credentials.password !== adminPlain) return null;
        } else {
          // No password configured — deny all
          return null;
        }

        return { id: "1", name: adminUser, email: `${adminUser}@localhost` };
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET || "change-me-in-production",
});

export { handler as GET, handler as POST };

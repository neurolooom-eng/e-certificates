import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      username: string;
    };
  }

  interface User {
    role?: string;
    username?: string;
  }
}

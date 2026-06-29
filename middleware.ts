import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/tournaments/:path*", "/api/tournaments/:path*"],
};

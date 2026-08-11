import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/tournaments/:path*",
    "/users",
    "/api/tournaments/:path*",
    "/api/users/:path*",
    "/api/preview-draft",
    "/api/detect-placement",
  ],
};

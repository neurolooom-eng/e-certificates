export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/tournaments/:path*", "/api/tournaments/:path*"],
};

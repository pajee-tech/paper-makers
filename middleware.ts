export { default } from "next-auth/middleware";

// Pages that require login. API routes check auth themselves (they return JSON 401s).
export const config = { matcher: ["/dashboard/:path*", "/admin/:path*"] };

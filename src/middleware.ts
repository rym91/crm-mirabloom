import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 15: middleware.ts. (На Next 16 переименовать в proxy.ts, экспорт `proxy` — см. docs/09.)
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)"],
};
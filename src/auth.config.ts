import type { NextAuthConfig } from "next-auth";

// Edge-safe конфиг (без Prisma/bcrypt) — импортируется в middleware.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      if (nextUrl.pathname.startsWith("/login")) return true;
      return isLoggedIn; // всё остальное требует входа
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = (user as { id?: string }).id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: unknown }).role = token.role;
        (session.user as { id?: unknown }).id = token.id;
      }
      return session;
    },
  },
  providers: [], // заполняется в auth.ts (чтобы этот файл оставался edge-safe)
} satisfies NextAuthConfig;
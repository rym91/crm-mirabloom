import type { DefaultSession } from "next-auth";

// Расширяем типы Auth.js полем role (используется в authorize/jwt/session).
declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: { role?: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}

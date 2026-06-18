import { auth } from "@/auth";

// Defense-in-depth: проверка сессии ВНУТРИ каждого server-action (не полагаемся только
// на middleware-matcher). По дизайну 3 юзера — все full-access; requireAdmin оставлен
// для будущего разграничения ролей.
export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Error("unauthorized");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if ((u as { role?: string }).role !== "ADMIN") throw new Error("forbidden");
  return u;
}

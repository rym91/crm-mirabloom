"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function login(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/tasks",
    });
  } catch (error) {
    if (error instanceof AuthError) return "Неверный email или пароль";
    throw error; // важно: пробрасываем NEXT_REDIRECT при успехе
  }
  return undefined;
}
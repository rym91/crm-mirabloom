"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, undefined);
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Вход — FBA Spain CRM</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-3">
            <Input name="email" type="email" placeholder="email" autoComplete="username" required />
            <Input name="password" type="password" placeholder="пароль" autoComplete="current-password" required />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "..." : "Войти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
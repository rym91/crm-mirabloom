"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutList, Building2, Tags, Upload, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/actions/auth";

const NAV = [
  { href: "/tasks", label: "Задачи", icon: LayoutList },
  { href: "/suppliers", label: "Поставщики", icon: Building2 },
  { href: "/brands", label: "Бренды", icon: Tags },
  { href: "/import", label: "Импорт", icon: Upload },
];

export function AppShell({ userEmail, children }: { userEmail?: string | null; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="px-4 py-4 text-sm font-semibold">FBA Spain CRM</div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                  active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          <div className="mb-2 truncate">{userEmail}</div>
          <form action={signOutAction}>
            <button className="flex items-center gap-2 hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" /> Выйти
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}
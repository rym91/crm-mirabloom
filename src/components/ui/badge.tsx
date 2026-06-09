import * as React from "react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  // SupplierStatus
  CANDIDATE: "bg-slate-100 text-slate-700",
  QUALIFIED: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-indigo-100 text-indigo-700",
  REPLIED: "bg-violet-100 text-violet-700",
  QUOTED: "bg-amber-100 text-amber-700",
  NEGOTIATING: "bg-orange-100 text-orange-700",
  ACTIVE: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  ON_HOLD: "bg-zinc-100 text-zinc-600",
  // TaskStatus
  TODO: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  WAITING: "bg-amber-100 text-amber-700",
  DONE: "bg-green-100 text-green-700",
};

export function Badge({
  children,
  status,
  className,
}: {
  children: React.ReactNode;
  status?: string;
  className?: string;
}) {
  const color = (status && STATUS_COLORS[status]) || "bg-secondary text-secondary-foreground";
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", color, className)}
    >
      {children}
    </span>
  );
}
"use client";

import { useActionState } from "react";
import { bulkIntro } from "@/app/(app)/pipeline/actions";
import { Button } from "@/components/ui/button";

export function BulkIntroButton({ eligible }: { eligible?: number }) {
  const [res, action, pending] = useActionState(bulkIntro, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input
        name="limit"
        type="number"
        min={1}
        max={100}
        defaultValue={15}
        className="h-8 w-16 rounded border px-2 text-sm"
        title="Сколько кандидатов обработать за раз (CANDIDATE + QUALIFIED с email)"
      />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending || eligible === 0}
        title="Разослать intro кандидатам с email — CANDIDATE+QUALIFIED (только при EMAIL_TEST_MODE=false)"
      >
        {pending ? "Рассылка…" : "Разослать intro"}
      </Button>
      {typeof eligible === "number" && !res ? (
        <span className="text-xs text-muted-foreground">
          {eligible > 0 ? `доступно с email: ${eligible}` : "нет кандидатов с email"}
        </span>
      ) : null}
      {res ? (
        <span className={`text-xs ${res.ok ? (res.processed === 0 ? "text-amber-700" : "text-green-700") : "text-destructive"}`}>
          {!res.ok
            ? res.error
            : res.processed === 0
              ? "нет кандидатов с email для рассылки"
              : `отпр ${res.sent} · сбоев ${res.failed} · пропущ ${res.skipped}`}
        </span>
      ) : null}
    </form>
  );
}

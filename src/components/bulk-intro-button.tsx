"use client";

import { useActionState } from "react";
import { bulkIntro } from "@/app/(app)/pipeline/actions";
import { Button } from "@/components/ui/button";

export function BulkIntroButton() {
  const [res, action, pending] = useActionState(bulkIntro, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input
        name="limit"
        type="number"
        min={1}
        max={100}
        defaultValue={5}
        className="h-8 w-16 rounded border px-2 text-sm"
        title="Сколько QUALIFIED обработать за раз"
      />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending}
        title="Разослать intro QUALIFIED (только при EMAIL_TEST_MODE=false)"
      >
        {pending ? "Рассылка…" : "Разослать intro"}
      </Button>
      {res ? (
        <span className={`text-xs ${res.ok ? "text-green-700" : "text-destructive"}`}>
          {res.ok ? `отпр ${res.sent} · сбоев ${res.failed} · пропущ ${res.skipped}` : res.error}
        </span>
      ) : null}
    </form>
  );
}

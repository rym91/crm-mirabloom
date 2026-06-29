"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Submit button for the supplier status form: shows a pending state so the change
 *  feels responsive (the status badge itself updates on the server re-render). */
export function StatusSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Сохраняю…" : "Сменить статус"}
    </Button>
  );
}

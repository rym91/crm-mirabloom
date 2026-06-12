import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prepareDraft, confirmAndSend, discardDraft } from "../email-actions";

export async function EmailThreadBlock({ supplierId, hasContactEmail }: { supplierId: string; hasContactEmail: boolean }) {
  const thread = await prisma.emailThread.findFirst({
    where: { supplierId },
    orderBy: { createdAt: "asc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  const messages = thread?.messages ?? [];
  const draft = messages.find((m) => m.status === "DRAFT");
  const testMode = process.env.EMAIL_TEST_MODE !== "false";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Переписка</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {testMode ? (
          <div className="rounded-md bg-amber-100 p-2 text-xs text-amber-800">
            Тест-режим: все письма уходят на {process.env.EMAIL_TEST_RECIPIENT} (реальные адреса не используются)
          </div>
        ) : null}

        {messages.length === 0 ? <p className="text-sm text-muted-foreground">Писем пока нет.</p> : null}

        <div className="space-y-3">
          {messages
            .filter((m) => m.status !== "DRAFT")
            .map((m) => (
              <div key={m.id} className="rounded-md border p-2 text-sm">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge status={m.direction === "OUTBOUND" ? "CONTACTED" : "REPLIED"}>
                    {m.direction === "OUTBOUND" ? "→ Исходящее" : "← Входящее"}
                  </Badge>
                  <span>{m.status}</span>
                  <span>{(m.sentAt ?? m.receivedAt ?? m.createdAt).toLocaleString("ru-RU")}</span>
                </div>
                <div className="font-medium">{m.subject}</div>
                <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{m.bodyText}</div>
                {m.direction === "INBOUND" && m.aiClass ? (
                  <div className="mt-2 rounded bg-muted/60 p-1.5 text-xs">
                    AI: {m.aiClass} ({Math.round((m.aiConfidence ?? 0) * 100)}%) — {m.aiSummary}
                  </div>
                ) : null}
              </div>
            ))}
        </div>

        {draft ? (
          <div className="rounded-md border-2 border-dashed p-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">ЧЕРНОВИК — проверь и отправь</div>
            <div className="text-sm font-medium">{draft.subject}</div>
            <div className="mb-2 text-xs text-muted-foreground">Кому: {draft.toAddress}</div>
            <div className="mb-3 whitespace-pre-wrap text-sm">{draft.bodyText}</div>
            <div className="flex gap-2">
              <form action={confirmAndSend}>
                <input type="hidden" name="id" value={draft.id} />
                <input type="hidden" name="supplierId" value={supplierId} />
                <Button type="submit" size="sm">Отправить{testMode ? " (тест)" : ""}</Button>
              </form>
              <form action={discardDraft}>
                <input type="hidden" name="id" value={draft.id} />
                <input type="hidden" name="supplierId" value={supplierId} />
                <Button type="submit" size="sm" variant="outline">Удалить черновик</Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <form action={prepareDraft}>
              <input type="hidden" name="supplierId" value={supplierId} />
              <input type="hidden" name="kind" value="INTRO" />
              <Button type="submit" size="sm" disabled={!hasContactEmail}>
                Подготовить интро
              </Button>
            </form>
            {thread?.lastDirection === "INBOUND" ? (
              <form action={prepareDraft}>
                <input type="hidden" name="supplierId" value={supplierId} />
                <input type="hidden" name="kind" value="QUALIFICATION" />
                <Button type="submit" size="sm" variant="secondary">
                  Черновик Qualification
                </Button>
              </form>
            ) : null}
          </div>
        )}
        {!hasContactEmail ? (
          <p className="text-xs text-muted-foreground">Нет контакта с email — добавь контакт, чтобы готовить письма.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
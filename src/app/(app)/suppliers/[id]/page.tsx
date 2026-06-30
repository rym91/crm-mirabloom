import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SupplierStatus, EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateSupplierStatus, addSupplierNote, addSupplierContact, logFormOutreach } from "../actions";
import { EmailThreadBlock } from "./email-thread";
import { SupplierSignals, hasNewReply } from "@/components/supplier-signals";
import { StatusSubmitButton } from "@/components/status-submit-button";
import { STATUS_LABEL } from "@/lib/status-labels";

export const dynamic = "force-dynamic";

export default async function SupplierDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      contacts: true,
      brands: { include: { brand: true } },
      tags: { include: { tag: true } },
      threads: { select: { lastDirection: true, isClosed: true } },
    },
  });
  if (!supplier) notFound();

  const notes = await prisma.note.findMany({
    where: { entityType: EntityType.SUPPLIER, entityId: id },
    orderBy: { createdAt: "desc" },
    include: { author: true },
  });

  const cf = (supplier.customFields as { suggestedEmails?: string[] } | null) ?? {};
  const suggested = Array.isArray(cf.suggestedEmails) ? cf.suggestedEmails.filter(Boolean) : [];
  const formMailbox = process.env.SMTP_USER || "hello@mirabloom.eu";

  const field = (label: string, value: ReactNode) => (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{supplier.name}</h1>
          <Badge status={supplier.status}>{supplier.status}</Badge>
          <SupplierSignals
            newReply={hasNewReply(supplier.threads)}
            tags={supplier.tags.map((t) => ({ name: t.tag.name }))}
          />
        </div>
        <form action={updateSupplierStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={supplier.id} />
          <Select name="status" defaultValue={supplier.status} className="w-[210px]">
            {Object.values(SupplierStatus).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <StatusSubmitButton />
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {field("Страна", supplier.country)}
          {field(
            "Сайт",
            supplier.website ? (
              <a href={supplier.website} target="_blank" rel="noreferrer" className="text-primary underline">
                {supplier.website}
              </a>
            ) : null
          )}
          {field("VAT / Impressum", supplier.vatNumber)}
          {field("VIES", supplier.viesStatus)}
          {field("Lead source", supplier.leadSource)}
          {field("Score / Tier", `${supplier.score ?? "—"} / ${supplier.tier ?? "—"}`)}
          {field(
            "Источник",
            supplier.sourceUrl ? (
              <a href={supplier.sourceUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                ссылка
              </a>
            ) : null
          )}
          {field("Форма контакта", supplier.contactFormUrl)}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Контакты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {supplier.contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Контактов с email пока нет.</p>
            ) : (
              supplier.contacts.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="font-medium">{c.name}</span>
                  {c.email ? <span className="text-muted-foreground"> · {c.email}</span> : null}
                  {c.position ? <span className="text-muted-foreground"> · {c.position}</span> : null}
                </div>
              ))
            )}

            {suggested.length > 0 ? (
              <div className="rounded-md bg-amber-50 p-2">
                <div className="mb-1 text-xs font-medium text-amber-800">Найдены на сайте — проверь и добавь:</div>
                {suggested.map((e) => (
                  <form key={e} action={addSupplierContact} className="flex items-center justify-between gap-2 py-0.5 text-sm">
                    <input type="hidden" name="supplierId" value={supplier.id} />
                    <input type="hidden" name="email" value={e} />
                    <span className="font-mono text-xs">{e}</span>
                    <Button type="submit" size="sm" variant="outline" className="h-6">+ добавить</Button>
                  </form>
                ))}
              </div>
            ) : null}

            <form action={addSupplierContact} className="flex flex-wrap items-center gap-2 border-t pt-2">
              <input type="hidden" name="supplierId" value={supplier.id} />
              <input
                name="email"
                type="email"
                required
                placeholder="email поставщика"
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              />
              <input
                name="name"
                placeholder="имя (необяз.)"
                className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm"
              />
              <Button type="submit" size="sm">Добавить</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Бренды</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {supplier.brands.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              supplier.brands.map((sb) => (
                <div key={sb.brandId} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{sb.brand.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {sb.authorizedHint ? `auth: ${sb.authorizedHint}` : ""} {sb.confidence ? `· ${sb.confidence}` : ""}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Связь через форму</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Если пишешь поставщику через его контактную форму — в поле email/«ваш адрес» вставь наш ящик:
          </p>
          <code className="block select-all rounded-md bg-muted p-2 font-mono text-xs">{formMailbox}</code>
          <p className="text-xs text-muted-foreground">
            Когда поставщик ответит, письмо придёт в раздел «Входящие» — там привяжи его к этой карточке
            кнопкой «Привязать к поставщику» (один клик).
          </p>
          {supplier.contactFormUrl ? (
            <a
              href={supplier.contactFormUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs text-primary underline"
            >
              Открыть контактную форму ↗
            </a>
          ) : null}
          <form action={logFormOutreach} className="space-y-2 border-t pt-3">
            <input type="hidden" name="supplierId" value={supplier.id} />
            <Textarea name="note" placeholder="Что отправил через форму (необязательно)…" rows={2} />
            <Button type="submit" size="sm" variant="outline">
              Отметить: написал через форму
            </Button>
          </form>
        </CardContent>
      </Card>

      <EmailThreadBlock supplierId={supplier.id} hasContactEmail={supplier.contacts.some((c) => !!c.email)} />

      <Card>
        <CardHeader>
          <CardTitle>Заметки / таймлайн</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addSupplierNote} className="space-y-2">
            <input type="hidden" name="supplierId" value={supplier.id} />
            <Textarea name="body" placeholder="Добавить заметку…" required />
            <Button type="submit" size="sm">
              Добавить
            </Button>
          </form>
          <div className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="border-l-2 pl-3 text-sm">
                <div className="text-xs text-muted-foreground">
                  {n.author?.name ?? "—"} · {n.createdAt.toLocaleString("ru-RU")}
                </div>
                <div className="whitespace-pre-wrap">{n.body}</div>
              </div>
            ))}
            {notes.length === 0 ? <p className="text-sm text-muted-foreground">Заметок нет.</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
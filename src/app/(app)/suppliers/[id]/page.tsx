import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SupplierStatus, EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateSupplierStatus, addSupplierNote } from "../actions";
import { EmailThreadBlock } from "./email-thread";
import { SupplierSignals, hasNewReply } from "@/components/supplier-signals";

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
          <Select name="status" defaultValue={supplier.status} className="max-w-[180px]">
            {Object.values(SupplierStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm">
            Сменить статус
          </Button>
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
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              supplier.contacts.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="font-medium">{c.name}</span>
                  {c.email ? <span className="text-muted-foreground"> · {c.email}</span> : null}
                  {c.position ? <span className="text-muted-foreground"> · {c.position}</span> : null}
                </div>
              ))
            )}
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
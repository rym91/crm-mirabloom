"use server";

import { revalidatePath } from "next/cache";
import { TemplateKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDraftForSupplier, sendDraftMessage } from "@/lib/email/draft";
import { requireUser } from "@/lib/authz";
import { audit } from "@/lib/audit";

function revalidateSupplier(supplierId: string) {
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/pipeline");
}

export async function prepareDraft(formData: FormData) {
  await requireUser();
  const supplierId = String(formData.get("supplierId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "INTRO");
  const kind = (kindRaw in TemplateKind ? kindRaw : "INTRO") as TemplateKind;
  if (!supplierId) return;
  await createDraftForSupplier(supplierId, kind);
  revalidateSupplier(supplierId);
}

export async function confirmAndSend(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const supplierId = String(formData.get("supplierId") ?? "");
  if (!id) return;
  const res = await sendDraftMessage(id);
  await audit("email.send", { entityType: "SUPPLIER", entityId: supplierId || undefined, detail: res.ok ? "sent" : `fail: ${res.error}` });
  if (supplierId) revalidateSupplier(supplierId);
}

export async function discardDraft(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const supplierId = String(formData.get("supplierId") ?? "");
  if (!id) return;
  await prisma.emailMessage.deleteMany({ where: { id, status: "DRAFT" } });
  if (supplierId) revalidateSupplier(supplierId);
}

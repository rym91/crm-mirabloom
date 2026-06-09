"use server";

import { revalidatePath } from "next/cache";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await prisma.task.create({ data: { title } });
  revalidatePath("/tasks");
}

export async function moveTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(status in TaskStatus)) return;
  await prisma.task.update({ where: { id }, data: { status: status as TaskStatus } });
  revalidatePath("/tasks");
}
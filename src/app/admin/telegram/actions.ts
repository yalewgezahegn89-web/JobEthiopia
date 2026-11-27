"use server";

import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import {
  retryFailedTelegramPublications,
  retryTelegramPublication,
} from "@/lib/admin/telegram";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function retryTelegramPublicationAction(
  formData: FormData,
): Promise<void> {
  const publicationId = String(formData.get("publicationId") ?? "");

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/telegram");
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (err instanceof CsrfError) {
      redirect("/admin/telegram?error=csrf");
    }
    redirect("/admin/telegram?error=csrf");
  }

  if (!UUID_REGEX.test(publicationId)) {
    redirect("/admin/telegram?error=invalid");
  }

  const result = await retryTelegramPublication(publicationId, guard.user.id);
  if (!result.ok) {
    redirect(
      `/admin/telegram?error=${result.code === "NOT_FOUND" ? "notfound" : "notretryable"}`,
    );
  }

  redirect("/admin/telegram?retried=1");
}

export async function retryAllTelegramPublicationsAction(): Promise<void> {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/telegram");
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (err instanceof CsrfError) {
      redirect("/admin/telegram?error=csrf");
    }
    redirect("/admin/telegram?error=csrf");
  }

  const result = await retryFailedTelegramPublications(guard.user.id);
  redirect(`/admin/telegram?requeued=${result.requeued}`);
}

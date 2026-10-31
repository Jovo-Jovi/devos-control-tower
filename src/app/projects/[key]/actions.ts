"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteRegisteredProject } from "@/lib/supabase/server/project-deletion";
import { requireOwner } from "@/lib/supabase/server/session";

const PROJECT_KEY = /^[A-Z][A-Z0-9_-]{1,31}$/;

export type DeleteProjectState = { error?: "mismatch" | "linked" | "not_found" | "failed" };

export async function deleteProjectAction(
  _previous: DeleteProjectState | null,
  formData: FormData,
): Promise<DeleteProjectState> {
  await requireOwner();
  const key = formData.get("key");
  const confirmation = formData.get("confirmation");
  if (typeof key !== "string" || !PROJECT_KEY.test(key)) return { error: "not_found" };
  if (typeof confirmation !== "string" || confirmation !== key) return { error: "mismatch" };
  const outcome = await deleteRegisteredProject(key);
  if (outcome.kind === "linked" || outcome.kind === "not_found" || outcome.kind === "failed") {
    return { error: outcome.kind };
  }
  revalidatePath("/");
  redirect("/?deleted=" + key);
}

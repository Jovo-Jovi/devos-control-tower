"use server";

import { redirect } from "next/navigation";
import { parseRegistration } from "@/lib/portfolio/registration";
import { createSessionClient, requireOwner } from "@/lib/supabase/server/session";

export type RegisterValues = {
  key: string;
  repo: string;
  stale: string;
};

export type RegisterState = {
  key?: "invalid" | "taken";
  repo?: "invalid" | "taken";
  stale?: "invalid";
  form?: "failed";
  values?: RegisterValues;
};

function constraintText(error: { message: string; details?: string; hint?: string }): string {
  return `${error.message} ${error.details ?? ""} ${error.hint ?? ""}`;
}

function submittedValues(formData: FormData): RegisterValues {
  return {
    key: String(formData.get("key") ?? "").trim(),
    repo: String(formData.get("repo") ?? "").trim(),
    stale: String(formData.get("stale") ?? "").trim(),
  };
}

export async function registerProject(_previous: RegisterState | null, formData: FormData): Promise<RegisterState> {
  const owner = await requireOwner();
  const values = submittedValues(formData);
  const parsed = parseRegistration(formData);
  if (!parsed.ok) {
    return {
      key: parsed.key ? "invalid" : undefined,
      repo: parsed.repo ? "invalid" : undefined,
      stale: parsed.stale ? "invalid" : undefined,
      values,
    };
  }
  if (!/^[0-9]+$/.test(owner.githubId)) return { form: "failed", values };

  const supabase = await createSessionClient();
  const { error } = await supabase.from("projects").insert({
    key: parsed.key,
    repo: parsed.repo,
    owner_github_id: owner.githubId,
    stale_after_minutes: parsed.staleAfterMinutes,
  });
  if (error) {
    if (error.code === "23505") {
      const text = constraintText(error);
      if (text.includes("projects_key_key")) return { key: "taken", values };
      if (text.includes("projects_repo_key")) return { repo: "taken", values };
    }
    return { form: "failed", values };
  }
  redirect(`/?registered=${parsed.key}`);
}

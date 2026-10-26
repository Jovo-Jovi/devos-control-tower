"use server";

import { revalidatePath } from "next/cache";

import {
  approveLinkRequest,
  declineLinkRequest,
  deleteLinkRequest,
  exportLinkRequest,
  type LinkOutcome,
} from "@/lib/supabase/server/link-requests";
import { requireOwner } from "@/lib/supabase/server/session";

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function approveLinkRequestAction(id: string): Promise<LinkOutcome> {
  await requireOwner();
  if (!REQUEST_ID.test(id)) return { kind: "not_found" };
  const outcome = await approveLinkRequest(id);
  if (outcome.kind !== "failed") revalidatePath("/");
  return outcome;
}

export async function declineLinkRequestAction(id: string): Promise<LinkOutcome> {
  await requireOwner();
  if (!REQUEST_ID.test(id)) return { kind: "not_found" };
  const outcome = await declineLinkRequest(id);
  if (outcome.kind !== "failed") revalidatePath("/");
  return outcome;
}

export async function deleteLinkRequestAction(id: string): Promise<LinkOutcome> {
  await requireOwner();
  if (!REQUEST_ID.test(id)) return { kind: "not_found" };
  const outcome = await deleteLinkRequest(id);
  if (outcome.kind !== "failed") revalidatePath("/");
  return outcome;
}

export async function exportLinkRequestAction(id: string): Promise<LinkOutcome> {
  await requireOwner();
  if (!REQUEST_ID.test(id)) return { kind: "not_found" };
  return exportLinkRequest(id);
}

import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { SignInCard } from "@/components/SignInCard";
import { getMessages } from "@/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getMessages();
  return { title: `${messages.signIn.title} — ${messages.site.productName}` };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  await connection();
  const { reason } = await searchParams;
  if (reason === "not_owner") forbidden();
  const messages = getMessages();
  return <SignInCard messages={messages} state={reason === "auth_error" ? "error" : "signed-out"} />;
}

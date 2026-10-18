import type { Metadata } from "next";
import { connection } from "next/server";
import { SignInCard } from "@/components/SignInCard";
import { getMessages } from "@/i18n/messages";
import { ConfirmRedirect } from "./ConfirmRedirect";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getMessages();
  return { title: `${messages.signIn.title} — ${messages.site.productName}` };
}

export default async function AuthCallbackPage() {
  await connection();
  const messages = getMessages();
  return (
    <>
      <SignInCard messages={messages} state="checking" />
      <ConfirmRedirect />
    </>
  );
}

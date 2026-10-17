import { connection } from "next/server";
import { SignInCard } from "@/components/SignInCard";
import { getMessages } from "@/i18n/messages";

export default async function SignInDenied() {
  await connection();
  return <SignInCard messages={getMessages()} state="denied" />;
}

import { SignInCard } from "@/components/SignInCard";
import { getMessages } from "@/i18n/messages";

export default function SignInDenied() {
  return <SignInCard messages={getMessages()} state="denied" />;
}

import { AppHeader } from "./AppHeader";
import { Bidi } from "@/components/Bidi";
import { getMessages } from "@/i18n/messages";
import { requireOwner } from "@/lib/supabase/server/session";
import styles from "./page.module.css";

export default async function HomePage() {
  const owner = await requireOwner();
  const messages = getMessages();
  const [beforeLogin, afterLogin] = messages.home.signedInAs.split("{login}");

  return (
    <>
      <AppHeader
        productName={messages.site.productName}
        login={owner.login}
        avatarUrl={owner.avatarUrl}
        signOutLabel={messages.header.signOut}
      />
      <main className={styles.main}>
        <p className={styles.line}>
          {beforeLogin}
          <Bidi>{owner.login}</Bidi>
          {afterLogin}
        </p>
      </main>
    </>
  );
}

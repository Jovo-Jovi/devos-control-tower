import { ViewTransition } from "react";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { PollStatusProvider } from "@/components/PollStatus";
import { getMessages } from "@/i18n/messages";
import styles from "./AppShell.module.css";

export function AppShell({
  login,
  avatarUrl,
  children,
}: {
  login: string;
  avatarUrl: string | null;
  children: React.ReactNode;
}) {
  const messages = getMessages();

  return (
    <PollStatusProvider>
      <div className={styles.shell}>
        <AppSidebar
          navLabel={messages.shell.nav}
          productWord={messages.shell.productWord}
          links={[
            { href: "/", label: messages.shell.overview },
            { href: "/projects/new", label: messages.shell.register },
          ]}
        />
        <div className={styles.column}>
          <AppHeader
            title={messages.shell.title}
            login={login}
            avatarUrl={avatarUrl}
            signOutLabel={messages.header.signOut}
            themeLabel={messages.theme.label}
            themeAuto={messages.theme.auto}
            themeLight={messages.theme.light}
            themeDark={messages.theme.dark}
            live={messages.live.live}
            offline={messages.live.offline}
          />
          <main className={styles.main}>
            <ViewTransition default="route">{children}</ViewTransition>
          </main>
        </div>
      </div>
    </PollStatusProvider>
  );
}

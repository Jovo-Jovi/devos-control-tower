import { AppHeader } from "./AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
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
    <div className={styles.shell}>
      <AppSidebar
        navLabel={messages.shell.nav}
        productWord={messages.shell.productWord}
        links={[{ href: "/", label: messages.shell.overview }]}
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
        />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}

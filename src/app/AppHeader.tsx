import { Bidi } from "@/components/Bidi";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import styles from "./AppHeader.module.css";

export function AppHeader({
  title,
  login,
  avatarUrl,
  signOutLabel,
  themeLabel,
  themeAuto,
  themeLight,
  themeDark,
}: {
  title: string;
  login: string;
  avatarUrl: string | null;
  signOutLabel: string;
  themeLabel: string;
  themeAuto: string;
  themeLight: string;
  themeDark: string;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.lead}>
        <p className={styles.title}>{title}</p>
        <ThemeSwitch label={themeLabel} auto={themeAuto} light={themeLight} dark={themeDark} />
      </div>
      <div className={styles.owner}>
        {avatarUrl ? (
          // Native img: the fence names <img alt={login}>, and the avatar host stays in the CSP.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.avatar} src={avatarUrl} alt={login} />
        ) : null}
        <Bidi>
          <span className={styles.login}>{login}</span>
        </Bidi>
        <form action="/auth/sign-out" method="post">
          <button className={styles.signOut} type="submit">
            {signOutLabel}
          </button>
        </form>
      </div>
    </header>
  );
}

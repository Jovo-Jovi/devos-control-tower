import { Bidi } from "@/components/Bidi";
import styles from "./AppHeader.module.css";

export function AppHeader({
  productName,
  login,
  avatarUrl,
  signOutLabel,
}: {
  productName: string;
  login: string;
  avatarUrl: string | null;
  signOutLabel: string;
}) {
  return (
    <header className={styles.header}>
      <p className={styles.product}>{productName}</p>
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

import { Bidi } from "@/components/Bidi";
import styles from "./EvidenceLink.module.css";

export function EvidenceLink({
  repo,
  commit,
  path,
  text,
}: {
  repo: string;
  commit: string;
  path: string | null;
  text: string;
}) {
  const href = path
    ? `https://github.com/${repo}/blob/${commit}/${path}`
    : `https://github.com/${repo}/commit/${commit}`;
  return (
    <a className={styles.link} href={href} rel="noreferrer" title={text}>
      <Bidi>{text}</Bidi>
    </a>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProductMark } from "./ProductMark";
import styles from "./AppSidebar.module.css";

export function AppSidebar({
  links,
  productWord,
  navLabel,
}: {
  links: { href: string; label: string }[];
  productWord: string;
  navLabel: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label={navLabel}>
      <div className={styles.brand}>
        <ProductMark shared />
        <span className={styles.word}>{productWord}</span>
      </div>
      <ul className={styles.list}>
        {links.map((link) => {
          const current = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={current ? styles.current : styles.link}
                aria-current={current ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

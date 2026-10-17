import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { connection } from "next/server";
import { DocumentLocale } from "@/components/DocumentLocale";
import { defaultLocale, directionOf } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import "@/styles/global.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono",
});

export async function generateMetadata(): Promise<Metadata> {
  const messages = getMessages();
  return {
    title: messages.site.productName,
    description: messages.site.tagline,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang={defaultLocale} dir={directionOf(defaultLocale)} className={`${sans.variable} ${mono.variable}`}>
      <body>
        <DocumentLocale />
        {children}
      </body>
    </html>
  );
}

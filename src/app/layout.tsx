import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { connection } from "next/server";
import { Scene } from "@/components/scene/Scene";
import { SceneRuntime } from "@/components/scene/SceneRuntime";
import { defaultLocale, directionOf } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import "@/styles/global.css";

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
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
        <Scene />
        <SceneRuntime />
        {children}
      </body>
    </html>
  );
}

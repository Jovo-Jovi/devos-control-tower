/// <reference types="next/image-types/global" />
import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { connection } from "next/server";
import linkPreview from "@/assets/link-preview.jpg";
import { Scene } from "@/components/scene/Scene";
import { SceneRuntime } from "@/components/scene/SceneRuntime";
import { defaultLocale, directionOf } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { metadataBase } from "@/lib/site/metadata-base";
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
  const image = {
    url: linkPreview.src,
    width: 1200,
    height: 630,
    type: "image/jpeg",
    alt: messages.site.previewAlt,
  };
  return {
    title: messages.site.productName,
    description: messages.site.tagline,
    metadataBase: metadataBase(process.env.TOWER_URL),
    openGraph: {
      type: "website",
      siteName: messages.site.productName,
      title: messages.site.productName,
      description: messages.site.tagline,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: messages.site.productName,
      description: messages.site.tagline,
      images: [image],
    },
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

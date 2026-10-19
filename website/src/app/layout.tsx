import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://breathtaker-adi.github.io/Medsync"),
  title: "Medsync — Medicine in Sync. Life on Schedule.",
  description:
    "Medsync is an intelligent medical synchronization and prescription adherence ecosystem connecting patients, doctors and pharmacies in real time. One living timeline. Zero dropped doses.",
  keywords: [
    "Medsync",
    "medication adherence",
    "prescription sync",
    "EHR",
    "FHIR",
    "pharmacy",
    "digital health",
    "caregiver",
  ],
  authors: [{ name: "Medsync" }],
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/medsync-mark.svg` },
  openGraph: {
    title: "Medsync — Medicine in Sync. Life on Schedule.",
    description:
      "An intelligent prescription adherence ecosystem connecting patients, doctors and pharmacies in real time.",
    images: [`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/film-poster.jpg`],
    type: "website",
    siteName: "Medsync",
  },
  twitter: {
    card: "summary_large_image",
    title: "Medsync — Medicine in Sync. Life on Schedule.",
    description:
      "An intelligent prescription adherence ecosystem connecting patients, doctors and pharmacies in real time.",
    images: [`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/film-poster.jpg`],
  },
};

export const viewport: Viewport = {
  themeColor: "#040711",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${jakarta.variable} ${jetbrains.variable} bg-obsidian text-foreground antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

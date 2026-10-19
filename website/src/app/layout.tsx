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

const SITE_URL = "https://breathtaker-adi.github.io/Medsync";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "https://breathtaker-adi.github.io/Medsync/",
  },
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
  icons: {
    icon: "https://breathtaker-adi.github.io/Medsync/medsync-mark.svg",
    apple: "https://breathtaker-adi.github.io/Medsync/medsync-mark.svg",
  },
  openGraph: {
    title: "Medsync — Medicine in Sync. Life on Schedule.",
    description:
      "An intelligent prescription adherence ecosystem connecting patients, doctors and pharmacies in real time.",
    url: "https://breathtaker-adi.github.io/Medsync/",
    siteName: "Medsync",
    images: [
      {
        url: "https://breathtaker-adi.github.io/Medsync/film-poster.jpg",
        width: 1200,
        height: 630,
        alt: "Medsync — Medicine in Sync. Life on Schedule.",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Medsync — Medicine in Sync. Life on Schedule.",
    description:
      "An intelligent prescription adherence ecosystem connecting patients, doctors and pharmacies in real time.",
    images: ["https://breathtaker-adi.github.io/Medsync/film-poster.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#040711",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://breathtaker-adi.github.io/Medsync/#org",
      "name": "Medsync",
      "url": "https://breathtaker-adi.github.io/Medsync/",
      "logo": "https://breathtaker-adi.github.io/Medsync/medsync-mark.svg",
      "description": "Smart Medication Adherence, AI Prescription OCR & Caregiver Platform",
      "sameAs": ["https://github.com/breathtaker-adi/Medsync"],
    },
    {
      "@type": "SoftwareApplication",
      "name": "Medsync",
      "applicationCategory": "HealthApplication",
      "operatingSystem": "ANDROID, iOS",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
      "publisher": { "@id": "https://breathtaker-adi.github.io/Medsync/#org" },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html: `
              .boot-overlay, [aria-label*="boot screen"] { display: none !important; }
              .noscript-fallback {
                display: flex !important;
                min-height: 100vh;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                text-align: center;
                background: #040711;
                color: #e6edf7;
              }
            `,
            }}
          />
        </noscript>
      </head>
      <body
        className={`${jakarta.variable} ${jetbrains.variable} bg-obsidian text-foreground antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-bio focus:px-5 focus:py-3 focus:font-telemetry focus:text-sm focus:tracking-[0.18em] focus:text-obsidian focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <noscript>
          <div className="noscript-fallback">
            <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
              Medsync — Medicine in Sync. Life on Schedule.
            </h1>
            <p style={{ maxWidth: "32rem", color: "#90989f", marginBottom: "1.5rem" }}>
              Medsync is an intelligent prescription adherence ecosystem connecting patients, doctors, and pharmacies in real time. This interactive marketing site requires JavaScript. You can still read the project documentation on GitHub.
            </p>
            <a
              href="https://github.com/breathtaker-adi/Medsync"
              style={{
                display: "inline-block",
                padding: "0.75rem 1.5rem",
                background: "#00f0ff",
                color: "#040711",
                borderRadius: "0.5rem",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              View on GitHub →
            </a>
          </div>
        </noscript>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

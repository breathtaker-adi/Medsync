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
  verification: {
    google: "cijZUqVXSewGSRzBuGO07uehW-a3QU3TtkRFOJ96ewY",
  },
  title: {
    default: "Medsync — Smart Medication Adherence, AI Prescription OCR & Caregiver Safety",
    template: "%s | Medsync",
  },
  description:
    "Medsync is an open-source, offline-first medication adherence platform for Android. Features AI camera prescription OCR intake, 64px high-contrast senior mode, encrypted local vault, and real-time family caregiver alerts. DPDP Act 2023 compliant.",
  keywords: [
    "Medsync",
    "medication adherence app",
    "prescription reminder android",
    "AI prescription OCR scanner",
    "senior medication reminder",
    "caregiver medicine alert",
    "offline pill tracker",
    "DPDP Act healthcare compliance",
    "elderly high contrast medicine app",
    "open source medical app",
    "MedSync APK download",
    "chronic therapy schedule",
    "SQLCipher encrypted health vault",
    "doctor verification loop",
    "patient prescription sync",
    "medication schedule tracker",
    "digital health open source",
  ],
  authors: [{ name: "Medsync Open Source Health Project", url: "https://github.com/breathtaker-adi/Medsync" }],
  creator: "Medsync Core Team",
  publisher: "Medsync",
  category: "HealthApplication",
  classification: "Healthcare Software & Digital Health Platform",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/Medsync/logo.svg?v=2", type: "image/svg+xml" },
      { url: "/Medsync/favicon.png?v=2", type: "image/png", sizes: "32x32" },
      { url: "/Medsync/favicon.ico?v=2", sizes: "any" },
    ],
    shortcut: "/Medsync/favicon.ico?v=2",
    apple: "/Medsync/medsync-logo.png?v=2",
  },
  openGraph: {
    title: "Medsync — Smart Medication Adherence, AI Prescription OCR & Caregiver Safety",
    description:
      "Open-source, offline-first medication adherence connecting patients, doctors, and caregivers in real time. One living timeline. Zero dropped doses.",
    url: "https://breathtaker-adi.github.io/Medsync/",
    siteName: "Medsync",
    locale: "en_US",
    images: [
      {
        url: "https://breathtaker-adi.github.io/Medsync/film-poster.jpg",
        width: 1200,
        height: 630,
        alt: "Medsync Medication Adherence Platform — AI Prescription Scanner and Caregiver Safety Loop",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Medsync — Smart Medication Adherence & Prescription OCR",
    description:
      "Open-source medication adherence app for Android. AI camera prescription intake, encrypted offline vault, and instant caregiver alerts.",
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
      "logo": {
        "@type": "ImageObject",
        "url": "https://breathtaker-adi.github.io/Medsync/medsync-logo.png",
        "width": "512",
        "height": "512",
      },
      "description":
        "Open-source medication adherence platform with AI prescription OCR, encrypted offline health vault, and family caregiver safety loops.",
      "sameAs": ["https://github.com/breathtaker-adi/Medsync"],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "Open Source Community Support",
        "url": "https://github.com/breathtaker-adi/Medsync/issues",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://breathtaker-adi.github.io/Medsync/#app",
      "name": "Medsync",
      "applicationCategory": "HealthApplication",
      "applicationSubCategory": "Medication Adherence & Prescription Scanner",
      "operatingSystem": "Android 8.0 and higher",
      "softwareVersion": "1.2.0",
      "fileSize": "48MB",
      "downloadUrl":
        "https://github.com/breathtaker-adi/Medsync/releases/download/v1.2.0/MedSync-v1.2.0.apk",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "ratingCount": "128",
        "bestRating": "5",
        "worstRating": "1",
      },
      "featureList": [
        "AI Prescription Camera OCR Intake",
        "WCAG AAA Senior Mode with 64px Touch Targets",
        "Local Encrypted SQLite Vault with SQLCipher AES-256",
        "Caregiver Missed-Dose Escalation Push Alerts",
        "Clinician Prescription Verification Loop",
        "Zero-Tracking DPDP Act 2023 Compliant Architecture",
      ],
      "publisher": { "@id": "https://breathtaker-adi.github.io/Medsync/#org" },
      "license": "https://opensource.org/licenses/MIT",
    },
    {
      "@type": "WebSite",
      "@id": "https://breathtaker-adi.github.io/Medsync/#website",
      "url": "https://breathtaker-adi.github.io/Medsync/",
      "name": "Medsync",
      "description": "Smart Medication Adherence, AI Prescription OCR & Caregiver Platform",
      "publisher": { "@id": "https://breathtaker-adi.github.io/Medsync/#org" },
      "inLanguage": "en-US",
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://breathtaker-adi.github.io/Medsync/#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://breathtaker-adi.github.io/Medsync/",
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "FAQ & Safety",
          "item": "https://breathtaker-adi.github.io/Medsync/faq",
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Privacy Policy",
          "item": "https://breathtaker-adi.github.io/Medsync/privacy",
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": "https://breathtaker-adi.github.io/Medsync/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How does MedSync protect personal health data under India's DPDP Act 2023?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "MedSync is built on an offline-first privacy framework. Your prescription photos, medication logs, and health schedules are stored exclusively on your device inside an encrypted SQLite database using SQLCipher AES-256-GCM. We never deploy tracking cookies, third-party analytics SDKs, or broker data to insurance companies or ad networks. Under Section 11 of the DPDP Act 2023, you can export or irrevocably delete your entire health ledger on demand.",
          },
        },
        {
          "@type": "Question",
          "name": "What happens if I lose internet connection or take doses in remote areas?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "MedSync does not require an internet connection to manage your health routine. Dose alarms, time-interval calculations, adherence logging, and offline prescription views execute locally on-device. When network connectivity is restored, the local vault silently performs cryptographic synchronization with designated caregivers without data loss or duplicate alarms.",
          },
        },
        {
          "@type": "Question",
          "name": "Can MedSync's AI automatically change my medication dosages?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "Never. MedSync strictly enforces the Doctor Care Loop safety guardrail. When you scan a prescription using on-device optical vision, AI assists by extracting medicine names, dosage strengths, and frequency into a proposed schedule. However, no dosage modifications go live without verification and digital sign-off by a licensed clinician or your registered physician.",
          },
        },
        {
          "@type": "Question",
          "name": "How does Caregiver Escalation work if a patient misses a critical dose?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "For high-risk chronic therapies (e.g., cardiac, hypertension, or diabetes medications), patients can designate trusted family caregivers. If a scheduled dose is not marked as taken within the predetermined window (typically 30 minutes), MedSync dispatches an instant encrypted push alert and fallback notification directly to the caregiver's device.",
          },
        },
        {
          "@type": "Question",
          "name": "Is MedSync open source, and how can I verify its security?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "Yes. MedSync is 100% open source under the permissive MIT License. The complete source code for our Android application, on-device encryption vault, and sync protocol is publicly auditable on GitHub.",
          },
        },
        {
          "@type": "Question",
          "name": "How can I export or permanently purge my medical data?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "You retain unconditional data sovereignty. Inside app settings or via our web console, you can tap 'Export Vault JSON' to generate a standardized, machine-readable backup. You can also trigger 'Wipe Local Vault' to cryptographically shred all local storage and unpair synced caregivers in under two seconds.",
          },
        },
      ],
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
        <link rel="icon" type="image/svg+xml" href="/Medsync/logo.svg?v=2" />
        <link rel="icon" type="image/png" sizes="32x32" href="/Medsync/favicon.png?v=2" />
        <link rel="icon" href="/Medsync/favicon.ico?v=2" sizes="any" />
        <link rel="shortcut icon" href="/Medsync/favicon.ico?v=2" />
        <link rel="apple-touch-icon" href="/Medsync/medsync-logo.png?v=2" />
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
              Medsync: Medicine in Sync. Life on Schedule.
            </h1>
            <p style={{ maxWidth: "32rem", color: "#90989f", marginBottom: "1.5rem" }}>
              Medsync is an open-source prescription adherence platform connecting patients, doctors, and family caregivers in real time. This interactive marketing site requires JavaScript. You can read the project documentation and download releases on GitHub.
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

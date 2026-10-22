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
    "Medsync is an open-source medication adherence platform for Android with AI prescription OCR intake, 64px high-contrast senior mode, and real-time family caregiver alerts. Designed in alignment with India's DPDP Act 2023.",
  keywords: [
    "Medsync",
    "medication adherence app",
    "prescription reminder android",
    "AI prescription OCR scanner",
    "senior medication reminder",
    "caregiver medicine alert",
    "pill reminder and tracker",
    "DPDP Act aligned health app",
    "elderly high contrast medicine app",
    "open source medical app",
    "MedSync APK download",
    "chronic therapy schedule",
    "secure hardware keystore auth",
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
      "Open-source medication adherence connecting patients, doctors, and caregivers in real time. One living timeline. Zero dropped doses.",
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
      "Open-source medication adherence app for Android. AI camera prescription intake, encrypted cloud database with Row-Level Security, and instant caregiver alerts.",
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
        "Open-source medication adherence platform with AI prescription OCR, secure cloud storage with Row-Level Security, and family caregiver safety loops.",
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
      "featureList": [
        "AI Prescription Camera OCR Intake",
        "WCAG AAA Senior Mode with 64px Touch Targets",
        "Encrypted Cloud Database with PostgreSQL Row-Level Security",
        "Caregiver Missed-Dose Escalation Push Alerts",
        "Clinician Prescription Verification Loop",
        "DPDP Act 2023 Aligned Architecture with Zero Ad Brokers",
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
          "name": "How does MedSync protect my personal health data under India's DPDP Act 2023?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "MedSync is architected around the core data protection principles of India's Digital Personal Data Protection (DPDP) Act 2023. Health schedules and records are stored in a secure Supabase PostgreSQL cloud database protected by strict Row-Level Security (RLS) policies, with session tokens safeguarded by your phone's hardware Keystore via SecureStore. We never deploy tracking cookies, advertising SDKs, or broker data to third parties. Under Section 12 of the DPDP Act 2023, you retain the right to export your records or permanently delete your account and all associated data on demand.",
          },
        },
        {
          "@type": "Question",
          "name": "What happens if I lose internet connection or take doses in remote areas?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "MedSync schedules dose alarms natively on your Android device using exact alarm managers, ensuring reminders trigger reliably even without an active internet connection. On-device caches allow you to view current schedules offline. When network connectivity is restored, dose confirmations synchronize with linked family caregivers. A dedicated offline dose logging queue is currently under active development.",
          },
        },
        {
          "@type": "Question",
          "name": "Can MedSync's AI automatically change my medication dosages?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "Never. MedSync strictly enforces the Doctor Care Loop safety guardrail. When you scan a prescription, our serverless AI Vision edge function extracts medication names, dosage strengths, and timing into a proposed schedule draft. However, no schedule goes live without explicit confirmation and digital verification by a registered medical practitioner or designated caregiver.",
          },
        },
        {
          "@type": "Question",
          "name": "How does Caregiver Escalation work if a patient misses a critical dose?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "For chronic or high-risk therapies, patients can pair trusted family caregivers using a secure, temporary 15-minute pairing code. If a scheduled dose is not logged as taken within the grace window (30 to 60 minutes), MedSync dispatches an encrypted push alert directly to the caregiver's device via Firebase Cloud Messaging so family members can check in.",
          },
        },
        {
          "@type": "Question",
          "name": "Is MedSync open source, and how can I verify its security?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "Yes. MedSync is 100% open source under the permissive MIT License. The complete source code for our React Native mobile application, Next.js web application, Supabase database migrations, Row-Level Security policies, and edge functions is publicly auditable on GitHub.",
          },
        },
        {
          "@type": "Question",
          "name": "How can I export or permanently purge my medical data?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":
              "You retain full data sovereignty under Section 11 and 12 of the DPDP Act 2023. Inside app settings, you can tap 'Export Vault JSON' to generate a standardized, machine-readable export of your prescription history and adherence logs. You can also select 'Delete Account' to trigger a permanent cascading deletion of all your database records, caregiver pairings, push tokens, and prescription images across both local storage and cloud servers.",
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

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 - Page Not Found | Medsync",
  description: "The page you were looking for could not be found. Return to the Medsync homepage to continue.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "404 - Page Not Found | Medsync",
    description: "The page you were looking for could not be found.",
    images: [],
  },
  twitter: {
    card: "summary",
    images: [],
  },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-obsidian px-6 text-center">
      <div className="relative mb-6">
        <span className="font-telemetry text-[11px] tracking-[0.32em] text-bio uppercase">
          404 · signal lost
        </span>
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-6xl">
        This page fell out of sync.
      </h1>
      <p className="mt-4 max-w-md text-slate-400">
        The URL you followed is no longer in the adherence loop. Let us get you back to the timeline.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-bio px-6 py-3 font-telemetry text-sm font-semibold tracking-[0.18em] text-obsidian transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bio"
      >
        ← BACK TO MEDSYNC
      </Link>
    </main>
  );
}

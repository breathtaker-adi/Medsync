"use client";

import { Preloader } from "@/components/fx/preloader";
import { Nav } from "@/components/nav/nav";
import { Hero } from "@/components/hero/hero";
import { Bento } from "@/components/bento/bento";
import { DayInMedsync } from "@/components/day/day-in-medsync";
import { Metrics } from "@/components/metrics/metrics";
import { Film } from "@/components/film/film";
import { Footer } from "@/components/footer/footer";
import { TerminalDrawer } from "@/components/console/terminal";

export default function Page() {
  return (
    <div className="relative flex min-h-screen flex-col bg-obsidian">
      <Preloader />
      <Nav />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Hero />
        <Bento />
        <DayInMedsync />
        <Metrics />
        <Film />
      </main>
      <Footer />
      <TerminalDrawer />
    </div>
  );
}

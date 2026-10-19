"use client";

import { SectionHeading } from "@/components/fx/section-heading";
import { Reveal } from "@/components/fx/reveal";
import { AdherenceCard } from "./adherence-card";
import { SyncBridgeCard } from "./sync-bridge-card";
import { RefillRadarCard } from "./refill-radar-card";
import { VaultCard } from "./vault-card";
import { DosageCard } from "./dosage-card";
import { ConsoleTeaser } from "./console-teaser";

/**
 * The Real-Time Bento — an asymmetric grid of living modules. Every card is
 * a running slice of the Medsync loop, not a screenshot of one.
 */
export function Bento() {
  return (
    <section
      id="system"
      className="relative mx-auto w-full max-w-7xl px-5 py-28 md:px-8 md:py-36"
      aria-label="The Medsync system modules"
    >
      <SectionHeading
        index="01"
        eyebrow="THE SYSTEM"
        title={
          <>
            One timeline.{" "}
            <span className="text-gradient-sync">Every heartbeat</span> of the
            loop.
          </>
        }
        description="Six living modules running the adherence engine — hover, drag and click your way through the same surfaces patients, doctors and pharmacies touch every day."
      />

      <div className="mt-14 grid grid-cols-1 gap-4 md:auto-rows-[248px] md:grid-cols-6">
        <Reveal className="md:col-span-4 md:row-span-2" y={36}>
          <AdherenceCard className="h-full" />
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.08} y={36}>
          <SyncBridgeCard className="h-full" />
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.16} y={36}>
          <RefillRadarCard className="h-full" />
        </Reveal>
        <Reveal className="md:col-span-4" delay={0.08} y={36}>
          <DosageCard className="h-full" />
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.16} y={36}>
          <VaultCard className="h-full" />
        </Reveal>
        <Reveal className="md:col-span-6" delay={0.1} y={30}>
          <ConsoleTeaser className="h-full" />
        </Reveal>
      </div>
    </section>
  );
}

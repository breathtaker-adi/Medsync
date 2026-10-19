"use client";

import { SectionHeading } from "@/components/fx/section-heading";
import { Reveal } from "@/components/fx/reveal";
import { AdherenceCard } from "./adherence-card";
import { SyncBridgeCard } from "./sync-bridge-card";
import { OcrScannerCard } from "./ocr-scanner-card";
import { VaultCard } from "./vault-card";
import { DosageCard } from "./dosage-card";
import { CaregiverSyncCard } from "./caregiver-sync-card";

/**
 * The Real-Time Bento: an asymmetric grid of living modules. Every card is
 * an interactive slice of Medsync's real adherence and safety engine.
 */
export function Bento() {
  return (
    <section
      id="system"
      className="relative mx-auto w-full max-w-7xl px-5 py-14 md:px-8 md:py-20"
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
        description="Interactive modules running the adherence engine: simulate doses, test interval schedules, inspect prescription OCR, and observe the caregiver safety loop."
      />

      <div className="mt-10 grid grid-cols-1 gap-4 md:auto-rows-[285px] md:grid-cols-6">
        <Reveal className="md:col-span-4 md:row-span-2" y={36}>
          <AdherenceCard className="h-full" />
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.08} y={36}>
          <SyncBridgeCard className="h-full" />
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.16} y={36}>
          <OcrScannerCard className="h-full" />
        </Reveal>
        <Reveal className="md:col-span-4" delay={0.08} y={36}>
          <DosageCard className="h-full" />
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.16} y={36}>
          <VaultCard className="h-full" />
        </Reveal>
        <Reveal className="md:col-span-6" delay={0.1} y={30}>
          <CaregiverSyncCard className="h-full" />
        </Reveal>
      </div>
    </section>
  );
}

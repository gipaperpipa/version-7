"use client";

import dynamic from "next/dynamic";
import type { ParcelMapWorkspaceProps } from "./parcel-map-workspace";
import { SectionCard } from "@/components/ui/section-card";

const DynamicParcelMapWorkspace = dynamic(() => import("./parcel-map-workspace"), {
  ssr: false,
  loading: () => (
    <SectionCard
      eyebrow="Loading map workspace"
      title="Preparing parcel-grade map selection"
      description="The map-first intake workspace is loading so you can search to an area and select sourced parcel geometry directly from the map."
    >
      <div className="helper-list">
        <div>Loading supported-region coverage.</div>
        <div>Loading the primary source-backed parcel selection surface.</div>
      </div>
    </SectionCard>
  ),
});

export function ParcelMapWorkspaceShell(props: ParcelMapWorkspaceProps) {
  return <DynamicParcelMapWorkspace {...props} />;
}

import type { ReactNode } from "react";
import { AppShell } from "@/components/ui/app-shell";

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  return <AppShell orgSlug={orgSlug}>{children}</AppShell>;
}

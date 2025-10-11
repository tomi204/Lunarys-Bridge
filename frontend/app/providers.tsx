"use client";

import { AppProviders } from "@/context/app-providers";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Header = () => {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Lunarys — Home">
          <Image
            src="/iso-logo.svg"
            alt="Lunarys logo"
            width={36}
            height={36}
            className="h-9 w-9 animate-spin-slow"
            priority
          />
          <span className="text-2xl font-semibold tracking-tight">Lunarys</span>
        </Link>

        <nav
          className="hidden items-center gap-10 rounded-full border border-white/5 bg-white/5 px-6 py-2 backdrop-blur-xl md:flex"
          aria-label="Main"
        >
          <Link
            href="#experience"
            className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
          >
            Experience
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
          >
            Flow
          </Link>
          <Link
            href="#docs"
            className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
          >
            Docs
          </Link>
          <Link
            href="#team"
            className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
          >
            Team
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Badge className="hidden bg-white/10 text-xs uppercase tracking-wide text-white md:inline-flex">
            Private Beta
          </Badge>
          <Link href="/bridge" aria-label="Launch Lunarys App">
            <Button className="group cursor-pointer bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-6 py-5 text-base font-semibold text-black shadow-[0_0_40px_rgba(56,226,255,0.35)] transition-transform hover:scale-105">
              Launch App
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};

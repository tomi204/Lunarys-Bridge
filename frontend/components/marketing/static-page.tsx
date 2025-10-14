import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

import { ConstellationBackground } from "@/components/constellation-background";
import { cn } from "@/lib/utils";

export type StaticPageSection = {
  title: string;
  description: string;
  bullets?: string[];
  extra?: ReactNode;
};

type StaticPageProps = {
  eyebrow?: string;
  title: string;
  description: string;
  lastUpdated?: string;
  sections: StaticPageSection[];
  callout?: {
    heading: string;
    body: string;
    ctaLabel?: string;
    ctaHref?: string;
  };
  className?: string;
};

export function StaticPage({
  eyebrow,
  title,
  description,
  lastUpdated,
  sections,
  callout,
  className,
}: StaticPageProps) {
  return (
    <div className={cn("relative min-h-screen overflow-hidden bg-[#020617] text-white", className)}>
      <ConstellationBackground className="z-0" particleCount={200} maxLineDistance={180} />
      <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(56,226,255,0.25),transparent_65%)]" />
      <div className="absolute bottom-[-20%] left-[10%] h-[360px] w-[360px] rounded-full bg-cyan-500/25 blur-[140px]" />
      <div className="absolute top-[25%] right-[-8%] h-[480px] w-[480px] rounded-full bg-indigo-500/25 blur-[160px]" />

      <header className="relative z-20">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-8">
          <Link href="/" className="flex items-center gap-3">
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
          <nav className="hidden items-center gap-10 rounded-full border border-white/5 bg-white/5 px-6 py-2 backdrop-blur-xl md:flex">
            <Link
              href="/"
              className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/bridge"
              className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
            >
              Bridge
            </Link>
            <Link
              href="/documentation"
              className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
            >
              Docs
            </Link>
            <Link
              href="/terms"
              className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
            >
              Terms
            </Link>
          </nav>
          <Link href="/bridge" className="hidden md:inline-block">
            <span className="rounded-full bg-gradient-to-r from-cyan-400 via-emerald-300 to-sky-400 px-6 py-3 text-sm font-semibold text-black shadow-[0_0_35px_rgba(56,226,255,0.35)] transition hover:opacity-90">
              Launch app
            </span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-24">
        <div className="mx-auto w-full max-w-6xl pt-12">
          <div className="mb-14 space-y-6 text-center">
            {eyebrow ? (
              <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.35em] text-cyan-200">
                {eyebrow}
              </span>
            ) : null}
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
            {lastUpdated ? (
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-100/70">
                Last updated • {lastUpdated}
              </p>
            ) : null}
            <p className="mx-auto max-w-3xl text-lg text-gray-300">{description}</p>
          </div>

          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            {sections.map((section) => (
              <section
                key={section.title}
                className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-8 text-gray-200 backdrop-blur"
              >
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                  <p className="text-sm leading-relaxed text-gray-300">{section.description}</p>
                </div>
                {section.bullets ? (
                  <ul className="space-y-2 text-sm leading-relaxed text-gray-300">
                    {section.bullets.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-cyan-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.extra ? <div className="text-sm text-gray-300">{section.extra}</div> : null}
              </section>
            ))}
          </div>

          {callout ? (
            <div className="mx-auto mt-12 flex max-w-5xl flex-col gap-4 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-8 text-cyan-50 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
                  {callout.heading}
                </p>
                <p className="text-sm leading-relaxed text-cyan-50/90">{callout.body}</p>
              </div>
              {callout.ctaLabel && callout.ctaHref ? (
                <Link
                  href={callout.ctaHref}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40"
                >
                  {callout.ctaLabel}
                  <span aria-hidden>→</span>
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

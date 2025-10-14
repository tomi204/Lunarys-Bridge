"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUpRight,
  CircuitBoard,
  Globe,
  Lock,
  Radar,
  ShieldCheck,
  Sparkles,
  Timer,
  Waves,
  Zap,
} from "lucide-react";

import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LampContainer } from "@/components/ui/lamp";
import { SplashCursor } from "@/components/ui/splash-cursor";

type Feature = {
  title: string;
  description: string;
  accent: string;
  icon: LucideIcon;
};

const featurePillars: Feature[] = [
  {
    title: "Zero-Knowledge By Default",
    description:
      "Every transfer is sealed inside Arcium MXE enclaves before it touches public rails. Privacy is automatic, uncompromised, and institution-ready.",
    accent: "Encrypted execution",
    icon: ShieldCheck,
  },
  {
    title: "Instant, Deep Liquidity",
    description:
      "Access Raydium-grade depth and Triton latency across chains. Pools rebalance in milliseconds so value lands where you need it, when you need it.",
    accent: "Sub-second settlement",
    icon: Zap,
  },
  {
    title: "Adaptive Compliance Layer",
    description:
      "Programmable guardrails, attestations, and audit trails for teams that ship fast but answer to regulators. Privacy for users, proofs for auditors.",
    accent: "Policy-aware logic",
    icon: Radar,
  },
];

const timelineSteps: Feature[] = [
  {
    title: "Link your vault",
    description:
      "Connect Phantom, Backpack, or any Solana-compatible wallet. Lunarys fingerprints the session, not the user, keeping biometrics off-chain.",
    accent: "No custody taken",
    icon: Waves,
  },
  {
    title: "Encrypt and route",
    description:
      "Choose asset, destination chain, and policy tags. Routing intelligence simulates 400+ paths to guarantee highest privacy score in real time.",
    accent: "Adaptive ZK routing",
    icon: CircuitBoard,
  },
  {
    title: "Settle in light speed",
    description:
      "Triton relays propagate proofs to counterpart chains and Raydium liquidity clears instantly. Funds arrive ready to deploy in under a second.",
    accent: "< 700ms clearance",
    icon: Timer,
  },
];

const capabilityCards: Feature[] = [
  {
    title: "Observability without exposure",
    description:
      "Multi-party attestations, tamper-proof logs, and zk-redactable exports mean ops teams see health, not private payloads.",
    accent: "Ops-grade telemetry",
    icon: Globe,
  },
  {
    title: "Composable control surfaces",
    description:
      "Drop-in webhooks, typed SDKs, and modular policy packs let you script treasury workflows without touching custodial risk.",
    accent: "SDK + policy packs",
    icon: Sparkles,
  },
  {
    title: "Hardware-trusted endpoints",
    description:
      "Secure enclaves sign every bridge proof. Hardware-backed identities, no shared operators, no compromise surface.",
    accent: "HSM-backed keys",
    icon: Lock,
  },
];

const launchMetrics = [
  {
    label: "Audit coverage",
    value: "4 firms",
    detail: "Quantstamp · OtterSec · Trail of Bits · Zellic",
  },
  {
    label: "Live capacity",
    value: "$1.2B",
    detail: "Instant liquidity available across supported pools",
  },
  {
    label: "Protocols",
    value: "37",
    detail: "Bridging destinations in active production",
  },
];

const docsHighlights = [
  {
    title: "Deep-dive documentation",
    description:
      "Blueprints, threat models, and SDK guides built for product teams, auditors, and integrators alike.",
  },
  {
    title: "Protocol transparency",
    description:
      "Open-source verifier circuits, reproducible builds, and deterministic release notes available on every push.",
  },
  {
    title: "Rapid integration kits",
    description:
      "Spin up staging bridges in minutes with TypeScript, Rust, and Python clients plus pre-built monitoring dashboards.",
  },
];

const teamMembers = [
  {
    name: "Luciano Carreño",
    role: "CLO",
    bio: "4 years as a web3 developer and a licensed lawyer, bridging tech with the legal & regulatory world",
    initials: "LC",
    image: "/luc.png",
  },
  {
    name: "Fabian Diaz",
    role: "CTO",
    bio: "5 years of experience leading technical architecture and smart contracts in high-impact web3 projects",
    initials: "FD",
    image: "/fab.jpeg",
  },
  {
    name: "Tomas Oliver",
    role: "CEO",
    bio: "5+ years as a full-stack developer, building across top protocols and alumni of global incubators like Avalanche Codebase and Odisea",
    initials: "TO",
    image: "/to.JPG",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <SplashCursor
        SPLAT_FORCE={120}
        SPLAT_RADIUS={0.03}
        COLOR_UPDATE_SPEED={1.5}
      />

      <div className="absolute -top-56 left-[10%] h-[520px] w-[520px] rounded-full bg-cyan-500/20 blur-[160px]" />
      <div className="absolute top-[40%] right-[-10%] h-[440px] w-[440px] rounded-full bg-indigo-500/25 blur-[160px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,226,255,0.12),transparent_55%)]" />

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
            <span className="text-2xl font-semibold tracking-tight">
              Lunarys
            </span>
          </Link>
          <nav className="hidden items-center gap-10 rounded-full border border-white/5 bg-white/5 px-6 py-2 backdrop-blur-xl md:flex">
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
            <Link href="/bridge">
              <Button className="group bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-6 py-5 text-base font-semibold text-black shadow-[0_0_40px_rgba(56,226,255,0.35)] transition-transform hover:scale-105">
                Launch App
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="px-6 pb-28 pt-12">
          <div className="mx-auto grid max-w-7xl items-center gap-16 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-10">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                <Badge className="bg-cyan-400/20 text-white backdrop-blur">
                  Encrypted cross-chain routing
                </Badge>
                <span className="hidden text-sm text-gray-500 md:inline-flex">
                  Audited • Non-custodial • Battle-tested
                </span>
              </div>

              <h1 className="text-4xl leading-tight sm:text-6xl sm:leading-[1.05] lg:text-7xl">
                The bridge built
                <br />
                for funds that never compromise
              </h1>

              <p className="max-w-2xl text-lg text-gray-300 sm:text-xl">
                Lunarys fuses zero-knowledge encryption, institutional
                liquidity, and programmable controls into a single glass-cannon
                interface. Bridge stealthily, settle instantly, prove
                everything.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Link href="/bridge">
                  <Button className="group bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-8 py-6 text-base font-semibold text-black shadow-[0_0_45px_rgba(56,226,255,0.45)] transition-transform hover:-translate-y-0.5">
                    Start bridging now
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1.5" />
                  </Button>
                </Link>
                <Link href="#docs">
                  <Button
                    variant="outline"
                    className="border-white/20 bg-white/5 px-8 py-6 text-base font-semibold text-white backdrop-blur transition-colors hover:border-white/40 hover:bg-white/10"
                  >
                    Explore docs
                    <ArrowUpRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {/* <div className="grid gap-6 sm:grid-cols-3">
                {launchMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_-28px_rgba(56,226,255,0.45)] backdrop-blur"
                  >
                    <span className="text-xs uppercase tracking-wide text-gray-400">
                      {metric.label}
                    </span>
                    <div className="mt-3 text-2xl font-semibold text-white">
                      {metric.value}
                    </div>
                    <p className="mt-2 text-sm text-gray-400">
                      {metric.detail}
                    </p>
                  </div>
                ))}
              </div> */}
            </div>

            <div className="relative">
              <div className="absolute -top-8 right-10 h-32 w-32 rounded-full bg-cyan-400/30 blur-3xl" />
              <div className="absolute -bottom-10 left-12 h-40 w-40 rounded-full bg-cyan-400/12 blur-3xl" />
              <div className="relative rounded-3xl border border-white/10 bg-white/10 p-8 shadow-[0_40px_120px_-40px_rgba(56,226,255,0.55)] backdrop-blur-xl">
                <div className="flex items-center justify-between text-sm text-gray-200">
                  <span className="font-medium">Session tunnel</span>
                  <Badge className="bg-white/10 text-white">ZK verified</Badge>
                </div>

                <div className="mt-6 grid gap-6 text-sm">
                  <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/40 p-5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wider text-gray-400">
                      <span>Origin</span>
                      <span>Destination</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <span className="text-xs uppercase tracking-wide text-gray-400">
                          Solana
                        </span>
                        <p className="mt-1 text-lg font-semibold">
                          Treasury Vault A
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Encrypting payload
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <span className="text-xs uppercase tracking-wide text-gray-400">
                          Ethereum
                        </span>
                        <p className="mt-1 text-lg font-semibold">
                          Policy Wallet 5
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Awaiting proof
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-400">
                        <span>Privacy score</span>
                        <span>99.3%</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full w-[93%] rounded-full bg-cyan-400/80" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-400">
                        <span>Settlement ETA</span>
                        <span>0.62s</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
                        <span className="text-gray-300">Proof propagation</span>
                        <span className="font-semibold text-white">Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-xs uppercase tracking-wide text-gray-300">
                    <div className="flex items-center justify-between">
                      <span>MXE enclave integrity</span>
                      <span className="text-white">Attested</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Raydium depth</span>
                      <span className="text-white">$134M</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Compliance mode</span>
                      <span className="text-white">Policy pack 07</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="experience" className="relative px-6 pb-28">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="space-y-4">
                <Badge className="bg-white/10 text-white">Experience</Badge>
                <h2 className="text-3xl font-semibold sm:text-5xl">
                  Designed for teams shipping the next wave of private finance
                </h2>
                <p className="max-w-3xl text-lg text-gray-300">
                  Advanced UX with institutional guardrails. Every interaction
                  feels cinematic while staying battle-tested for ops,
                  compliance, and security teams.
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featurePillars.map((feature) => (
                <div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur transition-transform duration-300 hover:-translate-y-2 hover:shadow-[0_25px_80px_-40px_rgba(56,226,255,0.6)]"
                >
                  <div className="absolute -top-24 right-0 h-40 w-40 rounded-full bg-cyan-400/15 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                  <feature.icon className="h-10 w-10 text-white" />
                  <h3 className="mt-8 text-2xl font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-base text-gray-300">
                    {feature.description}
                  </p>
                  <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white">
                    {feature.accent}
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="relative px-6 pb-28">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge className="bg-white/10 text-white">Flow</Badge>
                <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">
                  Three steps from idea to settled value
                </h2>
              </div>
              <p className="max-w-2xl text-lg text-gray-300">
                A cinematic workflow that keeps ops in the loop and sensitive
                data out of sight. Every step is instrumented, reversible, and
                provable without revealing counterparties.
              </p>
            </div>

            <div className="relative grid gap-8 md:grid-cols-3">
              <div className="pointer-events-none absolute left-1/2 top-10 hidden h-[calc(100%-5rem)] w-px -translate-x-1/2 bg-gradient-to-b from-cyan-400/40 via-white/0 to-transparent md:block" />
              {timelineSteps.map((step, index) => (
                <Card
                  key={step.title}
                  className="relative border-white/10 bg-white/5 p-8 text-left shadow-none backdrop-blur"
                >
                  <CardContent className="space-y-6 p-0">
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
                        <step.icon className="h-6 w-6 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-400">
                        Step {index + 1}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-semibold">{step.title}</h3>
                      <p className="text-base text-gray-300">
                        {step.description}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-white">
                      {step.accent}
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-6 pb-28">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge className="bg-white/10 text-white">Control center</Badge>
                <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">
                  Observatory-grade insight without leaking intent
                </h2>
              </div>
              <p className="max-w-2xl text-lg text-gray-300">
                Real-time visibility aligned to privacy posture. Monitor
                posture, latency, and liquidity budgets while zero-knowledge
                keeps payloads dark.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.65fr_0.35fr]">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur">
                <div className="absolute -top-20 left-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="relative space-y-6">
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span className="font-semibold uppercase tracking-wide text-gray-400">
                      Active bridges
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                      All systems nominal
                    </span>
                  </div>

                  <div className="space-y-4 text-sm">
                    {["Atlas Fund", "Nebula Desk", "Orion Research"].map(
                      (desk) => (
                        <div
                          key={desk}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur"
                        >
                          <div>
                            <p className="text-base font-semibold text-white">
                              {desk}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-widest text-gray-400">
                              Compliance posture · 99th percentile
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                              Throughput
                            </p>
                            <p className="text-lg font-semibold text-white">
                              $48.3M
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="grid gap-4 text-xs uppercase tracking-wide text-gray-400 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                      <p>Average latency</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        612ms
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        98th percentile <span className="text-white">-22%</span>
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                      <p>Liquidity buffer</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        $312M
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Refilled every 4h via auto-balancing
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                      <p>Policy drift</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        0 alerts
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        All packs synced
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {capabilityCards.map((card) => (
                  <div
                    key={card.title}
                    className="group rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-transform duration-300 hover:-translate-y-1"
                  >
                    <div className="flex items-start gap-4">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <card.icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold">{card.title}</h3>
                        <p className="text-sm text-gray-300">
                          {card.description}
                        </p>
                        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white">
                          {card.accent}
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="docs" className="relative px-6 pb-28">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge className="bg-white/10 text-white">Docs</Badge>
                <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">
                  Full-stack transparency from readme to runtime
                </h2>
              </div>
              <Link href="/bridge">
                <Button className="bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-6 py-5 text-sm font-semibold text-black shadow-[0_0_35px_rgba(56,226,255,0.45)]">
                  Read integration playbook
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {docsHighlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-8 text-left shadow-[0_30px_90px_-45px_rgba(56,226,255,0.6)] backdrop-blur"
                >
                  <h3 className="text-xl font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-base text-gray-300">
                    {item.description}
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">
                    Request access
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="team" className="relative px-6 pb-32">
          <div className="mx-auto max-w-7xl space-y-12">
            {/* Title Section - Above the lamp */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.8, ease: "easeInOut" }}
              className="flex max-w-3xl mx-auto flex-col items-center space-y-4 text-center"
            >
              <Badge className="bg-white/10 text-cyan-200">Team</Badge>
              <h2 className="text-3xl font-semibold sm:text-5xl">
                Builders behind Lunarys
              </h2>
              <p className="text-lg text-gray-300">
                Cryptography natives, protocol engineers, and operators crafting
                privacy-first liquidity rails.
              </p>
            </motion.div>

            <LampContainer className="min-h-[800px] rounded-3xl border border-white/10 bg-slate-950/90 px-4 pb-4 pt-20 shadow-[0_60px_160px_-80px_rgba(56,226,255,0.55)] md:px-10">
              <motion.div
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8, ease: "easeInOut" }}
                className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 w-full max-w-4xl justify-items-center"
              >
                {teamMembers.map((member, index) => (
                  <motion.div
                    key={member.name}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.5 + index * 0.1,
                      duration: 0.6,
                      ease: "easeOut",
                    }}
                    className="group flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur transition-all duration-300 hover:-translate-y-2 shadow-[0_0_40px_-10px_rgba(56,226,255,0.3)] hover:shadow-[0_0_60px_-5px_rgba(56,226,255,0.5)] hover:border-cyan-400/30 hover:bg-white/10"
                  >
                    <div className="relative h-32 w-32 overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.25),rgba(30,41,59,0.85))]">
                      <Image
                        src={member.image}
                        alt={member.name}
                        fill
                        className="object-cover"
                        sizes="128px"
                      />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-white">
                        {member.name}
                      </h3>
                      <p className="text-sm uppercase tracking-[0.35em] text-cyan-200/80">
                        {member.role}
                      </p>
                      <p className="text-sm text-gray-400">{member.bio}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </LampContainer>
          </div>
        </section>

        <section className="relative px-6 pb-24">
          <div className="mx-auto max-w-7xl rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 via-slate-900/90 to-indigo-600/20 p-10 text-center shadow-[0_50px_140px_-60px_rgba(56,226,255,0.6)] backdrop-blur-xl">
            <Badge className="bg-white/10 text-cyan-100">Final call</Badge>
            <h2 className="mt-6 text-4xl font-semibold sm:text-5xl">
              Bridge value at the speed of intent
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-cyan-50/80">
              Run private, programmable cross-chain liquidity like it&apos;s
              2030. Join the teams scaling stealth launches, market-making
              desks, and DAO treasuries across ecosystems.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/bridge">
                <Button className="bg-black/80 px-8 py-6 text-base font-semibold text-white outline outline-1 outline-cyan-300/40 transition-transform hover:-translate-y-0.5">
                  Launch Lunarys
                </Button>
              </Link>
              <Link href="#docs">
                <Button
                  variant="outline"
                  className="border-white/30 bg-white/5 px-8 py-6 text-base font-semibold text-white backdrop-blur hover:border-white/50 hover:bg-white/10"
                >
                  Talk to protocol engineers
                  <ArrowUpRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

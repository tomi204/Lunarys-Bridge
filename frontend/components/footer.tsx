import Image from "next/image";
import Link from "next/link";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Bridge", href: "/bridge" },
      { label: "Command center", href: "#" },
      { label: "Policy packs", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/#docs" },
      { label: "Integration playbook", href: "#" },
      { label: "Audit reports", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
      { label: "Legal", href: "/terms" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "X / Twitter", href: "#" },
      { label: "GitHub", href: "#" },
      { label: "Telegram", href: "#" },
      { label: "Discord", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-white/10 bg-[#030712] text-gray-300">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,226,255,0.08),transparent_60%)]" />
      <div className="absolute -top-24 right-16 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute -bottom-32 left-20 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-16 px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-8">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/iso-logo.svg"
                alt="Lunarys logo"
                width={36}
                height={36}
                className="h-9 w-9 animate-spin-slow"
                priority
              />
              <span className="text-2xl font-semibold tracking-tight text-white">Lunarys</span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-gray-400">
              The encrypted cross-chain bridge built for teams that trade at the speed of intent. Private by default,
              auditor-friendly by design.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-widest text-cyan-200/80">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1">Zero-knowledge verified</span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1">Non-custodial</span>
              <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1">HSM attested</span>
            </div>
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300 md:max-w-md">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-gray-400">Audit partners</span>
                <span className="text-xs text-cyan-200">Updated quarterly</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-white">
                <span>Quantstamp</span>
                <span>OtterSec</span>
                <span>Trail of Bits</span>
                <span>Zellic</span>
              </div>
            </div>
          </div>

          <div className="grid gap-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {footerColumns.map((column) => (
              <div key={column.title} className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-widest text-white/80">
                  {column.title}
                </h4>
                <ul className="space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-gray-400 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-400 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Need throughput guarantees?</p>
            <p className="text-xs text-gray-400">
              Our protocol team offers custom liquidity mirrors, policy packs, and SLAs for institutional desks.
            </p>
          </div>
          <Link
            href="mailto:protocol@lunarys.xyz"
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:border-cyan-400/50 hover:text-cyan-100"
          >
            protocol@lunarys.xyz
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs text-gray-500 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Lunarys. All rights reserved.</p>
          <div className="flex flex-wrap gap-6">
            <Link href="#" className="transition-colors hover:text-white">
              Privacy policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms of service
            </Link>
            <Link href="#" className="transition-colors hover:text-white">
              Cookie preferences
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

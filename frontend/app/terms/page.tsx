"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ScrollText } from "lucide-react";

import { ConstellationBackground } from "@/components/constellation-background";
import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Section = {
  id: string;
  title: string;
  body: ReactNode;
};

const sections: Section[] = [
  {
    id: "overview",
    title: "1. About These Terms",
    body: (
      <>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Lunarys Bridge interface, smart
          contracts, related APIs, documentation, and any content or features we provide (collectively, the &quot;Service&quot;).
          By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
        </p>
        <p>
          Lunarys is a non-custodial software protocol. We never take possession of digital assets, route funds through
          custodians, or guarantee the successful completion of any transaction.
        </p>
        <p>
          Supplemental terms or policies may apply to certain features. Where there is a conflict, the more specific terms control.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "2. Eligibility",
    body: (
      <>
        <p>
          You must be at least 18 years old, legally competent, and not barred from using the Service under applicable law.
        </p>
        <p>
          You may not use the Service if you are located in, organized in, or a resident of any jurisdiction where the Service is
          prohibited or would require registration that we have not undertaken, including but not limited to: the United States,
          Canada, sanctioned jurisdictions (e.g., Cuba, Iran, North Korea, Syria, Crimea, Donetsk, Luhansk), or areas embargoed by
          the United Nations or the European Union.
        </p>
        <p>
          You represent and warrant that you will comply with all laws, regulations, and internal policies that apply to your use of
          the Service.
        </p>
      </>
    ),
  },
  {
    id: "access",
    title: "3. Access and Wallets",
    body: (
      <>
        <p>
          Accessing the Service requires the use of a third-party wallet that supports the relevant blockchain networks. Wallets are
          not operated or controlled by Lunarys.
        </p>
        <p>
          You are solely responsible for safeguarding the private keys, seed phrases, passcodes, or any credentials associated with
          your wallet. Loss of these credentials may result in permanent loss of access to your assets.
        </p>
        <div>
          <p>
            When you sign a transaction or message through the Service, you authorize the associated operations on the respective
            blockchain network(s). All blockchain transactions are final and irreversible.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "usage",
    title: "4. Bridge Usage",
    body: (
      <>
        <p>
          The Service enables the submission of encrypted payloads to smart contracts that govern cross-chain asset transfers.
          Interaction with the Service occurs directly between you and the relevant blockchain(s).
        </p>
        <p>
          You understand and accept that:
        </p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Smart contracts may fail, be exploited, or behave unexpectedly.</li>
          <li>Transactions can be front-run, delayed, reversed, or lost.</li>
          <li>Third-party dependencies (oracles, RPC nodes, liquidity providers) may fail or operate with bugs.</li>
          <li>Your funds may be irretrievable if private keys are compromised or if the destination wallet is incorrect.</li>
        </ul>
        <p>
          You are solely responsible for verifying all transaction details, including destination addresses, token amounts, fees,
          network selection, and payload contents before submission.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    title: "5. Fees and Taxes",
    body: (
      <>
        <p>
          Lunarys may charge protocol fees that are displayed in the interface at the time of the transaction. Fees may change at any
          time without prior notice.
        </p>
        <p>
          You are responsible for all blockchain network fees (gas fees) and any third-party charges imposed by wallet providers,
          liquidity venues, or infrastructure partners.
        </p>
        <p>
          You are solely responsible for determining, reporting, and paying any taxes, duties, or similar governmental assessments
          associated with your use of the Service.
        </p>
      </>
    ),
  },
  {
    id: "prohibited",
    title: "6. Prohibited Conduct",
    body: (
      <>
        <p>
          You agree not to:
        </p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Use the Service to violate any applicable law, regulation, or third-party rights.</li>
          <li>Use the Service for money laundering, terrorist financing, fraud, or other illicit purposes.</li>
          <li>Probe, scan, or test the vulnerability of any system or network or breach any security or authentication measure.</li>
          <li>Interfere with or disrupt the Service, including distributing malware or launching denial-of-service attacks.</li>
          <li>Use automated scripts or bots without our prior written consent.</li>
          <li>Impersonate any person or misrepresent your affiliation with any person or entity.</li>
        </ul>
        <p>
          We reserve the right to investigate and cooperate with law enforcement regarding any violations.
        </p>
      </>
    ),
  },
  {
    id: "disclaimer",
    title: "7. Disclaimer of Warranties",
    body: (
      <>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT ANY WARRANTIES OF ANY KIND, WHETHER EXPRESS,
          IMPLIED, OR STATUTORY. WITHOUT LIMITING THE FOREGOING, WE SPECIFICALLY DISCLAIM ANY IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING OUT OF
          COURSE OF DEALING OR USAGE OF TRADE.
        </p>
        <p>
          We do not warrant that the Service will be uninterrupted, secure, or error-free, or that any defects will be corrected.
          No advice or information obtained from us creates any warranty.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "8. Limitation of Liability",
    body: (
      <>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, LUNARYS AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AGENTS,
          PARTNERS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
        </p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Loss of profits, revenue, data, or use</li>
          <li>Loss of digital assets or tokens</li>
          <li>Business interruption or loss of goodwill</li>
          <li>Any damages resulting from smart contract failures, exploits, or bugs</li>
          <li>Unauthorized access to or alteration of your transmissions or data</li>
          <li>Blockchain network failures, forks, or congestion</li>
          <li>Actions or omissions of third parties including liquidity providers</li>
          <li>Any other matter relating to the Service</li>
        </ul>
        <p>
          IN NO EVENT SHALL OUR TOTAL LIABILITY EXCEED THE AMOUNT OF FEES PAID BY YOU TO US IN THE 12 MONTHS PRIOR TO THE
          EVENT GIVING RISE TO LIABILITY, OR $100 USD, WHICHEVER IS LESS.
        </p>
      </>
    ),
  },
  {
    id: "indemnification",
    title: "9. Indemnification",
    body: (
      <p>
        You agree to indemnify, defend, and hold harmless Lunarys and its affiliates, officers, directors,
        employees, agents, and partners from any claims, damages, losses, liabilities, costs, or expenses (including
        reasonable attorneys&apos; fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c)
        your violation of any applicable laws or regulations; or (d) your violation of any rights of any third party.
      </p>
    ),
  },
  {
    id: "privacy",
    title: "10. Privacy",
    body: (
      <>
        <p>
          Lunarys does not collect personal data beyond technical information necessary to operate the Service. However, blockchain
          transactions are public and permanently recorded on-chain.
        </p>
        <p>
          For a detailed description of how we handle data, please review the Lunarys Privacy Notice. Where a conflict exists between
          this section and the Privacy Notice, the Privacy Notice controls.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "11. Intellectual Property",
    body: (
      <p>
        All intellectual property rights in the Service, including software, designs, graphics, and content, are owned
        by Lunarys or its licensors. You are granted a limited, non-exclusive, non-transferable license to access and
        use the Service in accordance with these Terms.
      </p>
    ),
  },
  {
    id: "changes",
    title: "12. Changes and Termination",
    body: (
      <>
        <p>
          We may modify or discontinue any part of the Service at any time without notice. We may also modify these Terms at any
          time. Updated Terms become effective upon posting, and your continued use of the Service constitutes acceptance.
        </p>
        <p>
          We may suspend or terminate your access to the Service at any time for any reason, including a suspected breach of these
          Terms.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "13. Governing Law and Disputes",
    body: (
      <>
        <p>
          These Terms are governed by the laws of Switzerland, excluding its conflicts of law principles.
        </p>
        <p>
          Any dispute arising out of or relating to these Terms or the Service shall be resolved through binding arbitration
          administered in Switzerland, in accordance with the Swiss Rules of International Arbitration. You waive any right to a jury
          trial or to participate in a class action.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "14. Contact",
    body: (
      <p>
        For questions about these Terms, please contact us at:
        <br />
        <a href="mailto:legal@lunarys.io" className="text-cyan-300 hover:text-cyan-200">
          legal@lunarys.io
        </a>
      </p>
    ),
  },
];

const lastUpdated = "October 9, 2025";

export default function TermsPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <ConstellationBackground className="z-0" particleCount={200} maxLineDistance={180} />
      <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(56,226,255,0.25),transparent_65%)]" />
      <div className="absolute bottom-[-20%] left-[20%] h-[360px] w-[360px] rounded-full bg-cyan-500/25 blur-[140px]" />
      <div className="absolute top-[30%] right-[-10%] h-[480px] w-[480px] rounded-full bg-indigo-500/25 blur-[160px]" />

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
              href="/#experience"
              className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
            >
              Features
            </Link>
            <Link
              href="/#docs"
              className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
            >
              Docs
            </Link>
            <Link
              href="/#team"
              className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
            >
              Team
            </Link>
          </nav>
          <Link href="/bridge">
            <Button className="bg-gradient-to-r from-cyan-400 via-emerald-300 to-sky-400 px-6 py-4 text-sm font-semibold text-black shadow-[0_0_35px_rgba(56,226,255,0.35)]">
              Launch app
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-28">
        <div className="mx-auto w-full max-w-7xl pt-12">
          <div className="mb-14 space-y-6 text-center">
            <Badge className="mx-auto bg-white/10 text-cyan-200">Legal</Badge>
            <h1 className="text-4xl font-semibold sm:text-5xl">Terms of Service</h1>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-100/70">
              Last updated • {lastUpdated}
            </p>
            <p className="mx-auto max-w-3xl text-lg text-gray-300">
              Review these Terms before initiating transactions through Lunarys Bridge. They explain what you can expect from us,
              what we expect from you, and how we handle disputes.
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
            <aside className="relative hidden rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300 backdrop-blur-xl lg:block">
              <div className="sticky top-32 space-y-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-cyan-100">
                    <ScrollText className="h-4 w-4" /> Table of contents
                  </div>
                  <p className="text-xs text-gray-400">
                    Jump directly to a section or skim the highlights before reading the full agreement.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="group flex items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-left transition-colors hover:border-white/15 hover:bg-white/10"
                    >
                      <span className="text-sm text-gray-200 group-hover:text-white">{section.title}</span>
                      <ArrowUpRight className="h-4 w-4 text-cyan-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  ))}
                </div>
                <Link href="mailto:legal@lunarys.io">
                  <Button
                    variant="outline"
                    className="w-full border-white/20 bg-white/5 text-sm font-semibold text-white hover:border-white/40 hover:bg-white/10"
                  >
                    Request signed copy
                  </Button>
                </Link>
              </div>
            </aside>

            <div className="space-y-12 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
              {sections.map((section) => (
                <section key={section.id} id={section.id} className="space-y-4 scroll-mt-28">
                  <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
                  <div className="space-y-4 text-base leading-relaxed text-gray-300">{section.body}</div>
                </section>
              ))}

              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-6 text-sm text-cyan-50">
                By using the Lunarys Service, you acknowledge that you have read, understood, and agree to be bound by
                these Terms of Service. If you do not agree, you must not access or use the Service.
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

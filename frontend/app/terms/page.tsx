"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ScrollText } from "lucide-react";

import { ConstellationBackground } from "@/components/constellation-background";
import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";

type Section = {
  id: string;
  title: string;
  body: ReactNode;
};

const sections: Section[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    body: (
      <>
        <p>
          By accessing or using Lunarys (&quot;the Service&quot;, &quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you agree
          to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not
          access or use the Service.
        </p>
        <p>
          The Service is a decentralized cross-chain bridge protocol operated as a software interface. We do not
          custody, control, or manage any user funds or assets at any time.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "2. Eligibility and Restrictions",
    body: (
      <>
        <p>
          <strong className="text-cyan-300">2.1 Age requirement:</strong> You must be at least 18 years old and legally capable of entering into binding
          contracts to use this Service.
        </p>
        <p>
          <strong className="text-cyan-300">2.2 Geographic restrictions:</strong> The Service is not available to persons or entities
          who reside in, are located in, are incorporated in, or have registered offices in any Restricted
          Territory, including but not limited to: United States, North Korea, Iran, Syria, Cuba, Crimea, or any
          jurisdiction where the Service would be illegal.
        </p>
        <p>
          <strong className="text-cyan-300">2.3 Compliance:</strong> You are solely responsible for ensuring compliance with all laws
          and regulations applicable to your use of the Service in your jurisdiction.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "3. Service Description and Disclaimers",
    body: (
      <>
        <p>
          <strong className="text-cyan-300">3.1 Non-custodial service:</strong> Lunarys is a non-custodial software interface. We do not hold,
          custody, control, or manage user funds. All transactions are executed through smart contracts on
          public blockchains.
        </p>
        <p>
          <strong className="text-cyan-300">3.2 Smart contract risks:</strong> Smart contracts are experimental technology. Despite
          security audits, vulnerabilities may exist. Users acknowledge all risks including complete loss of funds
          due to smart contract failures, exploits, or bugs.
        </p>
        <p>
          <strong className="text-cyan-300">3.3 No guarantees:</strong> We provide the Service &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without
          warranties of any kind, express or implied, including but not limited to warranties of merchantability,
          fitness for a particular purpose, or non-infringement.
        </p>
        <p>
          <strong className="text-cyan-300">3.4 Blockchain risks:</strong> Blockchain networks may experience congestion, delays,
          forks, or failures. We are not responsible for any losses resulting from blockchain-related issues.
        </p>
      </>
    ),
  },
  {
    id: "responsibilities",
    title: "4. User Responsibilities",
    body: (
      <>
        <p>
          <strong className="text-cyan-300">4.1 Wallet security:</strong> You are solely responsible for securing your private keys, seed
          phrases, and wallet credentials. Loss of these credentials may result in permanent loss of access to your
          assets.
        </p>
        <p>
          <strong className="text-cyan-300">4.2 Transaction verification:</strong> You must verify all transaction details including
          recipient addresses, amounts, fees, and network selections before confirming any transaction. All
          blockchain transactions are irreversible.
        </p>
        <div>
          <p>
            <strong className="text-cyan-300">4.3 Prohibited activities:</strong> You agree not to:
          </p>
          <ul className="list-disc list-inside space-y-2 pl-4">
            <li>Use the Service for any illegal activities including money laundering or terrorist financing</li>
            <li>Attempt to exploit, attack, or interfere with the Service or smart contracts</li>
            <li>Use the Service to violate any applicable laws or regulations</li>
            <li>Impersonate any person or entity or misrepresent your affiliation</li>
            <li>Use automated tools to access the Service without authorization</li>
          </ul>
        </div>
        <p>
          <strong className="text-cyan-300">4.4 Tax obligations:</strong> You are solely responsible for determining and paying all
          applicable taxes related to your use of the Service.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    title: "5. Fees and Costs",
    body: (
      <>
        <p>
          <strong className="text-cyan-300">5.1 Bridge fees:</strong> The Service charges bridge fees as displayed in the interface. Fees
          are subject to change without notice.
        </p>
        <p>
          <strong className="text-cyan-300">5.2 Network fees:</strong> Users are responsible for all blockchain network fees (gas fees)
          required to execute transactions.
        </p>
        <p>
          <strong className="text-cyan-300">5.3 Third-party fees:</strong> Additional fees may be charged by third-party services
          including wallet providers, liquidity providers, or RPC providers.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "6. Limitation of Liability",
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
    title: "7. Indemnification",
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
    title: "8. Privacy and Data",
    body: (
      <>
        <p>
          <strong className="text-cyan-300">8.1 Zero-knowledge privacy:</strong> While we implement zero-knowledge technology to protect
          transaction privacy, all blockchain transactions are publicly visible on-chain.
        </p>
        <p>
          <strong className="text-cyan-300">8.2 No data collection:</strong> We do not collect, store, or process personal data beyond what is
          necessary for Service functionality.
        </p>
        <p>
          <strong className="text-cyan-300">8.3 Blockchain data:</strong> By using the Service, you acknowledge that transaction data is
          recorded on public blockchains and may be permanently stored and accessible.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "9. Intellectual Property",
    body: (
      <p>
        All intellectual property rights in the Service, including software, designs, graphics, and content, are owned
        by Lunarys or its licensors. You are granted a limited, non-exclusive, non-transferable license to access and
        use the Service in accordance with these Terms.
      </p>
    ),
  },
  {
    id: "modifications",
    title: "10. Modifications and Termination",
    body: (
      <>
        <p>
          <strong className="text-cyan-300">10.1 Service changes:</strong> We reserve the right to modify, suspend, or discontinue the
          Service at any time without notice or liability.
        </p>
        <p>
          <strong className="text-cyan-300">10.2 Terms updates:</strong> We may update these Terms at any time. Continued use of the Service
          constitutes acceptance of updated Terms.
        </p>
        <p>
          <strong className="text-cyan-300">10.3 Termination:</strong> We may terminate or suspend your access to the Service immediately,
          without notice, for any reason including violation of these Terms.
        </p>
      </>
    ),
  },
  {
    id: "disputes",
    title: "11. Dispute Resolution",
    body: (
      <>
        <p>
          <strong className="text-cyan-300">11.1 Governing law:</strong> These Terms shall be governed by and construed in accordance with the
          laws of Switzerland, without regard to conflict of law principles.
        </p>
        <p>
          <strong className="text-cyan-300">11.2 Arbitration:</strong> Any dispute arising from these Terms or the Service shall be resolved
          through binding arbitration in accordance with Swiss arbitration rules.
        </p>
        <p>
          <strong className="text-cyan-300">11.3 Class action waiver:</strong> You agree to bring claims only in your individual capacity and not as
          part of any class or representative action.
        </p>
      </>
    ),
  },
  {
    id: "compliance",
    title: "12. Regulatory Compliance",
    body: (
      <>
        <p>
          <strong className="text-cyan-300">12.1 No financial advice:</strong> The Service does not provide financial, investment, legal, or tax
          advice. You should consult appropriate professionals before using the Service.
        </p>
        <p>
          <strong className="text-cyan-300">12.2 No securities:</strong> Nothing on the Service constitutes an offer to sell or solicitation of an
          offer to buy any securities or regulated financial instruments.
        </p>
        <p>
          <strong className="text-cyan-300">12.3 AML/KYC:</strong> We reserve the right to implement anti-money laundering (AML) and know-your-customer
          (KYC) procedures at any time and may block transactions that appear suspicious.
        </p>
      </>
    ),
  },
  {
    id: "force-majeure",
    title: "13. Force Majeure",
    body: (
      <p>
        We shall not be liable for any failure or delay in performance due to circumstances beyond our reasonable control,
        including but not limited to acts of God, war, terrorism, riots, embargoes, acts of civil or military authorities,
        fire, floods, accidents, network infrastructure failures, strikes, or shortages of transportation facilities, fuel,
        energy, labor, or materials.
      </p>
    ),
  },
  {
    id: "severability",
    title: "14. Severability",
    body: (
      <p>
        If any provision of these Terms is found to be invalid, illegal, or unenforceable, the remaining provisions shall
        continue in full force and effect.
      </p>
    ),
  },
  {
    id: "entire-agreement",
    title: "15. Entire Agreement",
    body: (
      <p>
        These Terms constitute the entire agreement between you and Lunarys regarding the Service and supersede all prior
        agreements and understandings, whether written or oral.
      </p>
    ),
  },
  {
    id: "contact",
    title: "16. Contact Information",
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

const lastUpdated = "October 5, 2025";

export default function TermsPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <ConstellationBackground className="z-0" particleCount={200} maxLineDistance={180} />
      <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(56,226,255,0.25),transparent_65%)]" />
      <div className="absolute bottom-[-20%] left-[20%] h-[360px] w-[360px] rounded-full bg-cyan-500/25 blur-[140px]" />
      <div className="absolute top-[30%] right-[-10%] h-[480px] w-[480px] rounded-full bg-indigo-500/25 blur-[160px]" />

      <Header />

      <main className="relative z-10 px-6 pb-28">
        <div className="mx-auto w-full max-w-7xl pt-12">
          <div className="mb-14 space-y-6 text-center">
            <Badge className="mx-auto bg-white/10 text-cyan-200">Legal</Badge>
            <h1 className="text-4xl font-semibold sm:text-5xl">Terms of Service</h1>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-100/70">
              Last updated • {lastUpdated}
            </p>
            <p className="mx-auto max-w-3xl text-lg text-gray-300">
              These Terms outline the rules of engagement when interacting with the Lunarys protocol. Read them carefully
              before initiating or completing any bridge transaction.
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
                    Jump to any section or download the latest signed PDF from our legal archive.
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

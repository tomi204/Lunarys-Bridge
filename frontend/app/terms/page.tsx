"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export default function TermsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 255, ${particle.opacity})`;
        ctx.fill();
      });

      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0, 255, 255, ${
              0.1 * (1 - distance / 150)
            })`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="relative bg-black text-white min-h-screen overflow-x-hidden">
      <canvas ref={canvasRef} className="fixed inset-0 z-0" />

      <div className="fixed inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70 z-[1] pointer-events-none" />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/30 border-b border-cyan-400/10">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/iso-logo.svg"
              alt="Lunarys Logo"
              className="w-10 h-10 animate-spin-slow"
            />
            <span className="text-2xl font-bold tracking-tight text-white">
              LUNARYS
            </span>
          </Link>

          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 font-medium"
            >
              Home
            </Link>
            <Link
              href="/bridge"
              className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 font-medium"
            >
              Bridge
            </Link>
            <Link
              href="/#docs"
              className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 font-medium"
            >
              Docs
            </Link>
          </div>
        </div>
      </nav>

      {/* Terms Content */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 animate-fade-in-up">
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-500">
                Terms of Service
              </span>
            </h1>
            <p className="text-gray-400 text-lg">
              Last Updated: October 5, 2025
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-cyan-400/20 bg-black/40 backdrop-blur-xl shadow-[0_0_60px_rgba(0,255,255,0.1)] animate-fade-in-up animation-delay-200">
            <div className="prose prose-invert prose-cyan max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  By accessing or using Lunarys (&quot;the Service&quot;, &quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not access or use the Service.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  The Service is a decentralized cross-chain bridge protocol operated as a software interface. We do not custody, control, or manage any user funds or assets at any time.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">2. Eligibility and Restrictions</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">2.1 Age Requirement:</strong> You must be at least 18 years old and legally capable of entering into binding contracts to use this Service.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">2.2 Geographic Restrictions:</strong> The Service is not available to persons or entities who reside in, are located in, are incorporated in, or have registered offices in any Restricted Territory, including but not limited to: United States, North Korea, Iran, Syria, Cuba, Crimea, or any jurisdiction where the Service would be illegal.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  <strong className="text-cyan-400">2.3 Compliance:</strong> You are solely responsible for ensuring compliance with all laws and regulations applicable to your use of the Service in your jurisdiction.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">3. Service Description and Disclaimers</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">3.1 Non-Custodial Service:</strong> Lunarys is a non-custodial software interface. We do not hold, custody, control, or manage user funds. All transactions are executed through smart contracts on public blockchains.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">3.2 Smart Contract Risks:</strong> Smart contracts are experimental technology. Despite security audits, vulnerabilities may exist. Users acknowledge all risks including complete loss of funds due to smart contract failures, exploits, or bugs.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">3.3 No Guarantees:</strong> We provide the Service &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  <strong className="text-cyan-400">3.4 Blockchain Risks:</strong> Blockchain networks may experience congestion, delays, forks, or failures. We are not responsible for any losses resulting from blockchain-related issues.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">4. User Responsibilities</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">4.1 Wallet Security:</strong> You are solely responsible for securing your private keys, seed phrases, and wallet credentials. Loss of these credentials may result in permanent loss of access to your assets.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">4.2 Transaction Verification:</strong> You must verify all transaction details including recipient addresses, amounts, fees, and network selections before confirming any transaction. All blockchain transactions are irreversible.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">4.3 Prohibited Activities:</strong> You agree not to:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mb-4">
                  <li>Use the Service for any illegal activities including money laundering or terrorist financing</li>
                  <li>Attempt to exploit, attack, or interfere with the Service or smart contracts</li>
                  <li>Use the Service to violate any applicable laws or regulations</li>
                  <li>Impersonate any person or entity or misrepresent your affiliation</li>
                  <li>Use automated tools to access the Service without authorization</li>
                </ul>
                <p className="text-gray-300 leading-relaxed">
                  <strong className="text-cyan-400">4.4 Tax Obligations:</strong> You are solely responsible for determining and paying all applicable taxes related to your use of the Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">5. Fees and Costs</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">5.1 Bridge Fees:</strong> The Service charges bridge fees as displayed in the interface. Fees are subject to change without notice.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">5.2 Network Fees:</strong> Users are responsible for all blockchain network fees (gas fees) required to execute transactions.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  <strong className="text-cyan-400">5.3 Third-Party Fees:</strong> Additional fees may be charged by third-party services including wallet providers, liquidity providers, or RPC providers.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">6. Limitation of Liability</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, LUNARYS AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AGENTS, PARTNERS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mb-4">
                  <li>Loss of profits, revenue, data, or use</li>
                  <li>Loss of digital assets or tokens</li>
                  <li>Business interruption or loss of goodwill</li>
                  <li>Any damages resulting from smart contract failures, exploits, or bugs</li>
                  <li>Unauthorized access to or alteration of your transmissions or data</li>
                  <li>Blockchain network failures, forks, or congestion</li>
                  <li>Actions or omissions of third parties including liquidity providers</li>
                  <li>Any other matter relating to the Service</li>
                </ul>
                <p className="text-gray-300 leading-relaxed">
                  IN NO EVENT SHALL OUR TOTAL LIABILITY EXCEED THE AMOUNT OF FEES PAID BY YOU TO US IN THE 12 MONTHS PRIOR TO THE EVENT GIVING RISE TO LIABILITY, OR $100 USD, WHICHEVER IS LESS.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">7. Indemnification</h2>
                <p className="text-gray-300 leading-relaxed">
                  You agree to indemnify, defend, and hold harmless Lunarys and its affiliates, officers, directors, employees, agents, and partners from any claims, damages, losses, liabilities, costs, or expenses (including reasonable attorneys&apos; fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any applicable laws or regulations; or (d) your violation of any rights of any third party.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">8. Privacy and Data</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">8.1 Zero-Knowledge Privacy:</strong> While we implement zero-knowledge technology to protect transaction privacy, all blockchain transactions are publicly visible on-chain.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">8.2 No Data Collection:</strong> We do not collect, store, or process personal data beyond what is necessary for Service functionality.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  <strong className="text-cyan-400">8.3 Blockchain Data:</strong> By using the Service, you acknowledge that transaction data is recorded on public blockchains and may be permanently stored and accessible.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">9. Intellectual Property</h2>
                <p className="text-gray-300 leading-relaxed">
                  All intellectual property rights in the Service, including software, designs, graphics, and content, are owned by Lunarys or its licensors. You are granted a limited, non-exclusive, non-transferable license to access and use the Service in accordance with these Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">10. Modifications and Termination</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">10.1 Service Changes:</strong> We reserve the right to modify, suspend, or discontinue the Service at any time without notice or liability.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">10.2 Terms Updates:</strong> We may update these Terms at any time. Continued use of the Service constitutes acceptance of updated Terms.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  <strong className="text-cyan-400">10.3 Termination:</strong> We may terminate or suspend your access to the Service immediately, without notice, for any reason including violation of these Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">11. Dispute Resolution</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">11.1 Governing Law:</strong> These Terms shall be governed by and construed in accordance with the laws of Switzerland, without regard to conflict of law principles.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">11.2 Arbitration:</strong> Any dispute arising from these Terms or the Service shall be resolved through binding arbitration in accordance with Swiss arbitration rules.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  <strong className="text-cyan-400">11.3 Class Action Waiver:</strong> You agree to bring claims only in your individual capacity and not as part of any class or representative action.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">12. Regulatory Compliance</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">12.1 No Financial Advice:</strong> The Service does not provide financial, investment, legal, or tax advice. You should consult appropriate professionals before using the Service.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-cyan-400">12.2 No Securities:</strong> Nothing on the Service constitutes an offer to sell or solicitation of an offer to buy any securities or regulated financial instruments.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  <strong className="text-cyan-400">12.3 AML/KYC:</strong> We reserve the right to implement anti-money laundering (AML) and know-your-customer (KYC) procedures at any time and may block transactions that appear suspicious.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">13. Force Majeure</h2>
                <p className="text-gray-300 leading-relaxed">
                  We shall not be liable for any failure or delay in performance due to circumstances beyond our reasonable control, including but not limited to acts of God, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, accidents, network infrastructure failures, strikes, or shortages of transportation facilities, fuel, energy, labor, or materials.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">14. Severability</h2>
                <p className="text-gray-300 leading-relaxed">
                  If any provision of these Terms is found to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">15. Entire Agreement</h2>
                <p className="text-gray-300 leading-relaxed">
                  These Terms constitute the entire agreement between you and Lunarys regarding the Service and supersede all prior agreements and understandings, whether written or oral.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">16. Contact Information</h2>
                <p className="text-gray-300 leading-relaxed">
                  For questions about these Terms, please contact us at:
                  <br />
                  <a href="mailto:legal@lunarys.io" className="text-cyan-400 hover:text-cyan-300">
                    legal@lunarys.io
                  </a>
                </p>
              </section>

              <div className="mt-12 p-6 rounded-xl bg-cyan-400/5 border border-cyan-400/20">
                <p className="text-sm text-gray-400 italic">
                  BY USING THE LUNARYS SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE. IF YOU DO NOT AGREE TO THESE TERMS, YOU MUST NOT ACCESS OR USE THE SERVICE.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-cyan-400/10 bg-black/80 backdrop-blur-md mt-20">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/iso-logo.svg"
                alt="Lunarys Logo"
                className="w-8 h-8 animate-spin-slow"
              />
              <span className="text-xl font-bold tracking-tight text-white">
                LUNARYS
              </span>
            </div>
            <p className="text-gray-500 text-sm">
              © 2025 Lunarys. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

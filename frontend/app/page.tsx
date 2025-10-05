"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { Footer } from "@/components/footer";

export default function Home() {
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
    <div className="relative bg-black text-white overflow-x-hidden">
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
            <a
              href="#features"
              className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 font-medium"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 font-medium"
            >
              How It Works
            </a>
            <a
              href="#docs"
              className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 font-medium"
            >
              Docs
            </a>
            <Link href="/bridge">
              <Button className="bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black font-semibold hover:shadow-[0_0_30px_rgba(0,255,255,0.5)] hover:scale-105 transition-all duration-300">
                Launch App
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-6xl mx-auto text-center space-y-8">
          <div className="space-y-6 animate-fade-in-up">
            <Badge variant="outline" className="border-cyan-400/30 bg-cyan-400/5 text-cyan-400 hover:bg-cyan-400/10 px-4 py-2 text-sm font-semibold tracking-wide mb-4">
              Powered by Zero-Knowledge Technology
            </Badge>

            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-none">
              The Future of
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500 animate-gradient">
                Encrypted Bridging
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Experience{" "}
              <span className="text-white font-semibold">
                zero-knowledge privacy
              </span>{" "}
              meets instant liquidity. Transfer assets across chains with{" "}
              <span className="text-cyan-400 font-semibold">
                Arcium-grade encryption
              </span>{" "}
              — your bridge, your data,{" "}
              <span className="text-white font-semibold">
                completely private
              </span>
              .
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8 animate-fade-in-up animation-delay-200">
            <Link href="/bridge">
              <Button size="lg" className="group px-10 py-7 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black font-bold text-lg hover:shadow-[0_0_50px_rgba(0,255,255,0.8)] hover:scale-105 transition-all duration-300">
                Start Bridging Now
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>

            <Link href="/bridge">
              <Button size="lg" variant="outline" className="px-10 py-7 border-2 border-cyan-400/40 hover:bg-cyan-400/10 hover:border-cyan-400/80 backdrop-blur-sm font-bold text-lg text-white hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]">
                View Demo
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-20 animate-fade-in-up animation-delay-400">
            <Card className="border-cyan-400/20 bg-gradient-to-br from-cyan-400/5 to-transparent backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:scale-105">
              <CardContent className="p-8 text-center">
                <Shield className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                <div className="text-5xl font-bold text-cyan-400 mb-2">100%</div>
                <div className="text-gray-400 text-lg">Private & Encrypted</div>
              </CardContent>
            </Card>

            <Card className="border-cyan-400/20 bg-gradient-to-br from-cyan-400/5 to-transparent backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:scale-105">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                <div className="text-5xl font-bold text-cyan-400 mb-2">Zero</div>
                <div className="text-gray-400 text-lg">Data Leaks</div>
              </CardContent>
            </Card>

            <Card className="border-cyan-400/20 bg-gradient-to-br from-cyan-400/5 to-transparent backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:scale-105">
              <CardContent className="p-8 text-center">
                <Zap className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                <div className="text-5xl font-bold text-cyan-400 mb-2">
                  &lt;1s
                </div>
                <div className="text-gray-400 text-lg">Settlement Time</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 animate-fade-in-up">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Why Choose{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-500">
                Lunarys
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Built with cutting-edge technology for maximum security and speed
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group p-8 rounded-3xl border border-cyan-400/10 bg-black/40 backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:shadow-[0_0_40px_rgba(0,255,255,0.15)] hover:-translate-y-2">
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-cyan-400/5 group-hover:from-cyan-400/30 group-hover:to-cyan-400/10 transition-all duration-500">
                  <svg
                    className="w-12 h-12 text-cyan-400 group-hover:scale-110 transition-transform duration-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-cyan-400 transition-colors">
                Military-Grade Privacy
              </h3>
              <p className="text-gray-400 leading-relaxed text-lg">
                Every transaction is encrypted end-to-end with{" "}
                <span className="text-cyan-400">
                  Arcium&apos;s confidential computing
                </span>
                . No one sees your moves — not even us.
              </p>
            </div>

            <div className="group p-8 rounded-3xl border border-cyan-400/10 bg-black/40 backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:shadow-[0_0_40px_rgba(0,255,255,0.15)] hover:-translate-y-2">
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-cyan-400/5 group-hover:from-cyan-400/30 group-hover:to-cyan-400/10 transition-all duration-500">
                  <svg
                    className="w-12 h-12 text-cyan-400 group-hover:scale-110 transition-transform duration-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M13 2.05v3.03c3.39.49 6 3.39 6 6.92 0 .9-.18 1.75-.48 2.54l2.6 1.53c.56-1.24.88-2.62.88-4.07 0-5.18-3.95-9.45-9-9.95zM12 19c-3.87 0-7-3.13-7-7 0-3.53 2.61-6.43 6-6.92V2.05c-5.06.5-9 4.76-9 9.95 0 5.52 4.47 10 9.99 10 3.31 0 6.24-1.61 8.06-4.09l-2.6-1.53C16.17 17.98 14.21 19 12 19z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-cyan-400 transition-colors">
                Instant Settlement
              </h3>
              <p className="text-gray-400 leading-relaxed text-lg">
                Powered by{" "}
                <span className="text-cyan-400">
                  Raydium&apos;s deep liquidity
                </span>{" "}
                and{" "}
                <span className="text-cyan-400">
                  Triton&apos;s RPC infrastructure
                </span>{" "}
                for sub-second cross-chain transfers.
              </p>
            </div>

            <div className="group p-8 rounded-3xl border border-cyan-400/10 bg-black/40 backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:shadow-[0_0_40px_rgba(0,255,255,0.15)] hover:-translate-y-2">
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-cyan-400/5 group-hover:from-cyan-400/30 group-hover:to-cyan-400/10 transition-all duration-500">
                  <svg
                    className="w-12 h-12 text-cyan-400 group-hover:scale-110 transition-transform duration-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-cyan-400 transition-colors">
                Truly Trustless
              </h3>
              <p className="text-gray-400 leading-relaxed text-lg">
                No intermediaries, no custodians.{" "}
                <span className="text-cyan-400">Smart contracts</span> execute
                automatically. You hold the keys, you control the funds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              How It{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-500">
                Works
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Bridge your assets in three simple steps with complete privacy
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-400/50 via-cyan-400/30 to-transparent hidden md:block" />

            <div className="space-y-24">
              {/* Step 1 */}
              <div className="relative flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 md:text-right">
                  <div className="p-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/5 to-transparent backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:shadow-[0_0_40px_rgba(0,255,255,0.15)]">
                    <h3 className="text-3xl font-bold mb-4 text-white">
                      Connect Your Wallet
                    </h3>
                    <p className="text-gray-400 text-lg leading-relaxed">
                      Connect your Solana wallet to get started. Fully
                      compatible with Phantom, Solflare, and all major Solana
                      wallets.
                    </p>
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-400 shadow-[0_0_30px_rgba(0,255,255,0.5)] flex-shrink-0">
                  <span className="text-2xl font-bold text-black">1</span>
                </div>

                <div className="flex-1 md:hidden" />
              </div>

              {/* Step 2 */}
              <div className="relative flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 md:hidden" />

                <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-400 shadow-[0_0_30px_rgba(0,255,255,0.5)] flex-shrink-0">
                  <span className="text-2xl font-bold text-black">2</span>
                </div>

                <div className="flex-1">
                  <div className="p-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/5 to-transparent backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:shadow-[0_0_40px_rgba(0,255,255,0.15)]">
                    <h3 className="text-3xl font-bold mb-4 text-white">
                      Select & Encrypt
                    </h3>
                    <p className="text-gray-400 text-lg leading-relaxed">
                      Choose your asset and destination chain. Arcium&apos;s MXE
                      encrypts your transaction data with zero-knowledge proofs
                      before processing.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 md:text-right">
                  <div className="p-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/5 to-transparent backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:shadow-[0_0_40px_rgba(0,255,255,0.15)]">
                    <h3 className="text-3xl font-bold mb-4 text-white">
                      Receive Instantly
                    </h3>
                    <p className="text-gray-400 text-lg leading-relaxed">
                      Assets arrive on the destination chain instantly via
                      Raydium&apos;s liquidity pools. Completely private,
                      secure, and untraceable.
                    </p>
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-400 shadow-[0_0_30px_rgba(0,255,255,0.5)] flex-shrink-0">
                  <span className="text-2xl font-bold text-black">3</span>
                </div>

                <div className="flex-1 md:hidden" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built on Solana */}
      <section className="relative z-10 py-32 px-6 bg-gradient-to-b from-transparent via-cyan-400/5 to-transparent">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Built on{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-500">
                Solana
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Leveraging Solana&apos;s high-speed, low-cost infrastructure for
              seamless cross-chain bridging
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-transparent backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,255,0.2)] text-center">
              <div className="text-5xl font-bold text-cyan-400 mb-3">
                65,000+
              </div>
              <div className="text-gray-400 text-lg">TPS Capacity</div>
            </div>

            <div className="p-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-transparent backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,255,0.2)] text-center">
              <div className="text-5xl font-bold text-cyan-400 mb-3">
                $0.00025
              </div>
              <div className="text-gray-400 text-lg">Average Fee</div>
            </div>

            <div className="p-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-transparent backdrop-blur-sm hover:border-cyan-400/40 transition-all duration-500 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,255,0.2)] text-center">
              <div className="text-5xl font-bold text-cyan-400 mb-3">400ms</div>
              <div className="text-gray-400 text-lg">Block Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/10 to-transparent backdrop-blur-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent animate-shimmer" />

            <h2 className="text-5xl md:text-6xl font-bold mb-6 relative z-10">
              Ready to Bridge with
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-500">
                Complete Privacy?
              </span>
            </h2>

            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto relative z-10">
              Join thousands of users who trust Lunarys for secure, private, and
              instant cross-chain transfers.
            </p>

            <Link href="/bridge">
              <Button size="lg" className="group px-12 py-8 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 font-bold text-xl text-black hover:shadow-[0_0_60px_rgba(0,255,255,0.9)] hover:scale-110 transition-all duration-300 relative z-10">
                Launch App Now
                <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-2 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Powered By */}
      <section className="relative z-10 py-16 px-6">
        <div className="flex items-center justify-center w-full">
          <div className="inline-flex flex-col items-center gap-4">
            <span className="text-sm text-gray-500 tracking-widest">
              POWERED BY
            </span>
            <div className="flex gap-8 items-center">
              <a
                href="#"
                className="text-gray-400 font-bold text-lg hover:text-cyan-400 transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,255,0.4)] px-4 py-2 rounded-lg"
              >
                Arcium
              </a>
              <span className="text-gray-600">•</span>
              <a
                href="#"
                className="text-gray-400 font-bold text-lg hover:text-cyan-400 transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,255,0.4)] px-4 py-2 rounded-lg"
              >
                Raydium
              </a>
              <span className="text-gray-600">•</span>
              <a
                href="#"
                className="text-gray-400 font-bold text-lg hover:text-cyan-400 transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,255,0.4)] px-4 py-2 rounded-lg"
              >
                Triton
              </a>
            </div>
            <div className="h-px w-64 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowDownUp, Shield, Clock, Zap } from "lucide-react";
import { Footer } from "@/components/footer";

export default function BridgePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fromChain, setFromChain] = useState("solana");
  const [toChain, setToChain] = useState("ethereum");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("SOL");

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

  const handleSwapChains = () => {
    const temp = fromChain;
    setFromChain(toChain);
    setToChain(temp);
  };

  return (
    <div className="relative bg-black text-white min-h-screen overflow-x-hidden flex flex-col">
      <canvas ref={canvasRef} className="fixed inset-0 z-0" />

      <div className="fixed inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70 z-[1] pointer-events-none" />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/30 border-b border-cyan-400/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/iso-logo.svg"
              alt="Lunarys Logo"
              className="w-8 h-8 sm:w-10 sm:h-10 animate-spin-slow"
            />
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              LUNARYS
            </span>
          </Link>

          <div className="flex items-center gap-4 sm:gap-8">
            <span className="text-cyan-400 font-semibold text-sm sm:text-base">
              Bridge
            </span>
            <Link
              href="/#docs"
              className="hidden sm:block text-gray-300 hover:text-cyan-400 transition-colors duration-300 font-medium"
            >
              Docs
            </Link>
            <Button className="bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black font-semibold hover:shadow-[0_0_30px_rgba(0,255,255,0.5)] hover:scale-105 transition-all duration-300 text-sm sm:text-base px-4 sm:px-6">
              Connect Wallet
            </Button>
          </div>
        </div>
      </nav>

      {/* Bridge Section */}
      <section className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-8">
        <div className="w-full max-w-6xl">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8 animate-fade-in-up">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-500">
                Bridge Assets
              </span>
            </h1>
            <p className="text-gray-400 text-sm sm:text-base md:text-lg">
              Transfer your assets across chains with complete privacy
            </p>
          </div>

          {/* Main Bridge Card - Wide Layout */}
          <Card className="border-cyan-400/20 bg-black/40 backdrop-blur-xl shadow-[0_0_60px_rgba(0,255,255,0.1)] animate-fade-in-up animation-delay-200">
            <CardContent className="p-4 sm:p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                {/* Left Column - From/To */}
                <div className="space-y-4">
                  {/* From Chain */}
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-400 font-medium">From</Label>
                    <Card className="border-cyan-400/20 bg-gradient-to-br from-cyan-400/5 to-transparent hover:border-cyan-400/40 transition-all duration-300">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <Select value={fromChain} onValueChange={setFromChain}>
                            <SelectTrigger className="w-[120px] border-0 bg-transparent text-base font-semibold text-white focus:ring-0 focus:ring-offset-0 hover:text-cyan-400">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-black border-cyan-400/30">
                              <SelectItem value="solana" className="text-white hover:text-cyan-400">Solana</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select value={selectedToken} onValueChange={setSelectedToken}>
                            <SelectTrigger className="w-[100px] bg-cyan-400/10 border-cyan-400/30 text-white font-semibold hover:bg-cyan-400/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-black border-cyan-400/30">
                              <SelectItem value="SOL" className="text-white hover:text-cyan-400">SOL</SelectItem>
                              <SelectItem value="USDC" className="text-white hover:text-cyan-400">USDC</SelectItem>
                              <SelectItem value="USDT" className="text-white hover:text-cyan-400">USDT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Input
                          type="text"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          className="text-2xl sm:text-3xl font-bold bg-transparent border-0 text-white placeholder-gray-600 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
                        />

                        <div className="flex justify-between items-center">
                          <span className="text-xs sm:text-sm text-gray-500">
                            Balance: 0.00 {selectedToken}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10 h-auto p-1 font-semibold text-xs"
                          >
                            MAX
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Swap Button - Horizontal on mobile */}
                  <div className="flex justify-center lg:hidden">
                    <Button
                      onClick={handleSwapChains}
                      variant="outline"
                      size="icon"
                      className="rounded-xl border-2 border-cyan-400/30 bg-black hover:bg-cyan-400/10 hover:border-cyan-400/60 transition-all duration-300 hover:scale-110 hover:rotate-180"
                    >
                      <ArrowDownUp className="h-5 w-5 text-cyan-400" />
                    </Button>
                  </div>

                  {/* To Chain */}
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-400 font-medium">To</Label>
                    <Card className="border-cyan-400/20 bg-gradient-to-br from-cyan-400/5 to-transparent hover:border-cyan-400/40 transition-all duration-300">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <Select value={toChain} onValueChange={setToChain}>
                            <SelectTrigger className="w-[120px] border-0 bg-transparent text-base font-semibold text-white focus:ring-0 focus:ring-offset-0 hover:text-cyan-400">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-black border-cyan-400/30">
                              <SelectItem value="ethereum" className="text-white hover:text-cyan-400">Ethereum</SelectItem>
                              <SelectItem value="polygon" className="text-white hover:text-cyan-400">Polygon</SelectItem>
                              <SelectItem value="arbitrum" className="text-white hover:text-cyan-400">Arbitrum</SelectItem>
                              <SelectItem value="optimism" className="text-white hover:text-cyan-400">Optimism</SelectItem>
                            </SelectContent>
                          </Select>

                          <Badge className="bg-cyan-400/10 border-cyan-400/30 text-white hover:bg-cyan-400/20 px-3 py-1">
                            {selectedToken}
                          </Badge>
                        </div>

                        <div className="text-2xl sm:text-3xl font-bold text-white">
                          {amount || "0.00"}
                        </div>

                        <div className="text-xs sm:text-sm text-gray-500">
                          You will receive: ~{amount || "0.00"} {selectedToken}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Right Column - Info & Actions */}
                <div className="space-y-4 flex flex-col">
                  {/* Bridge Info */}
                  <Card className="border-cyan-400/10 bg-cyan-400/5 flex-1">
                    <CardContent className="p-4 space-y-2">
                      <h3 className="text-sm font-semibold text-white mb-3">Bridge Details</h3>
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>Time</span>
                        </div>
                        <span className="text-white font-semibold">~30s</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Bridge Fee</span>
                        <span className="text-white font-semibold">0.1%</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Network Fee</span>
                        <span className="text-white font-semibold">~$0.01</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Privacy Badge */}
                  <Card className="border-cyan-400/20 bg-gradient-to-r from-cyan-400/10 to-cyan-500/10">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs sm:text-sm text-cyan-400 font-semibold">
                            Zero-Knowledge Privacy
                          </p>
                          <p className="text-xs text-gray-400">
                            Encrypted with Arcium
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stats Row - Desktop */}
                  <div className="hidden lg:grid grid-cols-3 gap-2">
                    <Card className="border-cyan-400/10 bg-black/30 backdrop-blur-sm hover:border-cyan-400/30 transition-all text-center">
                      <CardContent className="p-3">
                        <Zap className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                        <div className="text-lg font-bold text-cyan-400">&lt;1s</div>
                        <div className="text-xs text-gray-400">Fast</div>
                      </CardContent>
                    </Card>
                    <Card className="border-cyan-400/10 bg-black/30 backdrop-blur-sm hover:border-cyan-400/30 transition-all text-center">
                      <CardContent className="p-3">
                        <Shield className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                        <div className="text-lg font-bold text-cyan-400">100%</div>
                        <div className="text-xs text-gray-400">Private</div>
                      </CardContent>
                    </Card>
                    <Card className="border-cyan-400/10 bg-black/30 backdrop-blur-sm hover:border-cyan-400/30 transition-all text-center">
                      <CardContent className="p-3">
                        <Shield className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                        <div className="text-lg font-bold text-cyan-400">Zero</div>
                        <div className="text-xs text-gray-400">Leaks</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Bridge Button */}
                  <Button
                    className="w-full h-12 sm:h-14 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black font-bold text-base sm:text-lg hover:shadow-[0_0_40px_rgba(0,255,255,0.6)] hover:scale-[1.02] transition-all duration-300"
                  >
                    Bridge Assets
                  </Button>

                  <p className="text-xs text-center text-gray-500">
                    By bridging, you agree to our{" "}
                    <Link href="/terms" className="text-cyan-400 hover:text-cyan-300">
                      Terms of Service
                    </Link>
                  </p>
                </div>
              </div>

              {/* Stats Row - Mobile */}
              <div className="grid lg:hidden grid-cols-3 gap-3 mt-4">
                <Card className="border-cyan-400/10 bg-black/30 backdrop-blur-sm hover:border-cyan-400/30 transition-all text-center">
                  <CardContent className="p-3">
                    <Zap className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-cyan-400">&lt;1s</div>
                    <div className="text-xs text-gray-400">Fast</div>
                  </CardContent>
                </Card>
                <Card className="border-cyan-400/10 bg-black/30 backdrop-blur-sm hover:border-cyan-400/30 transition-all text-center">
                  <CardContent className="p-3">
                    <Shield className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-cyan-400">100%</div>
                    <div className="text-xs text-gray-400">Private</div>
                  </CardContent>
                </Card>
                <Card className="border-cyan-400/10 bg-black/30 backdrop-blur-sm hover:border-cyan-400/30 transition-all text-center">
                  <CardContent className="p-3">
                    <Shield className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-cyan-400">Zero</div>
                    <div className="text-xs text-gray-400">Leaks</div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}

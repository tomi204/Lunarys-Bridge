"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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
            <span className="text-cyan-400 font-semibold">
              Bridge
            </span>
            <Link
              href="/#docs"
              className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 font-medium"
            >
              Docs
            </Link>
            <button className="px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 transition-all duration-300 font-semibold text-black hover:shadow-[0_0_30px_rgba(0,255,255,0.5)] hover:scale-105">
              Connect Wallet
            </button>
          </div>
        </div>
      </nav>

      {/* Bridge Section */}
      <section className="relative z-10 min-h-[calc(100vh-80px)] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-8 animate-fade-in-up">
            <h1 className="text-5xl font-bold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-500">
                Bridge Assets
              </span>
            </h1>
            <p className="text-gray-400 text-lg">
              Transfer your assets across chains with complete privacy
            </p>
          </div>

          {/* Bridge Card */}
          <div className="p-8 rounded-3xl border border-cyan-400/20 bg-black/40 backdrop-blur-xl shadow-[0_0_60px_rgba(0,255,255,0.1)] animate-fade-in-up animation-delay-200">
            {/* From Chain */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-3 font-medium">
                From
              </label>
              <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-400/5 to-transparent border border-cyan-400/20 hover:border-cyan-400/40 transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                  <select
                    value={fromChain}
                    onChange={(e) => setFromChain(e.target.value)}
                    className="bg-transparent text-white text-lg font-semibold outline-none cursor-pointer hover:text-cyan-400 transition-colors"
                  >
                    <option value="solana" className="bg-black">
                      Solana
                    </option>
                  </select>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedToken}
                      onChange={(e) => setSelectedToken(e.target.value)}
                      className="bg-cyan-400/10 px-4 py-2 rounded-xl border border-cyan-400/30 text-white font-semibold outline-none cursor-pointer hover:bg-cyan-400/20 transition-all"
                    >
                      <option value="SOL" className="bg-black">
                        SOL
                      </option>
                      <option value="USDC" className="bg-black">
                        USDC
                      </option>
                      <option value="USDT" className="bg-black">
                        USDT
                      </option>
                    </select>
                  </div>
                </div>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent text-3xl font-bold text-white outline-none placeholder-gray-600"
                />
                <div className="flex justify-between items-center mt-4">
                  <span className="text-sm text-gray-500">
                    Balance: 0.00 {selectedToken}
                  </span>
                  <button className="text-sm text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
                    MAX
                  </button>
                </div>
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-3 relative z-10">
              <button
                onClick={handleSwapChains}
                className="p-3 rounded-xl bg-black border-2 border-cyan-400/30 hover:border-cyan-400/60 hover:bg-cyan-400/10 transition-all duration-300 hover:scale-110 hover:rotate-180"
              >
                <svg
                  className="w-6 h-6 text-cyan-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
              </button>
            </div>

            {/* To Chain */}
            <div className="mb-8">
              <label className="block text-sm text-gray-400 mb-3 font-medium">
                To
              </label>
              <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-400/5 to-transparent border border-cyan-400/20 hover:border-cyan-400/40 transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                  <select
                    value={toChain}
                    onChange={(e) => setToChain(e.target.value)}
                    className="bg-transparent text-white text-lg font-semibold outline-none cursor-pointer hover:text-cyan-400 transition-colors"
                  >
                    <option value="ethereum" className="bg-black">
                      Ethereum
                    </option>
                    <option value="polygon" className="bg-black">
                      Polygon
                    </option>
                    <option value="arbitrum" className="bg-black">
                      Arbitrum
                    </option>
                    <option value="optimism" className="bg-black">
                      Optimism
                    </option>
                  </select>
                  <div className="px-4 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30">
                    <span className="text-white font-semibold">
                      {selectedToken}
                    </span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">
                  {amount || "0.00"}
                </div>
                <div className="mt-4">
                  <span className="text-sm text-gray-500">
                    You will receive: ~{amount || "0.00"} {selectedToken}
                  </span>
                </div>
              </div>
            </div>

            {/* Bridge Info */}
            <div className="mb-8 p-4 rounded-xl bg-cyan-400/5 border border-cyan-400/10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Estimated Time</span>
                <span className="text-sm text-white font-semibold">
                  ~30 seconds
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Bridge Fee</span>
                <span className="text-sm text-white font-semibold">
                  0.1%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Network Fee</span>
                <span className="text-sm text-white font-semibold">
                  ~$0.01
                </span>
              </div>
            </div>

            {/* Privacy Badge */}
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-cyan-400/10 to-cyan-500/10 border border-cyan-400/20">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-cyan-400 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
                <div>
                  <p className="text-sm text-cyan-400 font-semibold">
                    Zero-Knowledge Privacy Enabled
                  </p>
                  <p className="text-xs text-gray-400">
                    Your transaction is encrypted with Arcium technology
                  </p>
                </div>
              </div>
            </div>

            {/* Bridge Button */}
            <button className="w-full py-5 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 transition-all duration-300 font-bold text-lg text-black hover:shadow-[0_0_40px_rgba(0,255,255,0.6)] hover:scale-[1.02] transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
              Bridge Assets
            </button>

            {/* Additional Info */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                By bridging, you agree to our{" "}
                <a href="/terms" className="text-cyan-400 hover:text-cyan-300">
                  Terms of Service
                </a>
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 mt-8 animate-fade-in-up animation-delay-400">
            <div className="text-center p-4 rounded-xl border border-cyan-400/10 bg-black/30 backdrop-blur-sm hover:border-cyan-400/30 transition-all">
              <div className="text-2xl font-bold text-cyan-400 mb-1">
                &lt;1s
              </div>
              <div className="text-xs text-gray-400">Settlement</div>
            </div>
            <div className="text-center p-4 rounded-xl border border-cyan-400/10 bg-black/30 backdrop-blur-sm hover:border-cyan-400/30 transition-all">
              <div className="text-2xl font-bold text-cyan-400 mb-1">100%</div>
              <div className="text-xs text-gray-400">Private</div>
            </div>
            <div className="text-center p-4 rounded-xl border border-cyan-400/10 bg-black/30 backdrop-blur-sm hover:border-cyan-400/30 transition-all">
              <div className="text-2xl font-bold text-cyan-400 mb-1">Zero</div>
              <div className="text-xs text-gray-400">Data Leaks</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-cyan-400/10 bg-black/80 backdrop-blur-md">
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

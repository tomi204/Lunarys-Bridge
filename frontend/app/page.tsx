"use client";

import { useEffect, useRef } from "react";

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

    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.2,
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

          if (distance < 120) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0, 255, 255, ${
              0.15 * (1 - distance / 120)
            })`;
            ctx.lineWidth = 1;
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
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black z-[1]" />

      <nav className="relative z-10 flex justify-between items-center px-8 py-6">
        <div className="flex items-center gap-3">
          <img src="/iso-logo.svg" alt="Lunarys Logo" className="w-10 h-10" />
          <span className="text-2xl font-bold tracking-tight text-white">
            LUNARYS
          </span>
        </div>

        <div className="flex items-center gap-8">
          <a
            href="#docs"
            className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 font-medium"
          >
            Docs
          </a>
          <button className="px-6 py-2.5 rounded-full border border-cyan-400/30 hover:bg-cyan-400/10 transition-all duration-300 hover:border-cyan-400/60 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]">
            Launch App
          </button>
        </div>
      </nav>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-88px)] px-6">
        <div className="max-w-6xl mx-auto text-center space-y-8">
          <div className="space-y-4 animate-fade-in-up">
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
            <button className="group px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 transition-all duration-300 font-semibold text-black hover:shadow-[0_0_40px_rgba(0,255,255,0.6)] hover:scale-105 transform">
              Start Bridging Now
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">
                →
              </span>
            </button>

            <button className="px-8 py-4 rounded-full border border-cyan-400/30 hover:bg-cyan-400/5 transition-all duration-300 hover:border-cyan-400/60 backdrop-blur-sm">
              View Demo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-20 animate-fade-in-up animation-delay-400">
            <div className="group p-6 rounded-2xl border border-cyan-400/10 bg-black/40 backdrop-blur-sm hover:border-cyan-400/30 transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]">
              <div className="flex justify-center mb-4">
                <svg
                  className="w-10 h-10 text-cyan-400 group-hover:scale-110 transition-transform duration-300"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">
                Military-Grade Privacy
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Every transaction is encrypted end-to-end with{" "}
                <span className="text-cyan-400">
                  Arcium&apos;s confidential computing
                </span>
                . No one sees your moves — not even us.
              </p>
            </div>

            <div className="group p-6 rounded-2xl border border-cyan-400/10 bg-black/40 backdrop-blur-sm hover:border-cyan-400/30 transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]">
              <div className="flex justify-center mb-4">
                <svg
                  className="w-10 h-10 text-cyan-400 group-hover:scale-110 transition-transform duration-300"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M13 2.05v3.03c3.39.49 6 3.39 6 6.92 0 .9-.18 1.75-.48 2.54l2.6 1.53c.56-1.24.88-2.62.88-4.07 0-5.18-3.95-9.45-9-9.95zM12 19c-3.87 0-7-3.13-7-7 0-3.53 2.61-6.43 6-6.92V2.05c-5.06.5-9 4.76-9 9.95 0 5.52 4.47 10 9.99 10 3.31 0 6.24-1.61 8.06-4.09l-2.6-1.53C16.17 17.98 14.21 19 12 19z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">
                Instant Settlement
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Powered by{" "}
                <span className="text-cyan-400">Raydium&apos;s deep liquidity</span>{" "}
                and{" "}
                <span className="text-cyan-400">
                  Triton&apos;s RPC infrastructure
                </span>{" "}
                for sub-second cross-chain transfers.
              </p>
            </div>

            <div className="group p-6 rounded-2xl border border-cyan-400/10 bg-black/40 backdrop-blur-sm hover:border-cyan-400/30 transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]">
              <div className="flex justify-center mb-4">
                <svg
                  className="w-10 h-10 text-cyan-400 group-hover:scale-110 transition-transform duration-300"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">
                Truly Trustless
              </h3>
              <p className="text-gray-400 leading-relaxed">
                No intermediaries, no custodians.{" "}
                <span className="text-cyan-400">Smart contracts</span> execute
                automatically. You hold the keys, you control the funds.
              </p>
            </div>
          </div>

          <div className="pt-16 animate-fade-in-up animation-delay-600">
            <div className="flex items-center justify-center w-full px-8">
              <div className="inline-flex flex-col items-center gap-3">
                <span className="text-sm text-gray-500 tracking-wider">
                  POWERED BY
                </span>
                <div className="flex gap-6 items-center group">
                  <a
                    href="#"
                    className="text-gray-400 font-semibold hover:text-cyan-400 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]"
                  >
                    Arcium
                  </a>
                  <span className="text-gray-600">•</span>
                  <a
                    href="#"
                    className="text-gray-400 font-semibold hover:text-cyan-400 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]"
                  >
                    Raydium
                  </a>
                  <span className="text-gray-600">•</span>
                  <a
                    href="#"
                    className="text-gray-400 font-semibold hover:text-cyan-400 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]"
                  >
                    Triton
                  </a>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent"></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-cyan-400/10 bg-black/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
            <div className="col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="/iso-logo.svg"
                  alt="Lunarys Logo"
                  className="w-8 h-8"
                />
                <span className="text-xl font-bold tracking-tight text-white">
                  LUNARYS
                </span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                The next generation of encrypted cross-chain bridging powered by
                zero-knowledge technology.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    Bridge
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    Analytics
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    Security
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#docs"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="#blog"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    API Reference
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    Careers
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Community</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    Twitter
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    Telegram
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    Discord
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-cyan-400/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © 2025 Lunarys. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a
                href="#"
                className="text-gray-500 hover:text-cyan-400 transition-colors text-sm"
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-cyan-400 transition-colors text-sm"
              >
                Terms of Service
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-cyan-400 transition-colors text-sm"
              >
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

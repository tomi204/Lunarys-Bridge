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
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 relative">
            <div className="absolute inset-0 animate-spin-slow">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400"
                  style={{
                    top: "50%",
                    left: "50%",
                    transform: `rotate(${i * 45}deg) translateY(-${
                      16 - i * 1.5
                    }px)`,
                    opacity: 1 - i * 0.1,
                  }}
                />
              ))}
            </div>
          </div>
          <span className="text-2xl font-bold tracking-tight">
            LUNAR<span className="text-cyan-400">YS</span>
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
            <div className="flex items-center justify-between max-w-4xl mx-auto opacity-60">
              <div className="flex items-center gap-8">
                <span className="text-sm text-gray-500 tracking-wider">
                  POWERED BY
                </span>
                <div className="flex gap-6 items-center">
                  <span className="text-gray-400 font-semibold">Arcium</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400 font-semibold">Raydium</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400 font-semibold">Triton</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <a
                  href="#"
                  className="text-gray-500 hover:text-cyan-400 transition-colors duration-300 hover:scale-110 transform"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="text-gray-500 hover:text-cyan-400 transition-colors duration-300 hover:scale-110 transform"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="text-gray-500 hover:text-cyan-400 transition-colors duration-300 hover:scale-110 transform"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.67-.52.36-.99.53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.48 1.03-.73 4.04-1.76 6.74-2.92 8.09-3.49 3.85-1.62 4.65-1.9 5.17-1.91.11 0 .37.03.54.17.14.12.18.27.2.38.01.06.03.24.02.38z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="text-gray-500 hover:text-cyan-400 transition-colors duration-300 hover:scale-110 transform"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

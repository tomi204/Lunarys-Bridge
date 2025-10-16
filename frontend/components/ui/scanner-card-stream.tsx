"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import * as THREE from "three";

// --- Token SVG Components ---
const USDCToken = () => (
  <svg
    viewBox="0 0 2000 2000"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <circle cx="1000" cy="1000" r="1000" fill="#2775CA" />
    <path
      fill="#fff"
      d="M1275 1158.33c0-145.83-87.5-195.83-262.5-216.66-125-16.67-150-50-150-108.34s41.67-95.83 125-95.83c75 0 116.67 25 137.5 87.5 4.17 12.5 16.67 20.83 29.17 20.83h66.66c16.67 0 29.17-12.5 29.17-29.16v-4.17c-16.67-91.67-91.67-162.5-187.5-170.83v-100c0-16.67-12.5-29.17-33.33-33.34h-62.5c-16.67 0-29.17 12.5-33.34 33.34v95.83c-125 16.67-204.16 100-204.16 204.17 0 137.5 83.33 191.66 258.33 212.5 116.67 20.83 154.17 45.83 154.17 112.5s-58.34 112.5-137.5 112.5c-108.34 0-145.84-45.84-158.34-108.34-4.16-16.66-16.66-25-29.16-25h-70.84c-16.66 0-29.16 12.5-29.16 29.17v4.17c16.66 104.16 83.33 179.16 220.83 200v100c0 16.66 12.5 29.16 33.33 33.33h62.5c16.67 0 29.17-12.5 33.34-33.33v-100c125-20.84 208.33-108.34 208.33-220.84z"
    />
    <path
      fill="#fff"
      d="M787.5 1595.83c-325-116.66-491.67-479.16-370.83-800 62.5-175 200-308.33 370.83-370.83 16.67-8.33 25-20.83 25-41.67V325c0-16.67-8.33-29.17-25-33.33-4.17 0-12.5 0-16.67 4.16-395.83 125-612.5 545.84-487.5 941.67 75 233.33 254.17 412.5 487.5 487.5 16.67 8.33 33.34 0 37.5-16.67 4.17-4.16 4.17-8.33 4.17-16.66v-58.34c0-12.5-12.5-29.16-25-37.5zM1229.17 295.83c-16.67-8.33-33.34 0-37.5 16.67-4.17 4.17-4.17 8.33-4.17 16.67v58.33c0 16.67 12.5 33.33 25 41.67 325 116.66 491.67 479.16 370.83 800-62.5 175-200 308.33-370.83 370.83-16.67 8.33-25 20.83-25 41.67V1700c0 16.67 8.33 29.17 25 33.33 4.17 0 12.5 0 16.67-4.16 395.83-125 612.5-545.84 487.5-941.67-75-237.5-258.34-416.67-487.5-491.67z"
    />
  </svg>
);


// Get chain display names
const getChainName = (chain: string) => {
  if (chain.includes("solana")) return "Solana Devnet";
  if (chain.includes("sepolia")) return "Sepolia";
  if (chain.includes("ethereum")) return "Ethereum";
  return chain;
};

// --- Helper function to generate ASCII-like code ---
const ASCII_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789(){}[]<>;:,._-+=!@#$%^&*|\\/\"'`~?";
const generateCode = (width: number, height: number): string => {
  let text = "";
  for (let i = 0; i < width * height; i++) {
    text += ASCII_CHARS[Math.floor(Math.random() * ASCII_CHARS.length)];
  }
  let out = "";
  for (let i = 0; i < height; i++) {
    out += text.substring(i * width, (i + 1) * width) + "\n";
  }
  return out;
};

// --- Component Props Type Definition ---
type ScannerCardStreamProps = {
  initialSpeed?: number;
  direction?: -1 | 1;
  repeat?: number;
  cardGap?: number;
  friction?: number;
  scanEffect?: "clip" | "scramble";
  fromChain?: string;
  toChain?: string;
  tokenSymbol?: string;
};

// --- The Main Component ---
const ScannerCardStream = ({
  initialSpeed = 150,
  direction = -1,
  repeat = 8,
  cardGap = 60,
  friction = 0.95,
  scanEffect = "scramble",
  fromChain = "solana-devnet",
  toChain = "sepolia",
  tokenSymbol = "USDC",
}: ScannerCardStreamProps) => {
  const fromChainName = useMemo(() => getChainName(fromChain), [fromChain]);
  const toChainName = useMemo(() => getChainName(toChain), [toChain]);

  const [isPaused] = useState(false);
  const [isScanning, setIsScanning] = useState(false); // New state for scanner visibility

  const cards = useMemo(() => {
    const totalCards = repeat;
    return Array.from({ length: totalCards }, (_, i) => ({
      id: i,
      tokenType: "usdc",
      displayName: tokenSymbol,
      ascii: generateCode(Math.floor(400 / 6.5), Math.floor(250 / 13)),
    }));
  }, [repeat, tokenSymbol]);

  const cardLineRef = useRef<HTMLDivElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const scannerCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalAscii = useRef(new Map<number, string>());

  const cardStreamState = useRef({
    position: 0,
    velocity: initialSpeed,
    direction: direction,
    isDragging: false,
    lastMouseX: 0,
    lastTime: performance.now(),
    cardLineWidth: (400 + cardGap) * cards.length,
    friction: friction,
    minVelocity: 30,
  });

  const scannerState = useRef({ isScanning: false });

  useEffect(() => {
    const cardLine = cardLineRef.current;
    const particleCanvas = particleCanvasRef.current;
    const scannerCanvas = scannerCanvasRef.current;

    if (!cardLine || !particleCanvas || !scannerCanvas) return;

    cards.forEach((card) => originalAscii.current.set(card.id, card.ascii));
    let animationFrameId: number;

    // --- (SETUP LOGIC for Three.js, Canvas, etc. - no changes here) ---
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -window.innerWidth / 2,
      window.innerWidth / 2,
      125,
      -125,
      1,
      1000
    );
    camera.position.z = 100;
    const renderer = new THREE.WebGLRenderer({
      canvas: particleCanvas,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, 250);
    renderer.setClearColor(0x000000, 0);
    const particleCount = 400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);
    const alphas = new Float32Array(particleCount);
    const texCanvas = document.createElement("canvas");
    texCanvas.width = 100;
    texCanvas.height = 100;
    const texCtx = texCanvas.getContext("2d")!;
    const half = 50;
    const gradient = texCtx.createRadialGradient(
      half,
      half,
      0,
      half,
      half,
      half
    );
    gradient.addColorStop(0.025, "#fff");
    gradient.addColorStop(0.1, `hsl(217, 61%, 33%)`);
    gradient.addColorStop(0.25, `hsl(217, 64%, 6%)`);
    gradient.addColorStop(1, "transparent");
    texCtx.fillStyle = gradient;
    texCtx.arc(half, half, half, 0, Math.PI * 2);
    texCtx.fill();
    const texture = new THREE.CanvasTexture(texCanvas);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * window.innerWidth * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 250;
      velocities[i] = Math.random() * 60 + 30;
      alphas[i] = (Math.random() * 8 + 2) / 10;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { pointTexture: { value: texture } },
      vertexShader: `attribute float alpha; varying float vAlpha; void main() { vAlpha = alpha; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 15.0; gl_Position = projectionMatrix * mvPosition; }`,
      fragmentShader: `uniform sampler2D pointTexture; varying float vAlpha; void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha) * texture2D(pointTexture, gl_PointCoord); }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: false,
    });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    const ctx = scannerCanvas.getContext("2d")!;
    scannerCanvas.width = window.innerWidth;
    scannerCanvas.height = 300;
    const scannerParticles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      life: number;
      decay: number;
    }> = [];
    const baseMaxParticles = 800;
    let currentMaxParticles = baseMaxParticles;
    const scanTargetMaxParticles = 2500;
    const createScannerParticle = () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 3,
      y: Math.random() * 300,
      vx: Math.random() * 0.8 + 0.2,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 0.6 + 0.4,
      alpha: Math.random() * 0.4 + 0.6,
      life: 1.0,
      decay: Math.random() * 0.02 + 0.005,
    });
    for (let i = 0; i < baseMaxParticles; i++)
      scannerParticles.push(createScannerParticle());

    const runScrambleEffect = (element: HTMLElement, cardId: number) => {
      if (element.dataset.scrambling === "true") return;
      element.dataset.scrambling = "true";
      const originalText = originalAscii.current.get(cardId) || "";
      let scrambleCount = 0;
      const maxScrambles = 10;
      const interval = setInterval(() => {
        element.textContent = generateCode(
          Math.floor(400 / 6.5),
          Math.floor(250 / 13)
        );
        scrambleCount++;
        if (scrambleCount >= maxScrambles) {
          clearInterval(interval);
          element.textContent = originalText;
          delete element.dataset.scrambling;
        }
      }, 30);
    };

    const updateCardEffects = () => {
      const scannerX = window.innerWidth / 2;
      const scannerWidth = 8;
      const scannerLeft = scannerX - scannerWidth / 2;
      const scannerRight = scannerX + scannerWidth / 2;
      let anyCardIsScanning = false;
      cardLine
        .querySelectorAll<HTMLElement>(".card-wrapper")
        .forEach((wrapper, index) => {
          const rect = wrapper.getBoundingClientRect();
          const normalCard =
            wrapper.querySelector<HTMLElement>(".card-normal")!;
          const asciiCard = wrapper.querySelector<HTMLElement>(".card-ascii")!;
          const asciiContent = asciiCard.querySelector<HTMLElement>("pre")!;
          if (rect.left < scannerRight && rect.right > scannerLeft) {
            anyCardIsScanning = true;
            if (
              scanEffect === "scramble" &&
              wrapper.dataset.scanned !== "true"
            ) {
              runScrambleEffect(asciiContent, index);
            }
            wrapper.dataset.scanned = "true";
            const intersectLeft = Math.max(scannerLeft - rect.left, 0);
            const intersectRight = Math.min(
              scannerRight - rect.left,
              rect.width
            );
            normalCard.style.setProperty(
              "--clip-right",
              `${(intersectLeft / rect.width) * 100}%`
            );
            asciiCard.style.setProperty(
              "--clip-left",
              `${(intersectRight / rect.width) * 100}%`
            );
          } else {
            delete wrapper.dataset.scanned;
            if (rect.right < scannerLeft) {
              normalCard.style.setProperty("--clip-right", "100%");
              asciiCard.style.setProperty("--clip-left", "100%");
            } else {
              normalCard.style.setProperty("--clip-right", "0%");
              asciiCard.style.setProperty("--clip-left", "0%");
            }
          }
        });
      // Update state for scanner visibility
      setIsScanning(anyCardIsScanning);
      scannerState.current.isScanning = anyCardIsScanning;
    };


    const animate = (currentTime: number) => {
      // --- (ANIMATION LOOP LOGIC - no changes here) ---
      const deltaTime = (currentTime - cardStreamState.current.lastTime) / 1000;
      cardStreamState.current.lastTime = currentTime;
      if (!isPaused && !cardStreamState.current.isDragging) {
        if (
          cardStreamState.current.velocity > cardStreamState.current.minVelocity
        ) {
          cardStreamState.current.velocity *= cardStreamState.current.friction;
        }
        cardStreamState.current.position +=
          cardStreamState.current.velocity *
          cardStreamState.current.direction *
          deltaTime;
      }
      const { position, cardLineWidth } = cardStreamState.current;
      const containerWidth = cardLine.parentElement?.offsetWidth || 0;
      if (position < -cardLineWidth)
        cardStreamState.current.position = containerWidth;
      else if (position > containerWidth)
        cardStreamState.current.position = -cardLineWidth;
      cardLine.style.transform = `translateX(${cardStreamState.current.position}px)`;
      updateCardEffects();
      const time = currentTime * 0.001;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] += velocities[i] * 0.016;
        if (positions[i * 3] > window.innerWidth / 2 + 100)
          positions[i * 3] = -window.innerWidth / 2 - 100;
        positions[i * 3 + 1] += Math.sin(time + i * 0.1) * 0.5;
        alphas[i] = Math.max(
          0.1,
          Math.min(1, alphas[i] + (Math.random() - 0.5) * 0.05)
        );
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.alpha.needsUpdate = true;
      renderer.render(scene, camera);
      ctx.clearRect(0, 0, window.innerWidth, 300);
      const targetCount = scannerState.current.isScanning
        ? scanTargetMaxParticles
        : baseMaxParticles;
      currentMaxParticles += (targetCount - currentMaxParticles) * 0.05;
      while (scannerParticles.length < currentMaxParticles)
        scannerParticles.push(createScannerParticle());
      while (scannerParticles.length > currentMaxParticles)
        scannerParticles.pop();
      scannerParticles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0 || p.x > window.innerWidth)
          Object.assign(p, createScannerParticle());
        ctx.globalAlpha = p.alpha * p.life;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [isPaused, cards, cardGap, friction, scanEffect]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#020617]">
      <style jsx global>{`
        @keyframes glitch {
          0%,
          16%,
          50%,
          100% {
            opacity: 1;
          }
          15%,
          99% {
            opacity: 0.9;
          }
          49% {
            opacity: 0.8;
          }
        }
        .animate-glitch {
          animation: glitch 0.1s infinite linear alternate-reverse;
        }

        @keyframes scanPulse {
          0% {
            opacity: 0.75;
            transform: scaleY(1);
          }
          100% {
            opacity: 1;
            transform: scaleY(1.03);
          }
        }
        .animate-scan-pulse {
          animation: scanPulse 1.5s infinite alternate ease-in-out;
        }
      `}</style>

      <canvas
        ref={particleCanvasRef}
        className="absolute top-1/2 left-0 -translate-y-1/2 w-screen h-[250px] z-0 pointer-events-none"
      />
      <canvas
        ref={scannerCanvasRef}
        className="absolute top-1/2 left-0 -translate-y-1/2 w-screen h-[300px] z-10 pointer-events-none"
      />

      <div
        className={`
          scanner-line absolute top-1/2 left-1/2 h-[280px] w-0.5 -translate-x-1/2 -translate-y-1/2
          bg-gradient-to-b from-transparent via-cyan-400 to-transparent rounded-full
          transition-opacity duration-300 z-20 pointer-events-none animate-scan-pulse
          ${isScanning ? "opacity-100" : "opacity-0"}
        `}
        style={{
          boxShadow: `
            0 0 10px #22d3ee, 0 0 20px #22d3ee,
            0 0 30px #06b6d4, 0 0 50px #0891b2`,
        }}
      />

      <div className="absolute w-screen h-[250px] flex items-center">
        <div
          ref={cardLineRef}
          className="flex items-center whitespace-nowrap select-none will-change-transform"
          style={{ gap: `${cardGap}px` }}
        >
          {cards.map((card) => (
            <div
              key={card.id}
              className="card-wrapper relative w-[400px] h-[250px] shrink-0"
            >
              <div className="card-normal card absolute top-0 left-0 w-full h-full rounded-[15px] overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/10 z-[2] [clip-path:inset(0_0_0_var(--clip-right,0%))]">
                <div className="w-full h-full flex flex-col items-center justify-center p-8">
                  <div className="w-32 h-32 mb-4 opacity-90 hover:opacity-100 transition-opacity">
                    <USDCToken />
                  </div>
                  <div className="text-white text-2xl font-bold tracking-wider">
                    {card.displayName}
                  </div>
                  <div className="text-gray-400 text-sm mt-2">
                    {fromChainName} → {toChainName}
                  </div>
                </div>
              </div>
              <div className="card-ascii card absolute top-0 left-0 w-full h-full rounded-[15px] overflow-hidden bg-transparent z-[1] [clip-path:inset(0_calc(100%-var(--clip-left,0%))_0_0)]">
                <pre className="ascii-content absolute top-0 left-0 w-full h-full text-[rgba(34,211,238,0.6)] font-mono text-[11px] leading-[13px] overflow-hidden whitespace-pre m-0 p-0 text-left align-top box-border [mask-image:linear-gradient(to_right,rgba(0,0,0,1)_0%,rgba(0,0,0,0.8)_30%,rgba(0,0,0,0.6)_50%,rgba(0,0,0,0.4)_80%,rgba(0,0,0,0.2)_100%)] animate-glitch">
                  {card.ascii}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 text-center space-y-2">
        <div className="text-cyan-400 text-lg font-semibold animate-pulse">
          Processing bridge transaction...
        </div>
        <div className="text-gray-400 text-sm">
          Burning {tokenSymbol} on {fromChainName}
        </div>
      </div>
    </div>
  );
};

export { ScannerCardStream };

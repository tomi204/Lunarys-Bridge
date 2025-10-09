"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import * as THREE from "three";

// --- Token SVG Components ---
const EthereumToken = () => (
  <svg
    viewBox="0 0 256 417"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <path
      fill="#343434"
      d="m127.961 0-2.795 9.5v275.668l2.795 2.79 127.962-75.638z"
    />
    <path fill="#8C8C8C" d="M127.962 0 0 212.32l127.962 75.639V154.158z" />
    <path
      fill="#3C3C3B"
      d="m127.961 312.187-1.575 1.92v98.199l1.575 4.6L256 236.587z"
    />
    <path fill="#8C8C8C" d="M127.962 416.905v-104.72L0 236.585z" />
    <path fill="#141414" d="m127.961 287.958 127.96-75.637-127.96-58.162z" />
    <path fill="#393939" d="m.001 212.321 127.96 75.637V154.159z" />
  </svg>
);

const SolanaToken = () => (
  <svg
    viewBox="0 0 397.7 311.7"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <defs>
      <linearGradient
        id="solGradient1"
        x1="360.879"
        y1="351.455"
        x2="141.213"
        y2="-69.294"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#00ffa3" />
        <stop offset="1" stopColor="#dc1fff" />
      </linearGradient>
      <linearGradient
        id="solGradient2"
        x1="264.829"
        y1="401.601"
        x2="45.163"
        y2="-19.148"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#00ffa3" />
        <stop offset="1" stopColor="#dc1fff" />
      </linearGradient>
      <linearGradient
        id="solGradient3"
        x1="312.548"
        y1="376.688"
        x2="92.882"
        y2="-44.061"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#00ffa3" />
        <stop offset="1" stopColor="#dc1fff" />
      </linearGradient>
    </defs>
    <path
      fill="url(#solGradient1)"
      d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1z"
    />
    <path
      fill="url(#solGradient2)"
      d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1z"
    />
    <path
      fill="url(#solGradient3)"
      d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1z"
    />
  </svg>
);

// Token images as data URLs for better performance
const getTokenImages = (fromChain: string, toChain: string) => {
  const isSolanaSource = fromChain.includes("solana");
  const isEthSource =
    fromChain.includes("sepolia") || fromChain.includes("ethereum");

  // Show the source chain token being "burned/scanned"
  return {
    tokenType: isSolanaSource ? "solana" : "ethereum",
    displayName: isSolanaSource ? "SOL" : "ETH",
  };
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
  showControls?: boolean;
  showSpeed?: boolean;
  initialSpeed?: number;
  direction?: -1 | 1;
  cardImages?: string[];
  repeat?: number;
  cardGap?: number;
  friction?: number;
  scanEffect?: "clip" | "scramble";
  fromChain?: string;
  toChain?: string;
};

// --- The Main Component ---
const ScannerCardStream = ({
  showControls = false,
  showSpeed = false,
  initialSpeed = 150,
  direction = -1,
  cardImages,
  repeat = 8,
  cardGap = 60,
  friction = 0.95,
  scanEffect = "scramble",
  fromChain = "solana-devnet",
  toChain = "sepolia",
}: ScannerCardStreamProps) => {
  // Determine which token to display based on source chain
  const tokenInfo = useMemo(
    () => getTokenImages(fromChain, toChain),
    [fromChain, toChain]
  );

  const [speed, setSpeed] = useState(initialSpeed);
  const [isPaused, setIsPaused] = useState(false);
  const [isScanning, setIsScanning] = useState(false); // New state for scanner visibility

  const cards = useMemo(() => {
    const totalCards = repeat;
    return Array.from({ length: totalCards }, (_, i) => ({
      id: i,
      tokenType: tokenInfo.tokenType,
      displayName: tokenInfo.displayName,
      ascii: generateCode(Math.floor(400 / 6.5), Math.floor(250 / 13)),
    }));
  }, [repeat, tokenInfo]);

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

  const toggleAnimation = useCallback(() => setIsPaused((prev) => !prev), []);
  const resetPosition = useCallback(() => {
    if (cardLineRef.current) {
      cardStreamState.current.position =
        cardLineRef.current.parentElement?.offsetWidth || 0;
      cardStreamState.current.velocity = initialSpeed;
      cardStreamState.current.direction = direction;
      setIsPaused(false);
    }
  }, [initialSpeed, direction]);
  const changeDirection = useCallback(() => {
    cardStreamState.current.direction *= -1;
  }, []);

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

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
      /* ... */
    };
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      /* ... */
    };
    const handleMouseUp = () => {
      /* ... */
    };
    const handleWheel = (e: WheelEvent) => {
      /* ... */
    };
    cardLine.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    cardLine.addEventListener("touchstart", handleMouseDown, { passive: true });
    window.addEventListener("touchmove", handleMouseMove, { passive: true });
    window.addEventListener("touchend", handleMouseUp);
    cardLine.addEventListener("wheel", handleWheel, { passive: false });

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
        setSpeed(Math.round(cardStreamState.current.velocity));
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
      /* ... (CLEANUP LOGIC - no changes here) ... */
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
                    {card.tokenType === "solana" ? (
                      <SolanaToken />
                    ) : (
                      <EthereumToken />
                    )}
                  </div>
                  <div className="text-white text-2xl font-bold tracking-wider">
                    {card.displayName}
                  </div>
                  <div className="text-gray-400 text-sm mt-2">
                    {card.tokenType === "solana"
                      ? "Solana Network"
                      : "Ethereum Network"}
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
          Encrypting payload · Verifying attestations
        </div>
      </div>
    </div>
  );
};

export { ScannerCardStream };

"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
};

type ConstellationBackgroundProps = {
  className?: string;
  overlayClassName?: string | null;
  particleCount?: number;
  particleColor?: string;
  lineColor?: string;
  maxLineDistance?: number;
};

export function ConstellationBackground({
  className,
  overlayClassName = "bg-gradient-to-b from-[#020617] via-[#01010f]/80 to-black",
  particleCount = 180,
  particleColor = "rgba(56, 226, 255, 0.65)",
  lineColor = "rgba(56, 226, 255, 0.15)",
  maxLineDistance = 160,
}: ConstellationBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationFrame = 0;
    let particles: Particle[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (typeof context.resetTransform === "function") {
        context.resetTransform();
      } else {
        context.setTransform(1, 0, 0, 1, 0, 0);
      }
      context.scale(dpr, dpr);
    };

    const createParticle = (): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 1.8 + 0.4,
      opacity: Math.random() * 0.6 + 0.2,
    });

    const populate = () => {
      particles = Array.from({ length: particleCount }, createParticle);
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -50 || particle.x > width + 50) particle.vx *= -1;
        if (particle.y < -50 || particle.y > height + 50) particle.vy *= -1;

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.save();
        context.globalAlpha = particle.opacity;
        context.fillStyle = particleColor;
        context.fill();
        context.restore();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxLineDistance) {
            const strength = Math.max(0, 1 - distance / maxLineDistance);
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.save();
            context.globalAlpha = strength * 0.5;
            context.strokeStyle = lineColor;
            context.lineWidth = 0.6;
            context.stroke();
            context.restore();
          }
        }
      }

      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    populate();
    draw();

    const handleResize = () => {
      resize();
      populate();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, [lineColor, maxLineDistance, particleColor, particleCount]);

  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      {overlayClassName !== null && (
        <div className={cn("absolute inset-0", overlayClassName)} />
      )}
    </div>
  );
}

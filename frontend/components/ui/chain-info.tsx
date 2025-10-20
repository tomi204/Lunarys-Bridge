"use client";

import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface ChainInfoProps {
  fromChain: string;
  toChain: string;
  tokenSymbol: string;
  amount: string;
}

const getChainName = (chain: string) => {
  if (chain.includes("solana")) return "Solana Devnet";
  if (chain.includes("sepolia")) return "Sepolia";
  if (chain.includes("ethereum")) return "Ethereum";
  return chain;
};

const SolanaLogo = ({ className = "w-16 h-16" }: { className?: string }) => (
  <svg
    viewBox="0 0 397.7 311.7"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient
        id="solGradientInfo1"
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
        id="solGradientInfo2"
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
        id="solGradientInfo3"
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
      fill="url(#solGradientInfo1)"
      d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1z"
    />
    <path
      fill="url(#solGradientInfo2)"
      d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1z"
    />
    <path
      fill="url(#solGradientInfo3)"
      d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1z"
    />
  </svg>
);

const EthereumLogo = ({ className = "w-16 h-16" }: { className?: string }) => (
  <svg
    viewBox="0 0 256 417"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
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

const USDCLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg
    viewBox="0 0 2000 2000"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
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

export const ChainInfo = ({
  fromChain,
  toChain,
  tokenSymbol,
  amount,
}: ChainInfoProps) => {
  const fromChainName = getChainName(fromChain);
  const toChainName = getChainName(toChain);
  const isSolanaSource = fromChain.includes("solana");
  const isSolanaTarget = toChain.includes("solana");
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,226,255,0.15),transparent_70%)]" />
      <div className="absolute bottom-[-20%] left-[15%] h-[420px] w-[420px] rounded-full bg-violet-500/20 blur-[140px]" />
      <div className="absolute top-[30%] right-[-5%] h-[460px] w-[460px] rounded-full bg-cyan-500/20 blur-[140px]" />

      <div className="relative z-10 w-full max-w-6xl px-6">
        {/* Status badge at top */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-6 py-3 text-lg font-medium text-cyan-400 border border-cyan-500/20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </motion.div>
            Bridging in Progress • {elapsedTime}s
          </div>
        </motion.div>

        {/* Main content */}
        <div className="flex items-center justify-between gap-8">
          {/* Source Chain */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 0px rgba(34,211,238,0)",
                  "0 0 30px rgba(34,211,238,0.6)",
                  "0 0 0px rgba(34,211,238,0)",
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-32 h-32 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur"
            >
              {isSolanaSource ? (
                <SolanaLogo className="w-20 h-20" />
              ) : (
                <EthereumLogo className="w-20 h-20" />
              )}
            </motion.div>

            <div className="text-center">
              <div className="text-white text-xl font-semibold">
                {fromChainName}
              </div>
              <div className="text-gray-400 text-sm mt-1">Source Chain</div>
            </div>
          </motion.div>

          {/* Connection Line with traveling tokens */}
          <div className="flex-1 relative h-2">
            {/* Connection line */}
            <div className="absolute inset-0 flex items-center">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="w-full h-0.5 bg-gradient-to-r from-cyan-500/50 via-cyan-400 to-cyan-500/50 rounded-full origin-left"
              />
            </div>

            {/* Traveling tokens */}
            {[0, 0.33, 0.66].map((delay, index) => (
              <motion.div
                key={index}
                initial={{ left: "0%" }}
                animate={{
                  left: ["0%", "100%"],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                  delay: delay * 3,
                }}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ marginLeft: "-16px" }}
              >
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="relative"
                >
                  <div className="w-8 h-8 rounded-full bg-cyan-400/20 backdrop-blur-sm border border-cyan-400/50 flex items-center justify-center">
                    <USDCLogo className="w-5 h-5" />
                  </div>
                  <motion.div
                    animate={{
                      opacity: [0.5, 0, 0.5],
                      scale: [1, 1.5],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                    className="absolute inset-0 rounded-full bg-cyan-400/30 blur-md"
                  />
                </motion.div>
              </motion.div>
            ))}

            {/* Particles along the line */}
            {Array.from({ length: 20 }).map((_, index) => (
              <motion.div
                key={`particle-${index}`}
                initial={{ left: `${index * 5}%`, opacity: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.1,
                  ease: "easeInOut",
                }}
                className="absolute top-1/2 -translate-y-1/2 w-1 h-1 bg-cyan-400 rounded-full"
              />
            ))}
          </div>

          {/* Target Chain */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 0px rgba(34,211,238,0)",
                  "0 0 30px rgba(34,211,238,0.6)",
                  "0 0 0px rgba(34,211,238,0)",
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
              className="w-32 h-32 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur"
            >
              {isSolanaTarget ? (
                <SolanaLogo className="w-20 h-20" />
              ) : (
                <EthereumLogo className="w-20 h-20" />
              )}
            </motion.div>

            <div className="text-center">
              <div className="text-white text-xl font-semibold">
                {toChainName}
              </div>
              <div className="text-gray-400 text-sm mt-1">Target Chain</div>
            </div>
          </motion.div>
        </div>

        {/* Bottom info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center space-y-4"
        >
          <div className="text-white text-2xl font-semibold">
            {amount} {tokenSymbol}
          </div>
          <div className="flex items-center justify-center gap-3 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Cross-chain transfer in progress</span>
            </div>
            <span>•</span>
            <span>Encrypted</span>
          </div>
          <div className="max-w-lg mx-auto text-sm text-gray-400 leading-relaxed">
            Your transaction is being securely processed through our encrypted bridge network.
            The destination address remains encrypted throughout the entire transfer, ensuring complete privacy.
            Relayers are now validating and forwarding your tokens to the target chain.
          </div>
        </motion.div>
      </div>
    </div>
  );
};

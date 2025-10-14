import Link from "next/link";

import { StaticPage } from "@/components/marketing/static-page";

export default function PressPage() {
  return (
    <StaticPage
      eyebrow="Press"
      title="Press kit and media resources"
      description="Access Lunarys brand assets, executive bios, and story angles covering encrypted cross-chain infrastructure."
      sections={[
        {
          title: "Company snapshot",
          description:
            "Lunarys builds encrypted routing for institutions bridging assets between Solana, EVM, and future FHE-enabled chains. Founded in 2024, the team blends cryptography research with high-frequency trading experience.",
          bullets: [
            "Mission: deliver private-by-default cross-chain liquidity with compliance guardrails",
            "Headquarters: Remote-first with hubs in Zürich, Singapore, and New York",
            "Funding: Backed by cryptography-focused venture funds and strategic market makers",
          ],
        },
        {
          title: "Media assets",
          description:
            "Our logo suite, product imagery, and approved screenshots are available for editorial use. Please follow the brand guidelines and avoid altering the marks.",
          extra: (
            <p>
              Download the latest assets:{" "}
              <Link
                href="https://drive.google.com/folderview?id=lunarys-press-kit"
                className="text-cyan-300 underline decoration-cyan-400/60 underline-offset-4"
              >
                Lunarys press kit
              </Link>
            </p>
          ),
        },
        {
          title: "Executive spokespeople",
          description:
            "We offer interviews with founders, lead cryptographers, and operations directors. Topics include privacy-preserving finance, cross-chain security, regulatory alignment, and liquidity strategy.",
          bullets: [
            "Tomas Vidal — CEO, former HFT infrastructure lead",
            "Luciano Carreño — CTO, cryptography and protocol design",
            "Camila Ortega — Head of Compliance, previously MAS regulator",
          ],
        },
        {
          title: "Featured story angles",
          description:
            "Resources for journalists covering encrypted infrastructure, institutional DeFi adoption, or regulatory innovation.",
          bullets: [
            "How FHE unlocks private cross-chain settlements",
            "Programmable policy packs vs. legacy compliance",
            "Reliability tactics for institutional bridges",
            "Emerging regulatory frameworks for encrypted finance",
          ],
        },
      ]}
      callout={{
        heading: "Press inquiries",
        body: "Reach the comms team for interviews, embargoed announcements, or background briefings.",
        ctaLabel: "Email press",
        ctaHref: "mailto:press@lunarys.io",
      }}
    />
  );
}

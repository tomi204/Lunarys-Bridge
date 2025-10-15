import { StaticPage } from "@/components/marketing/static-page";

export default function AboutPage() {
  return (
    <StaticPage
      eyebrow="Company"
      title="Building encrypted rails for institutions moving at crypto speed"
      description="Lunarys is a distributed team of cryptographers, protocol engineers, and former HFT operators. We are obsessed with giving institutions private, compliant access to cross-chain liquidity."
      sections={[
        {
          title: "Mission",
          description:
            "Eliminate the trade-off between privacy and compliance. We believe encrypted infrastructure should let market makers and treasuries move instantly while staying regulator-ready.",
          bullets: [
            "Private by default, auditable on demand",
            "Programmable controls that map to real-world policies",
            "Latency that matches centralized venues without sacrificing security",
          ],
        },
        {
          title: "What we ship",
          description:
            "The Lunarys stack combines FHE-encrypted payloads, policy engines, and high-availability relayers. We focus on hard engineering problems so our partners can focus on execution.",
          bullets: [
            "FHE circuits backed by Zama’s FHEVM libraries",
            "Institutional policy packs with zero-knowledge attestations",
            "Observability layer built for real-time operations teams",
          ],
        },
        {
          title: "Where we work",
          description:
            "We are remote-first with nodes in Zürich, Singapore, and New York. Our team spans more than 10 time zones and we gather quarterly to ship roadmap-critical features face to face.",
        },
        {
          title: "Investors and partners",
          description:
            "Backed by cryptography-focused funds and strategic market makers who trade across Solana and EVM. We collaborate with liquidity partners, custodians, and compliance vendors to keep the bridge aligned with institutional needs.",
        },
      ]}
      callout={{
        heading: "Want to collaborate?",
        body: "Reach out if you are a market maker, custodian, or infrastructure partner exploring encrypted cross-chain routing.",
        ctaLabel: "Contact the team",
        ctaHref: "mailto:hello@lunarys.io",
      }}
    />
  );
}

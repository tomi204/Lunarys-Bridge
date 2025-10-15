import { StaticPage } from "@/components/marketing/static-page";

export default function CareersPage() {
  return (
    <StaticPage
      eyebrow="Careers"
      title="Join the founding team"
      description="We are assembling a small group of founders who will define how encrypted cross-chain infrastructure operates for institutions. If you want to build from first principles and ship production systems, we’d love to meet you."
      sections={[
        {
          title: "What we look for",
          description:
            "We hire people who are comfortable owning ambiguous problems, building with rigor, and communicating clearly across time zones.",
          bullets: [
            "Deep experience in cryptography, protocol engineering, reliability, or institutional finance",
            "Bias toward shipping secure, production-ready systems over research prototypes",
            "Ability to lead initiatives autonomously while collaborating asynchronously",
          ],
        },
        {
          title: "Founding roles",
          description:
            "Instead of a long job board, we’re looking for builders who can own critical surface areas. You’ll define the roadmap alongside the founding team.",
          bullets: [
            "Founding Protocol Engineer – Rust, Solana, threshold signatures, FHE integration",
            "Founding Security & Reliability Engineer – enclave ops, observability, incident response",
            "Founding Product & Integrations Lead – policy automation, institutional onboarding",
            "Founding GTM Lead – strategic partnerships with market makers, custodians, and banks",
          ],
        },
        {
          title: "How we work",
          description:
            "We operate as a remote-first, high-trust team. Documentation, async decision-making, and regular build weeks keep us aligned.",
          bullets: [
            "Quarterly in-person build weeks focused on shipping roadmap milestones",
            "Written culture: design docs, runbooks, and decision logs in the open",
            "Competitive compensation with meaningful equity/token upside and full-remote support",
          ],
        },
        {
          title: "Interview process",
          description:
            "We respect your time. Expect an introductory call, a deep dive with future teammates, and a practical project that mirrors the work you’d own. No whiteboard trivia.",
        },
      ]}
      callout={{
        heading: "Looking to build as a founder?",
        body: "Send us the systems you’ve shipped, the failures you’ve learned from, or the research you’ve published. We respond to every founding candidate personally.",
        ctaLabel: "Introduce yourself",
        ctaHref: "mailto:careers@lunarys.io",
      }}
    />
  );
}

import { StaticPage } from "@/components/marketing/static-page";

export default function IntegrationPlaybookPage() {
  return (
    <StaticPage
      eyebrow="Playbook"
      title="Integration playbook for production-ready bridge deployments"
      description="A proven approach to move from sandbox to mainnet with stakeholder alignment, observability, and policy governance baked in."
      sections={[
        {
          title: "Phase 1 · Discovery",
          description:
            "Align architecture and compliance requirements before writing code. We map your flows, identify custody touchpoints, and scope which chains, assets, and desks go live first.",
          bullets: [
            "Technical questionnaire covering latency, volume, and custody posture",
            "Workshop with legal and compliance stakeholders",
            "Draft integration plan with milestones and responsible teams",
          ],
        },
        {
          title: "Phase 2 · Sandbox build",
          description:
            "Stand up a replica environment with mocked relayers and signed attestations. Engineers iterate on wallet UX, encrypted payload handling, and treasury approvals without touching mainnet funds.",
          bullets: [
            "Provisioned sandbox credentials, faucet scripts, and policy templates",
            "CI pipelines with regression suites and gas benchmarking",
            "Joint review for policy pack translations and fallback logic",
          ],
        },
        {
          title: "Phase 3 · Security and compliance sign-off",
          description:
            "Before launch, we coordinate security artifacts and policy attestations. Your auditors receive access to the encrypted logbook while runbooks are validated through game days.",
          bullets: [
            "Pen test coordination and findings triage",
            "Signed control matrix mapping to SOC2, ISO 27001, or MAS TRM",
            "Incident response tabletop and escalation rehearsal",
          ],
        },
        {
          title: "Phase 4 · Mainnet launch and optimization",
          description:
            "Roll out in controlled stages with real-time observability. We monitor relayer health, enforce liquidity buffers, and automate settlements to match your treasury cadence.",
          bullets: [
            "Progressive traffic ramp with automated circuit breakers",
            "Dedicated protocol operations channel with 5 minute response targets",
            "Monthly optimization reviews covering fees, latency, and policy drift",
          ],
        },
      ]}
      callout={{
        heading: "Ready to start?",
        body: "Book a joint architecture review so we can tailor the playbook to your environment and regulatory posture.",
        ctaLabel: "Book integration review",
        ctaHref: "mailto:integrations@lunarys.io",
      }}
    />
  );
}

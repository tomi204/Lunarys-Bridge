import { StaticPage } from "@/components/marketing/static-page";

export default function CommandCenterPage() {
  return (
    <StaticPage
      eyebrow="Product"
      title="Command Center overview"
      description="Monitor every cross-chain transfer, policy decision, and relayer heartbeat from a single encrypted console."
      sections={[
        {
          title: "Operational visibility",
          description:
            "Command Center aggregates live metrics from relayers, nodes, and policy engines. Drill into settlement latency, queue depth, or proof generation status without exposing underlying payloads.",
          bullets: [
            "Real-time dashboards with configurable alerts",
            "Per-desk views to segment trading activity",
            "Searchable logbook with encrypted metadata",
          ],
        },
        {
          title: "Governance workflows",
          description:
            "Trigger policy pack reviews, rotate keys, or approve quarantined transfers with explicit quorum requirements. Every approval produces a zero-knowledge receipt for auditors.",
          bullets: [
            "Role-based access tied to your identity provider",
            "Multi-sig and hardware key support for critical actions",
            "Immutable activity feed with exportable evidence packets",
          ],
        },
        {
          title: "Treasury automation",
          description:
            "Schedule rebalancing routines, enforce liquidity buffers, and automate settlement sweeps. Treasury teams can model scenarios before pushing changes to production.",
          bullets: [
            "Policy simulator to evaluate new limits",
            "Bridging SLAs with automated circuit breakers",
            "Webhooks and API endpoints for downstream systems",
          ],
        },
      ]}
      callout={{
        heading: "Schedule a walkthrough",
        body: "See how Command Center fits into your operations stack with a tailored demo.",
        ctaLabel: "Book demo",
        ctaHref: "mailto:hello@lunarys.io?subject=Command%20Center%20Demo",
      }}
    />
  );
}

import { StaticPage } from "@/components/marketing/static-page";

export default function StatusPage() {
  return (
    <StaticPage
      eyebrow="Reliability"
      title="Service status and uptime commitments"
      description="Track the health of Lunarys bridge clusters, relayers, and encryption services. We operate with an SLO-driven mindset so you can route liquidity confidently."
      sections={[
        {
          title: "Real-time status dashboard",
          description:
            "Our public dashboard exposes chain connectivity, relayer queue depth, policy VM performance, and attestation freshness. Metrics update every 30 seconds with historical charts for 90 days.",
          bullets: [
            "Solana, EVM, and FHE circuit health indicators",
            "Relayer settlement latency percentiles",
            "Policy evaluation throughput and error budgets",
          ],
        },
        {
          title: "Incident communication",
          description:
            "If an incident breaches our SLOs, we post an advisory within 10 minutes of detection. Updates continue every 30 minutes until resolved, followed by a full post-incident report.",
          bullets: [
            "Timeline of impact, mitigations, and root cause analysis",
            "Customer actions required (if any) and compensating controls",
            "Permanent links to the final report and remediation tickets",
          ],
        },
        {
          title: "Maintenance windows",
          description:
            "We announce planned maintenance at least 72 hours in advance. Window length, affected regions, and fallback instructions are published alongside reminders inside the bridge UI.",
        },
        {
          title: "Service level objectives",
          description:
            "Core bridge operations target 99.95% monthly availability with sub-4 second median settlement and 8 second p99. Policy evaluation SLO is 150ms p95 with a 0.01% error budget.",
        },
      ]}
      callout={{
        heading: "Status API access",
        body: "Subscribe to webhooks or SSE feeds for proactive alerts that sync with your trading or treasury tooling.",
        ctaLabel: "Request API token",
        ctaHref: "mailto:status@lunarys.io",
      }}
    />
  );
}

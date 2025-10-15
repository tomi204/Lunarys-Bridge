import { StaticPage } from "@/components/marketing/static-page";

export default function PolicyPacksPage() {
  return (
    <StaticPage
      eyebrow="Compliance"
      title="Policy packs that translate regulation into executable guardrails"
      description="Combine zero-knowledge privacy with audit-ready controls. Lunarys policy packs let compliance teams encode their obligations without exposing counterparties or trade intent."
      sections={[
        {
          title: "Configurable attestation logic",
          description:
            "Define which proofs must be satisfied before a payload can exit the bridge. Choose from residence checks, sanctioned wallet denies, counterparty reputation, or custom lists synced from your GRC stack.",
          bullets: [
            "Support for OFAC, UK HMT, and MAS lists out of the box",
            "Bring-your-own verifier endpoints with signed updates",
            "Policy versioning with immutable audit trails",
          ],
        },
        {
          title: "Programmable liquidity routing",
          description:
            "Enforce minimum oracle spreads, maximum daily notional, or tiered slippage budgets per desk. When thresholds are breached, payloads are quarantined until a designated reviewer signs off.",
          bullets: [
            "Rules execute inside the encrypted policy VM",
            "Every decision accompanied by a zero-knowledge receipt",
            "Fallback workflows for emergency unwinds and manual overrides",
          ],
        },
        {
          title: "Privacy-preserving audit exports",
          description:
            "Generate regulator-ready exports without revealing underlying wallet addresses. Policy packs produce blinded attestations that confirm obligations were met without exposing trading alpha.",
          bullets: [
            "CSV, JSON, and API streaming formats",
            "Time-bound decryption keys for external auditors",
            "Chain-of-custody signatures for every export bundle",
          ],
        },
      ]}
      callout={{
        heading: "Need a bespoke policy pack?",
        body: "Our compliance engineers map your existing policies into encrypted circuits and certify them with your governance board.",
        ctaLabel: "Schedule a workshop",
        ctaHref: "mailto:policies@lunarys.io",
      }}
    />
  );
}

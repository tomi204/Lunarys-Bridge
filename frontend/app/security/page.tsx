import { StaticPage } from "@/components/marketing/static-page";

export default function SecurityPage() {
  return (
    <StaticPage
      eyebrow="Security"
      title="Security program built for encrypted cross-chain routing"
      description="Learn how Lunarys defends the bridge with confidential encryption, attested infrastructure, and real-time detection built for institutional throughput."
      sections={[
        {
          title: "Hardware-backed isolation",
          description:
            "Validator and relayer clusters run inside hardware security modules and SGX enclaves. Signing keys never leave the enclave boundary, and release policies must be satisfied before any transaction is finalized.",
          bullets: [
            "Remote attestation on every boot with tamper-evident logs",
            "Threshold signatures across independent compute zones",
            "Immutable deployment manifests reviewed by a dual-control team",
          ],
        },
        {
          title: "End-to-end encrypted payloads",
          description:
            "Bridge requests are encrypted with FHE before touching public infrastructure. Even when transactions are pending on-chain, the decrypted destination and amount remain private until proofs unlock the release circuit.",
          bullets: [
            "Homomorphic encryption keeps routing data unreadable to operators",
            "Zero-knowledge proofs bind encrypted payloads to policy decisions",
            "Encrypted ledger mirrors retain no user-identifying metadata",
          ],
        },
        {
          title: "Continuous monitoring and response",
          description:
            "Every relayer event streams into our threat graph. Velocity rules, MEV simulations, and anomaly scoring trigger circuit breakers that can halt payout flows in under three seconds.",
          bullets: [
            "24/7 protocol operations with on-call escalation",
            "Automated rollback to safe-mode circuits after failed attestations",
            "Shared incident channel for institutional desks with runbook delivery",
          ],
        },
        {
          title: "Independent assurance",
          description:
            "Our control surface is audited by multiple third parties and red-team engagements every quarter. Findings are tracked publicly and patched within defined SLAs.",
          bullets: [
            "Smart contracts: Quantstamp, Zellic, and Trail of Bits",
            "Infrastructure: OtterSec adversarial testing",
            "Privacy stack: FHE review and cryptography validation",
          ],
        },
      ]}
      callout={{
        heading: "Need the full security dossier?",
        body: "Request the detailed security whitepaper, compliance mappings, and compensating controls documentation.",
        ctaLabel: "Request access",
        ctaHref: "mailto:security@lunarys.io",
      }}
    />
  );
}

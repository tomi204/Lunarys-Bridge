import { StaticPage } from "@/components/marketing/static-page";

export default function PrivacyPolicyPage() {
  return (
    <StaticPage
      eyebrow="Privacy"
      title="Privacy Notice"
      description="We minimize the data we collect and encrypt the rest. This notice explains what information we process, why we process it, and how you can exercise your rights."
      lastUpdated="October 9, 2025"
      sections={[
        {
          title: "Data collection principles",
          description:
            "Lunarys is designed to operate without handling personally identifiable information. We only collect the minimum telemetry needed to secure, monitor, and improve the Service.",
          bullets: [
            "No wallet private keys, seed phrases, or plaintext transaction destinations ever leave your device.",
            "Encrypted payloads stored on-chain are unreadable to Lunarys or our partners.",
            "We do not sell, rent, or trade customer data.",
          ],
        },
        {
          title: "What we collect",
          description:
            "We gather limited technical and operational data to keep the bridge stable. All data is pseudonymized and retained only as long as necessary.",
          bullets: [
            "Runtime telemetry: browser type, OS version, and anonymized session identifiers for debugging UI issues.",
            "Operational logs: hashed wallet addresses and transaction IDs for fraud detection and compliance evidence.",
            "Support interactions: email contents and attachments when you contact our teams.",
          ],
        },
        {
          title: "How we use data",
          description:
            "We use the collected data solely to operate, secure, and improve the bridge. Processing happens in the EU or other jurisdictions with equivalent safeguards.",
          bullets: [
            "Security monitoring, fraud prevention, and incident response",
            "Performance analytics to improve latency and reliability",
            "Regulatory reporting and audit trails requested by partners",
          ],
        },
        {
          title: "Your rights and choices",
          description:
            "Depending on your jurisdiction, you may have the right to access, correct, delete, or restrict processing of your data. We respond to verified requests within 30 days.",
          bullets: [
            "Submit requests via privacy@lunarys.io with sufficient detail to identify your records.",
            "Opt out of non-essential telemetry by adjusting cookie preferences.",
            "Appeal any decision by emailing our data protection officer: dpo@lunarys.io.",
          ],
        },
        {
          title: "Data retention and security",
          description:
            "We retain pseudonymized operational logs for up to 12 months unless a longer period is legally required. All data is encrypted at rest and in transit, with access restricted by role-based controls and hardware-backed keys.",
        },
      ]}
      callout={{
        heading: "Questions about privacy?",
        body: "Our data protection team is available to help you understand how Lunarys handles information.",
        ctaLabel: "Email privacy",
        ctaHref: "mailto:privacy@lunarys.io",
      }}
    />
  );
}

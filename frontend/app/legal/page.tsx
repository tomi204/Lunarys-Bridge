import Link from "next/link";

import { StaticPage } from "@/components/marketing/static-page";

export default function LegalPage() {
  return (
    <StaticPage
      eyebrow="Legal"
      title="Legal center"
      description="Find every agreement, policy, and compliance artifact that governs how Lunarys operates. We keep this hub current so your legal and risk teams can review changes at their own pace."
      sections={[
        {
          title: "Core agreements",
          description:
            "These documents define your relationship with Lunarys, the rules for using the bridge, and how we handle data.",
          extra: (
            <ul className="space-y-2 text-sm leading-relaxed text-gray-300">
              <li>
                <Link href="/terms" className="text-cyan-300 underline decoration-cyan-400/60 underline-offset-4">
                  Terms of Service
                </Link>{" "}
                — contractual terms governing access to the bridge and associated services.
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-cyan-300 underline decoration-cyan-400/60 underline-offset-4"
                >
                  Privacy Notice
                </Link>{" "}
                — how we collect, process, and protect personal data.
              </li>
              <li>
                <Link
                  href="/cookie-preferences"
                  className="text-cyan-300 underline decoration-cyan-400/60 underline-offset-4"
                >
                  Cookie &amp; Tracking Policy
                </Link>{" "}
                — information about the limited telemetry we use to operate the site.
              </li>
            </ul>
          ),
        },
        {
          title: "Regulatory posture",
          description:
            "We maintain documentation that maps Lunarys controls to major regulatory frameworks. Partners can request access through their account manager or via the compliance team.",
          bullets: [
            "SOC 2 Type II bridge readiness report",
            "MAS TRM and EU DORA control mapping",
            "AML/KYC program overview and policy attestations",
          ],
        },
        {
          title: "Update notifications",
          description:
            "Material changes to policies trigger email notifications to registered contacts and an alert in the bridge console. We track previous versions for at least 24 months.",
          bullets: [
            "Version comparison tables highlighting updated sections",
            "30-day advance notice for changes that affect contractual obligations",
            "Optional RSS feed for legal updates",
          ],
        },
      ]}
      callout={{
        heading: "Need a signed copy?",
        body: "Reach out to legal@lunarys.io for executed agreements, DPAs, or custom addenda.",
        ctaLabel: "Email legal",
        ctaHref: "mailto:legal@lunarys.io",
      }}
    />
  );
}

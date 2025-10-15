import Link from "next/link";

import { StaticPage } from "@/components/marketing/static-page";

export default function AuditReportsPage() {
  return (
    <StaticPage
      eyebrow="Assurance"
      title="Assurance program in partnership with founding auditors"
      description="We are onboarding independent security researchers and audit firms to validate every layer of the Lunarys bridge. This page outlines what’s complete, what’s scheduled, and how to participate."
      sections={[
        {
          title: "Current assurance scope",
          description:
            "Q4 2025 focuses on the settlement vaults, encrypted payload interpreter, and relayer consensus logic. Internal red-team exercises are underway while external engagements are finalized.",
          bullets: [
            "Formal verification of release conditions and threshold signature paths",
            "Penetration testing for relayer API surfaces and enclave provisioning",
            "FHE noise budget analysis and side-channel mitigation review",
          ],
        },
        {
          title: "Founding audit partners",
          description:
            "We are engaging top-tier assurance firms and independent researchers. If you run an audit practice or lead a security research collective, we’d like to collaborate.",
          bullets: [
            "Preferred scope: bridge contracts, relayer infra, policy VM, FHE stack",
            "Rolling access to private repos, deployment manifests, and observability data",
            "Co-branded disclosure process with clear remediation SLAs",
          ],
        },
        {
          title: "Upcoming deliverables",
          description:
            "We will publish executive summaries and remediation status as engagements conclude. Full findings remain available under NDA for institutional partners.",
          bullets: [
            "Initial smart contract audit summary – target December 2025",
            "Relayer+infrastructure report – target January 2026",
            "FHE cryptography review – target January 2026",
          ],
        },
        {
          title: "Participate in the assurance program",
          description:
            "Security teams, researchers, and institutional partners can request access to our data room. Please include context about your remit so we can tailor the material.",
          extra: (
            <p>
              Email{" "}
              <Link
                href="mailto:assurance@lunarys.io"
                className="text-cyan-300 underline decoration-cyan-400/60 underline-offset-4"
              >
                assurance@lunarys.io
              </Link>{" "}
              with your organization name, assurance scope, and the type of materials you need. We typically respond within two business days.
            </p>
          ),
        },
      ]}
      callout={{
        heading: "Looking to become a founding audit partner?",
        body: "Let’s collaborate on deep, transparent reviews of the Lunarys bridge. We provide full access, dedicated engineering support, and rapid remediation cycles.",
        ctaLabel: "Contact assurance team",
        ctaHref: "mailto:assurance@lunarys.io?subject=Founding%20Audit%20Partner",
      }}
    />
  );
}

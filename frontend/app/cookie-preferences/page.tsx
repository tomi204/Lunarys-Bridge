import Link from "next/link";

import { StaticPage } from "@/components/marketing/static-page";

export default function CookiePreferencesPage() {
  return (
    <StaticPage
      eyebrow="Privacy"
      title="Cookie & Tracking Preferences"
      description="Configure how Lunarys uses local storage, cookies, and telemetry in your browser. We keep tracking minimal and transparent."
      sections={[
        {
          title: "Essential cookies",
          description:
            "Required for the bridge to function. These cookies maintain session state, remember your network selections, and secure the wallet connection flow.",
          bullets: [
            "Authentication tokens scoped to the current session",
            "CSRF protection identifiers",
            "Chain and policy selections stored in local storage",
          ],
        },
        {
          title: "Performance telemetry (optional)",
          description:
            "Helps us understand latency, error hotspots, and UI regressions. Data is aggregated, pseudonymized, and never sold. Disable anytime without affecting bridge availability.",
          bullets: [
            "Page load metrics and anonymized session IDs",
            "Client-side error traces to improve reliability",
            "Feature adoption analytics for roadmap prioritization",
          ],
        },
        {
          title: "How to manage preferences",
          description:
            "Toggle your choices below or adjust them via your browser settings. Changes apply immediately and persist across sessions.",
          extra: (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-200">
              <p>
                Prefer programmatic control? Our Settings API lets you define cookie and telemetry posture across your desks. See the{" "}
                <Link href="/documentation" className="text-cyan-300 underline decoration-cyan-400/60 underline-offset-4">
                  documentation
                </Link>{" "}
                for examples.
              </p>
            </div>
          ),
        },
      ]}
      callout={{
        heading: "Need a data processing agreement?",
        body: "Compliance teams can request DPAs or cookie inventories aligned to GDPR, LGPD, or CCPA.",
        ctaLabel: "Request DPA",
        ctaHref: "mailto:privacy@lunarys.io?subject=DPA%20Request",
      }}
    />
  );
}

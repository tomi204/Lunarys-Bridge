import { StaticPage } from "@/components/marketing/static-page";

export default function DocumentationPage() {
  return (
    <StaticPage
      eyebrow="Docs"
      title="Documentation hub for engineers shipping with Lunarys"
      description="Everything you need to integrate the encrypted bridge: SDK guides, API references, runbooks, and architecture diagrams."
      sections={[
        {
          title: "Quickstart guides",
          description:
            "Spin up the bridge in minutes with framework-specific walkthroughs. Each guide covers wallet connection, encrypted payload generation, and transaction monitoring.",
          bullets: [
            "Next.js + App Router integration with React hooks",
            "Node relayer bootstrap on Kubernetes or Nomad",
            "Localnet sandbox with mocked attestations and fixtures",
          ],
        },
        {
          title: "API reference",
          description:
            "Detailed specs for the relayer gRPC surfaces, webhook callbacks, and policy management APIs. Every endpoint includes schema examples, auth requirements, and example responses.",
          bullets: [
            "OpenAPI and protobuf definitions kept in sync with releases",
            "SDK examples in TypeScript, Rust, and Python",
            "Rate limit and pagination strategies for production workloads",
          ],
        },
        {
          title: "Operational runbooks",
          description:
            "Step-by-step procedures for rotating keys, applying hotfixes, or recovering from partial outages. Runbooks include decision trees and escalation matrices for multi-team environments.",
          bullets: [
            "Incident classes with RACI assignments",
            "Rollback plans for policy pack misconfigurations",
            "Disaster recovery simulations for relayer clusters",
          ],
        },
        {
          title: "Architecture deep dives",
          description:
            "Understand how encrypted payloads flow from origin chain to destination. We document circuit sequencing, FHE proof generation, settlement windows, and attestation verification.",
        },
      ]}
      callout={{
        heading: "Need private repo access?",
        body: "Request access to internal examples, Terraform modules, and livebooks maintained by the protocol team.",
        ctaLabel: "Request repo access",
        ctaHref: "mailto:docs@lunarys.io",
      }}
    />
  );
}

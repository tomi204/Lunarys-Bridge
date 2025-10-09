import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import HomepageFeatures from "@site/src/components/HomepageFeatures";
import Heading from "@theme/Heading";

import styles from "./index.module.css";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro"
          >
            Get Started
          </Link>
          <Link
            className="button button--outline button--lg"
            to="/docs/smart-contracts"
          >
            Smart Contracts
          </Link>
        </div>
      </div>
    </header>
  );
}

function ArchitectureDiagrams() {
  return (
    <section className={styles.diagrams}>
      <div className="container">
        <div className="text--center margin-bottom--xl">
          <Heading as="h2">Cross-Chain Bridge Architecture</Heading>
          <p>
            Explore our encrypted cross-chain bridge architecture between Solana
            and Ethereum
          </p>
        </div>
        <div className="row">
          <div className="col col--6">
            <div className="text--center">
              <img
                src="/img/diagram-simple.png"
                alt="Simple Architecture Diagram"
                style={{ width: "100%", maxWidth: "500px", height: "auto" }}
              />
              <p>
                <strong>Simple Architecture Overview</strong>
              </p>
            </div>
          </div>
          <div className="col col--6">
            <div className="text--center">
              <img
                src="/img/diagram-full.png"
                alt="Full Architecture Diagram"
                style={{ width: "100%", maxWidth: "500px", height: "auto" }}
              />
              <p>
                <strong>Detailed Architecture Diagram</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - Encrypted Cross-Chain Bridge`}
      description="LUNARYS is an encrypted cross-chain bridge between Solana and Ethereum, enabling private and secure asset transfers with zero-knowledge proofs"
    >
      <HomepageHeader />
      <main>
        <ArchitectureDiagrams />
        <HomepageFeatures />
      </main>
    </Layout>
  );
}

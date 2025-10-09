import type { ReactNode } from "react";
import clsx from "clsx";
import Heading from "@theme/Heading";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<"svg">>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Encrypted Cross-Chain Transfers",
    Svg: require("@site/static/img/undraw_docusaurus_mountain.svg").default,
    description: (
      <>
        Secure asset transfers between Solana and Ethereum with end-to-end
        encryption, ensuring complete privacy of transaction amounts and
        recipients.
      </>
    ),
  },
  {
    title: "Zero-Knowledge Bridge Security",
    Svg: require("@site/static/img/undraw_docusaurus_tree.svg").default,
    description: (
      <>
        [Arcium](https://www.arcium.com/) - the encrypted supercomputer -
        enables computation on encrypted data without decryption, providing
        mathematical privacy guarantees for cross-chain transfers.
      </>
    ),
  },
  {
    title: "Decentralized Cross-Chain Bridge",
    Svg: require("@site/static/img/undraw_docusaurus_react.svg").default,
    description: (
      <>
        Trust-minimized bridge with no central custodianship, enabling seamless
        and private asset movement between Solana and Ethereum ecosystems.
      </>
    ),
  },
];

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

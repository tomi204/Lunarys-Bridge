import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: "doc",
      id: "intro",
      label: "Introduction",
    },
    {
      type: "category",
      label: "Smart Contracts",
      collapsed: false,
      items: [
        {
          type: "doc",
          id: "smart-contracts",
          label: "Overview",
        },
        {
          type: "doc",
          id: "bridge-evm-functions",
          label: "Bridge EVM Functions",
        },
        {
          type: "doc",
          id: "addresses",
          label: "Deployed Addresses",
        },
      ],
    },
    {
      type: "doc",
      id: "architecture",
      label: "Architecture",
    },
    {
      type: "doc",
      id: "privacy-protocol",
      label: "Privacy Protocol",
    },
    {
      type: "doc",
      id: "api-reference",
      label: "API Reference",
    },
    {
      type: "doc",
      id: "errors",
      label: "Error Codes",
    },
  ],
};

export default sidebars;

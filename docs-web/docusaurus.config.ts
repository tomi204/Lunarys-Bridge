import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "LUNARYS",
  tagline: "Encrypted Cross-Chain Bridge Between Solana & Ethereum",
  favicon: "img/favicon.ico",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: "https://lunarys.com",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "LunarysLabs", // Usually your GitHub org/user name.
  projectName: "lunarys-docs", // Usually your repo name.

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            "https://github.com/LunarysLabs/lunarys-docs/edit/main/docs-web/",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/iso-logo.svg",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "LUNARYS",
      logo: {
        alt: "LUNARYS Logo",
        src: "img/iso-logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Documentation",
        },
        {
          href: "https://github.com/LunarysLabs",
          label: "GitHub",
          position: "right",
        },
        {
          href: "https://x.com/LunarysLabs",
          label: "X (Twitter)",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Documentation",
          items: [
            {
              label: "Introduction",
              to: "/docs/intro",
            },
            {
              label: "Smart Contracts",
              to: "/docs/smart-contracts",
            },
            {
              label: "Architecture",
              to: "/docs/architecture",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "X (Twitter)",
              href: "https://x.com/LunarysLabs",
            },
            {
              label: "GitHub",
              href: "https://github.com/LunarysLabs",
            },
            {
              label: "Discord",
              href: "https://discord.gg/lunarys",
            },
          ],
        },
        {
          title: "Resources",
          items: [
            {
              label: "Privacy Protocol",
              to: "/docs/privacy-protocol",
            },
            {
              label: "API Reference",
              to: "/docs/api-reference",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Lunarys Labs. Built with privacy in mind.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

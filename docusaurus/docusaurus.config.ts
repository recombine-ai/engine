import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Recombine AI Docs',
  tagline: 'Conversational AI agents platform',
  favicon: 'img/favicon.ico',

  // The production URL of your site
  url: 'https://docs.recombine.ai',
  // The base path under which your site is served
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'Recombine AI', // Usually your GitHub org/user name.
  projectName: 'recombine-ai', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  trailingSlash: false,
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          routeBasePath: '/', // Serve the docs at the site's root
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'Recombine AI Docs',
      logo: {
        alt: 'Recombine AI Dev Logo',
        src: 'img/recombine.png',
      },
      items: [
        
        {
          href: 'https://github.com/recombine-ai/',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Main',
          items: [
            {
              label: 'Home',
              href: 'https://recombine.ai/',
            },
            {
              label: 'X (Twitter)',
              href: 'https://x.com/RecombineAI',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/recombine-ai',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Recombine AI`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      
    },
  } satisfies Preset.ThemeConfig,
  plugins: 
    [[
      "docusaurus-plugin-typedoc",
      {
        "entryPoints": ["../src/index.ts"],
        "tsconfig": "../tsconfig.json", // Path to your TypeScript config file
        // or "src" if you have multiple entry points
        "out": "docs/api",            // Where to put the generated documentation
        "excludeExternals": true,
        "excludePrivate": true,
        "excludeProtected": true,
        "readme": "none",
        "plugin": ["typedoc-plugin-markdown"], // optional plugin for markdown output    
        indexFormat: "table",
        disableSources: true,
        groupOrder: ["Classes", "Interfaces", "Enums"],
        sidebar: { pretty: true },
        textContentMappings: {
          "title.indexPage": "API Overview",
          "title.memberPage": "{name}",
        },
        parametersFormat: "table",
        enumMembersFormat: "table",
        useCodeBlocks: true,
      },
    ]],

};

export default config;

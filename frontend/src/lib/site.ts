export const siteConfig = {
  name: 'Suna Kortix - SYHC Private Server',
  url: process.env.NEXT_PUBLIC_URL || 'https://kortix.syhc.dev',
  description: 'Kortix - Open Source Generalist AI Agent Platform. Kortix is a fully open source AI assistant that helps you accomplish real-world tasks with ease through natural conversation.',
  links: {
    github: 'https://github.com/Logrui/suna/',
  },
};

export type SiteConfig = typeof siteConfig;

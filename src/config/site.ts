// Central place for app identity + the submission footer details.
export const siteConfig = {
  name: "docHouse",
  tagline: "House of docs",
  description:
    "A local-first collaborative document editor — edit offline, sync deterministically without losing work, and travel through version history.",
  author: {
    name: "Sunny Gandhwani",
    github: "https://github.com/sunny-unik",
    linkedin: "https://www.linkedin.com/in/sunny-gandhwani",
  },
} as const;

export type SiteConfig = typeof siteConfig;

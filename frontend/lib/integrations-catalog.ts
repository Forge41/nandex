/** Presentational-only "coming soon" tiles for the marketplace -- not backed by any API.
 * GET /apps only ever returns real, seeded Connector rows (just Google Drive today); these
 * exist purely so the page matches the approved design's fuller catalog. Never wire these
 * up to a connect/install call -- there is nothing on the backend for them to call. */
export type ComingSoonApp = {
  name: string;
  category: string;
  initials: string;
  description: string;
};

export const COMING_SOON_APPS: ComingSoonApp[] = [
  { name: "Dropbox", category: "Storage", initials: "Db", description: "Sync files and folders shared with your team." },
  { name: "GitHub", category: "Source Control", initials: "Gh", description: "Index READMEs, wikis, and issue threads from your repos." },
  { name: "GitLab", category: "Source Control", initials: "Gl", description: "Index merge requests, wikis, and READMEs from your projects." },
  { name: "Vercel", category: "Hosting", initials: "Vc", description: "Pull deployment logs and project docs into your workspace." },
  { name: "Netlify", category: "Hosting", initials: "Nf", description: "Bring in build logs and site docs alongside your other sources." },
  { name: "npm", category: "Distribution", initials: "np", description: "Index READMEs and changelogs across your published packages." },
  { name: "PyPI", category: "Distribution", initials: "Py", description: "Index package documentation and release notes." },
  { name: "Slack", category: "Coming Soon", initials: "Sl", description: "Search and cite messages from channels you're in." },
  { name: "Notion", category: "Coming Soon", initials: "No", description: "Import pages and databases from your workspace." },
  { name: "Confluence", category: "Coming Soon", initials: "Cf", description: "Search team spaces and pages alongside everything else." },
];

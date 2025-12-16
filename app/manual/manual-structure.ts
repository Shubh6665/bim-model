export type ManualChapter = {
  slug: string;
  title: string;
  subtitle: string;
  keywords: string[];
};

export const manualChapters: ManualChapter[] = [
  {
    slug: "introduction",
    title: "Introduction",
    subtitle: "What the platform is and who it is for",
    keywords: ["intro", "overview", "purpose", "roles", "login"],
  },
  {
    slug: "sign-in-invites",
    title: "Sign-in & Invites",
    subtitle: "How login works and how to accept project invitations",
    keywords: ["sign in", "login", "invite", "accept", "email", "project access"],
  },
  {
    slug: "dashboard",
    title: "Home Screen (Dashboard)",
    subtitle: "What you see after login and how to navigate",
    keywords: ["dashboard", "home", "navigation", "header", "profile menu", "projects"],
  },
  {
    slug: "projects",
    title: "Projects & Models",
    subtitle: "Create/select projects, open map or 3D view",
    keywords: ["projects", "models", "map", "create project", "project info"],
  },
  {
    slug: "bim",
    title: "BIM Module",
    subtitle: "Explore the 3D model, visibility and filtering",
    keywords: ["bim", "viewer", "filter", "model", "visibility"],
  },
  {
    slug: "iot",
    title: "IoT Module",
    subtitle: "Sensors list, placement in 3D, and sensor details",
    keywords: ["iot", "sensors", "placement", "graphs", "statistics"],
  },
  {
    slug: "database",
    title: "Database (Documents)",
    subtitle: "Folders, files, sharing, downloads",
    keywords: ["database", "documents", "folders", "files", "share", "download", "upload"],
  },
  {
    slug: "fm",
    title: "FM (Facility Management)",
    subtitle: "Service Requests → Work Orders → Maintenance",
    keywords: ["fm", "service request", "ticket", "work order", "maintenance", "report"],
  },
  {
    slug: "notifications",
    title: "Notifications",
    subtitle: "Where alerts appear and what they mean",
    keywords: ["notifications", "alerts", "bell", "unread"],
  },
  {
    slug: "vt",
    title: "VT (Virtual Tours)",
    subtitle: "Virtual Tours and Cameras panel",
    keywords: ["vt", "virtual tours", "cameras", "search"],
  },
  {
    slug: "ai",
    title: "AI",
    subtitle: "AI panel overview",
    keywords: ["ai", "assistant", "panel"],
  },
  {
    slug: "glossary",
    title: "Glossary",
    subtitle: "Simple meanings of key terms used in the platform",
    keywords: ["glossary", "terms"],
  },
];

export function chapterPath(slug: string) {
  return `/manual/${slug}`;
}

export function getCurrentChapterFromPathname(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const slug = parts[1] || "introduction";
  const index = manualChapters.findIndex((c) => c.slug === slug);
  const safeIndex = index >= 0 ? index : 0;
  const chapter = manualChapters[safeIndex];
  return { slug: chapter.slug, index: safeIndex, chapter };
}

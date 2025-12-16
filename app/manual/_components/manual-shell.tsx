"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { chapterPath, getCurrentChapterFromPathname, manualChapters } from "@/app/manual/manual-structure";

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function ManualShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { index, chapter } = getCurrentChapterFromPathname(pathname);

  const [query, setQuery] = useState("");
  const normalizedQuery = useMemo(() => normalize(query), [query]);

  const filteredChapters = useMemo(() => {
    if (!normalizedQuery) return manualChapters;
    return manualChapters.filter((c) => {
      const hay = normalize([c.title, c.subtitle, ...c.keywords].join(" "));
      return hay.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  const prev = index > 0 ? manualChapters[index - 1] : null;
  const next = index < manualChapters.length - 1 ? manualChapters[index + 1] : null;

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xl font-bold text-white">User Manual</div>
            <div className="text-sm text-gray-400">Step-by-step guide for using the platform</div>
          </div>
          <div className="w-full max-w-lg">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chapters… (e.g., projects, sensors, tickets, documents)"
              className="w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[280px_1fr]">
        <aside className="md:sticky md:top-6 md:h-[calc(100vh-7rem)] md:overflow-auto">
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
            <div className="text-sm font-semibold text-white">Chapters</div>
            <div className="mt-3 space-y-1">
              {filteredChapters.map((c) => {
                const active = c.slug === chapter.slug;
                return (
                  <Link
                    key={c.slug}
                    href={chapterPath(c.slug)}
                    className={
                      "block rounded-md px-2 py-2 text-sm transition-colors " +
                      (active
                        ? "bg-gray-800 text-white"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white")
                    }
                  >
                    <div className="font-medium">{c.title}</div>
                    <div className="text-xs text-gray-400">{c.subtitle}</div>
                  </Link>
                );
              })}
            </div>

            {normalizedQuery && (
              <div className="mt-4 rounded-md border border-gray-800 bg-gray-950/50 p-2 text-xs text-gray-400">
                Showing {filteredChapters.length} / {manualChapters.length} chapters
              </div>
            )}
          </div>
        </aside>

        <main className="space-y-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900/20 p-4">
            <div className="text-xs text-gray-400">Chapter</div>
            <div className="mt-1 text-2xl font-bold text-white">{chapter.title}</div>
            <div className="mt-1 text-sm text-gray-300">{chapter.subtitle}</div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900/20 p-4">{children}</div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {prev ? (
                <Link
                  href={chapterPath(prev.slug)}
                  className="inline-flex items-center rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
                >
                  ← Previous: {prev.title}
                </Link>
              ) : (
                <div className="text-sm text-gray-500">You are at the first chapter.</div>
              )}
            </div>
            <div>
              {next ? (
                <Link
                  href={chapterPath(next.slug)}
                  className="inline-flex items-center rounded-md border border-gray-800 bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
                >
                  Next: {next.title} →
                </Link>
              ) : (
                <div className="text-sm text-gray-500">You are at the last chapter.</div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import type { DocumentDetail } from "@/types/document";
import NdaCreator from "./NdaCreator";
import NdaPreview from "./NdaPreview";
import HistoryList from "./HistoryList";

interface Props {
  template: string;
}

interface CurrentUser {
  id: number;
  email: string;
}

type View = "creator" | "history";

export default function PlatformShell({ template }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [view, setView] = useState<View>("creator");
  const [openDocument, setOpenDocument] = useState<DocumentDetail | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Not signed in");
        const data: CurrentUser = await response.json();
        if (!cancelled) setUser(data);
      } catch {
        if (!cancelled) router.replace("/");
      } finally {
        if (!cancelled) setCheckingAuth(false);
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSignOut() {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    router.push("/");
  }

  function selectView(next: View) {
    setView(next);
    setOpenDocument(null);
  }

  if (checkingAuth || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                P
              </div>
              <span className="text-lg font-semibold tracking-tight text-gray-900">
                prelegal
              </span>
            </div>
            <nav className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => selectView("creator")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === "creator"
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                New Document
              </button>
              <button
                type="button"
                onClick={() => selectView("history")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === "history"
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                History
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-gray-500 sm:inline">
              {user.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        {view === "creator" && (
          <>
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Mutual NDA Creator
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Chat with the assistant below to generate a Mutual
                Non-Disclosure Agreement.
              </p>
            </div>
            <NdaCreator template={template} />
          </>
        )}

        {view === "history" && (
          <>
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Document History
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Documents you&apos;ve previously generated.
              </p>
            </div>
            {openDocument ? (
              <NdaPreview
                template={template}
                data={openDocument.fields}
                onBack={() => setOpenDocument(null)}
              />
            ) : (
              <HistoryList onSelect={setOpenDocument} />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <p className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-gray-400">
          Documents generated by prelegal are drafts only and do not
          constitute legal advice. Always have generated documents reviewed
          by a licensed attorney before relying on them.
        </p>
      </footer>
    </div>
  );
}

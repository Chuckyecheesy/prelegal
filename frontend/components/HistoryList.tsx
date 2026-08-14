"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import type { DocumentDetail, DocumentSummary } from "@/types/document";

interface Props {
  onSelect: (document: DocumentDetail) => void;
}

export default function HistoryList({ onSelect }: Props) {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`${API_URL}/api/documents`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Request failed");
        const data: DocumentSummary[] = await response.json();
        if (!cancelled) setDocuments(data);
      } catch {
        if (!cancelled) setError("Couldn't load your document history.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleOpen(id: number) {
    setOpeningId(id);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/documents/${id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Request failed");
      const data: DocumentDetail = await response.json();
      onSelect(data);
    } catch {
      setError("Couldn't open that document. Please try again.");
    } finally {
      setOpeningId(null);
    }
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {error}
      </p>
    );
  }

  if (documents === null) {
    return <p className="text-sm text-gray-500">Loading your documents…</p>;
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-gray-900">
          No documents yet
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Documents you generate will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {documents.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            onClick={() => handleOpen(doc.id)}
            disabled={openingId !== null}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {doc.party_a_name} &amp; {doc.party_b_name}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Mutual NDA · {new Date(doc.created_at + "Z").toLocaleString()}
              </p>
            </div>
            <span className="text-sm font-medium text-indigo-600">
              {openingId === doc.id ? "Opening…" : "View →"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

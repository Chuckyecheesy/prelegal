"use client";

import { useEffect, useRef, useState } from "react";
import type { NdaFormData } from "@/types/nda";
import { NDA_FIELD_LABELS, NDA_FIELD_ORDER } from "@/lib/ndaFields";

interface Props {
  onSubmit: (data: NdaFormData) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const GREETING =
  "Hi! I'll help you draft a Mutual NDA. Let's start — what's the full legal name of Party A, the party disclosing confidential information?";

export default function NdaChat({ onSubmit }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [fields, setFields] = useState<Partial<NdaFormData>>({});
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<keyof NdaFormData | null>(
    null
  );
  const [editValue, setEditValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  const isComplete = NDA_FIELD_ORDER.every(
    (key) => (fields[key] ?? "").trim() !== ""
  );

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, fields }),
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const data: { reply: string; fields: Partial<NdaFormData> } =
        await response.json();
      setFields((prev) => ({ ...prev, ...data.fields }));
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Something went wrong talking to the assistant. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function startEditing(key: keyof NdaFormData) {
    setEditingField(key);
    setEditValue(fields[key] ?? "");
  }

  function saveEdit() {
    if (!editingField) return;
    setFields((prev) => ({ ...prev, [editingField]: editValue }));
    setEditingField(null);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
        <div
          className="flex-1 space-y-4 overflow-y-auto p-6"
          style={{ maxHeight: "28rem" }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {m.content}
            </div>
          ))}
          {isLoading && (
            <div className="max-w-[80%] rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-500">
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {error && (
          <p role="alert" className="px-6 text-sm text-red-600">
            {error}
          </p>
        )}
        <form
          onSubmit={sendMessage}
          className="flex gap-2 border-t border-gray-200 p-4"
        >
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <input
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer…"
            disabled={isLoading}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Captured details
          </h2>
          <ul className="space-y-2 text-sm">
            {NDA_FIELD_ORDER.map((key) => (
              <li key={key}>
                <div className="text-xs font-medium text-gray-500">
                  {NDA_FIELD_LABELS[key]}
                </div>
                {editingField === key ? (
                  <div className="mt-1 flex gap-1">
                    <label htmlFor={`edit-${key}`} className="sr-only">
                      {NDA_FIELD_LABELS[key]}
                    </label>
                    <input
                      id={`edit-${key}`}
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(key)}
                    className={`mt-0.5 block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-gray-50 ${
                      fields[key] ? "text-gray-900" : "text-gray-400 italic"
                    }`}
                  >
                    {fields[key] || "Not yet provided"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          disabled={!isComplete}
          onClick={() => onSubmit(fields as NdaFormData)}
          className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Review & Generate →
        </button>
      </div>
    </div>
  );
}

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HistoryList from "@/components/HistoryList";

describe("HistoryList", () => {
  it("shows an empty state when there are no documents", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    );
    render(<HistoryList onSelect={vi.fn()} />);
    expect(await screen.findByText(/No documents yet/i)).toBeInTheDocument();
  });

  it("renders a row per saved document", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 1,
            document_type: "Mutual Non-Disclosure Agreement",
            party_a_name: "Acme Corp.",
            party_b_name: "Beta Inc.",
            created_at: "2026-08-14T12:00:00",
          },
        ],
      })
    );
    render(<HistoryList onSelect={vi.fn()} />);
    expect(await screen.findByText(/Acme Corp\. & Beta Inc\./)).toBeInTheDocument();
    expect(
      screen.getByText(/Mutual Non-Disclosure Agreement/)
    ).toBeInTheDocument();
  });

  it("calls onSelect with the full document when a row is opened", async () => {
    const onSelect = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith("/api/documents")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 1,
                party_a_name: "Acme Corp.",
                party_b_name: "Beta Inc.",
                created_at: "2026-08-14T12:00:00",
              },
            ],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 1,
            party_a_name: "Acme Corp.",
            party_b_name: "Beta Inc.",
            created_at: "2026-08-14T12:00:00",
            fields: { partyAName: "Acme Corp." },
          }),
        });
      })
    );
    const user = userEvent.setup();
    render(<HistoryList onSelect={onSelect} />);
    await user.click(await screen.findByText(/View →/));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, fields: { partyAName: "Acme Corp." } })
    );
  });

  it("shows an error message when the list request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<HistoryList onSelect={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Couldn't load your document history/i
    );
  });
});

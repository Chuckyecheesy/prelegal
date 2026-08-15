import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NdaChat from "@/components/NdaChat";

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    })
  );
}

describe("NdaChat", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a greeting and all fields as not yet provided", () => {
    render(<NdaChat onSubmit={vi.fn()} />);
    expect(screen.getByText(/I'll help you draft a Mutual NDA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Not yet provided/i).length).toBe(12);
  });

  it("Review & Generate is disabled until every field is captured", () => {
    render(<NdaChat onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Review & Generate/i })).toBeDisabled();
  });

  it("sends the message history and current fields to the backend, then merges the response", async () => {
    mockFetchOnce({
      reply: "Great, what's Party A's address?",
      fields: { partyAName: "Acme Corp." },
    });
    const user = userEvent.setup();
    render(<NdaChat onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/Message/i), "Acme Corp.");
    await user.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() =>
      expect(screen.getByText(/Great, what's Party A's address/i)).toBeInTheDocument()
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/chat"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              role: "assistant",
              content:
                "Hi! I'll help you draft a Mutual NDA. Let's start — what's the full legal name of Party A, the party disclosing confidential information?",
            },
            { role: "user", content: "Acme Corp." },
          ],
          fields: {},
        }),
      })
    );
    expect(screen.getByRole("button", { name: "Acme Corp." })).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockFetchOnce({}, false);
    const user = userEvent.setup();
    render(<NdaChat onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/Message/i), "hi");
    await user.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("allows editing a captured field directly in the sidebar", async () => {
    mockFetchOnce({
      reply: "Thanks!",
      fields: { partyAName: "Acme Corp." },
    });
    const user = userEvent.setup();
    render(<NdaChat onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/Message/i), "Acme Corp.");
    await user.click(screen.getByRole("button", { name: /Send/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Acme Corp." })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "Acme Corp." }));
    const editInput = screen.getByLabelText("Party A — Full Legal Name");
    await user.clear(editInput);
    await user.type(editInput, "Acme Corporation");
    await user.click(screen.getByRole("button", { name: /Save/i }));

    expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
  });

  it("calls onSubmit with the captured fields when Review & Generate is clicked", async () => {
    const allFields = {
      partyAName: "Acme Corp.",
      partyAAddress: "123 Main St",
      partyAEmail: "a@acme.com",
      partyBName: "Beta Inc.",
      partyBAddress: "456 Queen St",
      partyBEmail: "b@beta.com",
      businessPurpose: "joint venture",
      effectiveDate: "2026-01-01",
      governingState: "California",
      confidentialityTerm: "3",
      disputeCountyState: "Santa Clara County, California",
      disputeNoticeDays: "30",
    };
    mockFetchOnce({ reply: "All set!", fields: allFields });
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NdaChat onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/Message/i), "Here's everything.");
    await user.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Review & Generate/i })).not.toBeDisabled()
    );
    await user.click(screen.getByRole("button", { name: /Review & Generate/i }));

    expect(onSubmit).toHaveBeenCalledWith(allFields);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NdaCreator from "@/components/NdaCreator";

// react-markdown is ESM-only; mock it to avoid transform issues in tests
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Suppress html2canvas / jspdf — not needed for creator-level tests
vi.mock("html2canvas", () => ({ default: vi.fn() }));
vi.mock("jspdf", () => ({ default: vi.fn() }));

const TEMPLATE = "Party A: [Full Legal Name of Party A]";

const ALL_FIELDS = {
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

async function fillAndSubmitChat(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Message/i), "Here are all the details.");
  await user.click(screen.getByRole("button", { name: /Send/i }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /Review & Generate/i })
    ).not.toBeDisabled()
  );
  await user.click(screen.getByRole("button", { name: /Review & Generate/i }));
}

describe("NdaCreator", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ reply: "Got it, all set!", fields: ALL_FIELDS }),
      })
    );
  });

  it("renders the chat on first load", () => {
    render(<NdaCreator template={TEMPLATE} />);
    expect(screen.getByRole("button", { name: /Send/i })).toBeInTheDocument();
  });

  it("does not show the preview on first load", () => {
    render(<NdaCreator template={TEMPLATE} />);
    expect(screen.queryByText(/Back to Form/i)).not.toBeInTheDocument();
  });

  it("transitions to preview once the chat has captured all fields and Review & Generate is clicked", async () => {
    const user = userEvent.setup();
    render(<NdaCreator template={TEMPLATE} />);
    await fillAndSubmitChat(user);
    expect(screen.getByText(/Back to Form/i)).toBeInTheDocument();
  });

  it("returns to the chat when Back to Form is clicked", async () => {
    const user = userEvent.setup();
    render(<NdaCreator template={TEMPLATE} />);
    await fillAndSubmitChat(user);
    await user.click(screen.getByText(/Back to Form/i));
    expect(screen.getByRole("button", { name: /Send/i })).toBeInTheDocument();
    expect(screen.queryByText(/Back to Form/i)).not.toBeInTheDocument();
  });
});

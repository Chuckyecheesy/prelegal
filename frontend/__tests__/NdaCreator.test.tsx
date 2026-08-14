import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

async function fillAndSubmitForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Full Legal Name/i, { selector: "#partyAName" }), "Acme Corp.");
  await user.type(screen.getByLabelText(/Address/i, { selector: "#partyAAddress" }), "123 Main St");
  await user.type(screen.getByLabelText(/Email/i, { selector: "#partyAEmail" }), "a@acme.com");
  await user.type(screen.getByLabelText(/Full Legal Name/i, { selector: "#partyBName" }), "Beta Inc.");
  await user.type(screen.getByLabelText(/Address/i, { selector: "#partyBAddress" }), "456 Queen St");
  await user.type(screen.getByLabelText(/Email/i, { selector: "#partyBEmail" }), "b@beta.com");
  await user.type(screen.getByLabelText(/Business Purpose/i), "joint venture");
  await user.type(screen.getByLabelText(/Governing State/i), "California");
  await user.type(
    screen.getByLabelText(/Dispute Resolution Jurisdiction/i),
    "Santa Clara County, California"
  );
  await user.click(screen.getByRole("button", { name: /Generate NDA/i }));
}

describe("NdaCreator", () => {
  it("renders the form on first load", () => {
    render(<NdaCreator template={TEMPLATE} />);
    expect(screen.getByRole("button", { name: /Generate NDA/i })).toBeInTheDocument();
  });

  it("does not show the preview on first load", () => {
    render(<NdaCreator template={TEMPLATE} />);
    expect(screen.queryByText(/Back to Form/i)).not.toBeInTheDocument();
  });

  it("transitions to preview after form submission", async () => {
    const user = userEvent.setup();
    render(<NdaCreator template={TEMPLATE} />);
    await fillAndSubmitForm(user);
    expect(screen.getByText(/Back to Form/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate NDA/i })).not.toBeInTheDocument();
  });

  it("returns to the form when Back to Form is clicked", async () => {
    const user = userEvent.setup();
    render(<NdaCreator template={TEMPLATE} />);
    await fillAndSubmitForm(user);
    await user.click(screen.getByText(/Back to Form/i));
    expect(screen.getByRole("button", { name: /Generate NDA/i })).toBeInTheDocument();
    expect(screen.queryByText(/Back to Form/i)).not.toBeInTheDocument();
  });
});

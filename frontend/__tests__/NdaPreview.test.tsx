import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NdaPreview from "@/components/NdaPreview";
import type { NdaFormData } from "@/types/nda";

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

const pdfMock = {
  internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  addPage: vi.fn(),
  addImage: vi.fn(),
  save: vi.fn(),
};

vi.mock("html2canvas", () => ({
  default: vi.fn().mockResolvedValue({ width: 800, height: 1200 }),
}));
vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(function () {
    return pdfMock;
  }),
}));

beforeAll(() => {
  // jsdom doesn't implement canvas; provide minimal stubs
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,") as never;
});

const DATA: NdaFormData = {
  partyAName: "Acme Corp.",
  partyAAddress: "123 Main St",
  partyAEmail: "a@acme.com",
  partyBName: "Beta Inc.",
  partyBAddress: "456 Queen St",
  partyBEmail: "b@beta.com",
  businessPurpose: "joint venture",
  effectiveDate: "2026-08-14",
  governingState: "California",
  confidentialityTerm: "3",
  disputeCountyState: "Santa Clara County, California",
  disputeNoticeDays: "30",
};

const TEMPLATE =
  "Party A: [Full Legal Name of Party A]\nParty B: [Full Legal Name of Party B]\nDate: [Insert date]";

describe("NdaPreview", () => {
  describe("rendering", () => {
    it("renders the Back to Form button", () => {
      render(<NdaPreview template={TEMPLATE} data={DATA} onBack={vi.fn()} />);
      expect(screen.getByText(/Back to Form/i)).toBeInTheDocument();
    });

    it("renders the Download PDF button", () => {
      render(<NdaPreview template={TEMPLATE} data={DATA} onBack={vi.fn()} />);
      expect(screen.getByRole("button", { name: /Download PDF/i })).toBeInTheDocument();
    });

    it("renders filled template content via react-markdown", () => {
      render(<NdaPreview template={TEMPLATE} data={DATA} onBack={vi.fn()} />);
      const markdown = screen.getByTestId("markdown");
      expect(markdown.textContent).toContain("Acme Corp.");
      expect(markdown.textContent).toContain("Beta Inc.");
    });

    it("substitutes date in the rendered content", () => {
      render(<NdaPreview template={TEMPLATE} data={DATA} onBack={vi.fn()} />);
      const markdown = screen.getByTestId("markdown");
      expect(markdown.textContent).toContain("August 14, 2026");
    });

    it("Download PDF button is enabled initially", () => {
      render(<NdaPreview template={TEMPLATE} data={DATA} onBack={vi.fn()} />);
      expect(screen.getByRole("button", { name: /Download PDF/i })).not.toBeDisabled();
    });
  });

  describe("back navigation", () => {
    it("calls onBack when Back to Form is clicked", async () => {
      const onBack = vi.fn();
      const user = userEvent.setup();
      render(<NdaPreview template={TEMPLATE} data={DATA} onBack={onBack} />);
      await user.click(screen.getByText(/Back to Form/i));
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("PDF download", () => {
    it("calls pdf.save with a sanitized filename on download click", async () => {
      const user = userEvent.setup();
      render(<NdaPreview template={TEMPLATE} data={DATA} onBack={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: /Download PDF/i }));
      // Wait for async download to complete
      await screen.findByRole("button", { name: /Download PDF/i });
      expect(pdfMock.save).toHaveBeenCalledWith(
        expect.stringMatching(/Mutual-NDA.*\.pdf$/)
      );
    });

    it("button re-enables after download completes", async () => {
      const user = userEvent.setup();
      render(<NdaPreview template={TEMPLATE} data={DATA} onBack={vi.fn()} />);
      const btn = screen.getByRole("button", { name: /Download PDF/i });
      await user.click(btn);
      await screen.findByRole("button", { name: /Download PDF/i });
      expect(btn).not.toBeDisabled();
    });
  });
});

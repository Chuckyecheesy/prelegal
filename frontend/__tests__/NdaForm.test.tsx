import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NdaForm from "@/components/NdaForm";
import type { NdaFormData } from "@/types/nda";

const noop = vi.fn();

function getFields() {
  return {
    partyAName: screen.getByLabelText(/Full Legal Name/i, { selector: "#partyAName" }),
    partyAAddress: screen.getByLabelText(/Address/i, { selector: "#partyAAddress" }),
    partyAEmail: screen.getByLabelText(/Email/i, { selector: "#partyAEmail" }),
    partyBName: screen.getByLabelText(/Full Legal Name/i, { selector: "#partyBName" }),
    partyBAddress: screen.getByLabelText(/Address/i, { selector: "#partyBAddress" }),
    partyBEmail: screen.getByLabelText(/Email/i, { selector: "#partyBEmail" }),
    businessPurpose: screen.getByLabelText(/Business Purpose/i),
    effectiveDate: screen.getByLabelText(/Effective Date/i),
    governingState: screen.getByLabelText(/Governing State/i),
    confidentialityTerm: screen.getByLabelText(/Confidentiality Term/i),
    disputeNoticeDays: screen.getByLabelText(/Dispute Notice Period/i),
    disputeCountyState: screen.getByLabelText(/Dispute Resolution Jurisdiction/i),
  };
}

describe("NdaForm", () => {
  describe("rendering", () => {
    it("renders all 12 form fields", () => {
      render(<NdaForm onSubmit={noop} />);
      const fields = getFields();
      expect(Object.keys(fields)).toHaveLength(12);
      Object.values(fields).forEach((el) => expect(el).toBeInTheDocument());
    });

    it("renders the submit button", () => {
      render(<NdaForm onSubmit={noop} />);
      expect(screen.getByRole("button", { name: /Generate NDA/i })).toBeInTheDocument();
    });

    it("defaults confidentialityTerm to 3", () => {
      render(<NdaForm onSubmit={noop} />);
      expect(screen.getByLabelText(/Confidentiality Term/i)).toHaveValue(3);
    });

    it("defaults disputeNoticeDays to 30", () => {
      render(<NdaForm onSubmit={noop} />);
      expect(screen.getByLabelText(/Dispute Notice Period/i)).toHaveValue(30);
    });

    it("defaults effectiveDate to today's ISO date", () => {
      render(<NdaForm onSubmit={noop} />);
      const today = new Date().toISOString().split("T")[0];
      expect(screen.getByLabelText(/Effective Date/i)).toHaveValue(today);
    });
  });

  describe("user interaction", () => {
    it("updates field value as user types", async () => {
      const user = userEvent.setup();
      render(<NdaForm onSubmit={noop} />);
      const input = screen.getByLabelText(/Full Legal Name/i, { selector: "#partyAName" });
      await user.type(input, "Acme Corp.");
      expect(input).toHaveValue("Acme Corp.");
    });

    it("updates Party B name independently of Party A", async () => {
      const user = userEvent.setup();
      render(<NdaForm onSubmit={noop} />);
      await user.type(screen.getByLabelText(/Full Legal Name/i, { selector: "#partyAName" }), "Acme Corp.");
      await user.type(screen.getByLabelText(/Full Legal Name/i, { selector: "#partyBName" }), "Beta Inc.");
      expect(screen.getByLabelText(/Full Legal Name/i, { selector: "#partyAName" })).toHaveValue("Acme Corp.");
      expect(screen.getByLabelText(/Full Legal Name/i, { selector: "#partyBName" })).toHaveValue("Beta Inc.");
    });
  });

  describe("form submission", () => {
    async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText(/Full Legal Name/i, { selector: "#partyAName" }), "Acme Corp.");
      await user.type(screen.getByLabelText(/Address/i, { selector: "#partyAAddress" }), "123 Main St");
      await user.type(screen.getByLabelText(/Email/i, { selector: "#partyAEmail" }), "a@acme.com");
      await user.type(screen.getByLabelText(/Full Legal Name/i, { selector: "#partyBName" }), "Beta Inc.");
      await user.type(screen.getByLabelText(/Address/i, { selector: "#partyBAddress" }), "456 Queen St");
      await user.type(screen.getByLabelText(/Email/i, { selector: "#partyBEmail" }), "b@beta.com");
      await user.type(screen.getByLabelText(/Business Purpose/i), "joint venture");
      await user.type(screen.getByLabelText(/Governing State/i), "California");
      await user.type(screen.getByLabelText(/Dispute Resolution Jurisdiction/i), "Santa Clara, CA");
      await user.click(screen.getByRole("button", { name: /Generate NDA/i }));
    }

    it("calls onSubmit with all field values on submit", async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<NdaForm onSubmit={onSubmit} />);
      await fillAndSubmit(user);
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const submitted: NdaFormData = onSubmit.mock.calls[0][0];
      expect(submitted.partyAName).toBe("Acme Corp.");
      expect(submitted.partyBName).toBe("Beta Inc.");
      expect(submitted.businessPurpose).toBe("joint venture");
      expect(submitted.governingState).toBe("California");
    });

    it("includes default values in submission if not changed", async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<NdaForm onSubmit={onSubmit} />);
      await fillAndSubmit(user);
      const submitted: NdaFormData = onSubmit.mock.calls[0][0];
      expect(submitted.confidentialityTerm).toBe("3");
      expect(submitted.disputeNoticeDays).toBe("30");
    });
  });
});

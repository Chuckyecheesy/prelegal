import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { fillTemplate } from "@/lib/fillTemplate";
import type { NdaFormData } from "@/types/nda";

const BASE_DATA: NdaFormData = {
  partyAName: "Acme Corp.",
  partyAAddress: "123 Main St, Toronto, ON M5V 1A1",
  partyAEmail: "legal@acme.com",
  partyBName: "Beta Inc.",
  partyBAddress: "456 Queen St, Vancouver, BC V6B 2K9",
  partyBEmail: "legal@beta.com",
  businessPurpose: "evaluating a potential technology partnership",
  effectiveDate: "2026-08-14",
  governingState: "California",
  confidentialityTerm: "3",
  disputeCountyState: "Santa Clara County, California",
  disputeNoticeDays: "30",
};

// Minimal template with every placeholder used exactly once (or twice for [3])
const MINIMAL_TEMPLATE = `
Agreement entered as of [Insert date].

Party A: [Full Legal Name of Party A], [Party A Street Address], [Party A Email Address]
Party B: [Full Legal Name of Party B], [Party B Street Address], [Party B Email Address]

Purpose: [brief description of business purpose or project]

Term: [3] years from last disclosure. Obligations survive for [3] years after termination.

Governing Law: State of [State].

Disputes in [County, State] within [30] days.
`.trim();

describe("fillTemplate", () => {
  describe("Party A substitutions", () => {
    it("substitutes Party A name", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("Acme Corp.");
      expect(result).not.toContain("[Full Legal Name of Party A]");
    });

    it("substitutes Party A address", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("123 Main St, Toronto, ON M5V 1A1");
      expect(result).not.toContain("[Party A Street Address]");
    });

    it("substitutes Party A email", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("legal@acme.com");
      expect(result).not.toContain("[Party A Email Address]");
    });
  });

  describe("Party B substitutions", () => {
    it("substitutes Party B name", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("Beta Inc.");
      expect(result).not.toContain("[Full Legal Name of Party B]");
    });

    it("substitutes Party B address — distinct from Party A", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("456 Queen St, Vancouver, BC V6B 2K9");
      expect(result).not.toContain("[Party B Street Address]");
      // Both addresses appear, not just Party A's
      expect(result).toContain("123 Main St, Toronto, ON M5V 1A1");
    });

    it("substitutes Party B email — distinct from Party A", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("legal@beta.com");
      expect(result).not.toContain("[Party B Email Address]");
      // Both emails appear, not just Party A's
      expect(result).toContain("legal@acme.com");
    });
  });

  describe("Agreement detail substitutions", () => {
    it("substitutes business purpose", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("evaluating a potential technology partnership");
      expect(result).not.toContain("[brief description of business purpose or project]");
    });

    it("substitutes governing state", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("State of California");
      expect(result).not.toContain("[State]");
    });

    it("substitutes dispute county/state", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("Santa Clara County, California");
      expect(result).not.toContain("[County, State]");
    });

    it("substitutes dispute notice days", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("30");
      expect(result).not.toContain("[30]");
    });

    it("replaces both occurrences of the confidentiality term [3]", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).not.toContain("[3]");
      // Template has two occurrences — both should be replaced
      const matches = result.match(/\b3 years\b/g);
      expect(matches).toHaveLength(2);
    });

    it("replaces confidentiality term with non-default value", () => {
      const data = { ...BASE_DATA, confidentialityTerm: "5" };
      const result = fillTemplate(MINIMAL_TEMPLATE, data);
      expect(result).not.toContain("[3]");
      const matches = result.match(/\b5 years\b/g);
      expect(matches).toHaveLength(2);
    });

    it("replaces dispute notice days with non-default value", () => {
      const data = { ...BASE_DATA, disputeNoticeDays: "60" };
      const result = fillTemplate(MINIMAL_TEMPLATE, data);
      expect(result).toContain("60");
      expect(result).not.toContain("[30]");
    });

    it("[3] placeholder does not corrupt [30] — cross-contamination guard", () => {
      const data = { ...BASE_DATA, confidentialityTerm: "5", disputeNoticeDays: "30" };
      const result = fillTemplate(MINIMAL_TEMPLATE, data);
      // [30] → "30 days", not "50 days" or "3 0 days"
      expect(result).toContain("30");
      expect(result).not.toContain("50");
    });

    it("strips a unit the user included so the template's own unit isn't doubled", () => {
      const data = {
        ...BASE_DATA,
        confidentialityTerm: "3 years",
        disputeNoticeDays: "30 days",
      };
      const result = fillTemplate(MINIMAL_TEMPLATE, data);
      expect(result).not.toContain("years years");
      expect(result).not.toContain("days days");
      const matches = result.match(/\b3 years\b/g);
      expect(matches).toHaveLength(2);
    });
  });

  describe("Date formatting", () => {
    it("formats ISO date as long-form legal date", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("August 14, 2026");
      expect(result).not.toContain("2026-08-14");
      expect(result).not.toContain("[Insert date]");
    });

    it("formats beginning-of-month date correctly (no off-by-one from UTC)", () => {
      const data = { ...BASE_DATA, effectiveDate: "2026-01-01" };
      const result = fillTemplate(MINIMAL_TEMPLATE, data);
      expect(result).toContain("January 1, 2026");
    });

    it("formats end-of-month date without UTC shift", () => {
      const data = { ...BASE_DATA, effectiveDate: "2026-03-31" };
      const result = fillTemplate(MINIMAL_TEMPLATE, data);
      expect(result).toContain("March 31, 2026");
    });
  });

  describe("Signature block", () => {
    it("appends signature block to the document", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("## Signatures");
    });

    it("includes Disclosing Party signature lines", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("### Disclosing Party");
      expect(result).toContain("**Signature:**");
    });

    it("includes Receiving Party signature lines", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      expect(result).toContain("### Receiving Party");
    });

    it("signature block appears after the main document body", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      const bodyEnd = result.indexOf("days.");
      const sigStart = result.indexOf("## Signatures");
      expect(sigStart).toBeGreaterThan(bodyEnd);
    });
  });

  describe("No remaining placeholders", () => {
    it("leaves no unfilled square-bracket placeholders in output", () => {
      const result = fillTemplate(MINIMAL_TEMPLATE, BASE_DATA);
      // Match any [placeholder] pattern (not markdown links like [text](url))
      const remaining = result.match(/\[[^\]]+\](?!\()/g) ?? [];
      expect(remaining).toHaveLength(0);
    });
  });

  describe("Edge cases", () => {
    it("handles party names with special characters", () => {
      const data = {
        ...BASE_DATA,
        partyAName: "O'Brien & Partners, LLC",
        partyBName: "Müller GmbH & Co. KG",
      };
      const result = fillTemplate(MINIMAL_TEMPLATE, data);
      expect(result).toContain("O'Brien & Partners, LLC");
      expect(result).toContain("Müller GmbH & Co. KG");
    });

    it("handles empty business purpose without crashing", () => {
      const data = { ...BASE_DATA, businessPurpose: "" };
      expect(() => fillTemplate(MINIMAL_TEMPLATE, data)).not.toThrow();
    });

    it("Party A and Party B values do not cross-contaminate", () => {
      const data = {
        ...BASE_DATA,
        partyAName: "UNIQUE_PARTY_A",
        partyBName: "UNIQUE_PARTY_B",
        partyAAddress: "ADDR_A",
        partyBAddress: "ADDR_B",
        partyAEmail: "EMAIL_A@test.com",
        partyBEmail: "EMAIL_B@test.com",
      };
      const result = fillTemplate(MINIMAL_TEMPLATE, data);
      // Each unique token appears exactly once
      expect((result.match(/UNIQUE_PARTY_A/g) ?? []).length).toBe(1);
      expect((result.match(/UNIQUE_PARTY_B/g) ?? []).length).toBe(1);
      expect((result.match(/ADDR_A/g) ?? []).length).toBe(1);
      expect((result.match(/ADDR_B/g) ?? []).length).toBe(1);
    });
  });

  // Runs fillTemplate against the actual template file on disk, not the
  // synthetic MINIMAL_TEMPLATE fixture above. The fixture can drift from the
  // real template (e.g. it kept a "[Insert date]" placeholder years after
  // the real template's intro clause lost its own), silently masking bugs
  // that only show up in a real generated document.
  describe("Real template file (frontend/templates/Mutual-NDA.md)", () => {
    const realTemplate = fs.readFileSync(
      path.join(process.cwd(), "templates", "Mutual-NDA.md"),
      "utf-8"
    );

    it("leaves no bracketed placeholders unfilled", () => {
      const result = fillTemplate(realTemplate, BASE_DATA);
      expect(result.match(/\[[A-Za-z][^\]]*\]/g)).toBeNull();
    });

    it("renders the effective date somewhere in the document", () => {
      const result = fillTemplate(realTemplate, BASE_DATA);
      expect(result).toContain("August 14, 2026");
    });

    it("has exactly one Signatures section", () => {
      const result = fillTemplate(realTemplate, BASE_DATA);
      expect((result.match(/## Signatures/g) ?? []).length).toBe(1);
    });

    it("doesn't double the period after a business purpose that already ends in one", () => {
      const data = {
        ...BASE_DATA,
        businessPurpose: "evaluating a potential technology partnership.",
      };
      const result = fillTemplate(realTemplate, data);
      expect(result).not.toContain("..");
      expect(result).toContain(
        "evaluating a potential technology partnership. This Agreement governs"
      );
    });
  });
});

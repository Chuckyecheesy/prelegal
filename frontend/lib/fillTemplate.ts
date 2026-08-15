import type { NdaFormData } from "@/types/nda";

const SIGNATURE_BLOCK = `

---

## Signatures

By signing below, the parties agree to the terms of this Agreement.

### Disclosing Party

**Name:** ________________________________

**Title:** _________________________________

**Signature:** _____________________________

**Date:** _________________________________

---

### Receiving Party

**Name:** ________________________________

**Title:** _________________________________

**Signature:** _____________________________

**Date:** _________________________________
`;

// The template's own text already supplies the unit ("... for [3] years"),
// so a value like "3 years" (the user's exact wording, copied verbatim into
// the field) would render as "3 years years". Extract just the number for
// these two placeholders — the field descriptions call for "a whole number".
function extractNumber(value: string): string {
  const match = value.match(/\d+/);
  return match ? match[0] : value;
}

function formatDate(isoDate: string): string {
  // Append time to prevent UTC-offset date shifting
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function fillTemplate(template: string, data: NdaFormData): string {
  const filled = template
    .replaceAll("[Full Legal Name of Party A]", data.partyAName)
    .replaceAll("[Party A Street Address]", data.partyAAddress)
    .replaceAll("[Party A Email Address]", data.partyAEmail)
    .replaceAll("[Full Legal Name of Party B]", data.partyBName)
    .replaceAll("[Party B Street Address]", data.partyBAddress)
    .replaceAll("[Party B Email Address]", data.partyBEmail)
    .replace(
      "[brief description of business purpose or project]",
      data.businessPurpose
    )
    .replace("[Insert date]", formatDate(data.effectiveDate))
    .replace("[State]", data.governingState)
    .replace("[County, State]", data.disputeCountyState)
    // Regex anchors prevent [3] from matching inside [30] or other [3x] tokens
    .replace(/\[30\]/g, extractNumber(data.disputeNoticeDays))
    .replace(/\[3\]/g, extractNumber(data.confidentialityTerm));

  return filled + SIGNATURE_BLOCK;
}

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
    .replace("[Full Legal Name of Party A]", data.partyAName)
    .replace("[Party A Street Address]", data.partyAAddress)
    .replace("[Party A Email Address]", data.partyAEmail)
    .replace("[Full Legal Name of Party B]", data.partyBName)
    .replace("[Party B Street Address]", data.partyBAddress)
    .replace("[Party B Email Address]", data.partyBEmail)
    .replace(
      "[brief description of business purpose or project]",
      data.businessPurpose
    )
    .replace("[Insert date]", formatDate(data.effectiveDate))
    .replace("[State]", data.governingState)
    .replace("[County, State]", data.disputeCountyState)
    .replace("[30]", data.disputeNoticeDays)
    // Confidentiality term appears twice in the template
    .replaceAll("[3]", data.confidentialityTerm);

  return filled + SIGNATURE_BLOCK;
}

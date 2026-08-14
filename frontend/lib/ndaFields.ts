import type { NdaFormData } from "@/types/nda";

// Mirrors backend/app/nda_fields.py's NDA_FIELDS keys and ordering — if
// NdaFormData changes, update both.
export const NDA_FIELD_LABELS: Record<keyof NdaFormData, string> = {
  partyAName: "Party A — Full Legal Name",
  partyAAddress: "Party A — Address",
  partyAEmail: "Party A — Email",
  partyBName: "Party B — Full Legal Name",
  partyBAddress: "Party B — Address",
  partyBEmail: "Party B — Email",
  businessPurpose: "Business Purpose",
  effectiveDate: "Effective Date",
  governingState: "Governing State",
  confidentialityTerm: "Confidentiality Term (years)",
  disputeCountyState: "Dispute Resolution Jurisdiction",
  disputeNoticeDays: "Dispute Notice Period (days)",
};

export const NDA_FIELD_ORDER = Object.keys(
  NDA_FIELD_LABELS
) as (keyof NdaFormData)[];

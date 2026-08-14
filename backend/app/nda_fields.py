"""Canonical Mutual NDA field keys and descriptions.

Mirrors `frontend/types/nda.ts`'s `NdaFormData` shape — if that changes, update
this too.
"""

NDA_FIELDS: dict[str, str] = {
    "partyAName": "Full legal name of Party A, the disclosing party",
    "partyAAddress": "Mailing address of Party A",
    "partyAEmail": "Email address of Party A",
    "partyBName": "Full legal name of Party B, the receiving party",
    "partyBAddress": "Mailing address of Party B",
    "partyBEmail": "Email address of Party B",
    "businessPurpose": "The business purpose for which confidential information will be exchanged",
    "effectiveDate": "The effective date of the agreement, as YYYY-MM-DD",
    "governingState": "The US state whose law governs the agreement",
    "confidentialityTerm": "Confidentiality term in years, a whole number",
    "disputeCountyState": "County and state for dispute resolution jurisdiction, e.g. 'Santa Clara County, California'",
    "disputeNoticeDays": "Dispute notice period in days, a whole number",
}

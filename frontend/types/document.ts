import type { NdaFormData } from "@/types/nda";

export interface DocumentSummary {
  id: number;
  document_type: string;
  party_a_name: string;
  party_b_name: string;
  created_at: string;
}

export interface DocumentDetail extends DocumentSummary {
  fields: NdaFormData;
}

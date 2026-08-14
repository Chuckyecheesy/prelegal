"use client";

import { useState } from "react";
import NdaChat from "./NdaChat";
import NdaPreview from "./NdaPreview";
import type { NdaFormData } from "@/types/nda";
import { API_URL } from "@/lib/api";

interface Props {
  template: string;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function NdaCreator({ template }: Props) {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [formData, setFormData] = useState<NdaFormData | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const handleFormSubmit = async (data: NdaFormData) => {
    setFormData(data);
    setStep("preview");
    window.scrollTo({ top: 0, behavior: "smooth" });

    setSaveStatus("saving");
    try {
      const response = await fetch(`${API_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fields: data }),
      });
      setSaveStatus(response.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
  };

  const handleBack = () => {
    setStep("form");
    setSaveStatus("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      {step === "form" && <NdaChat onSubmit={handleFormSubmit} />}
      {step === "preview" && formData && (
        <NdaPreview
          template={template}
          data={formData}
          onBack={handleBack}
          saveStatus={saveStatus}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import NdaForm from "./NdaForm";
import NdaPreview from "./NdaPreview";
import type { NdaFormData } from "@/types/nda";

interface Props {
  template: string;
}

export default function NdaCreator({ template }: Props) {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [formData, setFormData] = useState<NdaFormData | null>(null);

  const handleFormSubmit = (data: NdaFormData) => {
    setFormData(data);
    setStep("preview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    setStep("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      {step === "form" && <NdaForm onSubmit={handleFormSubmit} />}
      {step === "preview" && formData && (
        <NdaPreview
          template={template}
          data={formData}
          onBack={handleBack}
        />
      )}
    </div>
  );
}

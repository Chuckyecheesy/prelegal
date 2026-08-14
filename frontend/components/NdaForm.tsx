"use client";

import { useState } from "react";
import type { NdaFormData } from "@/types/nda";

interface Props {
  onSubmit: (data: NdaFormData) => void;
}

const today = new Date().toISOString().split("T")[0];

const INITIAL: NdaFormData = {
  partyAName: "",
  partyAAddress: "",
  partyAEmail: "",
  partyBName: "",
  partyBAddress: "",
  partyBEmail: "",
  businessPurpose: "",
  effectiveDate: today,
  governingState: "",
  confidentialityTerm: "3",
  disputeCountyState: "",
  disputeNoticeDays: "30",
};

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  required = true,
}: {
  label: string;
  name: keyof NdaFormData;
  value: string;
  onChange: (name: keyof NdaFormData, value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}

function TextAreaField({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: keyof NdaFormData;
  value: string;
  onChange: (name: keyof NdaFormData, value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        <span className="text-red-500 ml-1">*</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        required
        rows={3}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}

export default function NdaForm({ onSubmit }: Props) {
  const [form, setForm] = useState<NdaFormData>(INITIAL);

  const handleChange = (name: keyof NdaFormData, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Party A */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-900">
          Party A — Disclosing Party
        </h2>
        <Field
          label="Full Legal Name"
          name="partyAName"
          value={form.partyAName}
          onChange={handleChange}
          placeholder="Acme Corp."
        />
        <Field
          label="Address"
          name="partyAAddress"
          value={form.partyAAddress}
          onChange={handleChange}
          placeholder="123 Main St, Toronto, ON M5V 1A1"
        />
        <Field
          label="Email"
          name="partyAEmail"
          value={form.partyAEmail}
          onChange={handleChange}
          type="email"
          placeholder="legal@acme.com"
        />
      </section>

      {/* Party B */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-900">
          Party B — Receiving Party
        </h2>
        <Field
          label="Full Legal Name"
          name="partyBName"
          value={form.partyBName}
          onChange={handleChange}
          placeholder="Beta Inc."
        />
        <Field
          label="Address"
          name="partyBAddress"
          value={form.partyBAddress}
          onChange={handleChange}
          placeholder="456 Queen St, Vancouver, BC V6B 2K9"
        />
        <Field
          label="Email"
          name="partyBEmail"
          value={form.partyBEmail}
          onChange={handleChange}
          type="email"
          placeholder="legal@beta.com"
        />
      </section>

      {/* Agreement details */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-900">
          Agreement Details
        </h2>
        <TextAreaField
          label="Business Purpose"
          name="businessPurpose"
          value={form.businessPurpose}
          onChange={handleChange}
          placeholder="Evaluating a potential technology partnership between the parties"
        />
        <Field
          label="Effective Date"
          name="effectiveDate"
          value={form.effectiveDate}
          onChange={handleChange}
          type="date"
        />
        <Field
          label="Governing State"
          name="governingState"
          value={form.governingState}
          onChange={handleChange}
          placeholder="California"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Confidentiality Term (years)"
            name="confidentialityTerm"
            value={form.confidentialityTerm}
            onChange={handleChange}
            type="number"
            placeholder="3"
          />
          <Field
            label="Dispute Notice Period (days)"
            name="disputeNoticeDays"
            value={form.disputeNoticeDays}
            onChange={handleChange}
            type="number"
            placeholder="30"
          />
        </div>
        <Field
          label="Dispute Resolution Jurisdiction (County, State)"
          name="disputeCountyState"
          value={form.disputeCountyState}
          onChange={handleChange}
          placeholder="Santa Clara County, California"
        />
      </section>

      <button
        type="submit"
        className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 transition-colors"
      >
        Generate NDA →
      </button>
    </form>
  );
}

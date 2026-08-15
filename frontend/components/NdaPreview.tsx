"use client";

import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { NdaFormData } from "@/types/nda";
import { fillTemplate } from "@/lib/fillTemplate";
import type { SaveStatus } from "./NdaCreator";

interface Props {
  template: string;
  data: NdaFormData;
  onBack: () => void;
  saveStatus?: SaveStatus;
}

const SAVE_STATUS_LABEL: Record<Exclude<SaveStatus, "idle">, string> = {
  saving: "Saving…",
  saved: "✓ Saved to history",
  error: "Couldn't save to history",
};

export default function NdaPreview({
  template,
  data,
  onBack,
  saveStatus = "idle",
}: Props) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const filled = useMemo(() => fillTemplate(template, data), [template, data]);

  const handleDownload = async () => {
    if (!documentRef.current || isDownloading) return;
    setIsDownloading(true);
    setDownloadError(null);

    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const { default: jsPDF } = await import("jspdf");

      const canvas = await html2canvas(documentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const printWidth = pageWidth - margin * 2;
      const printHeight = pageHeight - margin * 2;

      // pixels per PDF page
      const pxPerPage = Math.floor((canvas.width * printHeight) / printWidth);
      let pageTop = 0;
      let isFirstPage = true;

      while (pageTop < canvas.height) {
        const remainingHeight = canvas.height - pageTop;
        const sliceHeight = Math.min(pxPerPage, remainingHeight);
        const minimumSliceHeight = 0.05 * pxPerPage;

        if (pageTop > 0 && sliceHeight < minimumSliceHeight) {
          break;
        }

        if (!isFirstPage) pdf.addPage();

        // Slice only the pixels that belong on this page
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeight;
        sliceCanvas
          .getContext("2d")!
          .drawImage(
            canvas,
            0,
            pageTop,
            sliceCanvas.width,
            sliceCanvas.height,
            0,
            0,
            sliceCanvas.width,
            sliceCanvas.height
          );

        const renderedHeight = (sliceCanvas.height * printWidth) / canvas.width;
        pdf.addImage(
          sliceCanvas.toDataURL("image/png"),
          "PNG",
          margin,
          margin,
          printWidth,
          renderedHeight
        );

        pageTop += pxPerPage;
        isFirstPage = false;
      }

      const filename = `Mutual-NDA-${data.partyAName}-${data.partyBName}`
        .replace(/[^\p{L}\p{N}-]/gu, "_")
        .slice(0, 80);
      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
      setDownloadError("Failed to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {downloadError && (
        <p role="alert" className="text-sm text-red-600">
          {downloadError}
        </p>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back to Form
        </button>
        <div className="flex items-center gap-4">
          {saveStatus !== "idle" && (
            <span
              className={`text-xs font-medium ${
                saveStatus === "error" ? "text-red-600" : "text-gray-500"
              }`}
            >
              {SAVE_STATUS_LABEL[saveStatus]}
            </span>
          )}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDownloading ? "Generating PDF…" : "↓ Download PDF"}
          </button>
        </div>
      </div>

      {/* Draft disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong className="font-semibold">Draft only.</strong> This document
        was generated automatically and should be considered a draft. It is
        not legal advice — have it reviewed by a licensed attorney before you
        rely on or sign it.
      </div>

      {/* NDA Document */}
      <div
        ref={documentRef}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 prose prose-sm max-w-none
          prose-headings:font-semibold prose-headings:text-gray-900
          prose-h1:text-2xl prose-h1:mb-6
          prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
          prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
          prose-p:text-gray-700 prose-p:leading-relaxed
          prose-li:text-gray-700
          prose-strong:text-gray-900
          prose-hr:border-gray-300"
      >
        <ReactMarkdown>{filled}</ReactMarkdown>
      </div>
    </div>
  );
}

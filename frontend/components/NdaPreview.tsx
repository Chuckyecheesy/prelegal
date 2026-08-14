"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { NdaFormData } from "@/types/nda";
import { fillTemplate } from "@/lib/fillTemplate";

interface Props {
  template: string;
  data: NdaFormData;
  onBack: () => void;
}

export default function NdaPreview({ template, data, onBack }: Props) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const filled = fillTemplate(template, data);

  const handleDownload = async () => {
    if (!documentRef.current || isDownloading) return;
    setIsDownloading(true);

    try {
      const { default: html2canvas } = await import("html2canvas");
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
        if (!isFirstPage) pdf.addPage();

        // Slice only the pixels that belong on this page
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(pxPerPage, canvas.height - pageTop);
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

        const sliceHeight = (sliceCanvas.height * printWidth) / canvas.width;
        pdf.addImage(
          sliceCanvas.toDataURL("image/png"),
          "PNG",
          margin,
          margin,
          printWidth,
          sliceHeight
        );

        pageTop += pxPerPage;
        isFirstPage = false;
      }

      const filename = `Mutual-NDA-${data.partyAName}-${data.partyBName}`
        .replace(/[^a-zA-Z0-9-]/g, "_")
        .slice(0, 80);
      pdf.save(`${filename}.pdf`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back to Form
        </button>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isDownloading ? "Generating PDF…" : "↓ Download PDF"}
        </button>
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

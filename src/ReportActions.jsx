import React from 'react';
import { Copy, FileText, Send } from 'lucide-react';

export default function ReportActions({ activeReport = 'customer', internalReportData }) {
  function copyInternalJson() {
    navigator.clipboard?.writeText(JSON.stringify(internalReportData, null, 2));
  }

  function printReport() {
    window.print();
  }

  return (
    <div className="reportActions">
      {activeReport === 'customer' ? (
        <>
          <button type="button" className="secondaryButton" onClick={printReport}>
            <FileText size={17} />
            Download klantadvies
          </button>
          <button type="button" className="secondaryButton">
            <Send size={17} />
            Vraag offerte aan
          </button>
        </>
      ) : (
        <>
          <button type="button" className="secondaryButton" onClick={printReport}>
            <FileText size={17} />
            Download intern rapport
          </button>
          <button type="button" className="secondaryButton" onClick={copyInternalJson}>
            <Copy size={17} />
            Kopieer interne JSON
          </button>
        </>
      )}
    </div>
  );
}

import api from '../services/api';
import { useToast } from '../context/ToastContext';

// ── Hook for PDF downloads ────────────────────────────────
export function usePDFDownload() {
  const { toast } = useToast();

  const download = async (url, filename) => {
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href     = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast('PDF downloaded.', 'success');
    } catch (err) {
      toast('PDF generation failed.', 'error');
    }
  };

  const downloadTaskReport = (filters = {}) => {
    const params = new URLSearchParams(filters);
    download(`/pdf/tasks?${params}`, `task-report-${Date.now()}.pdf`);
  };

  const downloadClientSummary = (clientId, clientName) => {
    download(`/pdf/client/${clientId}`, `${clientName.replace(/\s+/g,'-')}-summary.pdf`);
  };

  return { downloadTaskReport, downloadClientSummary };
}

// ── PDF Download Button component ─────────────────────────
export function PDFButton({ onClick, label = 'Download PDF', small = false }) {
  return (
    <button
      onClick={onClick}
      className={`${small ? 'text-xs py-1.5 px-3' : 'text-sm py-2 px-4'} btn-outline flex items-center gap-2 transition-colors hover:border-red-400/50 hover:text-red-300`}>
      <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      {label}
    </button>
  );
}

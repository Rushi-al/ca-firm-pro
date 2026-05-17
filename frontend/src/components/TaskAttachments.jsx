import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/index.jsx';

const ICONS = {
  'application/pdf':    '📄',
  'image/jpeg':         '🖼️',
  'image/png':          '🖼️',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'text/csv':           '📊',
};

const fmtSize = bytes => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/(1024*1024)).toFixed(1)} MB`;
};

const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

export default function TaskAttachments({ taskId }) {
  const { user }   = useAuth();
  const { toast }  = useToast();
  const isAdmin    = ['Owner','Admin'].includes(user?.role);
  const fileRef    = useRef(null);

  const [attachments, setAttachments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [confirm,     setConfirm]     = useState(null);

  const load = async () => {
    try {
      const res = await api.get(`/tasks/${taskId}/attachments`);
      setAttachments(res.data.data);
    } catch {
      // silent fail — attachments are supplementary
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [taskId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX = 10 * 1024 * 1024;
    if (file.size > MAX) return toast('File too large. Maximum 10MB.', 'error');

    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await api.post(`/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      toast(`"${file.name}" uploaded.`, 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (att) => {
    try {
      await api.delete(`/tasks/${taskId}/attachments/${att._id}`);
      toast(`"${att.originalName}" deleted.`, 'success');
      setConfirm(null);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Delete failed.', 'error');
    }
  };

  const canDelete = (att) =>
    isAdmin || att.uploadedBy?._id === user?.id || att.uploadedBy === user?.id;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-300">
          Attachments
          {attachments.length > 0 && (
            <span className="ml-2 text-xs text-slate-500 font-normal">{attachments.length} file{attachments.length > 1 ? 's' : ''}</span>
          )}
        </p>
        <div>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.csv" />
          <button
            className="btn-outline text-xs py-1.5 px-3"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}>
            {uploading ? `Uploading ${progress}%…` : '+ Upload File'}
          </button>
        </div>
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div className="mb-3">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="skeleton h-10 rounded-lg" />
      ) : attachments.length === 0 ? (
        <div className="text-center py-5 border border-dashed border-slate-700 rounded-xl">
          <p className="text-slate-500 text-sm">No files attached</p>
          <p className="text-xs text-slate-600 mt-0.5">PDF, Word, Excel, Images up to 10MB</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att._id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
              {/* Icon */}
              <span className="text-xl flex-shrink-0">{ICONS[att.mimeType] || '📎'}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 font-medium truncate">{att.originalName}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span>{fmtSize(att.sizeBytes)}</span>
                  <span>v{att.version}</span>
                  <span>by {att.uploadedBy?.name?.split(' ')[0]}</span>
                  <span>{fmtDate(att.createdAt)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                {att.downloadUrl && (
                  <a
                    href={att.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost text-xs px-2.5 py-1.5 text-amber-400 hover:bg-amber-400/10 no-underline">
                    Download
                  </a>
                )}
                {canDelete(att) && (
                  <button
                    className="btn-ghost text-xs px-2 py-1.5 hover:text-red-400 hover:bg-red-400/10"
                    onClick={() => setConfirm(att)}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={`Delete "${confirm.originalName}"?`}
          message="This file will be permanently deleted and cannot be recovered."
          onConfirm={() => handleDelete(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

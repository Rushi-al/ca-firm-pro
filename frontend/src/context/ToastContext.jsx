import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const remove = (id) => setToasts(t => t.filter(x => x.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`slide-up flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium pointer-events-auto max-w-sm
              ${t.type === 'success' ? 'bg-emerald-950 border-emerald-700 text-emerald-300' :
                t.type === 'error'   ? 'bg-red-950   border-red-700   text-red-300'     :
                t.type === 'info'    ? 'bg-slate-800 border-slate-600 text-slate-200'   :
                                       'bg-amber-950 border-amber-700 text-amber-300'}`}>
            <span className="text-base leading-none mt-0.5">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'info' ? 'ℹ' : '⚠'}
            </span>
            <span className="flex-1">{t.message}</span>
            <button className="opacity-60 hover:opacity-100 transition-opacity leading-none" onClick={() => remove(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

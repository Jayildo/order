import { useRef, useState } from 'react';

/**
 * Reusable file upload component.
 *
 * Props:
 *   label       — display label (string)
 *   accept      — file accept string, e.g. ".xlsx,.xls"
 *   onFileLoad  — callback(file: File) — passes raw File object to parent
 *   status      — null | { type: 'success' | 'error', message: string }
 *   description — optional helper text
 */
export default function FileUploader({ label, accept = '.xlsx,.xls', onFileLoad, status, description }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    onFileLoad(file);
  };

  const handleChange = (e) => {
    handleFile(e.target.files[0]);
    // Reset so same file can be re-uploaded
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const isSuccess = status?.type === 'success';
  const isError = status?.type === 'error';

  let borderClass = 'border-dashed border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30';
  if (dragging) borderClass = 'border-blue-500 bg-blue-50';
  else if (isSuccess) borderClass = 'border-emerald-400 bg-emerald-50';
  else if (isError) borderClass = 'border-red-400 bg-red-50';

  return (
    <div
      className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all duration-200 ${borderClass}`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />

      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold
          ${isSuccess ? 'bg-emerald-100 text-emerald-600' : isError ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}
        >
          {isSuccess ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : isError ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm">{label}</div>
          {description && !status && (
            <div className="text-xs text-slate-400 truncate">{description}</div>
          )}
          {status && (
            <div className={`text-xs font-medium truncate ${isSuccess ? 'text-emerald-600' : 'text-red-600'}`}>
              {status.message}
            </div>
          )}
          {!status && !description && (
            <div className="text-xs text-slate-400">클릭하거나 파일을 드래그하세요</div>
          )}
        </div>

        {/* Upload button indicator */}
        {!isSuccess && (
          <div className="flex-shrink-0 text-xs text-slate-400 border border-slate-200 rounded px-2 py-1 bg-white">
            선택
          </div>
        )}
        {isSuccess && (
          <div className="flex-shrink-0 text-xs text-slate-400 border border-slate-200 rounded px-2 py-1 bg-white">
            재선택
          </div>
        )}
      </div>
    </div>
  );
}

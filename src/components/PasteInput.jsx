import { useState } from 'react';

/**
 * Textarea for pasting tab-separated data from a web browser.
 *
 * Props:
 *   onParse  — callback(text: string) called when user clicks "적용"
 *   label    — section label
 */
export default function PasteInput({ onParse, label }) {
  const [text, setText] = useState('');
  const [rowCount, setRowCount] = useState(null);

  const handleApply = () => {
    if (!text.trim()) return;
    onParse(text);
    // Estimate row count: non-empty lines minus header
    const lines = text.trim().split('\n').filter(l => l.trim());
    setRowCount(Math.max(0, lines.length - 1));
  };

  const handleClear = () => {
    setText('');
    setRowCount(null);
    onParse('');
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="w-full h-32 text-sm border border-slate-300 rounded-lg p-3 resize-y
          font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400
          focus:border-transparent transition"
        placeholder={
          `배송중 데이터를 웹에서 복사하여 붙여넣기 하세요.\n` +
          `(탭으로 구분된 데이터: 주문번호, 完, 화주, 하단일, 통관검사재질, 바코드, 下单套数...)`
        }
        value={text}
        onChange={(e) => { setText(e.target.value); setRowCount(null); }}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={handleApply}
          disabled={!text.trim()}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition
            ${text.trim()
              ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              : 'bg-slate-300 cursor-not-allowed'
            }`}
        >
          적용
        </button>

        {text && (
          <button
            onClick={handleClear}
            className="px-4 py-1.5 rounded-lg text-sm text-slate-600 border border-slate-300
              hover:bg-slate-100 transition cursor-pointer"
          >
            초기화
          </button>
        )}

        {rowCount !== null && (
          <span className="text-sm font-semibold text-emerald-600">
            {rowCount.toLocaleString()}행 입력됨
          </span>
        )}
      </div>
    </div>
  );
}

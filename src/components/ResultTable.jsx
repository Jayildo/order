import { useState } from 'react';

const HEADERS = [
  { key: 'idx', label: '#', align: 'center' },
  { key: 'barcode', label: '바코드', align: 'left' },
  { key: 'name', label: '상품명', align: 'left' },
  { key: 'orderCount', label: '발주건수', align: 'right' },
  { key: 'totalOrder', label: '총발주수량', align: 'right' },
  { key: 'available', label: '가용재고', align: 'right' },
  { key: 'weihaiStock', label: '위해_재고', align: 'right' },
  { key: 'transit', label: '배송중', align: 'right' },
  { key: 'totalStock', label: '총재고', align: 'right' },
  { key: 'shortage', label: '부족수량', align: 'right' },
  { key: 'status', label: '상태', align: 'center' },
];

export default function ResultTable({ rows, onExport }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  if (!rows || rows.length === 0) return null;

  const filtered = rows.filter(r => {
    if (filter === 'need' && r.status !== 'need') return false;
    if (filter === 'ok' && r.status !== 'ok') return false;
    if (search) {
      const q = search.toLowerCase();
      return r.barcode.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    }
    return true;
  });

  const truncate = (s, n) => {
    s = String(s || '');
    return s.length > n ? s.slice(0, n) + '...' : s;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-800 mr-4">바코드별 재고 비교</h2>
          {['all', 'need', 'ok'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors
                ${filter === f
                  ? f === 'need' ? 'bg-red-100 text-red-700' : f === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
            >
              {f === 'all' ? `전체 (${rows.length})` : f === 'need' ? `주문필요 (${rows.filter(r => r.status === 'need').length})` : `충분 (${rows.filter(r => r.status === 'ok').length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="바코드/상품명 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 w-56"
          />
          <button
            onClick={onExport}
            className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Excel 다운로드
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {HEADERS.map(h => (
                <th
                  key={h.key}
                  className="bg-slate-800 text-white px-3 py-2.5 font-semibold whitespace-nowrap"
                  style={{ textAlign: h.align }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr
                key={r.barcode}
                className={`border-b border-slate-50 ${r.status === 'need' ? 'bg-red-50 hover:bg-red-100/60' : 'hover:bg-slate-50'}`}
              >
                <td className="px-3 py-2 text-center text-slate-500">{i + 1}</td>
                <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{r.barcode}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap" title={r.name}>{truncate(r.name, 35)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{r.orderCount}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{r.totalOrder}</td>
                <td className="px-3 py-2 text-right text-slate-600">{r.available}</td>
                <td className="px-3 py-2 text-right text-slate-600">{r.weihaiStock}</td>
                <td className="px-3 py-2 text-right text-slate-600">{r.transit}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{r.totalStock}</td>
                <td className={`px-3 py-2 text-right font-bold ${r.shortage > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  {r.shortage > 0 ? r.shortage : '-'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold
                    ${r.status === 'need' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {r.status === 'need' ? '주문필요' : '충분'}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={HEADERS.length} className="text-center py-8 text-slate-400">결과 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
        {filtered.length}건 표시 / 전체 {rows.length}건
      </div>
    </div>
  );
}

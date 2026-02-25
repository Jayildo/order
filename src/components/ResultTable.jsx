import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ASSIGNEES, ASSIGNEE_COLORS } from '../utils/constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'barcode',       label: '바코드',   align: 'left',   sortable: true },
  { key: 'name',          label: '상품명',   align: 'left',   sortable: true },
  { key: 'orderQty',      label: '발주수량', align: 'right',  sortable: true },
  { key: 'gimpo',         label: '김포',     align: 'right',  sortable: true },
  { key: 'weihai',        label: '위해',     align: 'right',  sortable: true },
  { key: 'transit',       label: '배송중',   align: 'right',  sortable: true },
  { key: 'totalStock',    label: '전체재고', align: 'right',  sortable: true },
  { key: 'orderAmount',   label: '주문수량', align: 'right',  sortable: true },
  { key: 'vendor',        label: '업체',     align: 'left',   sortable: true },
  { key: 'assignee',      label: '담당자',   align: 'center', sortable: true },
  { key: 'isTarget',      label: '상태',     align: 'center', sortable: true },
];

const PAGE_SIZE = 100;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n === null || n === undefined) return '-';
  return Number(n).toLocaleString('ko-KR');
}

function truncate(s, n) {
  const str = String(s || '');
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function rowToExcelRow(r) {
  return {
    '바코드': r.barcode,
    '상품명': r.name,
    '발주수량': r.orderQty,
    '김포': r.gimpo,
    '위해': r.weihai,
    '배송중': r.transit,
    '전체재고': r.totalStock,
    '주문수량': r.orderAmount,
    '업체': r.vendor,
    '담당자': r.assignee,
    '배정방식': r.isAutoAssigned ? '자동' : (r.assignee ? '수동' : ''),
    '상태': r.isTarget ? '주문필요' : '재고충분',
  };
}

// ─── Export Functions ─────────────────────────────────────────────────────────

function exportAll(filteredRows) {
  const wb = XLSX.utils.book_new();
  const data = filteredRows.map(rowToExcelRow);
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, '전체');
  XLSX.writeFile(wb, `주문필요산출_${todayString()}.xlsx`);
}

function exportByAssignee(allRows) {
  const wb = XLSX.utils.book_new();

  // Full sheet
  const allData = allRows.map(rowToExcelRow);
  const wsAll = XLSX.utils.json_to_sheet(allData);
  XLSX.utils.book_append_sheet(wb, wsAll, '전체');

  // Per-assignee sheets
  for (const name of ASSIGNEES) {
    const subset = allRows.filter((r) => r.assignee === name).map(rowToExcelRow);
    if (subset.length === 0) continue;
    const ws = XLSX.utils.json_to_sheet(subset);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  XLSX.writeFile(wb, `주문필요산출_${todayString()}.xlsx`);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PillButton({ active, activeClass, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap
        ${active ? activeClass : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  );
}

function SortIndicator({ dir }) {
  if (!dir) return <span className="ml-1 opacity-30">↕</span>;
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

function AssigneeBadge({ name, isAutoAssigned }) {
  const colors = ASSIGNEE_COLORS[name];
  const cls = colors?.badge ?? 'bg-gray-100 text-gray-600';
  if (!name) return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600`}>미배정</span>;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {name}{isAutoAssigned && <span className="text-[10px] font-normal opacity-70"> (자동)</span>}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResultTable({ rows }) {
  const [statusFilter, setStatusFilter] = useState('all');   // 'all' | 'need' | 'ok'
  const [assigneeFilter, setAssigneeFilter] = useState('all'); // 'all' | name | 'none'
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  if (!rows || rows.length === 0) return null;

  // ── Counts for pill labels ─────────────────────────────────────────────────
  const needCount       = rows.filter((r) => r.isTarget).length;
  const sufficientCount = rows.filter((r) => !r.isTarget).length;
  const autoCount       = rows.filter((r) => r.isAutoAssigned).length;
  const assigneeCounts  = useMemo(() => {
    const m = {};
    for (const a of [...ASSIGNEES, '']) {
      m[a] = rows.filter((r) => r.assignee === a).length;
    }
    return m;
  }, [rows]);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = rows;

    if (statusFilter === 'need') result = result.filter((r) => r.isTarget);
    else if (statusFilter === 'ok') result = result.filter((r) => !r.isTarget);

    if (assigneeFilter === 'none') result = result.filter((r) => !r.assignee);
    else if (assigneeFilter === 'auto') result = result.filter((r) => r.isAutoAssigned);
    else if (assigneeFilter !== 'all') result = result.filter((r) => r.assignee === assigneeFilter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) => r.barcode.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [rows, statusFilter, assigneeFilter, search]);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];

      // Boolean: treat true > false
      if (typeof va === 'boolean') { va = va ? 1 : 0; vb = vb ? 1 : 0; }

      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va ?? '');
      const sb = String(vb ?? '');
      return sortDir === 'asc' ? sa.localeCompare(sb, 'ko') : sb.localeCompare(sa, 'ko');
    });
  }, [filtered, sortKey, sortDir]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSort(key) {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  function handleFilterChange(setter) {
    return (val) => {
      setter(val);
      setPage(1);
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

      {/* ── Top toolbar ── */}
      <div className="p-4 border-b border-slate-100 space-y-3">

        {/* Row 1: Status + Assignee filters + Count */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status pills */}
          <div className="flex items-center gap-1.5">
            <PillButton
              active={statusFilter === 'all'}
              activeClass="bg-slate-200 text-slate-700"
              onClick={() => handleFilterChange(setStatusFilter)('all')}
            >
              전체 ({rows.length})
            </PillButton>
            <PillButton
              active={statusFilter === 'need'}
              activeClass="bg-red-100 text-red-700"
              onClick={() => handleFilterChange(setStatusFilter)('need')}
            >
              주문필요 ({needCount})
            </PillButton>
            <PillButton
              active={statusFilter === 'ok'}
              activeClass="bg-emerald-100 text-emerald-700"
              onClick={() => handleFilterChange(setStatusFilter)('ok')}
            >
              재고충분 ({sufficientCount})
            </PillButton>
          </div>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Assignee pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <PillButton
              active={assigneeFilter === 'all'}
              activeClass="bg-slate-200 text-slate-700"
              onClick={() => handleFilterChange(setAssigneeFilter)('all')}
            >
              전체
            </PillButton>
            {ASSIGNEES.map((name) => (
              <PillButton
                key={name}
                active={assigneeFilter === name}
                activeClass={ASSIGNEE_COLORS[name]?.badge ?? 'bg-gray-100 text-gray-600'}
                onClick={() => handleFilterChange(setAssigneeFilter)(name)}
              >
                {name} ({assigneeCounts[name] ?? 0})
              </PillButton>
            ))}
            <PillButton
              active={assigneeFilter === 'none'}
              activeClass="bg-gray-200 text-gray-700"
              onClick={() => handleFilterChange(setAssigneeFilter)('none')}
            >
              미배정 ({assigneeCounts[''] ?? 0})
            </PillButton>
            <PillButton
              active={assigneeFilter === 'auto'}
              activeClass="bg-amber-100 text-amber-700"
              onClick={() => handleFilterChange(setAssigneeFilter)('auto')}
            >
              자동배정 ({autoCount})
            </PillButton>
          </div>
        </div>

        {/* Row 2: Search + Count + Export buttons */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="바코드/상품명 검색..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 w-60"
            />
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {filtered.length} / {rows.length}건
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportAll(sorted)}
              className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              전체 내보내기
            </button>
            <button
              onClick={() => exportByAssignee(rows)}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              담당자별 내보내기
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`bg-slate-800 text-white px-3 py-2.5 font-semibold whitespace-nowrap select-none
                    ${col.sortable ? 'cursor-pointer hover:bg-slate-700' : ''}`}
                  style={{ textAlign: col.align }}
                >
                  {col.label}
                  {col.sortable && <SortIndicator dir={sortKey === col.key ? sortDir : null} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => {
              const isEven = i % 2 === 0;
              const baseClass = r.isTarget
                ? isEven ? 'bg-red-50' : 'bg-red-50/70'
                : isEven ? 'bg-white' : 'bg-slate-50/50';
              return (
                <tr
                  key={r.barcode + i}
                  className={`border-b border-slate-100 transition-colors ${baseClass} hover:bg-slate-100`}
                >
                  {/* 바코드 */}
                  <td className="px-3 py-2 font-mono text-xs text-slate-700 whitespace-nowrap">
                    {r.barcode}
                  </td>
                  {/* 상품명 */}
                  <td className="px-3 py-2 text-slate-600 max-w-[180px]" title={r.name}>
                    {truncate(r.name, 20)}
                  </td>
                  {/* 발주수량 */}
                  <td className="px-3 py-2 text-right text-slate-700">{fmt(r.orderQty)}</td>
                  {/* 김포 */}
                  <td className={`px-3 py-2 text-right ${r.gimpo === 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                    {fmt(r.gimpo)}
                  </td>
                  {/* 위해 */}
                  <td className={`px-3 py-2 text-right ${r.weihai === 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                    {fmt(r.weihai)}
                  </td>
                  {/* 배송중 */}
                  <td className={`px-3 py-2 text-right ${r.transit === 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                    {fmt(r.transit)}
                  </td>
                  {/* 전체재고 */}
                  <td className="px-3 py-2 text-right font-semibold text-slate-700">{fmt(r.totalStock)}</td>
                  {/* 주문수량 */}
                  <td className={`px-3 py-2 text-right font-bold ${r.orderAmount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {r.orderAmount > 0 ? fmt(r.orderAmount) : '-'}
                  </td>
                  {/* 업체 */}
                  <td className="px-3 py-2 text-slate-600 max-w-[120px]" title={r.vendor}>
                    {truncate(r.vendor, 15)}
                  </td>
                  {/* 담당자 */}
                  <td className="px-3 py-2 text-center">
                    <AssigneeBadge name={r.assignee} isAutoAssigned={r.isAutoAssigned} />
                  </td>
                  {/* 상태 */}
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {r.isTarget
                      ? <span className="text-red-600 font-semibold text-xs">🔴 필요</span>
                      : <span className="text-emerald-600 font-semibold text-xs">🟢 충분</span>}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-10 text-slate-400">
                  조건에 맞는 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer: count + pagination ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50">
        <span className="text-xs text-slate-500">
          {filtered.length}건 표시 / 전체 {rows.length}건
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1 text-xs rounded-md border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              이전
            </button>
            <span className="text-xs text-slate-600 font-medium">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1 text-xs rounded-md border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

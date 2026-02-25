import { useState, useEffect, useRef, useMemo } from 'react';
import {
  getMasterData,
  importFromXlsx,
  clearMasterData,
  hasMasterData,
  getSettings,
  saveSettings,
} from '../utils/masterData';
import { ASSIGNEES } from '../utils/constants';

/**
 * SettingsPage — master data management with tab-based layout.
 * Three tabs: SKU별 업체 매핑 / 담당자 배정 / 월결제·특수제작
 */

const TAB_CONFIG = [
  {
    id: 'skuVendor',
    title: 'SKU별 업체 매핑',
    description: '바코드 → SKU ID + 업체명 매핑 파일 (열: 바코드, SKU ID, 업체명)',
    columns: [
      { key: 'barcode',    label: '바코드' },
      { key: 'skuId',      label: 'SKU ID' },
      { key: 'vendorName', label: '업체명' },
    ],
    searchKeys: ['barcode', 'skuId', 'vendorName'],
  },
  {
    id: 'assignment',
    title: '담당자 배정',
    description: '업체명 → 담당자 배정 파일 (열: 업체정보, 상품수, 누적, 담당자)',
    columns: [
      { key: 'vendorName',   label: '업체정보' },
      { key: 'productCount', label: '상품수' },
      { key: 'cumulative',   label: '누적' },
      { key: 'assignee',     label: '담당자' },
    ],
    searchKeys: ['vendorName', 'assignee'],
  },
  {
    id: 'monthlyVendor',
    title: '월결제 / 특수제작',
    description: '월결제 또는 특수제작 바코드 목록 (열: 구분, 업체명, 바코드)',
    columns: [
      { key: 'category',   label: '구분' },
      { key: 'vendorName', label: '업체명' },
      { key: 'barcode',    label: '바코드' },
    ],
    searchKeys: ['category', 'vendorName', 'barcode'],
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('skuVendor');
  const [version, setVersion] = useState(0); // bumped on upload/delete to refresh counts

  // Get counts for tab labels (re-read on version change)
  const counts = useMemo(() => ({
    skuVendor:     getMasterData('skuVendor').length,
    assignment:    getMasterData('assignment').length,
    monthlyVendor: getMasterData('monthlyVendor').length,
  }), [version]);

  const onDataChange = () => setVersion(v => v + 1);

  const activeConfig = TAB_CONFIG.find(t => t.id === activeTab);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      {/* Tab bar */}
      <div className="flex border-b border-slate-200">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors cursor-pointer
              ${activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            {tab.title}
            {counts[tab.id] > 0 && (
              <span className="ml-1.5 text-xs font-normal text-slate-400">
                ({counts[tab.id].toLocaleString()})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Monthly assignee setting (only when monthlyVendor tab active) */}
      {activeTab === 'monthlyVendor' && <MonthlyAssigneeSetting />}

      {/* Active tab content */}
      <MasterSection
        key={activeTab}
        type={activeConfig.id}
        title={activeConfig.title}
        description={activeConfig.description}
        columns={activeConfig.columns}
        searchKeys={activeConfig.searchKeys}
        onDataChange={onDataChange}
      />
    </div>
  );
}

// ─── MonthlyAssigneeSetting ───────────────────────────────────────────────────

function MonthlyAssigneeSetting() {
  const [settings, setSettingsState] = useState(() => getSettings());

  const handleChange = (e) => {
    const updated = { ...settings, monthlyVendorAssignee: e.target.value };
    saveSettings(updated);
    setSettingsState(updated);
  };

  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-700">월결제/특수제작 고정 담당자</span>
        <select
          value={settings.monthlyVendorAssignee}
          onChange={handleChange}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent cursor-pointer"
        >
          {ASSIGNEES.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">
          월결제/특수제작 바코드의 담당자를 지정합니다
        </span>
      </div>
    </div>
  );
}

// ─── MasterSection ────────────────────────────────────────────────────────────

function MasterSection({ type, title, description, columns, searchKeys, onDataChange }) {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputRef = useRef(null);

  // Load on mount and when data changes
  useEffect(() => {
    setData(getMasterData(type));
  }, [type]);

  const reload = () => setData(getMasterData(type));

  // ── upload ──────────────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    setUploadError(null);
    try {
      await importFromXlsx(type, file);
      reload();
      onDataChange?.();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── clear ───────────────────────────────────────────────────────────────────
  const handleClear = () => {
    clearMasterData(type);
    reload();
    setShowConfirm(false);
    setSearch('');
    onDataChange?.();
  };

  // ── filter ──────────────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? data.filter(row =>
        searchKeys.some(k =>
          String(row[k] ?? '').toLowerCase().includes(search.toLowerCase())
        )
      )
    : data;

  const preview = filtered.slice(0, 100);

  // ── status pill ─────────────────────────────────────────────────────────────
  const statusPill = data.length > 0
    ? <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2.5 py-0.5">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        {data.length.toLocaleString()}건 등록
      </span>
    : <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-500 rounded-full px-2.5 py-0.5">
        미등록
      </span>;

  return (
    <div>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-slate-800 text-base">{title}</h2>
              {statusPill}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Upload button */}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700
                text-white text-sm font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  업로드 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  xlsx 업로드
                </>
              )}
            </button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />

            {/* Clear button */}
            {data.length > 0 && (
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-red-600 border border-red-200
                  hover:bg-red-50 text-sm font-semibold rounded-lg transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                전체 삭제
              </button>
            )}
          </div>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 font-medium">
            오류: {uploadError}
          </div>
        )}
      </div>

      {/* Table area */}
      {data.length > 0 && (
        <div className="px-6 py-4">
          {/* Search */}
          <div className="mb-3 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>

          {/* Count hint */}
          <div className="text-xs text-slate-400 mb-2">
            {search.trim()
              ? `${filtered.length.toLocaleString()}건 검색됨 (전체 ${data.length.toLocaleString()}건)`
              : `전체 ${data.length.toLocaleString()}건 — 최대 100건 미리보기`}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  {columns.map(col => (
                    <th key={col.key} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap border-b border-slate-200">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    {columns.map(col => (
                      <td key={col.key} className="px-3 py-2 text-slate-700 font-mono text-xs whitespace-nowrap">
                        {String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
                {preview.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-400">
                      검색 결과가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {data.length === 0 && (
        <div className="px-6 py-10 text-center text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">등록된 데이터가 없습니다.</p>
          <p className="text-xs mt-1">xlsx 업로드 버튼으로 파일을 업로드하세요.</p>
        </div>
      )}

      {/* Confirm dialog */}
      {showConfirm && (
        <ConfirmDialog
          title="전체 삭제 확인"
          message={`"${title}" 데이터 ${data.length.toLocaleString()}건을 모두 삭제하시겠습니까?\n삭제 후 되돌릴 수 없습니다.`}
          onConfirm={handleClear}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-slate-800">{title}</h3>
        </div>
        <p className="text-sm text-slate-600 whitespace-pre-line mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2 text-sm font-semibold text-slate-600 border border-slate-200
              rounded-lg hover:bg-slate-50 transition cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 text-sm font-semibold text-white bg-red-600
              rounded-lg hover:bg-red-700 transition cursor-pointer"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

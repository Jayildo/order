import { useState } from 'react';
import FileUploader from './FileUploader';
import PasteInput from './PasteInput';
import {
  parseOrderFile,
  parseInventoryFile,
  parseTransitFile,
  parseTransitFromText,
  parsePrevConfirmedFile,
  calculate,
  autoAssignUnassigned,
} from '../utils/calculator';
import { getMasterDataAsMap, hasMasterData, getSettings } from '../utils/masterData';
import { ASSIGNEES } from '../utils/constants';

/**
 * DataInputPage — 4 file upload zones + calculation trigger.
 *
 * Props:
 *   onCalculate(results) — callback to App.jsx with { rows, summary }
 *   adjustmentRate       — current adjustment rate (number)
 */
export default function DataInputPage({ onCalculate, adjustmentRate }) {
  // Raw File objects
  const [files, setFiles] = useState({
    orders: null,
    inventory: null,
    transit: null,
    prevConfirmed: null,
  });

  // Parse status per slot
  const [status, setStatus] = useState({
    orders: null,
    inventory: null,
    transit: null,
    prevConfirmed: null,
  });

  // Parsed data arrays
  const [parsed, setParsed] = useState({
    orders: null,
    inventory: null,
    transit: null,
    prevConfirmed: null,
  });

  // "배송중" input mode
  const [transitMode, setTransitMode] = useState('file'); // 'file' | 'paste'

  const [loading, setLoading] = useState(false);
  const [calcError, setCalcError] = useState(null);

  const masterStatus = hasMasterData();
  const masterMissing = !masterStatus.skuVendor || !masterStatus.assignment;

  // ── helpers ──────────────────────────────────────────────────────────────────

  const setSlotStatus = (key, type, message) =>
    setStatus(prev => ({ ...prev, [key]: { type, message } }));

  const clearSlot = (key) => {
    setStatus(prev => ({ ...prev, [key]: null }));
    setParsed(prev => ({ ...prev, [key]: null }));
    setFiles(prev => ({ ...prev, [key]: null }));
  };

  // ── file handlers ─────────────────────────────────────────────────────────

  const handleOrderFile = async (file) => {
    setFiles(prev => ({ ...prev, orders: file }));
    setSlotStatus('orders', null, null);
    try {
      const data = await parseOrderFile(file);
      setParsed(prev => ({ ...prev, orders: data }));
      setSlotStatus('orders', 'success', `${file.name} (${data.length.toLocaleString()}행)`);
    } catch (err) {
      setParsed(prev => ({ ...prev, orders: null }));
      setSlotStatus('orders', 'error', err.message);
    }
  };

  const handleInventoryFile = async (file) => {
    setFiles(prev => ({ ...prev, inventory: file }));
    setSlotStatus('inventory', null, null);
    try {
      const data = await parseInventoryFile(file);
      setParsed(prev => ({ ...prev, inventory: data }));
      setSlotStatus('inventory', 'success', `${file.name} (${data.length.toLocaleString()}행)`);
    } catch (err) {
      setParsed(prev => ({ ...prev, inventory: null }));
      setSlotStatus('inventory', 'error', err.message);
    }
  };

  const handleTransitFile = async (file) => {
    setFiles(prev => ({ ...prev, transit: file }));
    setSlotStatus('transit', null, null);
    try {
      const data = await parseTransitFile(file);
      setParsed(prev => ({ ...prev, transit: data }));
      setSlotStatus('transit', 'success', `${file.name} (${data.length.toLocaleString()}행)`);
    } catch (err) {
      setParsed(prev => ({ ...prev, transit: null }));
      setSlotStatus('transit', 'error', err.message);
    }
  };

  const handleTransitPaste = (text) => {
    if (!text.trim()) {
      clearSlot('transit');
      return;
    }
    try {
      const data = parseTransitFromText(text);
      setParsed(prev => ({ ...prev, transit: data }));
      setSlotStatus('transit', 'success', `붙여넣기 (${data.length.toLocaleString()}행)`);
    } catch (err) {
      setParsed(prev => ({ ...prev, transit: null }));
      setSlotStatus('transit', 'error', err.message);
    }
  };

  const handlePrevConfirmedFile = async (file) => {
    setFiles(prev => ({ ...prev, prevConfirmed: file }));
    setSlotStatus('prevConfirmed', null, null);
    try {
      const data = await parsePrevConfirmedFile(file);
      setParsed(prev => ({ ...prev, prevConfirmed: data }));
      setSlotStatus('prevConfirmed', 'success', `${file.name} (${data.length.toLocaleString()}행)`);
    } catch (err) {
      setParsed(prev => ({ ...prev, prevConfirmed: null }));
      setSlotStatus('prevConfirmed', 'error', err.message);
    }
  };

  // ── transit mode toggle ───────────────────────────────────────────────────

  const switchTransitMode = (mode) => {
    setTransitMode(mode);
    clearSlot('transit');
  };

  // ── calculation ───────────────────────────────────────────────────────────

  const canCalculate = parsed.orders && parsed.inventory && parsed.transit;

  const handleCalculate = async () => {
    if (!canCalculate) return;
    setLoading(true);
    setCalcError(null);

    // Small tick so React can re-render spinner before blocking work
    await new Promise(r => setTimeout(r, 30));

    try {
      const masterData = {
        skuVendorMap: getMasterDataAsMap('skuVendor'),
        assignmentMap: getMasterDataAsMap('assignment'),
        monthlyVendorSet: getMasterDataAsMap('monthlyVendor'),
      };

      const settings = getSettings();

      const results = calculate({
        orders: parsed.orders,
        inventory: parsed.inventory,
        transit: parsed.transit,
        prevConfirmed: parsed.prevConfirmed || [],
        masterData,
        adjustmentRate,
        monthlyVendorAssignee: settings.monthlyVendorAssignee,
      });

      // Auto-assign unassigned target rows
      const updatedRows = autoAssignUnassigned(results.rows, ASSIGNEES);

      // Recalculate byAssignee summary with auto-assigned rows
      const byAssignee = {};
      for (const row of updatedRows) {
        if (row.isTarget && row.assignee) {
          if (!byAssignee[row.assignee]) {
            byAssignee[row.assignee] = { count: 0, totalOrderAmount: 0, autoCount: 0 };
          }
          byAssignee[row.assignee].count++;
          byAssignee[row.assignee].totalOrderAmount += row.orderAmount;
          if (row.isAutoAssigned) {
            byAssignee[row.assignee].autoCount++;
          }
        }
      }

      onCalculate({
        rows: updatedRows,
        summary: { ...results.summary, byAssignee },
      });
    } catch (err) {
      setCalcError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Upload zones ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">

        {/* 1. 발주 리스트 */}
        <div className="p-5">
          <SectionLabel num="1" title="발주 리스트" required />
          <FileUploader
            label="발주 리스트 (발주skulist.xlsx)"
            accept=".xlsx,.xls"
            onFileLoad={handleOrderFile}
            status={status.orders}
            description="쿠팡 발주 SKU 리스트"
          />
        </div>

        {/* 2. 현재고 */}
        <div className="p-5">
          <SectionLabel num="2" title="현재고" required />
          <FileUploader
            label="현재고 (현재고조회.xls)"
            accept=".xlsx,.xls"
            onFileLoad={handleInventoryFile}
            status={status.inventory}
            description="창고별 가용재고 조회 파일"
          />
        </div>

        {/* 3. 배송중 (파일 or 붙여넣기) */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel num="3" title="배송중" required />
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
              <button
                onClick={() => switchTransitMode('file')}
                className={`px-3 py-1.5 transition cursor-pointer ${
                  transitMode === 'file'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                파일 업로드
              </button>
              <button
                onClick={() => switchTransitMode('paste')}
                className={`px-3 py-1.5 transition cursor-pointer ${
                  transitMode === 'paste'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                붙여넣기
              </button>
            </div>
          </div>

          {transitMode === 'file' ? (
            <FileUploader
              label="배송중 (중국 출고 리스트)"
              accept=".xlsx,.xls"
              onFileLoad={handleTransitFile}
              status={status.transit}
              description="중국 배송중 데이터"
            />
          ) : (
            <PasteInput
              label="배송중 데이터 붙여넣기"
              onParse={handleTransitPaste}
            />
          )}
          {status.transit && (
            <div className={`mt-2 text-xs font-medium ${
              status.transit.type === 'success' ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {status.transit.type === 'success' ? '확인: ' : '오류: '}{status.transit.message}
            </div>
          )}
        </div>

        {/* 4. 지난주확정 (선택사항) */}
        <div className="p-5">
          <SectionLabel num="4" title="지난주확정" optional />
          <FileUploader
            label="지난주확정 (선택사항)"
            accept=".xlsx,.xls"
            onFileLoad={handlePrevConfirmedFile}
            status={status.prevConfirmed}
            description="지난주 확정 발주 파일 — 없어도 됩니다"
          />
        </div>
      </div>

      {/* ── Master data warning ── */}
      {masterMissing && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <div className="font-semibold text-amber-800">마스터 데이터 미설정</div>
            <div className="text-amber-700 mt-0.5">
              {!masterStatus.skuVendor && 'SKU별 업체 매핑'}
              {!masterStatus.skuVendor && !masterStatus.assignment && ', '}
              {!masterStatus.assignment && '담당자 배정'}
              {' '}정보가 없습니다. 산출은 가능하지만 업체/담당자 정보가 비어 있습니다.
              설정 탭에서 마스터 데이터를 업로드하세요.
            </div>
          </div>
        </div>
      )}

      {/* ── Calc error ── */}
      {calcError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
          </svg>
          <div>
            <div className="font-semibold text-red-800">산출 오류</div>
            <div className="text-red-700 mt-0.5 font-mono text-xs">{calcError}</div>
          </div>
        </div>
      )}

      {/* ── Calculate button ── */}
      <div className="flex justify-center">
        <button
          onClick={handleCalculate}
          disabled={!canCalculate || loading}
          className={`px-10 py-3.5 rounded-xl text-base font-bold text-white transition-all
            ${canCalculate && !loading
              ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-lg shadow-blue-200 active:scale-95'
              : 'bg-slate-300 cursor-not-allowed'
            }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              산출 중...
            </span>
          ) : '산출 실행'}
        </button>
      </div>
    </div>
  );
}

// ── Small helper components ────────────────────────────────────────────────────

function SectionLabel({ num, title, required, optional }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
        {num}
      </span>
      <span className="font-semibold text-slate-800">{title}</span>
      {required && (
        <span className="text-xs text-red-500 font-medium">필수</span>
      )}
      {optional && (
        <span className="text-xs text-slate-400 font-medium">선택</span>
      )}
    </div>
  );
}

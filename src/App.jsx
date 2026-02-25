import { useState } from 'react';
import DataInputPage from './components/DataInputPage';
import SettingsPage from './components/SettingsPage';
import ResultTable from './components/ResultTable';
import SummaryCards from './components/SummaryCards';
import { hasMasterData } from './utils/masterData';

const TABS = [
  { id: 'input',    label: '데이터 입력' },
  { id: 'results',  label: '산출 결과' },
  { id: 'settings', label: '설정' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('input');
  const [results, setResults] = useState(null);          // { rows, summary }
  const [adjustmentRate, setAdjustmentRate] = useState(1.0);

  const masterStatus = hasMasterData();
  const masterMissing = !masterStatus.skuVendor || !masterStatus.assignment;

  const handleCalculate = (res) => {
    setResults(res);
    setActiveTab('results');
  };

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-slate-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-0">
          <div className="flex items-center justify-between h-14">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="font-bold text-base tracking-tight">주문필요산출</span>
            </div>

            {/* Tabs */}
            <nav className="flex items-center gap-1">
              {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                const showBadge = tab.id === 'settings' && masterMissing;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-4 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer
                      ${isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                      }`}
                  >
                    {tab.label}
                    {showBadge && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-6">

        {/* 데이터 입력 */}
        {activeTab === 'input' && (
          <DataInputPage
            onCalculate={handleCalculate}
            adjustmentRate={adjustmentRate}
          />
        )}

        {/* 산출 결과 */}
        {activeTab === 'results' && (
          <>
            {results ? (
              <>
                {/* Adjustment rate slider */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-6 py-4 mb-5">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm whitespace-nowrap">조정 배율</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={adjustmentRate}
                      onChange={e => setAdjustmentRate(Number(e.target.value))}
                      className="flex-1 min-w-32 max-w-72 accent-blue-600"
                    />
                    <span className="text-sm font-bold text-blue-600 w-12 text-right tabular-nums">
                      ×{adjustmentRate.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400">
                      (발주수량에 배율을 곱해 주문필요수량 산출)
                    </span>
                    <button
                      onClick={() => setActiveTab('input')}
                      className="ml-auto text-sm text-blue-600 hover:text-blue-800 font-semibold
                        underline underline-offset-2 cursor-pointer transition"
                    >
                      재산출 →
                    </button>
                  </div>
                </div>

                <SummaryCards summary={results.summary} />
                <div className="mt-5">
                  <ResultTable rows={results.rows} summary={results.summary} />
                </div>
              </>
            ) : (
              <EmptyResults onGoToInput={() => setActiveTab('input')} />
            )}
          </>
        )}

        {/* 설정 */}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

// ─── EmptyResults ──────────────────────────────────────────────────────────────

function EmptyResults({ onGoToInput }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
      <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-base font-semibold text-slate-500 mb-2">산출 결과가 없습니다</p>
      <p className="text-sm mb-6">데이터 입력 탭에서 파일을 업로드하고 산출을 실행하세요.</p>
      <button
        onClick={onGoToInput}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
          rounded-xl transition cursor-pointer shadow-md shadow-blue-200"
      >
        데이터 입력으로 이동
      </button>
    </div>
  );
}

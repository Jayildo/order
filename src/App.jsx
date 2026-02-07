import { useState, useCallback } from 'react';
import FileUploader from './components/FileUploader';
import SummaryCards from './components/SummaryCards';
import ResultTable from './components/ResultTable';
import { calculate, exportToExcel } from './utils/calculator';

export default function App() {
  const [fileData, setFileData] = useState({ orders: null, inventory: null, transit: null });
  const [fileStatus, setFileStatus] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const allLoaded = fileData.orders && fileData.inventory && fileData.transit;

  const handleFileLoaded = useCallback((key, data, error, message) => {
    setFileData(prev => ({ ...prev, [key]: data }));
    setFileStatus(prev => ({
      ...prev,
      [key]: { loaded: !!data, error: error || null, message: error || message || '' },
    }));
  }, []);

  const handleCalculate = () => {
    setLoading(true);
    setTimeout(() => {
      try {
        const res = calculate(fileData.orders, fileData.inventory, fileData.transit);
        setResult(res);
      } catch (err) {
        alert('계산 오류: ' + err.message);
        console.error(err);
      }
      setLoading(false);
    }, 50);
  };

  const handleExport = () => {
    if (result) exportToExcel(result.rows);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800">주문 필요 산출</h1>
          <p className="text-sm text-slate-500 mt-1">발주수량 vs 재고+배송중 비교</p>
        </div>

        {/* File Upload */}
        <FileUploader fileStatus={fileStatus} onFileLoaded={handleFileLoaded} />

        {/* Calculate Button */}
        <div className="flex justify-center mb-8">
          <button
            disabled={!allLoaded || loading}
            onClick={handleCalculate}
            className={`px-8 py-3 rounded-xl text-base font-bold text-white transition-all
              ${allLoaded && !loading
                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-lg shadow-blue-200'
                : 'bg-slate-300 cursor-not-allowed'
              }`}
          >
            {loading ? '계산 중...' : '주문 필요 산출'}
          </button>
        </div>

        {/* Results */}
        {result && (
          <>
            <SummaryCards summary={result.summary} />
            <ResultTable rows={result.rows} onExport={handleExport} />
          </>
        )}
      </div>
    </div>
  );
}

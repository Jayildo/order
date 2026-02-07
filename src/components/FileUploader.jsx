import { useRef } from 'react';
import { parseExcel, validateColumns } from '../utils/calculator';

const FILE_CONFIGS = [
  {
    key: 'orders',
    label: '발주리스트',
    desc: '쿠팡 발주 SKU 리스트 (.xlsx)',
    icon: '📋',
    required: ['SKU Barcode', '발주수량'],
  },
  {
    key: 'inventory',
    label: '현재고',
    desc: '현재고 조회 파일 (.xls/.xlsx)',
    icon: '📦',
    required: ['바코드', '가용재고'],
  },
  {
    key: 'transit',
    label: '배송중',
    desc: '중국 배송중 데이터 (.xlsx)',
    icon: '🚚',
    required: ['바코드'],
  },
];

export default function FileUploader({ fileStatus, onFileLoaded }) {
  const inputRefs = useRef({});

  const handleFile = (e, config) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = parseExcel(ev.target.result);
        const { ok, missing } = validateColumns(data, config.required);
        if (!ok) {
          onFileLoaded(config.key, null, '필수 컬럼 누락: ' + missing.join(', '));
          return;
        }
        onFileLoaded(config.key, data, null, file.name + ' (' + data.length + '행)');
      } catch (err) {
        onFileLoaded(config.key, null, '파일 읽기 실패: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {FILE_CONFIGS.map(config => {
        const status = fileStatus[config.key] || {};
        const isLoaded = status.loaded;
        const isError = !!status.error;

        return (
          <div
            key={config.key}
            onClick={() => inputRefs.current[config.key]?.click()}
            className={`
              relative rounded-xl p-6 text-center cursor-pointer transition-all duration-200
              border-2
              ${isError
                ? 'border-red-400 bg-red-50'
                : isLoaded
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-dashed border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'
              }
            `}
          >
            <div className="text-3xl mb-2">{config.icon}</div>
            <div className="font-bold text-slate-800 mb-1">{config.label}</div>
            <div className="text-xs text-slate-500 mb-2">{config.desc}</div>
            {status.message && (
              <div className={`text-sm font-semibold ${isError ? 'text-red-600' : 'text-emerald-600'}`}>
                {status.message}
              </div>
            )}
            <input
              ref={el => inputRefs.current[config.key] = el}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e, config)}
            />
          </div>
        );
      })}
    </div>
  );
}

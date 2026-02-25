// ─── SummaryCards ─────────────────────────────────────────────────────────────

import { ASSIGNEES, ASSIGNEE_COLORS } from '../utils/constants';

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('ko-KR');
}

// Single metric card
function MetricCard({ label, value, borderColor, valueClass, subLabel }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 ${borderColor} p-4 flex flex-col gap-1`}>
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className={`text-2xl font-bold leading-none ${valueClass}`}>{value}</span>
      {subLabel && <span className="text-xs text-slate-400">{subLabel}</span>}
    </div>
  );
}

export default function SummaryCards({ summary }) {
  if (!summary) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center mb-6">
        <p className="text-slate-400 text-sm">
          산출 결과가 없습니다. 데이터를 입력하고 산출을 실행하세요.
        </p>
      </div>
    );
  }

  const {
    totalSkus        = 0,
    needOrder        = 0,
    sufficient       = 0,
    totalOrderQty    = 0,
    totalGimpo       = 0,
    totalWeihai      = 0,
    totalTransit     = 0,
    totalOrderAmount = 0,
    byAssignee       = {},
  } = summary;

  // Row 1: main metrics
  const row1 = [
    {
      label: '전체 SKU',
      value: fmt(totalSkus),
      borderColor: 'border-slate-400',
      valueClass: 'text-slate-800',
    },
    {
      label: '주문필요',
      value: fmt(needOrder),
      borderColor: 'border-red-400',
      valueClass: 'text-red-600',
      subLabel: totalSkus > 0 ? `전체의 ${Math.round((needOrder / totalSkus) * 100)}%` : undefined,
    },
    {
      label: '재고충분',
      value: fmt(sufficient),
      borderColor: 'border-emerald-400',
      valueClass: 'text-emerald-600',
      subLabel: totalSkus > 0 ? `전체의 ${Math.round((sufficient / totalSkus) * 100)}%` : undefined,
    },
    {
      label: '총 주문수량',
      value: fmt(totalOrderAmount),
      borderColor: 'border-blue-400',
      valueClass: 'text-blue-600',
    },
  ];

  // Row 2: stock breakdown
  const row2 = [
    {
      label: '총 발주수량',
      value: fmt(totalOrderQty),
      borderColor: 'border-slate-300',
      valueClass: 'text-slate-700',
    },
    {
      label: '김포 재고',
      value: fmt(totalGimpo),
      borderColor: 'border-sky-400',
      valueClass: 'text-sky-600',
    },
    {
      label: '위해 재고',
      value: fmt(totalWeihai),
      borderColor: 'border-violet-400',
      valueClass: 'text-violet-600',
    },
    {
      label: '배송중',
      value: fmt(totalTransit),
      borderColor: 'border-amber-400',
      valueClass: 'text-amber-600',
    },
  ];

  return (
    <div className="mb-6 space-y-3">
      {/* Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {row1.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {row2.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      {/* Row 3: Assignee breakdown */}
      {Object.keys(byAssignee).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-5 py-4">
          <span className="text-xs text-slate-500 font-medium block mb-3">담당자별</span>
          <div className="flex flex-wrap gap-4">
            {ASSIGNEES.map((name) => {
              const data = byAssignee[name];
              if (!data) return null;
              const colors = ASSIGNEE_COLORS[name] || {};
              return (
                <div key={name} className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${colors.dot}`} />
                  <span className={`text-sm font-semibold ${colors.text}`}>{name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors.badge}`}>
                    {fmt(data.count)}건
                  </span>
                  {data.autoCount > 0 && (
                    <span className="text-xs text-amber-600 font-medium">
                      (자동 {fmt(data.autoCount)})
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    ({fmt(data.totalOrderAmount)}개)
                  </span>
                </div>
              );
            })}

            {/* Unassigned */}
            {(() => {
              const assigned = ASSIGNEES.reduce((s, n) => s + (byAssignee[n]?.count || 0), 0);
              const unassigned = needOrder - assigned;
              if (unassigned <= 0) return null;
              return (
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
                  <span className="text-sm font-semibold text-gray-500">미배정</span>
                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600">
                    {fmt(unassigned)}건
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

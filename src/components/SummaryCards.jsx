export default function SummaryCards({ summary }) {
  if (!summary) return null;

  const cards = [
    { label: '총 SKU 수', value: summary.totalSkus, color: 'text-slate-800' },
    { label: '주문 필요', value: summary.needOrder, color: 'text-red-600' },
    { label: '재고 충분', value: summary.sufficient, color: 'text-emerald-600' },
    { label: '총 부족수량', value: summary.totalShortage.toLocaleString(), color: 'text-red-600' },
    { label: '총 발주수량', value: summary.totalOrderQty.toLocaleString(), color: 'text-slate-800' },
    { label: '총 재고수량', value: summary.totalStockQty.toLocaleString(), color: 'text-emerald-600' },
  ];

  return (
    <div className="grid grid-cols-6 gap-3 mb-8">
      {cards.map((c, i) => (
        <div key={i} className="bg-white rounded-xl p-4 text-center shadow-sm border border-slate-100">
          <div className="text-xs text-slate-500 mb-1">{c.label}</div>
          <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

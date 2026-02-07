import * as XLSX from 'xlsx';

function num(v) {
  return typeof v === 'number' ? v : (parseFloat(v) || 0);
}

/**
 * Parse an uploaded Excel file and return an array of row objects.
 */
export function parseExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

/**
 * Validate that required columns exist in the parsed data.
 * Returns { ok, missing } where missing is an array of missing column names.
 */
export function validateColumns(data, requiredColumns) {
  if (!data || data.length === 0) return { ok: false, missing: ['(데이터 없음)'] };
  const cols = Object.keys(data[0]);
  const missing = requiredColumns.filter(c => !cols.includes(c));
  return { ok: missing.length === 0, missing };
}

/**
 * Core calculation: merges order, inventory, and transit data by barcode.
 *
 * Returns { rows, summary } where:
 * - rows: array of { barcode, name, totalOrder, available, weihaiStock, transit, totalStock, shortage, status }
 * - summary: { totalSkus, needOrder, sufficient, totalShortage, totalOrderQty, totalStockQty }
 */
export function calculate(orders, inventory, transit) {
  // Step 1: Group orders by barcode → sum 발주수량
  const orderMap = {}; // barcode → { totalOrder, name, orders: [...] }
  for (const row of orders) {
    const bc = String(row['SKU Barcode'] || '').trim();
    if (!bc) continue;
    if (!orderMap[bc]) {
      orderMap[bc] = {
        name: row['SKU 이름'] || '',
        totalOrder: 0,
        orderCount: 0,
      };
    }
    orderMap[bc].totalOrder += num(row['발주수량']);
    orderMap[bc].orderCount += 1;
  }

  // Step 2: Build inventory map by barcode
  const invMap = {}; // barcode → { available, weihaiStock }
  for (const row of inventory) {
    const bc = String(row['바코드'] || '').trim();
    if (!bc) continue;
    invMap[bc] = {
      available: num(row['가용재고']),
      weihaiStock: num(row['위해_재고']),
    };
  }

  // Step 3: Build transit map by barcode (完≠1 only)
  const transitMap = {}; // barcode → transitQty
  for (const row of transit) {
    if (row['完'] == 1) continue;
    const bc = String(row['바코드'] || '').trim();
    if (!bc) continue;
    transitMap[bc] = (transitMap[bc] || 0) + num(row['下单套数（套数）']);
  }

  // Step 4: Merge into result rows
  const rows = [];
  let needOrder = 0, sufficient = 0, totalShortage = 0;
  let totalOrderQty = 0, totalStockQty = 0;

  for (const bc of Object.keys(orderMap).sort()) {
    const o = orderMap[bc];
    const inv = invMap[bc] || { available: 0, weihaiStock: 0 };
    const tr = transitMap[bc] || 0;

    const totalStock = inv.available + inv.weihaiStock + tr;
    const shortage = Math.max(0, o.totalOrder - totalStock);
    const status = shortage > 0 ? 'need' : 'ok';

    if (status === 'need') needOrder++;
    else sufficient++;

    totalShortage += shortage;
    totalOrderQty += o.totalOrder;
    totalStockQty += totalStock;

    rows.push({
      barcode: bc,
      name: o.name,
      orderCount: o.orderCount,
      totalOrder: o.totalOrder,
      available: inv.available,
      weihaiStock: inv.weihaiStock,
      transit: tr,
      totalStock,
      shortage,
      status,
    });
  }

  return {
    rows,
    summary: {
      totalSkus: rows.length,
      needOrder,
      sufficient,
      totalShortage,
      totalOrderQty,
      totalStockQty,
    },
  };
}

/**
 * Export result rows to Excel and trigger download.
 */
export function exportToExcel(rows) {
  if (!rows || rows.length === 0) return;

  const exportRows = rows.map(r => ({
    '바코드': r.barcode,
    '상품명': r.name,
    '발주건수': r.orderCount,
    '총발주수량': r.totalOrder,
    '가용재고': r.available,
    '위해_재고': r.weihaiStock,
    '배송중': r.transit,
    '총재고': r.totalStock,
    '부족수량': r.shortage,
    '상태': r.status === 'need' ? '주문필요' : '재고충분',
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  ws['!cols'] = [
    { wch: 16 }, { wch: 40 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '주문필요산출');
  XLSX.writeFile(wb, '주문필요산출_' + new Date().toISOString().slice(0, 10) + '.xlsx');
}

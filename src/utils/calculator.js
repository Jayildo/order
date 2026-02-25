import * as XLSX from 'xlsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : 0;
}

function bc(v) {
  return String(v ?? '').trim();
}

/**
 * Read a File object into an ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('파일 읽기 오류'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse the first sheet of an xlsx/xls file into an array of row objects.
 * @param {File} file
 * @returns {Promise<object[]>}
 */
async function parseSheet(file) {
  const buf = await readFile(file);
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

/**
 * Verify required columns exist; throws a Korean error if any are missing.
 */
function requireCols(rows, required, fileName) {
  if (!rows.length) throw new Error(`${fileName}: 데이터가 비어 있습니다.`);
  const cols = Object.keys(rows[0]);
  const missing = required.filter((c) => !cols.includes(c));
  if (missing.length > 0) {
    throw new Error(
      `${fileName}: 필수 컬럼 누락 — ${missing.join(', ')}\n실제 컬럼: ${cols.join(', ')}`
    );
  }
}

// ─── File Parsers ─────────────────────────────────────────────────────────────

/**
 * Parse 발주skulist.xlsx
 * Columns: 'SKU Barcode' (or 'SKU 바코드'), 'SKU 이름', '발주수량'
 * Groups by barcode, sums 발주수량.
 * @param {File} file
 * @returns {Promise<Array<{ barcode: string, name: string, orderQty: number }>>}
 */
export async function parseOrderFile(file) {
  const rows = await parseSheet(file);

  // Accept either column name for barcode
  const barcodeCol =
    rows.length && 'SKU Barcode' in rows[0]
      ? 'SKU Barcode'
      : rows.length && 'SKU 바코드' in rows[0]
      ? 'SKU 바코드'
      : null;

  if (!barcodeCol) {
    throw new Error(
      `발주 파일: 바코드 컬럼을 찾을 수 없습니다. 'SKU Barcode' 또는 'SKU 바코드' 컬럼이 필요합니다.\n실제 컬럼: ${rows.length ? Object.keys(rows[0]).join(', ') : '(없음)'}`
    );
  }
  requireCols(rows, [barcodeCol, 'SKU 이름', '발주수량'], '발주 파일');

  const map = new Map(); // barcode → { name, orderQty }
  for (const row of rows) {
    const barcode = bc(row[barcodeCol]);
    if (!barcode) continue;
    if (!map.has(barcode)) {
      map.set(barcode, { name: String(row['SKU 이름'] ?? '').trim(), orderQty: 0 });
    }
    map.get(barcode).orderQty += num(row['발주수량']);
  }

  return Array.from(map.entries()).map(([barcode, v]) => ({ barcode, ...v }));
}

/**
 * Parse 현재고조회.xls
 * Columns: '바코드', '가용재고', '창고재고합'
 * @param {File} file
 * @returns {Promise<Array<{ barcode: string, available: number, warehouseStock: number }>>}
 */
export async function parseInventoryFile(file) {
  const rows = await parseSheet(file);
  requireCols(rows, ['바코드', '가용재고', '창고재고합'], '재고 파일');

  return rows
    .map((row) => ({
      barcode: bc(row['바코드']),
      available: num(row['가용재고']),
      warehouseStock: num(row['창고재고합']),
    }))
    .filter((r) => r.barcode);
}

/**
 * Parse 배송중.xlsx
 * Columns: '바코드', '下单套数（套数）', '完'
 * Only includes rows where '完' is empty (not completed).
 * Groups by barcode, sums quantity.
 * @param {File} file
 * @returns {Promise<Array<{ barcode: string, quantity: number }>>}
 */
export async function parseTransitFile(file) {
  const rows = await parseSheet(file);
  requireCols(rows, ['바코드', '下单套数（套数）'], '배송중 파일');

  return _aggregateTransit(rows);
}

/**
 * Parse tab-separated or CSV text pasted from a web browser.
 * First line is treated as the header row.
 * Same logic as parseTransitFile: filter '完' empty, group by barcode.
 * @param {string} text
 * @returns {Array<{ barcode: string, quantity: number }>}
 */
export function parseTransitFromText(text) {
  if (!text || !text.trim()) return [];

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Auto-detect delimiter: tab preferred, fall back to comma
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));

  const barcodeIdx = headers.indexOf('바코드');
  const qtyIdx = headers.indexOf('下单套数（套数）');
  const doneIdx = headers.indexOf('完');

  if (barcodeIdx === -1) {
    throw new Error(
      `배송중 텍스트: '바코드' 컬럼을 찾을 수 없습니다.\n실제 컬럼: ${headers.join(', ')}`
    );
  }
  if (qtyIdx === -1) {
    throw new Error(
      `배송중 텍스트: '下单套数（套数）' 컬럼을 찾을 수 없습니다.\n실제 컬럼: ${headers.join(', ')}`
    );
  }

  const rows = lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? null;
    });
    return obj;
  });

  return _aggregateTransit(rows);
}

/**
 * Internal helper: filter rows where '完' is empty, group by barcode, sum qty.
 */
function _aggregateTransit(rows) {
  const map = new Map(); // barcode → quantity
  for (const row of rows) {
    const done = row['完'];
    // Skip completed rows (完 has any non-empty value)
    if (done !== null && done !== undefined && String(done).trim() !== '') continue;

    const barcode = bc(row['바코드']);
    if (!barcode) continue;

    map.set(barcode, (map.get(barcode) ?? 0) + num(row['下单套数（套数）']));
  }

  return Array.from(map.entries()).map(([barcode, quantity]) => ({ barcode, quantity }));
}

/**
 * Parse previous confirmed order file (optional).
 * Columns: '상품바코드', '확정수량'
 * @param {File} file
 * @returns {Promise<Array<{ barcode: string, confirmedQty: number }>>}
 */
export async function parsePrevConfirmedFile(file) {
  const rows = await parseSheet(file);
  requireCols(rows, ['상품바코드', '확정수량'], '지난주확정 파일');

  return rows
    .map((row) => ({
      barcode: bc(row['상품바코드']),
      confirmedQty: num(row['확정수량']),
    }))
    .filter((r) => r.barcode);
}

// ─── Core Calculator ──────────────────────────────────────────────────────────

/**
 * Main calculation function.
 *
 * @param {object} params
 * @param {Array<{ barcode, name, orderQty }>}               params.orders
 * @param {Array<{ barcode, available, warehouseStock }>}    params.inventory
 * @param {Array<{ barcode, quantity }>}                     params.transit
 * @param {Array<{ barcode, confirmedQty }>}                 [params.prevConfirmed]
 * @param {{ skuVendorMap, assignmentMap, monthlyVendorSet }} params.masterData
 * @param {number}                                           [params.adjustmentRate=1.0]
 *
 * @returns {{ rows: object[], summary: object }}
 */
export function calculate({
  orders,
  inventory,
  transit,
  prevConfirmed = [],
  masterData = {},
  adjustmentRate = 1.0,
  monthlyVendorAssignee = '정호',
}) {
  const { skuVendorMap = {}, assignmentMap = {}, monthlyVendorSet = new Set() } = masterData;

  // ── Build lookup maps ────────────────────────────────────────────────────────

  // H: 김포/가용재고, I: 위해/창고재고
  const invMap = new Map();
  for (const r of inventory) {
    const barcode = bc(r.barcode);
    if (!barcode) continue;
    invMap.set(barcode, {
      available: num(r.available),
      warehouseStock: num(r.warehouseStock),
    });
  }

  // J: 배송중
  const transitMap = new Map();
  for (const r of transit) {
    const barcode = bc(r.barcode);
    if (!barcode) continue;
    transitMap.set(barcode, (transitMap.get(barcode) ?? 0) + num(r.quantity));
  }

  // K: 지난주확정
  const prevMap = new Map();
  for (const r of prevConfirmed) {
    const barcode = bc(r.barcode);
    if (!barcode) continue;
    prevMap.set(barcode, (prevMap.get(barcode) ?? 0) + num(r.confirmedQty));
  }

  // ── Compute rows ─────────────────────────────────────────────────────────────

  const rows = [];
  let needOrder = 0;
  let sufficient = 0;
  let totalOrderQty = 0;
  let totalGimpo = 0;
  let totalWeihai = 0;
  let totalTransit = 0;
  let totalOrderAmount = 0;
  const byAssignee = {};

  for (const order of orders) {
    const barcode = bc(order.barcode);
    if (!barcode) continue;

    // G
    const orderQty = num(order.orderQty);

    // H
    const inv = invMap.get(barcode) ?? { available: 0, warehouseStock: 0 };
    const gimpo = inv.available;

    // I
    const weihai = inv.warehouseStock;

    // J
    const transitQty = transitMap.get(barcode) ?? 0;

    // K
    const prevConfirmedQty = prevMap.get(barcode) ?? 0;

    // L: 전체재고 = max(H + I + J - K, 0)
    const totalStock = Math.max(gimpo + weihai + transitQty - prevConfirmedQty, 0);

    // M: 대상
    const isTarget = orderQty > totalStock;

    // shortage (intermediate)
    const shortage = Math.max(orderQty - totalStock, 0);

    // N: 주문수량 = isTarget ? ceil(shortage * adjustmentRate) : 0
    const orderAmount = isTarget ? Math.ceil(shortage * adjustmentRate) : 0;

    // O: 업체
    const vendorInfo = skuVendorMap[barcode];
    const vendor = vendorInfo?.vendorName || '(업체정보없음)';

    // P: 월결제/특수제작 여부
    const isMonthly = monthlyVendorSet.has(barcode);

    // R: 담당자
    let assignee = '';
    if (isTarget) {
      assignee = isMonthly ? monthlyVendorAssignee : (assignmentMap[vendor] || '');
    }

    // ── Accumulate summary ───────────────────────────────────────────────────
    if (isTarget) {
      needOrder++;
      totalOrderAmount += orderAmount;
      if (assignee) {
        if (!byAssignee[assignee]) byAssignee[assignee] = { count: 0, totalOrderAmount: 0 };
        byAssignee[assignee].count++;
        byAssignee[assignee].totalOrderAmount += orderAmount;
      }
    } else {
      sufficient++;
    }

    totalOrderQty += orderQty;
    totalGimpo += gimpo;
    totalWeihai += weihai;
    totalTransit += transitQty;

    rows.push({
      barcode,
      name: String(order.name ?? '').trim(),
      orderQty,
      gimpo,
      weihai,
      transit: transitQty,
      prevConfirmed: prevConfirmedQty,
      totalStock,
      isTarget,
      shortage,
      orderAmount,
      vendor,
      isMonthly,
      assignee,
    });
  }

  // ── Sort: isTarget desc, then orderAmount desc ───────────────────────────────
  rows.sort((a, b) => {
    if (a.isTarget !== b.isTarget) return a.isTarget ? -1 : 1;
    return b.orderAmount - a.orderAmount;
  });

  return {
    rows,
    summary: {
      totalSkus: rows.length,
      needOrder,
      sufficient,
      totalOrderQty,
      totalGimpo,
      totalWeihai,
      totalTransit,
      totalOrderAmount,
      byAssignee,
    },
  };
}

// ─── Auto-assign Unassigned ──────────────────────────────────────────────────

/**
 * Extract a "family prefix" from a barcode for grouping related SKUs.
 *
 * W-format (e.g. 4W138AA11): extract up to and including W + digits → "4W138"
 * Other (e.g. R011328360001): drop last 2 chars → "R0113283600"
 */
function extractFamilyPrefix(barcode) {
  const wMatch = barcode.match(/^([A-Za-z\d]*W\d+)/);
  if (wMatch) return wMatch[1];
  return barcode.length > 2 ? barcode.slice(0, -2) : barcode;
}

/**
 * Auto-assign unassigned target rows to assignees using round-robin
 * on barcode family groups.
 *
 * @param {object[]} rows - rows from calculate() result
 * @param {string[]} assignees - list of assignee names (e.g. ['정호','희철','해준','길남'])
 * @returns {object[]} - rows with unassigned targets now assigned (isAutoAssigned: true)
 */
export function autoAssignUnassigned(rows, assignees) {
  if (!assignees || assignees.length === 0) return rows;

  // Identify unassigned target rows
  const unassignedIndices = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].isTarget && !rows[i].assignee) {
      unassignedIndices.push(i);
    }
  }

  if (unassignedIndices.length === 0) return rows;

  // Group by barcode family
  const familyMap = new Map(); // familyPrefix → [index, ...]
  for (const idx of unassignedIndices) {
    const prefix = extractFamilyPrefix(rows[idx].barcode);
    if (!familyMap.has(prefix)) familyMap.set(prefix, []);
    familyMap.get(prefix).push(idx);
  }

  // Sort family keys alphabetically for deterministic assignment
  const familyKeys = Array.from(familyMap.keys()).sort();

  // Round-robin assign families to assignees
  const updatedRows = rows.map(r => ({ ...r }));
  familyKeys.forEach((key, i) => {
    const assignee = assignees[i % assignees.length];
    for (const idx of familyMap.get(key)) {
      updatedRows[idx].assignee = assignee;
      updatedRows[idx].isAutoAssigned = true;
    }
  });

  return updatedRows;
}

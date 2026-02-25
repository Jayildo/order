import * as XLSX from 'xlsx';

const STORAGE_KEYS = {
  skuVendor: 'master_sku_vendor',
  assignment: 'master_assignment',
  monthlyVendor: 'master_monthly_vendor',
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function getMasterData(type) {
  const key = STORAGE_KEYS[type];
  if (!key) throw new Error(`알 수 없는 마스터 데이터 타입: ${type}`);
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMasterData(type, dataArray) {
  const key = STORAGE_KEYS[type];
  if (!key) throw new Error(`알 수 없는 마스터 데이터 타입: ${type}`);
  localStorage.setItem(key, JSON.stringify(dataArray));
}

export function clearMasterData(type) {
  const key = STORAGE_KEYS[type];
  if (!key) throw new Error(`알 수 없는 마스터 데이터 타입: ${type}`);
  localStorage.removeItem(key);
}

// ─── Lookup Maps ──────────────────────────────────────────────────────────────

/**
 * Returns lookup maps for use in calculator:
 *   'skuVendor'     → { [barcode]: { skuId, vendorName } }
 *   'assignment'    → { [vendorName]: assignee }
 *   'monthlyVendor' → Set of barcodes
 */
export function getMasterDataAsMap(type) {
  const data = getMasterData(type);

  if (type === 'skuVendor') {
    const map = {};
    for (const row of data) {
      const bc = String(row.barcode ?? '').trim();
      if (bc) map[bc] = { skuId: row.skuId, vendorName: row.vendorName };
    }
    return map;
  }

  if (type === 'assignment') {
    const map = {};
    for (const row of data) {
      const vendor = String(row.vendorName ?? '').trim();
      if (vendor) map[vendor] = row.assignee;
    }
    return map;
  }

  if (type === 'monthlyVendor') {
    const set = new Set();
    for (const row of data) {
      const bc = String(row.barcode ?? '').trim();
      if (bc) set.add(bc);
    }
    return set;
  }

  throw new Error(`알 수 없는 마스터 데이터 타입: ${type}`);
}

// ─── xlsx Import ──────────────────────────────────────────────────────────────

/**
 * Parse an xlsx file into sheet rows (array of plain objects).
 * @param {File} file
 * @returns {Promise<object[]>}
 */
function readSheetRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
        resolve(rows);
      } catch (err) {
        reject(new Error(`파일 파싱 실패: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('파일 읽기 오류'));
    reader.readAsArrayBuffer(file);
  });
}

function requireCol(row, col) {
  if (!(col in row)) return null;
  return row[col];
}

function checkCols(rows, required) {
  if (!rows.length) throw new Error('파일에 데이터가 없습니다.');
  const cols = Object.keys(rows[0]);
  const missing = required.filter((c) => !cols.includes(c));
  if (missing.length > 0) {
    throw new Error(`필수 컬럼 누락: ${missing.join(', ')}\n실제 컬럼: ${cols.join(', ')}`);
  }
}

/**
 * Parse xlsx file and save to localStorage.
 * @param {'skuVendor'|'assignment'|'monthlyVendor'} type
 * @param {File} file
 * @returns {Promise<{ count: number, data: object[] }>}
 */
export async function importFromXlsx(type, file) {
  const rows = await readSheetRows(file);

  let data;

  if (type === 'skuVendor') {
    // Expected columns: 바코드, SKU ID, 업체명
    checkCols(rows, ['바코드', 'SKU ID', '업체명']);
    data = rows
      .map((r) => ({
        barcode: String(requireCol(r, '바코드') ?? '').trim(),
        skuId: String(requireCol(r, 'SKU ID') ?? '').trim(),
        vendorName: String(requireCol(r, '업체명') ?? '').trim(),
      }))
      .filter((r) => r.barcode);
  } else if (type === 'assignment') {
    // Expected columns: 업체정보, 상품수, 누적, 담당자
    checkCols(rows, ['업체정보', '상품수', '누적', '담당자']);
    data = rows
      .map((r) => ({
        vendorName: String(requireCol(r, '업체정보') ?? '').trim(),
        productCount: Number(requireCol(r, '상품수') ?? 0) || 0,
        cumulative: Number(requireCol(r, '누적') ?? 0) || 0,
        assignee: String(requireCol(r, '담당자') ?? '').trim(),
      }))
      .filter((r) => r.vendorName);
  } else if (type === 'monthlyVendor') {
    // Expected columns: 구분, 업체명, 바코드
    checkCols(rows, ['구분', '업체명', '바코드']);
    data = rows
      .map((r) => ({
        category: String(requireCol(r, '구분') ?? '').trim(),
        vendorName: String(requireCol(r, '업체명') ?? '').trim(),
        barcode: String(requireCol(r, '바코드') ?? '').trim(),
      }))
      .filter((r) => r.barcode);
  } else {
    throw new Error(`알 수 없는 마스터 데이터 타입: ${type}`);
  }

  saveMasterData(type, data);
  return { count: data.length, data };
}

// ─── App Settings ────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  monthlyVendorAssignee: '정호',
};

export function getSettings() {
  try {
    const raw = localStorage.getItem('app_settings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem('app_settings', JSON.stringify(settings));
}

// ─── Existence Check ──────────────────────────────────────────────────────────

/**
 * Returns { skuVendor: bool, assignment: bool, monthlyVendor: bool }
 */
export function hasMasterData() {
  return {
    skuVendor: getMasterData('skuVendor').length > 0,
    assignment: getMasterData('assignment').length > 0,
    monthlyVendor: getMasterData('monthlyVendor').length > 0,
  };
}

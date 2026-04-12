import * as XLSX from 'xlsx';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

/**
 * Export an array of objects to an .xlsx file and trigger browser download.
 */
export function exportToExcel(
  rows: AnyRow[],
  headers: { key: string; label: string; width?: number }[],
  filename: string,
  sheetName = 'Sheet1',
) {
  const wsData: unknown[][] = [headers.map(h => h.label)];

  for (const row of rows) {
    wsData.push(headers.map(h => {
      const v = row[h.key];
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v);
      return v ?? '';
    }));
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = headers.map(h => ({ wch: h.width ?? 16 }));

  // Bold the header row
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = { font: { bold: true } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Export multiple sheets in one workbook */
export function exportToExcelMultiSheet(
  sheets: { name: string; headers: { key: string; label: string; width?: number }[]; rows: AnyRow[] }[],
  filename: string,
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const wsData: unknown[][] = [sheet.headers.map(h => h.label)];
    for (const row of sheet.rows) {
      wsData.push(sheet.headers.map(h => {
        const v = row[h.key];
        if (typeof v === 'number') return v;
        if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v);
        return v ?? '';
      }));
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = sheet.headers.map(h => ({ wch: h.width ?? 16 }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

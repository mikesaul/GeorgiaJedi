
/**
 * script.js — Complete updated version for autographs.html
 *
 * Features:
 * - Loads data from data/<page>.json
 * - Injects filter row, date and numeric range modals
 * - Clear All button visibility
 * - Formatters for bootstrap-table (date, currency, detail)
 * - Image link state encoding for imageview
 * - Export: CSV (tableExport), JSON (manual), Excel (SheetJS), PDF (jsPDF + AutoTable)
 * - Export modes: all | filtered | page | selected
 *
 * Replace your existing /js/script.js with this file.
 */

(function () {
  'use strict';

  /* =========================
     Globals & Configuration
     ========================= */
  const DEFAULT_PAGE_SIZE = 5;
  let rawData = [];
  let currentFiltered = [];
  let exportMode = 'all'; // 'all' | 'filtered' | 'page' | 'selected'

  /* =========================
     Utilities
     ========================= */
  function getItemType() {
    const p = window.location.pathname.split('/').pop();
    return (p || '').split('.').shift() || 'data';
  }

  function safeTrim(v) {
    return (v === undefined || v === null) ? '' : String(v).trim();
  }

  function isValidDate(d) {
    return d instanceof Date && !isNaN(d.getTime());
  }

  function parseDate(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    if (!s) return null;
    // try yyyy-mm-dd
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    // try mm/dd/yyyy
    const parts = s.split('/');
    if (parts.length === 3) {
      const mm = parts[0].padStart(2, '0');
      const dd = parts[1].padStart(2, '0');
      const yyyy = parts[2];
      return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }
    const d = new Date(s);
    return isValidDate(d) ? d : null;
  }

  function toNumber(v) {
    if (v === undefined || v === null || String(v).trim() === '') return NaN;
    const n = parseFloat(String(v).replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? NaN : n;
  }

  function b64EncodeUnicode(str) {
    try {
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_, p1) {
        return String.fromCharCode('0x' + p1);
      }));
    } catch (e) {
      return '';
    }
  }

  /* =========================
     Formatters (exposed to window for bootstrap-table)
     ========================= */
  function dateFormatter(value) {
    const d = parseDate(value);
    return isValidDate(d) ? d.toISOString().split('T')[0] : '';
  }
  window.dateFormatter = dateFormatter;

  function dateSorter(a, b, order) {
    const A = parseDate(a), B = parseDate(b);
    const aOk = isValidDate(A), bOk = isValidDate(B);
    if (!aOk && !bOk) return 0;
    if (!aOk) return order === 'asc' ? 1 : -1;
    if (!bOk) return order === 'asc' ? -1 : 1;
    return A - B;
  }
  window.dateSorter = dateSorter;

  function currencyFormatter(value) {
    if (value === undefined || value === null || value === '') return '';
    const n = toNumber(value);
    if (isNaN(n)) return String(value);
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    } catch (e) {
      return '$' + n.toFixed(2);
    }
  }
  window.currencyFormatter = currencyFormatter;

  function originalCostFooter(data) {
    let total = 0;
    (data || []).forEach(r => total += toNumber(r.original_cost) || 0);
    return currencyFormatter(total);
  }
  window.originalCostFooter = originalCostFooter;

  function currentValueFooter(data) {
    let total = 0;
    (data || []).forEach(r => total += toNumber(r.current_value) || 0);
    return currencyFormatter(total);
  }
  window.currentValueFooter = currentValueFooter;

  function imageFooterFormatter(data) {
    let count = 0;
    (data || []).forEach(r => {
      if (r.image) {
        const fn = String(r.image).split('/').pop().toLowerCase();
        if (fn !== '100.png' && fn !== '100') count++;
      }
    });
    return `${count} images`;
  }
  window.imageFooterFormatter = imageFooterFormatter;

  function descFormatter(index, row) {
    const v = row.description || '';
    return v.length > 140 ? v.slice(0, 140) + '…' : v;
  }
  window.descFormatter = descFormatter;

  function rowStyle(row, index) {
    const classes = [];
    if (index % 2 === 0) classes.push('bg-ltgray');
    if (row.is_verified && (String(row.is_verified).toLowerCase() === 'yes' || row.is_verified === true)) classes.push('verified-row');
    return { classes: classes.join(' ') };
  }
  window.rowStyle = rowStyle;

  function detailFormatter(index, row) {
    const img = row.image ? `images/${row.image}.jpg` : 'images/100.png';
    const title = row['name/brand'] || row.title || '';
    const description = row.description || '';
    const serial = row.serialnumber || '';
    const franchise = row.franchise || '';
    const source = row.source || '';
    const orig = currencyFormatter(row.original_cost);
    const curr = currencyFormatter(row.current_value);

    return `
      <div class="card" style="display:flex; border:1px solid #ddd; padding:10px;">
        <div style="flex:1; text-align:center;">
          <img src="${img}" style="max-width:100%; width:420px; border-radius:6px;">
        </div>
        <div style="flex:2; padding-left:20px;">
          <h4>${title}</h4>
          ${franchise ? `<p><b>Franchise:</b> ${franchise}</p>` : ''}
          ${description ? `<p>${description}</p>` : ''}
          ${source ? `<p><b>Source:</b> ${source}</p>` : ''}
          ${serial ? `<p><b>Serial#:</b> ${serial}</p>` : ''}
          ${orig ? `<p><b>Original Cost:</b> ${orig}</p>` : ''}
          ${curr ? `<p><b>Current Value:</b> ${curr}</p>` : ''}
        </div>
      </div>
    `;
  }
  window.detailFormatter = detailFormatter;

  /* =========================
     Image formatter (with state)
     ========================= */
  function getTableState() {
    const opt = $('#catalog-table').bootstrapTable('getOptions') || {};
    const state = {
      pageNumber: opt.pageNumber || 1,
      pageSize: opt.pageSize || DEFAULT_PAGE_SIZE,
      sortName: opt.sortName || '',
      sortOrder: opt.sortOrder || '',
      searchText: opt.searchText || ''
    };

    const filters = {};
    $('.column-filter').each(function () {
      const k = $(this).data('column');
      const v = $(this).val();
      if (v !== undefined && v !== null && String(v) !== '') filters[k] = v;
    });

    const ac = $('#acquired-select').val();
    if (ac) filters.acquired = ac;
    if (ac === '__range__') {
      const rs = $('#acquired-range-start').val() || '';
      const re = $('#acquired-range-end').val() || '';
      if (rs || re) filters.acquired_range = `${rs}|${re}`;
    }

    const origSel = $('#original-select').val();
    if (origSel) filters.original_select = origSel;
    if (origSel === '__custom__') {
      const rs = $('#orig-range-min').val() || '';
      const re = $('#orig-range-max').val() || '';
      const rb = $('#orig-range-blank').is(':checked') ? '1' : '0';
      filters.original_range = `${rs}|${re}|${rb}`;
    }

    const currSel = $('#current-select').val();
    if (currSel) filters.current_select = currSel;
    if (currSel === '__custom__') {
      const rs = $('#curr-range-min').val() || '';
      const re = $('#curr-range-max').val() || '';
      const rb = $('#curr-range-blank').is(':checked') ? '1' : '0';
      filters.current_range = `${rs}|${re}|${rb}`;
    }

    state.filters = filters;
    return state;
  }
  window.getTableState = getTableState;

  function imageFormatter(value, row) {
    const sender = getItemType();
    let sParam = '';
    try { sParam = encodeURIComponent(b64EncodeUnicode(JSON.stringify(getTableState()))); } catch (e) {}
    const sQuery = sParam ? `&s=${sParam}` : '';
    if (row.image) {
      return `<a href="imageview.html?image=${row.image}&sender=${sender}${sQuery}">
                <img height="128" width="128" src="images/thumbs/${row.image}_thumb.jpg" alt="thumb">
              </a>
              <a href="update-item.html?id=${encodeURIComponent(row.id)}&itemType=${sender}" class="btn btn-sm btn-primary mt-2 admin-only">Edit</a>`;
    }
    return `<img height="128" src="images/100.png" alt="no image">
            <a href="update-item.html?id=${encodeURIComponent(row.id)}&itemType=${sender}" class="btn btn-sm btn-primary mt-2 admin-only">Edit</a>`;
  }
  window.imageFormatter = imageFormatter;

  /* =========================
     Filtering helpers
     ========================= */
  function customNumericFilter(value, filter) {
    if (!filter) return true;
    const m = String(filter).trim().match(/^(<=|>=|=|<|>)?\s*([\d,.]+)$/);
    if (!m) return true;
    const [, op = '=', numStr] = m;
    const fnum = parseFloat(numStr.replace(/,/g, ''));
    const valNum = parseFloat(String(value || '').replace(/[^0-9.-]+/g, ''));
    if (isNaN(valNum)) return false;
    switch (op) {
      case '<': return valNum < fnum;
      case '<=': return valNum <= fnum;
      case '=': return valNum === fnum;
      case '>=': return valNum >= fnum;
      case '>': return valNum > fnum;
      default: return valNum === fnum;
    }
  }

  function evaluateMinMaxPair(value, minStr, maxStr, blankOnly) {
    const valNum = parseFloat(String(value || '').replace(/[^0-9.-]+/g, ''));
    const isBlank = isNaN(valNum);
    if (blankOnly) return isBlank;
    if (isBlank) return false;

    if (minStr) {
      if (/^(<=|>=|=|<|>)/.test(minStr)) {
        if (!customNumericFilter(value, minStr)) return false;
      } else {
        const mn = parseFloat(minStr.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(mn) && valNum < mn) return false;
      }
    }
    if (maxStr) {
      if (/^(<=|>=|=|<|>)/.test(maxStr)) {
        if (!customNumericFilter(value, maxStr)) return false;
      } else {
        const mx = parseFloat(maxStr.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(mx) && valNum > mx) return false;
      }
    }
    return true;
  }

  function applyCustomFilters(data) {
    const acVal = $('#acquired-select').val() || '';
    const startDateStr = $('#acquired-range-start').val() || '';
    const endDateStr = $('#acquired-range-end').val() || '';
    const startDate = startDateStr ? parseDate(startDateStr) : null;
    const endDate = endDateStr ? parseDate(endDateStr) : null;

    const origSel = $('#original-select').val() || '';
    const currSel = $('#current-select').val() || '';

    const origCustomMin = $('#orig-range-min').val() || '';
    const origCustomMax = $('#orig-range-max').val() || '';
    const origCustomBlank = $('#orig-range-blank').is(':checked');

    const currCustomMin = $('#curr-range-min').val() || '';
    const currCustomMax = $('#curr-range-max').val() || '';
    const currCustomBlank = $('#curr-range-blank').is(':checked');

    const textFilters = {};
    $('.column-filter').each(function () {
      const k = $(this).data('column');
      const v = $(this).val();
      if (v !== undefined && v !== null && String(v).trim() !== '') textFilters[k] = String(v).trim().toLowerCase();
    });

    const filtered = (data || []).filter(row => {
      // acquired date rules
      if (acVal === '__blank__') {
        if (isValidDate(parseDate(row.acquired))) return false;
      } else if (acVal && acVal.startsWith('year:')) {
        const y = parseInt(acVal.split(':')[1], 10);
        const d = parseDate(row.acquired);
        if (!isValidDate(d) || d.getFullYear() !== y) return false;
      } else if (acVal === '__range__') {
        if (startDate || endDate) {
          const d = parseDate(row.acquired);
          if (!isValidDate(d)) return false;
          if (startDate && d < startDate) return false;
          if (endDate && d > endDate) return false;
        }
      }

      // original cost
      if (origSel === '__blank__') {
        if (!isNaN(toNumber(row.original_cost))) return false;
      } else if (/^preset:/.test(origSel)) {
        const parts = origSel.split(':');
        if (parts[1] === 'under') {
          const mx = parts[2] ? parseFloat(parts[2]) : NaN;
          const v = toNumber(row.original_cost);
          if (isNaN(v) || v > mx) return false;
        } else if (parts[1] === 'over') {
          const mn = parts[2] ? parseFloat(parts[2]) : NaN;
          const v = toNumber(row.original_cost);
          if (isNaN(v) || v <= mn) return false;
        }
      } else if (origSel === '__custom__') {
        if (!evaluateMinMaxPair(row.original_cost, origCustomMin, origCustomMax, origCustomBlank)) return false;
      }

      // current value
      if (currSel === '__blank__') {
        if (!isNaN(toNumber(row.current_value))) return false;
      } else if (/^preset:/.test(currSel)) {
        const parts = currSel.split(':');
        if (parts[1] === 'under') {
          const mx = parts[2] ? parseFloat(parts[2]) : NaN;
          const v = toNumber(row.current_value);
          if (isNaN(v) || v > mx) return false;
        } else if (parts[1] === 'over') {
          const mn = parts[2] ? parseFloat(parts[2]) : NaN;
          const v = toNumber(row.current_value);
          if (isNaN(v) || v <= mn) return false;
        }
      } else if (currSel === '__custom__') {
        if (!evaluateMinMaxPair(row.current_value, currCustomMin, currCustomMax, currCustomBlank)) return false;
      }

      for (const [k, v] of Object.entries(textFilters)) {
        if (k === 'original_cost' || k === 'current_value') {
          if (!customNumericFilter(row[k], v)) return false;
        } else {
          const cell = String(row[k] || '').toLowerCase();
          if (!cell.includes(v)) return false;
        }
      }

      return true;
    });

    currentFiltered = filtered;
    return filtered;
  }
  window.applyCustomFilters = applyCustomFilters;

  /* =========================
     UI: build filter row and modals
     ========================= */
  function buildNumericSelectHtml(id) {
    let html = `<select id="${id}-select" class="form-control form-control-sm numeric-select" data-column="${id}">`;
    html += `<option value="">All</option>`;
    html += `<option value="__blank__">Blank only</option>`;
    html += `<option value="preset:under:25">Under $25</option>`;
    html += `<option value="preset:under:100">Under $100</option>`;
    html += `<option value="preset:over:500">Over $500</option>`;
    html += `<option value="preset:over:1000">Over $1k</option>`;
    html += `<option value="__custom__">Custom Range…</option>`;
    html += `</select>`;
    return html;
  }

  function populateAcquiredOptions() {
    const years = [...new Set((rawData || []).map(r => parseDate(r.acquired)).filter(Boolean).map(d => d.getFullYear()))].sort((a, b) => b - a);
    const $sel = $('#acquired-select');
    if (!$sel.length) return;
    let html = '<option value="">All</option>';
    html += '<option value="__blank__">Blank only</option>';
    html += '<option value="__range__">Custom Range…</option>';
    years.forEach(y => html += `<option value="year:${y}">${y}</option>`);
    $sel.html(html);
  }

  function injectFilterRow() {
    const $thead = $('#catalog-table thead');
    if (!$thead.length) return;
    if ($thead.find('tr.filter-row').length) return;

    const $filterRow = $('<tr class="filter-row"></tr>');
    $thead.find('th').each(function () {
      const field = $(this).data('field');
      const $cell = $('<td></td>');
      if (field === 'state' || $(this).attr('data-checkbox')) {
        $cell.append(`<button id="clear-filters" class="btn btn-sm btn-warning" style="width:100px; min-width:100px; max-width:100px; font-size:0.8em; display:none; margin:4px auto 2px auto;">Clear All</button>`);
      } else if (field === 'acquired') {
        $cell.append(`<select id="acquired-select" class="form-control form-control-sm" data-column="acquired"></select>`);
      } else if (field === 'name/brand') {
        $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="name/brand" placeholder="Search title">');
      } else if (['franchise', 'size/model#', 'source'].includes(field)) {
        $cell.append(`<select class="column-filter form-control form-control-sm" data-column="${field}"><option value="">All</option></select>`);
      } else if (field === 'description') {
        $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="description" placeholder="Search description">');
      } else if (field === 'original_cost') {
        $cell.append(buildNumericSelectHtml('original'));
      } else if (field === 'current_value') {
        $cell.append(buildNumericSelectHtml('current'));
      } else if (field === 'is_verified') {
        $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="is_verified" placeholder="yes">');
      } else {
        $cell.append('');
      }
      $filterRow.append($cell);
    });

    $thead.append($filterRow);

    populateAcquiredOptions();
    ['franchise', 'size/model#', 'source'].forEach(col => {
      const unique = [...new Set((rawData || []).map(i => i[col]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
      const $sel = $(`select.column-filter[data-column="${col}"]`);
      if ($sel.length) {
        $sel.empty().append('<option value="">All</option>');
        unique.forEach(v => $sel.append(`<option value="${v}">${v}</option>`));
      }
    });
  }

  function showDateRangeModal() {
    const $m = $('#date-range-modal');
    if (!$m.length) return;
    $m.show();
    $m.find('.modal-box').css({ transform: 'translateY(0)', opacity: 1 });
  }
  function hideDateRangeModal() {
    const $m = $('#date-range-modal');
    if (!$m.length) return;
    $m.find('.modal-box').css({ transform: 'translateY(-12px)', opacity: 0 });
    setTimeout(() => $m.hide(), 220);
  }

  function showNumericModal(which) {
    const id = which === 'original' ? '#numeric-range-modal-original' : '#numeric-range-modal-current';
    const $m = $(id);
    if (!$m.length) return;
    $m.show();
    $m.find('.modal-box').css({ transform: 'translateY(0)', opacity: 1 });
  }
  function hideNumericModal(which) {
    const id = which === 'original' ? '#numeric-range-modal-original' : '#numeric-range-modal-current';
    const $m = $(id);
    if (!$m.length) return;
    $m.find('.modal-box').css({ transform: 'translateY(-12px)', opacity: 0 });
    setTimeout(() => $m.hide(), 220);
  }

  function anyFilterActive() {
    const hasColumnFilters = $('.column-filter').filter(function () {
      return $(this).val() && String($(this).val()).trim() !== '';
    }).length > 0;
    const ac = $('#acquired-select').val();
    const hasAc = ac && ac !== '';
    const origSel = $('#original-select').val();
    const currSel = $('#current-select').val();
    const hasNumericSelect = (origSel && origSel !== '') || (currSel && currSel !== '');
    const hasNumericModalValues = ($('#orig-range-min').val() && $('#orig-range-min').val().trim() !== '') ||
                                  ($('#orig-range-max').val() && $('#orig-range-max').val().trim() !== '') ||
                                  ($('#curr-range-min').val() && $('#curr-range-min').val().trim() !== '') ||
                                  ($('#curr-range-max').val() && $('#curr-range-max').val().trim() !== '') ||
                                  $('#orig-range-blank').is(':checked') || $('#curr-range-blank').is(':checked');
    return hasColumnFilters || hasAc || hasNumericSelect || hasNumericModalValues;
  }

  function updateClearButtonVisibility() {
    $('#clear-filters').toggle(anyFilterActive());
  }

  /* =========================
     Exports: native excel/pdf + csv/json via tableExport
     ========================= */

  // Native Excel using SheetJS (dynamic import)
// Native Excel using SheetJS (dynamic import)
function exportToExcel(data, fileName) {
  if (typeof XLSX === 'undefined') {
    alert("SheetJS (XLSX) library not loaded.");
    return;
  }
  if (!data || !data.length) {
    alert("No data to export.");
    return;
  }

  try {
    // Clone data so we don't modify original
    const cleanData = data.map(row => {
      const newRow = { ...row };
      ["OriginalCost", "CurrentValue"].forEach(key => {
        if (newRow[key] != null) {
          // Remove all non-digit/non-dot characters (like $ or GBP)
          const num = parseFloat(newRow[key].toString().replace(/[^0-9.-]+/g,""));
          newRow[key] = isNaN(num) ? 0 : num;
        }
      });
      return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(cleanData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export");

    // Find column indices for OriginalCost and CurrentValue
    const headers = Object.keys(cleanData[0]);
    const origIdx = headers.indexOf("OriginalCost");
    const currIdx = headers.indexOf("CurrentValue");

    if (origIdx !== -1 || currIdx !== -1) {
      const totalRowNum = cleanData.length + 2; // +1 for header, +1 for 1-based indexing
      const totalLabelCell = XLSX.utils.encode_cell({ r: totalRowNum - 1, c: headers.length - 3 });
      ws[totalLabelCell] = { t: "s", v: "Total:" };

      ["OriginalCost", "CurrentValue"].forEach((key, i) => {
        const idx = key === "OriginalCost" ? origIdx : currIdx;
        if (idx !== -1) {
          const col = XLSX.utils.encode_col(idx);
          const formula = `SUM(${col}2:${col}${cleanData.length + 1})`;
          const cellRef = XLSX.utils.encode_cell({ r: totalRowNum - 1, c: idx });
          ws[cellRef] = { t: "n", f: formula, z: "$#,##0.00" }; // currency format
        }
      });

      ws["!ref"] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: totalRowNum - 1, c: headers.length - 1 }
      });

      // Optional: set currency format for all rows
      cleanData.forEach((row, rowIndex) => {
        ["OriginalCost", "CurrentValue"].forEach(key => {
          const idx = headers.indexOf(key);
          if (idx !== -1) {
            const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: idx });
            if (ws[cellRef]) ws[cellRef].z = "$#,##0.00";
          }
        });
      });
    }

    XLSX.writeFile(wb, fileName + ".xlsx");
  } catch (err) {
    console.error("Excel export failed:", err);
    alert("Excel export failed.");
  }
}

  
  // Native PDF using jsPDF + AutoTable
  function exportToPDF(data, fileName) {
    const jspdfPresent = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jspdfPresent) {
      alert('jsPDF + AutoTable not loaded; cannot export PDF.');
      return;
    }
    if (!data || !data.length) {
      alert('No data to export.');
      return;
    }

    const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });

    // Build headers and body
    const headers = Object.keys(data[0] || {});
    const body = data.map(row => headers.map(h => row[h] ?? ''));

    // optional title
    doc.setFontSize(12);
    doc.text(fileName, 40, 30);

    doc.autoTable({
      head: [headers],
      body: body,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(fileName + '.pdf');
  }

  // performExport uses native Excel & PDF handlers, tableExport for CSV
  function performExport(format) {
    const $table = $('#catalog-table');
    let dataToExport = [];

    if (exportMode === 'selected') {
      dataToExport = $table.bootstrapTable('getSelections') || [];
    } else if (exportMode === 'page') {
      try {
        dataToExport = $table.bootstrapTable('getData', { useCurrentPage: true }) || $table.bootstrapTable('getData');
      } catch (err) {
        const opts = $table.bootstrapTable('getOptions') || {};
        const pageNumber = opts.pageNumber || 1;
        const pageSize = opts.pageSize || DEFAULT_PAGE_SIZE;
        const all = $table.bootstrapTable('getData') || [];
        dataToExport = all.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
      }
    } else if (exportMode === 'filtered') {
      dataToExport = applyCustomFilters(rawData);
    } else { // 'all'
      dataToExport = rawData.slice();
    }

    if (!dataToExport || dataToExport.length === 0) {
      alert('No rows available to export.');
      return;
    }

    // map to a clean object list for export (consistent columns)
    const mapped = dataToExport.map(r => ({
      ID: r.id,
      Acquired: r.acquired,
      Title: r['name/brand'] || r.title || '',
      Franchise: r.franchise || '',
      Description: r.description || '',
      Source: r.source || '',
      OriginalCost: r.original_cost || '',
      CurrentValue: r.current_value || '',
      IsVerified: r.is_verified || ''
    }));

    const filename = ($('#export-filename').val().trim() || getItemType() + '-export');

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(mapped, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename + '.json';
      a.click();
      return;
    }

    if (format === 'csv') {
      // use tableExport for CSV by building temporary table
      const $tmp = $('<table>').attr('id', 'tmp-export-table').css('display', 'none').appendTo('body');
      const cols = Object.keys(mapped[0]);
      const $thead = $('<thead>');
      const $htr = $('<tr>');
      cols.forEach(c => $htr.append(`<th>${c}</th>`));
      $thead.append($htr); $tmp.append($thead);
      const $tbody = $('<tbody>');
      mapped.forEach(row => {
        const $r = $('<tr>');
        cols.forEach(c => $r.append(`<td>${row[c] ?? ''}</td>`));
        $tbody.append($r);
      });
      $tmp.append($tbody);
      // ensure tableExport is available
      if ($.fn.tableExport) {
        $tmp.tableExport({ fileName: filename, type: 'csv', escape: 'false', exportDataType: 'all' });
      } else {
        // fallback: simple CSV generation
        const csv = [cols.join(',')].concat(mapped.map(r => cols.map(c => `"${String(r[c] || '').replace(/"/g, '""')}"`).join(','))).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename + '.csv'; a.click();
      }
      $tmp.remove();
      return;
    }

    if (format === 'excel') {
      exportToExcel(mapped, filename);
      return;
    }

    if (format === 'pdf') {
      exportToPDF(mapped, filename);
      return;
    }

    alert('Unsupported export format: ' + format);
  }

  /* =========================
     Initialization & Event bindings after JSON load
     ========================= */
  $(function () {
    const type = getItemType();
    const path = `data/${type}.json`;

    // Ensure jsPDF global alias if loaded via UMD
    if (window.jspdf && !window.jsPDF) {
      try { window.jsPDF = window.jspdf.jsPDF; } catch (e) {}
    }
    // Also provide fallback alias if jsPDF already present as window.jsPDF
    if (window.jsPDF && !window.jspdf) {
      try { window.jspdf = { jsPDF: window.jsPDF }; } catch (e) {}
    }

    $.getJSON(path)
      .done(function (json) {
        rawData = json || [];
        initTableAndBindings();
      })
      .fail(function (jqxhr, status, err) {
        console.error('Failed to load', path, status, err);
        rawData = [];
        initTableAndBindings();
      });

    function initTableAndBindings() {
      $('#catalog-table').bootstrapTable('destroy').bootstrapTable({
        data: rawData,
        pagination: true,
        pageSize: DEFAULT_PAGE_SIZE,
        pageList: [5, 10, 25, 50, 100],
        toolbar: '#toolbar',
        clickToSelect: true,
        idField: 'id',
        detailView: true,
        detailViewByClick: true,
        detailFormatter: detailFormatter,
        rowStyle: rowStyle,
        showFooter: true
      });

      injectFilterRow();

      // initial hide modals
      $('#date-range-modal').hide();
      $('#numeric-range-modal-original').hide();
      $('#numeric-range-modal-current').hide();

      // Bind change handlers for dynamic selects
      $(document).on('change', '#acquired-select', function () {
        const v = $(this).val() || '';
        if (v === '__range__') { showDateRangeModal(); updateClearButtonVisibility(); return; }
        hideDateRangeModal();
        const f = applyCustomFilters(rawData);
        $('#catalog-table').bootstrapTable('load', f);
        autoSwitchExportModeIfFilteredActive();
        updateClearButtonVisibility();
      });

      $(document).on('change', '.numeric-select', function () {
        const id = $(this).attr('id') || '';
        const who = id.split('-')[0];
        const val = $(this).val() || '';
        if (val === '__custom__') {
          if (who === 'original') { $('#orig-range-min').val($('#orig-range-min').val() || ''); $('#orig-range-max').val($('#orig-range-max').val() || ''); $('#orig-range-blank').prop('checked', $('#orig-range-blank').is(':checked')); showNumericModal('original'); }
          else { $('#curr-range-min').val($('#curr-range-min').val() || ''); $('#curr-range-max').val($('#curr-range-max').val() || ''); $('#curr-range-blank').prop('checked', $('#curr-range-blank').is(':checked')); showNumericModal('current'); }
          updateClearButtonVisibility(); return;
        }
        const f = applyCustomFilters(rawData);
        $('#catalog-table').bootstrapTable('load', f);
        autoSwitchExportModeIfFilteredActive();
        updateClearButtonVisibility();
      });

      let debounceT;
      $(document).on('input change', '.column-filter', function () {
        clearTimeout(debounceT);
        debounceT = setTimeout(() => {
          const f = applyCustomFilters(rawData);
          $('#catalog-table').bootstrapTable('load', f);
          autoSwitchExportModeIfFilteredActive();
          updateClearButtonVisibility();
        }, 200);
      });

      // Date modal apply/cancel
      $(document).on('click', '#date-range-apply', function (e) {
        e.preventDefault();
        hideDateRangeModal();
        const f = applyCustomFilters(rawData);
        $('#catalog-table').bootstrapTable('load', f);
        autoSwitchExportModeIfFilteredActive();
        updateClearButtonVisibility();
      });
      $(document).on('click', '#date-range-cancel', function (e) {
        e.preventDefault();
        hideDateRangeModal();
        updateClearButtonVisibility();
      });

      // Numeric modals
      $(document).on('click', '#orig-range-apply', function (e) {
        e.preventDefault(); hideNumericModal('original'); const f = applyCustomFilters(rawData); $('#catalog-table').bootstrapTable('load', f); autoSwitchExportModeIfFilteredActive(); updateClearButtonVisibility(); 
      });
      $(document).on('click', '#orig-range-cancel', function (e) {
        e.preventDefault(); hideNumericModal('original'); updateClearButtonVisibility(); 
      });
      $(document).on('click', '#curr-range-apply', function (e) {
        e.preventDefault(); hideNumericModal('current'); const f = applyCustomFilters(rawData); $('#catalog-table').bootstrapTable('load', f); autoSwitchExportModeIfFilteredActive(); updateClearButtonVisibility(); 
      });
      $(document).on('click', '#curr-range-cancel', function (e) {
        e.preventDefault(); hideNumericModal('current'); updateClearButtonVisibility(); 
      });

      // Clear all
      $(document).on('click', '#clear-filters', function (e) {
        e.preventDefault();
        $('.column-filter').val('');
        $('#acquired-select').val('');
        $('.numeric-select').val('');
        $('#acquired-range-start, #acquired-range-end').val('');
        $('#orig-range-min, #orig-range-max').val('');
        $('#curr-range-min, #curr-range-max').val('');
        $('#orig-range-blank, #curr-range-blank').prop('checked', false);
        hideDateRangeModal(); hideNumericModal('original'); hideNumericModal('current');
        $('#catalog-table').bootstrapTable('load', rawData);

        // Reset export mode to All when clearing filters
        exportMode = "all";
        $('#exportModeBtn').text("Export Mode: All Rows");
        $('.export-mode').removeClass('active');
        $('.export-mode[data-mode="all"]').addClass('active');

        updateClearButtonVisibility();
      });

      // AUTO-SWITCH EXPORT MODE TO FILTERED WHEN ANY FILTER IS ACTIVE
      function autoSwitchExportModeIfFilteredActive() {
        // Only switch if user hasn't manually chosen a different mode
        if (exportMode === "all") {
            exportMode = "filtered";

            // Update button label
            $('#exportModeBtn').text("Export Mode: Filtered Rows");

            // Update dropdown active state
            $('.export-mode').removeClass('active');
            $('.export-mode[data-mode="filtered"]').addClass('active');
        }
      }

      // Export mode selection
      $(document).on('click', '.export-mode', function (e) {
        e.preventDefault();

        const mode = $(this).data('mode');
        if (!mode) return;

        // Update internal state
        exportMode = mode;

        // Update active highlight
        $('.export-mode').removeClass('active');
        $(this).addClass('active');

        // Update button label text
        const labelMap = {
            all: "All Rows",
            filtered: "Filtered Rows",
            page: "Visible Data",
            selected: "Selected Rows"
        };

        $('#exportModeBtn').text("Export Mode: " + labelMap[mode]);
      });

      // Export buttons
      $(document).on('click', '#export-csv', function () { performExport('csv'); });
      $(document).on('click', '#export-excel', function () { performExport('excel'); });
      $(document).on('click', '#export-json', function () { performExport('json'); });
      $(document).on('click', '#export-pdf', function () { performExport('pdf'); });

      // Sync label when filters change
      $(document).on('change input', '.column-filter, #acquired-select, .numeric-select, #orig-range-min, #orig-range-max, #curr-range-min, #curr-range-max, #orig-range-blank, #curr-range-blank', function () {
        setTimeout(updateExportModeLabel, 10);
      });

      // post-body callback: render canvas watermarks if present
      $('#catalog-table').on('post-body.bs.table', function () {
        $('#catalog-table canvas[data-src]').each(function () {
          try {
            const c = this;
            const ctx = c.getContext('2d');
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
              const w = c.width, h = c.height;
              ctx.clearRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              ctx.save();
              ctx.translate(w / 2, h / 2);
              ctx.rotate(-0.6);
              ctx.globalAlpha = 0.22;
              ctx.font = '36px Arial';
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.fillText('GeorgiaJedi', 0, 0);
              ctx.restore();
            };
            img.src = $(c).attr('data-src');
          } catch (e) {
            console.warn('canvas render failed', e);
          }
        });
      });

      // initial UI state
      updateClearButtonVisibility();
    }
  });

  window.performExport = performExport;

})(); // end closure

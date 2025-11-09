/**
 * script.js — cleaned, integrated
 * - Date dropdown (All / Blank / Year / Custom Range modal)
 * - Numeric dropdowns (All / Blank / presets / Custom Range modal) for original_cost & current_value
 * - Custom modals are injected by this script (no HTML edits required)
 * - State encoding/decoding via tiny base64 's' param for imageview <-> restore
 * - Clear All button in first header cell: auto-show when filters active (instant show/hide)
 * - Exposes formatters & helpers to window for bootstrap-table compatibility
 *
 * Ready to paste over your current js/script.js
 */

let rawData = [];

// active ranges (persisted in state)
const activeDateRange = { start: '', end: '' }; // for date modal
const activeNumericRange = { // for numeric modal, set before opening modal: { field: 'original'|'current', min:'', max:'' }
  field: '',
  min: '',
  max: ''
};

// ---------------- Utilities ----------------
function isValidDate(d) { return d instanceof Date && !isNaN(d); }
function parseDate(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
  const parts = s.split('/');
  if (parts.length === 3) return new Date(`${parts[2]}-${parts[0]}-${parts[1]}T00:00:00`);
  const d = new Date(s);
  return isValidDate(d) ? d : null;
}
function toNumber(value) {
  if (value === undefined || value === null || value === '') return NaN;
  const n = parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  return isNaN(n) ? NaN : n;
}

// ---------------- Formatters & Exports ----------------
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
  const n = parseFloat(String(value).replace(/[^0-9.-]+/g, '')) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
window.currencyFormatter = currencyFormatter;

function originalCostFooter(data) {
  let total = 0;
  data.forEach(r => total += parseFloat(String(r.original_cost || '').replace(/[^0-9.-]+/g, '')) || 0);
  return currencyFormatter(total);
}
window.originalCostFooter = originalCostFooter;

function currentValueFooter(data) {
  let total = 0;
  data.forEach(r => total += parseFloat(String(r.current_value || '').replace(/[^0-9.-]+/g, '')) || 0);
  return currencyFormatter(total);
}
window.currentValueFooter = currentValueFooter;

function imageFooterFormatter(data) {
  let count = 0;
  data.forEach(r => {
    if (r.image) {
      const fn = String(r.image).split('/').pop().toLowerCase();
      if (fn !== '100.png' && fn !== '100') count++;
    }
  });
  return `${count} images`;
}
window.imageFooterFormatter = imageFooterFormatter;

function descFormatter(index, row) {
  return row.description ? String(row.description).substring(0, 120) : '';
}
window.descFormatter = descFormatter;

function rowStyle(row, index) {
  return { classes: index % 2 === 0 ? 'bg-ltgray' : 'bg-ltblue' };
}
window.rowStyle = rowStyle;

// ---------------- Detail & Image view ----------------
function detailFormatter(index, row) {
  const img = row.image ? `images/${row.image}.jpg` : 'images/100.png';
  return `
  <div class="card" style="display:flex; border:1px solid #ddd; padding:10px;">
    <div style="flex:1; text-align:center;">
      <img src="${img}" style="width:500px; border-radius:5px;" alt="item image">
    </div>
    <div style="flex:2; padding-left:20px;">
      ${row.title ? `<h3>${row.title}</h3>` : ''}
      ${row.franchise ? `<p><b>Franchise:</b> ${row.franchise}</p>` : ''}
      ${row.description ? `<p><b>Description:</b> ${row.description}</p>` : ''}
      ${row.size ? `<p><b>Size:</b> ${row.size}</p>` : ''}
      ${row.source ? `<p><b>Source:</b> ${row.source}</p>` : ''}
      ${row.serialnumber ? `<p><b>Serial Number:</b> ${row.serialnumber}</p>` : ''}
      ${row.original_cost ? `<p><b>Original Cost:</b> ${currencyFormatter(row.original_cost)}</p>` : ''}
      ${row.current_value ? `<p><b>Current Value:</b> ${currencyFormatter(row.current_value)}</p>` : ''}
    </div>
  </div>`;
}
window.detailFormatter = detailFormatter;

function b64EncodeUnicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(_, p1) {
    return String.fromCharCode('0x' + p1);
  }));
}
function b64DecodeUnicode(str) {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch (e) {
    try { return atob(str); } catch (ex) { return null; }
  }
}

function getItemType() {
  const page = window.location.pathname.split('/').pop();
  return page.split('.').shift();
}

// ---------------- Table state ----------------
function getTableState() {
  const opt = $('#catalog-table').bootstrapTable('getOptions') || {};
  const state = {
    pageNumber: opt.pageNumber || 1,
    pageSize: opt.pageSize || 5,
    sortName: opt.sortName || '',
    sortOrder: opt.sortOrder || '',
    searchText: opt.searchText ?? ''
  };

  // collect column-filters
  const filters = {};
  $('.column-filter').each(function() {
    const k = $(this).data('column');
    const v = $(this).val();
    if (v !== undefined && v !== null && String(v) !== '') filters[k] = v;
  });

  // acquired (date) select
  const ac = $('#acquired-select').val();
  if (ac) filters['acquired'] = ac;
  if (ac === '__range__') {
    if (activeDateRange.start || activeDateRange.end) filters['acquired_range'] = (activeDateRange.start || '') + '|' + (activeDateRange.end || '');
  }

  // numeric selects
  const origSel = $('#original-select').val();
  if (origSel) {
    filters['original_select'] = origSel;
    if (origSel === '__range__' && activeNumericRange.field === 'original') {
      filters['original_range'] = (activeNumericRange.min || '') + '|' + (activeNumericRange.max || '');
    }
  }
  const currSel = $('#current-select').val();
  if (currSel) {
    filters['current_select'] = currSel;
    if (currSel === '__range__' && activeNumericRange.field === 'current') {
      filters['current_range'] = (activeNumericRange.min || '') + '|' + (activeNumericRange.max || '');
    }
  }

  state.filters = filters;
  return state;
}

// ---------------- imageFormatter (encodes state for imageview) ----------------
function imageFormatter(value, row) {
  const sender = getItemType();
  const type = getItemType();
  let sParam = '';
  try { sParam = encodeURIComponent(b64EncodeUnicode(JSON.stringify(getTableState()))); } catch (e) {}
  const sQuery = sParam ? `&s=${sParam}` : '';
  if (row.image) {
    return `<a href="imageview.html?image=${row.image}&sender=${sender}${sQuery}">
              <img height="128" width="128" src="images/thumbs/${row.image}_thumb.jpg" alt="thumb">
            </a>
            <a href="update-item.html?id=${row.id}&itemType=${type}" class="btn btn-sm btn-primary mt-2 admin-only">Edit</a>`;
  }
  return `<img height="128" src="images/100.png" alt="no image">
          <a href="update-item.html?id=${row.id}&itemType=${type}" class="btn btn-sm btn-primary mt-2 admin-only">Edit</a>`;
}
window.imageFormatter = imageFormatter;

// ---------------- Numeric option helpers ----------------
function buildNumericDropdownOptions(presets) {
  // returns HTML string of <option> elements with data-min/data-max attributes
  let html = '<option value="">All</option>';
  html += '<option value="__blank__" data-min="" data-max="">Blank only</option>';
  presets.forEach(p => {
    const val = `preset:${p.min || ''}:${p.max || ''}`; // encode min/max in value
    html += `<option value="${val}" data-min="${p.min || ''}" data-max="${p.max || ''}">${p.label}</option>`;
  });
  html += '<option value="__range__" data-min="" data-max="">Custom Range…</option>';
  return html;
}

// ---------------- Filters core ----------------
function customNumericCompare(value, minStr, maxStr, blankOnly) {
  // blankOnly true => match only if value is blank
  const valNum = toNumber(value);
  const isBlank = isNaN(valNum);

  if (blankOnly) return isBlank;
  if (isBlank) return false;

  // if minStr starts with operator, allow that
  if (minStr && /^(\s*(<=|>=|=|<|>))/i.test(minStr)) {
    if (!customNumericFilter(value, minStr)) return false;
  } else if (minStr) {
    const mn = parseFloat(String(minStr).replace(/[^0-9.-]+/g, ''));
    if (!isNaN(mn) && valNum < mn) return false;
  }

  if (maxStr && /^(\s*(<=|>=|=|<|>))/i.test(maxStr)) {
    if (!customNumericFilter(value, maxStr)) return false;
  } else if (maxStr) {
    const mx = parseFloat(String(maxStr).replace(/[^0-9.-]+/g, ''));
    if (!isNaN(mx) && valNum > mx) return false;
  }

  return true;
}

function customNumericFilter(value, filter) {
  if (!filter) return true;
  const m = String(filter).match(/^(<=|>=|=|<|>)?\s*([\d,.]+)$/);
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

// ---------------- Apply all custom filters ----------------
function applyCustomFilters(data) {
  // acquired (date)
  const acVal = $('#acquired-select').val();
  const startStr = activeDateRange.start || $('#acquired-range-start').val() || $('#date-range-start').val();
  const endStr   = activeDateRange.end   || $('#acquired-range-end').val()   || $('#date-range-end').val();
  const startDate = startStr ? parseDate(startStr) : null;
  const endDate = endStr ? parseDate(endStr) : null;

  // numeric selects
  const origSel = $('#original-select').val();
  const currSel = $('#current-select').val();

  // collect text column filters
  const filters = {};
  $('.column-filter').each(function() {
    const k = $(this).data('column');
    const v = $(this).val();
    if (v !== undefined && v !== null && String(v).trim() !== '') filters[k] = String(v).trim().toLowerCase();
  });

  return data.filter(row => {
    // ---------- Date filtering ----------
    if (acVal === '__blank__') {
      if (isValidDate(parseDate(row.acquired))) return false;
    } else if (acVal && acVal.startsWith('year:')) {
      const year = parseInt(acVal.split(':')[1], 10);
      const d = parseDate(row.acquired);
      if (!isValidDate(d) || d.getFullYear() !== year) return false;
    } else if (acVal === '__range__') {
      if (startDate || endDate) {
        const d = parseDate(row.acquired);
        if (!isValidDate(d)) return false;
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
      }
    }

    // ---------- Numeric original_cost ----------
    if (origSel === '__blank__') {
      if (!isNaN(toNumber(row.original_cost))) return false; // only blanks allowed
    } else if (origSel && origSel.startsWith('preset:')) {
      // preset: min:max
      const parts = origSel.split(':').slice(1); // [min,max]
      const min = parts[0] || '';
      const max = parts[1] || '';
      if (!customNumericCompare(row.original_cost, min, max, false)) return false;
    } else if (origSel === '__range__') {
      if (activeNumericRange.field === 'original') {
        if (!customNumericCompare(row.original_cost, activeNumericRange.min, activeNumericRange.max, false)) return false;
      } else {
        // if no active range for this field, treat as no filter
      }
    }

    // ---------- Numeric current_value ----------
    if (currSel === '__blank__') {
      if (!isNaN(toNumber(row.current_value))) return false;
    } else if (currSel && currSel.startsWith('preset:')) {
      const parts = currSel.split(':').slice(1);
      const min = parts[0] || '';
      const max = parts[1] || '';
      if (!customNumericCompare(row.current_value, min, max, false)) return false;
    } else if (currSel === '__range__') {
      if (activeNumericRange.field === 'current') {
        if (!customNumericCompare(row.current_value, activeNumericRange.min, activeNumericRange.max, false)) return false;
      }
    }

    // ---------- Other column filters ----------
    for (const [k, v] of Object.entries(filters)) {
      if (k === 'original_cost' || k === 'current_value') {
        // legacy support if someone typed operator in column-filter (rare)
        if (!customNumericFilter(row[k], v)) return false;
      } else {
        const cell = String(row[k] || '').toLowerCase();
        if (!cell.includes(v)) return false;
      }
    }

    return true;
  });
}
window.applyCustomFilters = applyCustomFilters;

// ---------------- Filter Row Injection & Modals ----------------
function populateAcquiredOptions() {
  const years = [...new Set(rawData
    .map(r => parseDate(r.acquired))
    .filter(d => isValidDate(d))
    .map(d => d.getFullYear()))].sort((a, b) => b - a);
  const $sel = $('#acquired-select');
  if (!$sel.length) return;
  let opt = '<option value="">All</option>';
  opt += '<option value="__blank__">Blank only</option>';
  opt += '<option value="__range__">Custom Range…</option>';
  years.forEach(y => opt += `<option value="year:${y}">${y}</option>`);
  $sel.html(opt);
}

function injectModalsIfNeeded() {
  // Date modal: if page already has #date-range-modal we leave it; else inject a minimal one
  if (!$('#date-range-modal').length) {
    const dateModal = `
<div id="date-range-modal" style="display:none;">
  <div class="modal-backdrop-custom" style="position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.45);z-index:1999;"></div>
  <div class="modal-box" style="position:fixed;left:50%;transform:translateX(-50%) translateY(-12px);top:100px;background:#fff;padding:12px;border-radius:6px;z-index:2000;box-shadow:0 8px 24px rgba(0,0,0,0.25);transition:transform 220ms ease, opacity 220ms ease;opacity:0;">
    <h5 style="margin-top:0;margin-bottom:10px;">Select Acquired Date Range</h5>
    <div style="margin-bottom:8px;"><label style="display:block;font-size:0.9em">From:</label><input id="acquired-range-start" type="date" class="form-control form-control-sm"></div>
    <div style="margin-bottom:8px;"><label style="display:block;font-size:0.9em">To:</label><input id="acquired-range-end" type="date" class="form-control form-control-sm"></div>
    <div style="text-align:right;"><button id="acquired-range-cancel" class="btn btn-sm btn-secondary">Cancel</button> <button id="acquired-range-apply" class="btn btn-sm btn-primary">Apply</button></div>
  </div>
</div>`;
    $('body').append(dateModal);
  }

  // Numeric modal (single modal used for both original & current; activeNumericRange.field controls which field)
  if (!$('#numeric-range-modal').length) {
    const numModal = `
<div id="numeric-range-modal" style="display:none;">
  <div class="modal-backdrop-custom" style="position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.45);z-index:1999;"></div>
  <div class="modal-box" style="position:fixed;left:50%;transform:translateX(-50%) translateY(-12px);top:120px;background:#fff;padding:12px;border-radius:6px;z-index:2000;box-shadow:0 8px 24px rgba(0,0,0,0.25);transition:transform 220ms ease, opacity 220ms ease;opacity:0;">
    <h5 style="margin-top:0;margin-bottom:10px;">Custom Numeric Range</h5>
    <div style="margin-bottom:8px;"><label style="display:block;font-size:0.9em">Min:</label><input id="numeric-range-min" type="text" class="form-control form-control-sm" placeholder="e.g. 10 or >= 50"></div>
    <div style="margin-bottom:8px;"><label style="display:block;font-size:0.9em">Max:</label><input id="numeric-range-max" type="text" class="form-control form-control-sm" placeholder="e.g. 500 or <= 1000"></div>
    <div style="text-align:right;"><button id="numeric-range-cancel" class="btn btn-sm btn-secondary">Cancel</button> <button id="numeric-range-apply" class="btn btn-sm btn-primary">Apply</button></div>
  </div>
</div>`;
    $('body').append(numModal);
  }
}

function buildNumericDropdown(presets) {
  // returns HTML string for select element options
  return buildNumericDropdownOptions(presets);
}

function injectFilterRow() {
  const $thead = $('#catalog-table thead');
  const $filterRow = $('<tr class="filter-row"></tr>');

  // Make sure to create Clear All button placeholder in first cell (image column)
  $thead.find('th').each(function(i) {
    const field = $(this).data('field');
    const $cell = $('<td></td>');

    if (field === 'image') {
      // Clear All button (hidden by default). We'll show/hide instantly via updateClearButtonVisibility()
      $cell.append(`<button id="clear-filters" class="btn btn-sm btn-warning w-100" style="font-size:0.8em; display:none; margin-top:4px; margin-bottom:2px;">Clear All</button>`);
    }
    else if (field === 'acquired') {
      $cell.append(`<select id="acquired-select" class="form-control form-control-sm" data-column="acquired"></select>`);
    }
    else if (field === 'name/brand') {
      $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="name/brand" placeholder="Search title">');
    } else if (field === 'franchise' || field === 'size/model#' || field === 'source') {
      $cell.append(`<select class="column-filter form-control form-control-sm" data-column="${field}"><option value="">All</option></select>`);
    } else if (field === 'original_cost') {
      // numeric dropdown for original cost (presets)
      const origPresets = [
        { label: 'Under $25', min: '', max: '25' },
        { label: 'Under $100', min: '', max: '100' },
        { label: 'Over $500', min: '500', max: '' },
        { label: 'Over $1k', min: '1000', max: '' }
      ];
      const selHtml = `<select id="original-select" class="form-control form-control-sm" data-column="original_cost">${buildNumericDropdown(origPresets)}</select>`;
      $cell.append(selHtml);
    } else if (field === 'current_value') {
      const currPresets = [
        { label: 'Under $25', min: '', max: '25' },
        { label: 'Under $100', min: '', max: '100' },
        { label: 'Over $500', min: '500', max: '' },
        { label: 'Over $1k', min: '1000', max: '' }
      ];
      const selHtml = `<select id="current-select" class="form-control form-control-sm" data-column="current_value">${buildNumericDropdown(currPresets)}</select>`;
      $cell.append(selHtml);
    } else if (field === 'is_verified') {
      $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="is_verified" placeholder="yes">');
    } else {
      // leave empty cell for columns without a filter
    }

    $filterRow.append($cell);
  });

  $thead.append($filterRow);

  // after injecting row, populate dynamic selects
  populateAcquiredOptions();
  ['franchise', 'size/model#', 'source'].forEach(col => {
    const unique = [...new Set(rawData.map(i => i[col]).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
    const $sel = $(`select.column-filter[data-column="${col}"]`);
    $sel.empty().append('<option value="">All</option>');
    unique.forEach(v => $sel.append(`<option value="${v}">${v}</option>`));
  });

  // Ensure modals exist
  injectModalsIfNeeded();

  // ---------- Events ----------

  // Acquired select change
  $(document).on('change', '#acquired-select', function() {
    const val = $(this).val();
    if (val === '__range__') {
      // prefill modal from activeDateRange
      $('#acquired-range-start').val(activeDateRange.start);
      $('#acquired-range-end').val(activeDateRange.end);
      // show modal (SD-B subtle)
      $('#date-range-modal').show();
      $('#date-range-modal .modal-box').css({ transform: 'translateY(0)', opacity: 1 });
    } else {
      // hide modal if open
      $('#date-range-modal .modal-box').css({ transform: 'translateY(-12px)', opacity: 0 });
      setTimeout(() => { $('#date-range-modal').hide(); }, 220);
      $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
      updateClearButtonVisibility();
    }
  });

  // column-filter text/select change (debounced)
  let debounceT;
  $(document).on('input change', '.column-filter', function() {
    clearTimeout(debounceT);
    debounceT = setTimeout(() => {
      $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
      updateClearButtonVisibility();
    }, 200);
  });

  // numeric select change (original/current)
  $(document).on('change', '#original-select', function() {
    const val = $(this).val();
    if (val === '__range__') {
      // open numeric modal for original
      activeNumericRange.field = 'original';
      $('#numeric-range-min').val(activeNumericRange.min || '');
      $('#numeric-range-max').val(activeNumericRange.max || '');
      $('#numeric-range-modal').show();
      $('#numeric-range-modal .modal-box').css({ transform: 'translateY(0)', opacity: 1 });
    } else {
      // apply filters immediately
      $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
      updateClearButtonVisibility();
    }
  });
  $(document).on('change', '#current-select', function() {
    const val = $(this).val();
    if (val === '__range__') {
      activeNumericRange.field = 'current';
      $('#numeric-range-min').val(activeNumericRange.min || '');
      $('#numeric-range-max').val(activeNumericRange.max || '');
      $('#numeric-range-modal').show();
      $('#numeric-range-modal .modal-box').css({ transform: 'translateY(0)', opacity: 1 });
    } else {
      $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
      updateClearButtonVisibility();
    }
  });

  // date modal apply/cancel
  $(document).on('click', '#acquired-range-apply', function(e) {
    e.preventDefault();
    activeDateRange.start = $('#acquired-range-start').val() || '';
    activeDateRange.end   = $('#acquired-range-end').val() || '';
    $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
    // hide modal
    $('#date-range-modal .modal-box').css({ transform: 'translateY(-12px)', opacity: 0 });
    setTimeout(()=> { $('#date-range-modal').hide(); }, 220);
    updateClearButtonVisibility();
  });
  $(document).on('click', '#acquired-range-cancel', function(e) {
    e.preventDefault();
    $('#date-range-modal .modal-box').css({ transform: 'translateY(-12px)', opacity: 0 });
    setTimeout(()=> { $('#date-range-modal').hide(); }, 220);
    // keep activeDateRange unchanged
  });

  // numeric modal apply/cancel
  $(document).on('click', '#numeric-range-apply', function(e) {
    e.preventDefault();
    const min = $('#numeric-range-min').val() || '';
    const max = $('#numeric-range-max').val() || '';
    if (!activeNumericRange.field) return;
    activeNumericRange.min = min;
    activeNumericRange.max = max;
    // apply filters
    $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
    // hide modal
    $('#numeric-range-modal .modal-box').css({ transform: 'translateY(-12px)', opacity: 0 });
    setTimeout(()=> { $('#numeric-range-modal').hide(); }, 220);
    updateClearButtonVisibility();
  });
  $(document).on('click', '#numeric-range-cancel', function(e) {
    e.preventDefault();
    $('#numeric-range-modal .modal-box').css({ transform: 'translateY(-12px)', opacity: 0 });
    setTimeout(()=> { $('#numeric-range-modal').hide(); }, 220);
  });

  // Clear All button handler
  $(document).on('click', '#clear-filters', function(e) {
    e.preventDefault();
    // reset all filters & active ranges
    $('.column-filter').val('');
    $('#acquired-select').val('');
    $('#original-select').val('');
    $('#current-select').val('');
    activeDateRange.start = activeDateRange.end = '';
    activeNumericRange.field = activeNumericRange.min = activeNumericRange.max = '';
    // hide modals if present
    $('#date-range-modal, #numeric-range-modal').hide();
    // reload full dataset
    $('#catalog-table').bootstrapTable('load', rawData);
    updateClearButtonVisibility();
  });

  // ensure clear button visibility initially
  updateClearButtonVisibility();
}

// ---------------- Clear button visibility ----------------
function anyFilterActive() {
  // any column-filter with value
  const hasColumnFilters = $('.column-filter').filter(function() { return $(this).val() && $(this).val().toString().trim() !== ''; }).length > 0;
  // acquired select active
  const hasAcquired = $('#acquired-select').length && $('#acquired-select').val() && $('#acquired-select').val() !== '';
  // numeric selects active
  const hasOrig = $('#original-select').length && $('#original-select').val() && $('#original-select').val() !== '';
  const hasCurr = $('#current-select').length && $('#current-select').val() && $('#current-select').val() !== '';
  // active ranges set
  const hasDateRange = (activeDateRange.start && activeDateRange.start.trim() !== '') || (activeDateRange.end && activeDateRange.end.trim() !== '');
  const hasNumericRange = Boolean(activeNumericRange.field && (activeNumericRange.min || activeNumericRange.max));
  return hasColumnFilters || hasAcquired || hasOrig || hasCurr || hasDateRange || hasNumericRange;
}
function updateClearButtonVisibility() {
  $('#clear-filters').toggle(anyFilterActive());
}

// ---------------- Init & State restoration ----------------
$(function() {
  // Fetch data
  $.getJSON('data/' + getItemType() + '.json', function(jsonData) {
    rawData = jsonData || [];

    // Ensure modals exist
    injectModalsIfNeeded();

    // Create table
    $('#catalog-table').bootstrapTable('destroy').bootstrapTable({
      data: rawData,
      detailView: true,
      detailViewByClick: true,
      detailFormatter: detailFormatter,
      cardView: window.innerWidth < 1200,
      pagination: true,
      pageList: [5,10,25,50,100],
      pageSize: 5,
      sidePagination: 'client',
      showFooter: window.innerWidth >= 1200,
      rowStyle: rowStyle
    });

    // Inject filter row and wire events
    injectFilterRow();

    // Populate acquired + numeric dropdowns (from data + presets done in injectFilterRow)
    populateAcquiredOptions();

    // If compact state 's' found in URL, decode and apply
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sRaw = urlParams.get('s');
      if (sRaw) {
        const decoded = b64DecodeUnicode(decodeURIComponent(sRaw));
        if (decoded) {
          const state = JSON.parse(decoded);
          // Apply column filters
          if (state.filters) {
            // text/select filters
            Object.entries(state.filters).forEach(([k,v]) => {
              if (k === 'acquired') {
                $('#acquired-select').val(v);
              } else if (k === 'original_select') {
                $('#original-select').val(v);
              } else if (k === 'current_select') {
                $('#current-select').val(v);
              } else if (k === 'acquired_range') {
                const [s,e] = String(v).split('|');
                activeDateRange.start = s || '';
                activeDateRange.end = e || '';
                $('#acquired-range-start').val(activeDateRange.start);
                $('#acquired-range-end').val(activeDateRange.end);
              } else if (k === 'original_range') {
                const [mn,mx] = String(v).split('|');
                activeNumericRange.field = 'original';
                activeNumericRange.min = mn || '';
                activeNumericRange.max = mx || '';
              } else if (k === 'current_range') {
                const [mn,mx] = String(v).split('|');
                activeNumericRange.field = 'current';
                activeNumericRange.min = mn || '';
                activeNumericRange.max = mx || '';
              } else {
                // generic column-filter inputs
                const $el = $(`.column-filter[data-column="${k}"]`);
                if ($el.length) $el.val(v);
              }
            });
          }

          // Apply table search and options if provided
          if (state.searchText) {
            const $searchInput = $('.fixed-table-toolbar .search input');
            if ($searchInput.length) $searchInput.val(state.searchText);
            $('#catalog-table').bootstrapTable('refreshOptions', { searchText: state.searchText });
          }
          const refreshOpts = {};
          if (state.sortName) refreshOpts.sortName = state.sortName;
          if (state.sortOrder) refreshOpts.sortOrder = state.sortOrder;
          if (state.pageSize) refreshOpts.pageSize = state.pageSize;
          if (Object.keys(refreshOpts).length) $('#catalog-table').bootstrapTable('refreshOptions', refreshOpts);

          // small timeout then set pageNumber
          setTimeout(() => {
            const pg = parseInt(state.pageNumber || 1, 10);
            if (pg && !isNaN(pg)) {
              try { $('#catalog-table').bootstrapTable('selectPage', pg); } catch (ex) { /* ignore */ }
            }
            // After page set, apply filtered data to table
            $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
            updateClearButtonVisibility();
          }, 150);
        }
      } else {
        // no state: just show all
        $('#catalog-table').bootstrapTable('load', rawData);
        updateClearButtonVisibility();
      }
    } catch (ex) {
      console.warn('Error applying saved table state:', ex);
      $('#catalog-table').bootstrapTable('load', rawData);
      updateClearButtonVisibility();
    }

    // Expose helpers
    window.getTableState = getTableState;
  });
});

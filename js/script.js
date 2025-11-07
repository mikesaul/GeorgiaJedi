/**
 * script.js — final, modal-based date-range (SD-B) + year presets from data
 * - Custom Range modal slides down subtly (SD-B)
 * - Acquired dropdown populated from actual years in JSON (descending)
 * - Options: All, Blank only, Custom Range..., <years...>
 * - CR1: dropdown stays on Custom Range... after Apply
 * - Other filters unchanged (text filters, numeric operator support)
 */

let rawData = [];

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

// ---------------- Formatters & Exported Helpers ----------------
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

function getItemType() {
  const page = window.location.pathname.split('/').pop();
  return page.split('.').shift();
}

function getTableState() {
  const opt = $('#catalog-table').bootstrapTable('getOptions') || {};
  const state = {
    pageNumber: opt.pageNumber || 1,
    pageSize: opt.pageSize || 5,
    sortName: opt.sortName || '',
    sortOrder: opt.sortOrder || '',
    searchText: opt.searchText ?? ''
  };

  const filters = {};
  $('.column-filter').each(function() {
    const k = $(this).data('column');
    const v = $(this).val();
    if (v !== undefined && v !== null && String(v) !== '') filters[k] = v;
  });

  const ac = $('#acquired-select').val();
  if (ac) filters['acquired'] = ac;
  if (ac === '__range__') {
    const rs = $('#acquired-range-start').val();
    const re = $('#acquired-range-end').val();
    if (rs || re) filters['acquired_range'] = (rs || '') + '|' + (re || '');
  }

  state.filters = filters;
  return state;
}

// imageFormatter with state param
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

// ---------------- Filters ----------------
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

// applyCustomFilters supports acquired select values:
// '' -> no date filter; '__blank__' -> blank only; 'year:YYYY' -> that year;
// '__range__' -> use modal start/end if present (if both empty then no date filter)
function applyCustomFilters(data) {
  const acVal = $('#acquired-select').val();
  const startStr = $('#acquired-range-start').val();
  const endStr = $('#acquired-range-end').val();
  const startDate = startStr ? parseDate(startStr) : null;
  const endDate = endStr ? parseDate(endStr) : null;

  const filters = {};
  $('.column-filter').each(function() {
    const k = $(this).data('column');
    const v = $(this).val();
    if (v !== undefined && v !== null && String(v).trim() !== '') filters[k] = String(v).trim().toLowerCase();
  });

  return data.filter(row => {
    // Acquired handling
    if (acVal === '__blank__') {
      // show only rows with blank/invalid acquired
      if (isValidDate(parseDate(row.acquired))) return false;
    } else if (acVal && acVal.startsWith('year:')) {
      const year = parseInt(acVal.split(':')[1], 10);
      const d = parseDate(row.acquired);
      if (!isValidDate(d) || d.getFullYear() !== year) return false;
    } else if (acVal === '__range__') {
      // If both start and end are empty -> treat as no date filter
      if (!startDate && !endDate) {
        // no filtering
      } else {
        const d = parseDate(row.acquired);
        if (!isValidDate(d)) return false;
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
      }
    }
    // else acVal '' => no date filtering

    // Other filters
    for (const [k, v] of Object.entries(filters)) {
      if (k === 'original_cost' || k === 'current_value') {
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

// ---------------- Filter row injection ----------------
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

function injectFilterRow() {
  const $thead = $('#catalog-table thead');
  const $filterRow = $('<tr class="filter-row"></tr>');

  $thead.find('th').each(function() {
    const field = $(this).data('field');
    const $cell = $('<td></td>');

    if (field === 'acquired') {
      $cell.append(`<select id="acquired-select" class="form-control form-control-sm" data-column="acquired"></select>`);
    } else if (field === 'name/brand') {
      $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="name/brand" placeholder="Search title">');
    } else if (field === 'franchise' || field === 'size/model#' || field === 'source') {
      $cell.append(`<select class="column-filter form-control form-control-sm" data-column="${field}"><option value="">All</option></select>`);
    } else if (field === 'original_cost') {
      $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="original_cost" placeholder="e.g. >= 100">');
    } else if (field === 'current_value') {
      $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="current_value" placeholder="e.g. <= 500">');
    } else if (field === 'is_verified') {
      $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="is_verified" placeholder="yes">');
    }

    $filterRow.append($cell);
  });

  $thead.append($filterRow);

  // events
  $(document).on('change', '#acquired-select', function() {
    const val = $(this).val();
    if (val === '__range__') {
      // open modal (slide-down subtle)
      showDateRangeModal();
    } else {
      hideDateRangeModal();
      $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
    }
  });

  // debounce other filters
  let t;
  $(document).on('input change', '.column-filter', function() {
    clearTimeout(t);
    t = setTimeout(() => $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData)), 200);
  });

  // Custom Range Apply / Cancel handlers (buttons live in the modal)
  $(document).on('click', '#acquired-range-apply', function(e) {
    e.preventDefault();
    // keep dropdown at '__range__' (CR1) — modal remains open until user closes or switches
    $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
    hideDateRangeModal(); // user pressed apply -> hide modal (but dropdown stays __range__). This is a reasonable UX.
  });

  $(document).on('click', '#acquired-range-cancel', function(e) {
    e.preventDefault();
    // If user cancels, reset inputs? We'll leave inputs as-is so user can reopen and continue.
    hideDateRangeModal();
    // Do not change dropdown (keeps CR1 - user still on Custom Range unless they change)
  });

  // initialize flatpickr if available
  if (typeof flatpickr === 'function') {
    flatpickr('#acquired-range-start', { dateFormat: 'Y-m-d' });
    flatpickr('#acquired-range-end',   { dateFormat: 'Y-m-d' });
  }
}

// ---------------- Modal show/hide with SD-B subtle slide ----------------
function showDateRangeModal() {
  const $m = $('#date-range-modal');
  if (!$m.length) return;
  $m.show().removeClass('modal-hidden').addClass('modal-visible');
  // small delay to allow CSS transition
  window.requestAnimationFrame(() => {
    $m.find('.modal-box').css({ transform: 'translateY(0)', opacity: 1 });
  });
}
function hideDateRangeModal() {
  const $m = $('#date-range-modal');
  if (!$m.length) return;
  $m.find('.modal-box').css({ transform: 'translateY(-12px)', opacity: 0 });
  setTimeout(() => { $m.removeClass('modal-visible').addClass('modal-hidden').hide(); }, 220);
}

// ---------------- Init ----------------
$(function() {
  $.getJSON('data/' + getItemType() + '.json', function(jsonData) {
    rawData = jsonData || [];

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

    injectFilterRow();
    populateAcquiredOptions();

    // populate simple dropdowns
    ['franchise', 'size/model#', 'source'].forEach(col => {
      const unique = [...new Set(rawData.map(i => i[col]).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
      const $sel = $(`select.column-filter[data-column="${col}"]`);
      $sel.empty().append('<option value="">All</option>');
      unique.forEach(v => $sel.append(`<option value="${v}">${v}</option>`));
    });

    // ensure modal is initially hidden and modal-box positioned subtle off
    const $m = $('#date-range-modal');
    if ($m.length) {
      $m.hide();
      $m.find('.modal-box').css({ transform: 'translateY(-12px)', opacity: 0, transition: 'transform 220ms ease, opacity 220ms ease' });
    }

    // expose helpers
    window.getTableState = getTableState;
  });
});

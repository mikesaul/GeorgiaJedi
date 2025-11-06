let rawData = [];

// ================= Utility & Formatters =================

function isValidDate(d) { return d instanceof Date && !isNaN(d); }

function parseDate(value) {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
  const parts = value.split('/');
  if (parts.length === 3) return new Date(`${parts[2]}-${parts[0]}-${parts[1]}T00:00:00`);
  return new Date(value);
}

function dateSorter(a, b, order) {
  const A = parseDate(a), B = parseDate(b);
  const aOk = isValidDate(A), bOk = isValidDate(B);
  if (!aOk && !bOk) return 0;
  if (!aOk) return order === 'asc' ? 1 : -1;
  if (!bOk) return order === 'asc' ? -1 : 1;
  return A - B;
}

function dateFormatter(value) {
  const d = parseDate(value);
  return isValidDate(d) ? d.toISOString().split('T')[0] : value || '';
}
window.dateFormatter = dateFormatter;


function currencyFormatter(value) {
  if (!value) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format(parseFloat(value));
}

function originalCostFooter(data) {
  return currencyFormatter(data.reduce((t, r) => t + (parseFloat(r.original_cost) || 0), 0));
}

function currentValueFooter(data) {
  return currencyFormatter(data.reduce((t, r) => t + (parseFloat(r.current_value) || 0), 0));
}

function imageFooterFormatter(data) {
  let count = 0;
  data.forEach(row => {
    if (row.image && String(row.image).toLowerCase() !== '100.png') count++;
  });
  return `${count} images`;
}

function descFormatter(index, row) {
  return row.description ? String(row.description).substr(0, 120) : '';
}

function getItemType() {
  return window.location.pathname.split('/').pop().split('.').shift();
}

// ================= Detail Formatter =================

function detailFormatter(index, row) {
  return `
<div class="card" style="display: flex; border: 1px solid #ddd; padding: 10px;">
  <div style="flex: 1; text-align: center;">
    <img src="images/${row.image || '100'}.jpg" style="width: 500px; border-radius: 5px;">
  </div>
  <div style="flex: 2; padding-left: 20px;">
    ${row.title ? `<h3>${row.title}</h3>` : ''}
    ${row.franchise ? `<p><b>Franchise:</b> ${row.franchise}</p>` : ''}
    ${row.description ? `<p><b>Description:</b> ${row.description}</p>` : ''}
    ${row.size ? `<p><b>Size:</b> ${row.size}</p>` : ''}
    ${row.source ? `<p><b>Source:</b> ${row.source}</p>` : ''}
    ${row.serialnumber ? `<p><b>Serial Number:</b> ${row.serialnumber}</p>` : ''}
    ${row.original_cost ? `<p><b>Original Cost:</b> $${row.original_cost}</p>` : ''}
    ${row.current_value ? `<p><b>Current Value:</b> $${row.current_value}</p>` : ''}
  </div>
</div>`;
}

// ================= State Save (for ImageView return) =================

function b64EncodeUnicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
    (_, p1) => String.fromCharCode('0x' + p1)));
}

function getTableState() {
  const opt = $('#catalog-table').bootstrapTable('getOptions') || {};
  const filters = {};

  $('.column-filter').each(function () {
    const k = $(this).data('column');
    const v = $(this).val();
    if (v) filters[k] = v;
  });

  const start = $('#acquired-start').val();
  const end = $('#acquired-end').val();
  if (start || end) filters['acquired_range'] = (start || '') + '|' + (end || '');

  return {
    pageNumber: opt.pageNumber,
    pageSize: opt.pageSize,
    sortName: opt.sortName,
    sortOrder: opt.sortOrder,
    searchText: opt.searchText,
    filters
  };
}

function imageFormatter(value, row) {
  const type = getItemType();
  let s = '';
  try { s = encodeURIComponent(b64EncodeUnicode(JSON.stringify(getTableState()))); } catch(e){}
  return `
<a href="imageview.html?image=${row.image}&sender=${type}&s=${s}">
  <img height=128 width=128 src="images/thumbs/${row.image}_thumb.jpg">
</a>
<a href="update-item.html?id=${row.id}&itemType=${type}" class="btn btn-sm btn-primary mt-2 admin-only">Edit</a>`;
}

function rowStyle(row, index) {
  return { classes: index % 2 === 0 ? 'bg-ltgray' : 'bg-ltblue' };
}

// ================= Filtering =================

function customNumericFilter(value, filter) {
  if (!filter) return true;
  const m = filter.match(/^(<=|>=|=|<|>)?\s*([\d.]+)$/);
  if (!m) return true;
  const [, op = '=', numStr] = m;
  const num = parseFloat(numStr);
  const val = parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  if (isNaN(val)) return false;
  return ({
    '<': val < num,
    '<=': val <= num,
    '=': val === num,
    '>=': val >= num,
    '>': val > num
  })[op];
}

function dateRangeApplies(date, start, end) {
  if (!start && !end) return true;
  if (!isValidDate(date)) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function applyCustomFilters(data) {
  const start = parseDate($('#acquired-start').val());
  const end = parseDate($('#acquired-end').val());

  const filters = {};
  $('.column-filter').each(function () {
    const k = $(this).data('column');
    const v = $(this).val();
    if (v) filters[k] = v.toLowerCase();
  });

  return data.filter(row => {
    if (!dateRangeApplies(parseDate(row.acquired), start, end)) return false;

    return Object.entries(filters).every(([k, v]) => {
      if (k === 'original_cost' || k === 'current_value') return customNumericFilter(row[k], v);
      return String(row[k] || '').toLowerCase().includes(v);
    });
  });
}

// ================= Filter Row Injection =================

function injectFilterRow() {
  const $thead = $('#catalog-table thead');
  const $filterRow = $('<tr class="filter-row"></tr>');

  $thead.find('th').each(function () {
    const field = $(this).data('field');
    const $cell = $('<td></td>');

    if (field === 'acquired') {
      $cell.append(`
        <div style="display:flex; flex-direction:column; gap:2px;">
          <input id="acquired-start" type="text" class="form-control form-control-sm" placeholder="Start date">
          <input id="acquired-end" type="text" class="form-control form-control-sm" placeholder="End date">
        </div>`);
    } else if (field === 'name/brand') {
      $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="name/brand" placeholder="Search title">');
    } else if (field === 'franchise' || field === 'size/model#' || field === 'source') {
      $cell.append(`<select class="column-filter form-control form-control-sm" data-column="${field}"><option value="">All</option></select>`);
    } else if (field === 'original_cost') {
      $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="original_cost" placeholder=">= 100">');
    } else if (field === 'current_value') {
      $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="current_value" placeholder="<= 500">');
    } else if (field === 'is_verified') {
      $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="is_verified" placeholder="yes">');
    }

    $filterRow.append($cell);
  });

  $thead.append($filterRow);

  flatpickr('#acquired-start', { dateFormat: "Y-m-d" });
  flatpickr('#acquired-end', { dateFormat: "Y-m-d" });
}

// ================= Init =================

$(function () {
  $.getJSON('data/' + getItemType() + '.json', function (jsonData) {
    rawData = jsonData;

    $('#catalog-table').bootstrapTable('destroy').bootstrapTable({
      data: rawData,
      detailView: true,
      detailViewByClick: true,
      detailFormatter,
      cardView: window.innerWidth < 1200,
      pagination: true,
      pageSize: 5,
      sortReset: true,
      showFooter: window.innerWidth >= 1200,
      rowStyle
    });

    injectFilterRow();

    // Populate dropdown filters
    ['franchise', 'size/model#', 'source'].forEach(col => {
      const vals = [...new Set(rawData.map(i => i[col]).filter(Boolean))].sort();
      const $dd = $(`select.column-filter[data-column="${col}"]`);
      $dd.empty().append('<option value="">All</option>');
      vals.forEach(v => $dd.append(`<option value="${v}">${v}</option>`));
    });

    // Live filter
    $(document).on('input change', '.column-filter, #acquired-start, #acquired-end', () => {
      $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
    });
  });
});

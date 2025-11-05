let rawData = [];

// ================= Utility & Formatters =================
function isValidDate(d) { return d instanceof Date && !isNaN(d); }

function parseDate(value) {
  if (!value) return null;
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
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

function detailFormatter(index, row) {
  const html = [];
  html.push('<div class="card" style="display: flex; border: 1px solid #ddd; padding: 10px;">');

  // Left: image
  html.push('<div class="card-left" style="flex: 1; text-align: center;">');
  if (row.image) {
    html.push('<img src="images/' + row.image + '.jpg" style="width: 500px; border-radius: 5px;" alt="Item Image">');
  } else {
    html.push('<img src="images/100.png" style="width: 150px; height: 150px; border-radius: 5px;" alt="No Image">');
  }
  html.push('</div>');

  // Right: details
  html.push('<div class="card-right" style="flex: 2; padding-left: 20px;">');
  if (row.title) html.push('<h3 style="margin-top: 0;">' + row.title + '</h3>');
  if (row.franchise) html.push('<p><b>Franchise:</b> ' + row.franchise + '</p>');
  if (row.description) html.push('<p><b>Description:</b> ' + row.description + '</p>');
  if (row.size) html.push('<p><b>Size:</b> ' + row.size + '</p>');
  if (row.source) html.push('<p><b>Source:</b> ' + row.source + '</p>');
  if (row.serialnumber) html.push('<p><b>Serial Number:</b> ' + row.serialnumber + '</p>');
  if (row.original_cost) html.push('<p><b>Original Cost:</b> $' + row.original_cost + '</p>');
  if (row.current_value) html.push('<p><b>Current Value:</b> $' + row.current_value + '</p>');
  html.push('</div></div>');
  return html.join('');
}

function currencyFormatter(value) {
  if (value === undefined || value === null || value === '') return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

function originalCostFooter(data) {
  let total = 0;
  data.forEach(r => total += parseFloat(r.original_cost) || 0);
  return currencyFormatter(total);
}

function currentValueFooter(data) {
  let total = 0;
  data.forEach(r => total += parseFloat(r.current_value) || 0);
  return currencyFormatter(total);
}

function imageFooterFormatter(data) {
  let count = 0;
  data.forEach(row => {
    if (row.image) {
      const filename = String(row.image).split('/').pop().toLowerCase();
      if (filename !== '100.png') count++;
    }
  });
  return `${count} images`;
}

function descFormatter(index, row) {
  return row.description ? String(row.description).substr(0, 120) : '';
}

function getItemType() {
  const page = window.location.pathname.split('/').pop();
  return page.split('.').shift();
}

// ====== Compact base64 helpers ======
function b64EncodeUnicode(str) {
  // encodeURIComponent -> percent-encoded UTF-8, convert percent encodings to raw bytes, btoa() to base64
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
    return String.fromCharCode('0x' + p1);
  }));
}
function b64DecodeUnicode(str) {
  // atob -> binary string of raw bytes, convert each char code to %xx, decodeURIComponent to decode UTF-8
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(str), function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch (e) {
    // fallback: return atob result if decode fails
    try { return atob(str); } catch (ex) { return null; }
  }
}

// New: gather table state (page, pageSize, sort, search, custom filters)
function getTableState() {
  const options = $('#catalog-table').bootstrapTable('getOptions') || {};
  const state = {
    pageNumber: options.pageNumber || 1,
    pageSize: options.pageSize || 5,
    sortName: options.sortName || '',
    sortOrder: options.sortOrder || '',
    searchText: (options.searchText !== undefined) ? options.searchText : ''
  };

  const filters = {};
  $('.column-filter').each(function () {
    const key = $(this).data('column');
    const val = $(this).val();
    if (val !== undefined && val !== null && String(val) !== '') filters[key] = val;
  });
  state.filters = filters;
  return state;
}

// Modified imageFormatter to include compact base64 state param 's' and drop pg/index
// Sender detection now uses getItemType() to reliably return 'autographs' or 'collectibles' (etc)
function imageFormatter(value, row) {
  const sender = getItemType();
  const type = getItemType();

  let sParam = '';
  try {
    const state = getTableState();
    const b64 = b64EncodeUnicode(JSON.stringify(state));
    sParam = encodeURIComponent(b64);
  } catch (ex) { console.warn('Could not serialize table state:', ex); }
  const sQuery = sParam ? `&s=${sParam}` : '';

  if (row.image) {
    return `<a href="imageview.html?image=${row.image}&sender=${sender}${sQuery}">
              <img height=128 width=128 src="images/thumbs/${row.image}_thumb.jpg" alt="thumb">
            </a>
            <a href="update-item.html?id=${row.id}&itemType=${type}" class="btn btn-sm btn-primary mt-2 admin-only">Edit</a>`;
  }
  return `<img height=128 src="images/100.png" alt="no image">
          <a href="update-item.html?id=${row.id}&itemType=${type}" class="btn btn-sm btn-primary mt-2 admin-only">Edit</a>`;
}

function rowStyle(row, index) {
  return { classes: index % 2 === 0 ? 'bg-ltgray' : 'bg-ltblue' };
}

function customNumericFilter(value, filter) {
  if (!filter) return true;
  const match = String(filter).match(/^(<=|>=|=|<|>)?\s*([\d.]+)$/);
  if (!match) return true;
  const [, operator = '=', numberStr] = match;
  const numericVal = parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  const number = parseFloat(numberStr);
  if (isNaN(numericVal)) return false;

  switch (operator) {
    case '<': return numericVal < number;
    case '<=': return numericVal <= number;
    case '=': return numericVal === number;
    case '>=': return numericVal >= number;
    case '>': return numericVal > number;
    default: return numericVal === number;
  }
}

function customDateFilter(value, filter) {
  if (!filter) return true; // no filter applied → include all
  const match = String(filter).match(/^(<=|>=|=|<|>)?\s*([\d/-]+)$/);
  if (!match) return true;
  const [, operator = '=', dateStr] = match;
  const filterDate = parseDate(dateStr);
  const rowDate = parseDate(value);

  // ✅ exclude rows missing or invalid dates when filter is active
  if (!isValidDate(filterDate) || !isValidDate(rowDate)) return false;

  switch (operator) {
    case '<': return rowDate < filterDate;
    case '<=': return rowDate <= filterDate;
    case '=': return rowDate.toDateString() === filterDate.toDateString();
    case '>=': return rowDate >= filterDate;
    case '>': return rowDate > filterDate;
    default: return rowDate.toDateString() === filterDate.toDateString();
  }
}

function applyCustomFilters(data) {
  const filters = {};
  $('.column-filter').each(function () {
    const key = $(this).data('column');
    const val = $(this).val();
    if (val) filters[key] = val;
  });
  return data.filter(row => {
    return Object.entries(filters).every(([key, val]) => {
      if (key === 'acquired') return customDateFilter(row[key], val);
      if (key === 'original_cost' || key === 'current_value') return customNumericFilter(row[key], val);
      if (key === 'name/brand' || key === 'is_verified') {
        return String(row[key] || '').toLowerCase().includes(String(val).toLowerCase());
      }
      return val === '' || String(row[key] || '').toLowerCase() === String(val).toLowerCase();
    });
  });
}

function injectFilterRow() {
  const $thead = $('#catalog-table thead');
  const $filterRow = $('<tr class="filter-row"></tr>');

  $thead.find('th').each(function () {
    const field = $(this).data('field');
    const $cell = $('<td></td>');

    if (field === 'acquired') {
      $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="acquired" placeholder=">= 2023-01-01">');
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
}

// ================= Init =================
$(function () {
  $.getJSON('data/' + getItemType() + '.json', function (jsonData) {
    rawData = jsonData;

    $('#catalog-table').bootstrapTable('destroy').bootstrapTable({
      data: rawData,
      detailView: true,
      detailViewByClick: true,
      detailFormatter: detailFormatter,
      cardView: window.innerWidth < 1200,
      pagination: true,
      pageList: [5, 10, 25, 50, 100],
      pageSize: 5,
      sidePagination: 'client',
      showFooter: window.innerWidth >= 1200,
      onPostBody: function () {
        if (typeof updateAdminVisibility === 'function') updateAdminVisibility();
      }
    });

    injectFilterRow();

    const dropdowns = ['franchise', 'size/model#', 'source'];
    dropdowns.forEach(col => {
      const uniqueValues = [...new Set(rawData.map(item => item[col]).filter(Boolean))];
      uniqueValues.sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
      const $dropdown = $(`select.column-filter[data-column="${col}"]`);
      $dropdown.empty().append('<option value="">All</option>');
      uniqueValues.forEach(val => $dropdown.append(`<option value="${val}">${val}</option>`));
    });

    // Filter inputs debounce
    let filterTimeout;
    $(document).on('input change', '.column-filter', function () {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(() => {
        const filtered = applyCustomFilters(rawData);
        $('#catalog-table').bootstrapTable('load', filtered);
      }, 250);
    });
  });
});

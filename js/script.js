// script.js (compact base64 state-preservation for image view; pg/index removed)
// Sender detection now uses getItemType() for robust page name detection.

let rawData = [];

// ================= Utility & Formatters =================
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
  html.push('</div>');

  html.push('</div>');
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

function isValidDate(d) { return d instanceof Date && !isNaN(d); }

function dateSorter(a, b, order) {
  const A = new Date(a); const B = new Date(b);
  const aOk = isValidDate(A), bOk = isValidDate(B);
  if (!aOk && !bOk) return 0;
  if (!aOk) return order === 'asc' ? 1 : -1;
  if (!bOk) return order === 'asc' ? -1 : 1;
  return A - B;
}

function descFormatter(index, row) {
  return row.description ? String(row.description).substr(0, 120) : '';
}

function getItemType() {
  const page = window.location.pathname.split('/').pop();
  return page.split('.').shift();
}

// ====== Compact base64 helpers (UTF-8 safe) ======
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
    pageSize: options.pageSize || options.pageSize || 5,
    sortName: options.sortName || '',
    sortOrder: options.sortOrder || '',
    searchText: (options.searchText !== undefined) ? options.searchText : ''
  };

  const filters = {};
  $('.column-filter').each(function () {
    const key = $(this).data('column');
    const val = $(this).val();
    if (val !== undefined && val !== null && String(val) !== '') {
      filters[key] = val;
    }
  });
  state.filters = filters;
  return state;
}

// Modified imageFormatter to include compact base64 state param 's' and drop pg/index
// Sender detection now uses getItemType() to reliably return 'autographs' or 'collectibles' (etc)
function imageFormatter(value, row, index) {
  const sender = getItemType(); // more robust than substring-matching the pathname
  const type = getItemType();

  let sParam = '';
  try {
    const state = getTableState();
    const json = JSON.stringify(state);
    const b64 = b64EncodeUnicode(json);
    sParam = encodeURIComponent(b64); // safe for URL
  } catch (ex) {
    console.warn('Could not serialize table state:', ex);
  }

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

function alphanumericCaseInsensitiveSort(a, b) {
  const regex = /^(\\d+)(.*)/i;
  const A = String(a ?? '');
  const B = String(b ?? '');
  const mA = A.match(regex), mB = B.match(regex);
  if (mA && mB) {
    const nA = parseInt(mA[1], 10), nB = parseInt(mB[1], 10);
    if (nA !== nB) return nA - nB;
    return mA[2].toLowerCase().localeCompare(mB[2].toLowerCase());
  }
  return A.toLowerCase().localeCompare(B.toLowerCase());
}

// ================= Filtering =================
function customNumericFilter(value, filter) {
  if (!filter) return true;
  const match = String(filter).match(/^(<=|>=|=|<|>)?\s*([\d.]+)$/);
  if (!match) return true;
  const [, operator = '=', numberStr] = match;
  const number = parseFloat(numberStr);

  // Normalize value: remove $ , GBP etc
  const numericVal = parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
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
  if (!filter || !value) return true;
  const match = String(filter).match(/^(<=|>=|=|<|>)?\\s*([\\d/-]+)$/);
  if (!match) return true;
  const [, operator = '=', dateStr] = match;
  const filterDate = new Date(dateStr);
  const rowDate = new Date(value);
  if (isNaN(filterDate) || isNaN(rowDate)) return true;
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

function populateDropdownFilter(column, selector) {
  const uniqueValues = [...new Set(rawData.map(item => item[column]).filter(Boolean))];
  uniqueValues.sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
  const $dropdown = $(`select.column-filter[data-column="${selector}"]`);
  $dropdown.empty().append('<option value="">All</option>');
  uniqueValues.forEach(val => $dropdown.append(`<option value="${val}">${val}</option>`));
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

// Compute totals for mobile footer
function computeTotals(data) {
  let images = 0, orig = 0, curr = 0;
  data.forEach(r => {
    if (r.image) {
      const filename = String(r.image).split('/').pop().toLowerCase();
      if (filename !== '100.png') images++;
    }
    orig += parseFloat(r.original_cost) || 0;
    curr += parseFloat(r.current_value) || 0;
  });
  return { images, orig, curr };
}

function isMobileView() { return window.innerWidth < 1200; }

// ================= Init =================
$(function () {
  $.getJSON('data/' + getItemType() + '.json', function (jsonData) {
    rawData = jsonData;

    $('#catalog-table').bootstrapTable('destroy').bootstrapTable({
      data: rawData,
      detailView: true,
      detailViewByClick: true,
      detailFormatter: detailFormatter,
      cardView: isMobileView(),
      pagination: true,
      pageList: [5, 10, 25, 50, 100],
      pageSize: 5,
      sidePagination: 'client',
      showFooter: !isMobileView(),
      onPostBody: function () {
        const data = $('#catalog-table').bootstrapTable('getData');
        if (isMobileView()) {
          const totals = computeTotals(data);
          $('#custom-footer').html(`
            <div style="border-top: 1px solid #ccc; padding-top: 10px;">
              <strong>Total Original Cost:</strong> ${currencyFormatter(totals.orig)}<br>
              <strong>Total Current Value:</strong> ${currencyFormatter(totals.curr)}<br>
              <strong>Total Images:</strong> ${totals.images}
            </div>`);
        } else {
          $('#custom-footer').empty();
        }
        if (typeof updateAdminVisibility === 'function') {
          updateAdminVisibility();
        }
      }
    });

    // Inject filter row and populate dropdowns
    injectFilterRow();
    populateDropdownFilter('franchise', 'franchise');
    populateDropdownFilter('size/model#', 'size/model#');
    populateDropdownFilter('source', 'source');

    // If a compact state 's' is provided in the URL, decode and apply it now
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sRaw = urlParams.get('s');
      if (sRaw) {
        const decoded = b64DecodeUnicode(decodeURIComponent(sRaw));
        if (decoded) {
          const state = JSON.parse(decoded);

          // Apply filters first (these operate on client-side data via the column-filter inputs)
          if (state.filters) {
            Object.entries(state.filters).forEach(([key, val]) => {
              // set the filter input/select
              const $el = $(`.column-filter[data-column="${key}"]`);
              if ($el.length) {
                $el.val(val);
              }
            });
            // Trigger input change which will apply custom filtering
            $('.column-filter').trigger('change');
          }

          // Apply search text (bootstrap-table option)
          if (state.searchText) {
            const $searchInput = $('.fixed-table-toolbar .search input');
            if ($searchInput.length) $searchInput.val(state.searchText);
            $('#catalog-table').bootstrapTable('refreshOptions', { searchText: state.searchText });
          }

          // Apply sorting and page size via refreshOptions
          const refreshOpts = {};
          if (state.sortName) refreshOpts.sortName = state.sortName;
          if (state.sortOrder) refreshOpts.sortOrder = state.sortOrder;
          if (state.pageSize) refreshOpts.pageSize = state.pageSize;
          if (Object.keys(refreshOpts).length) {
            $('#catalog-table').bootstrapTable('refreshOptions', refreshOpts);
          }

          // Ensure page selection happens after the table has rendered (small timeout)
          setTimeout(() => {
            const pg = parseInt(state.pageNumber || 1, 10);
            if (pg && !isNaN(pg)) {
              try {
                $('#catalog-table').bootstrapTable('selectPage', pg);
              } catch (ex) {
                // fallback: do nothing
              }
            }
          }, 150);
        }
      }
    } catch (ex) {
      console.warn('Error applying saved table state:', ex);
    }
  });

  // React to filter changes
  $(document).on('input change', '.column-filter', function () {
    const filtered = applyCustomFilters(rawData);
    $('#catalog-table').bootstrapTable('load', filtered);
  });

  // Re-render on resize to switch card/table mode
  $(window).on('resize', function () {
    const options = $('#catalog-table').bootstrapTable('getOptions');
    const shouldCard = isMobileView();
    if (options.cardView !== shouldCard) {
      const data = $('#catalog-table').bootstrapTable('getData');
      $('#catalog-table').bootstrapTable('destroy').bootstrapTable({
        ...options,
        data,
        cardView: shouldCard,
        showFooter: !shouldCard
      });
    }
  });
});
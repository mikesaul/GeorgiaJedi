/**
 * script.js — final integrated version (ready to paste)
 *
 * Features:
 * - Date filter dropdown auto-populated from data (All, Blank only, Custom Range..., Years...)
 * - Date Custom Range shown as SD-B modal (subtle slide)
 * - Numeric filters as dropdown presets + "Custom Range..." which opens a modal (Option B)
 *   Presets: All, Blank only, Under $25, Under $100, Over $500, Over $1k, Custom Range...
 * - "Clear All" button in first header cell (fixed width 100px), auto-show/hide when any filter active
 * - State persistence encoded in image links (getTableState includes acquired & numeric filter state)
 * - Footer formatters, rowStyle, detailFormatter, etc. exposed to window for bootstrap-table
 * - Robust parsing for dates and numeric strings
 *
 * Notes:
 * - This file expects certain DOM IDs added to the HTML:
 *   - A date modal container: #date-range-modal with inputs #date-range-start and #date-range-end
 *   - Two numeric-range modals: #numeric-range-modal-original and #numeric-range-modal-current
 *     each containing inputs #orig-range-min, #orig-range-max, #orig-range-blank,
 *     and #curr-range-min, #curr-range-max, #curr-range-blank respectively, plus apply/cancel buttons.
 *   - The filter injection logic will create select elements with IDs:
 *       #acquired-select, #original-select, #current-select
 *   - The Clear All button will be injected with ID #clear-filters (100px width).
 *
 * If your HTML differs slightly, adapt the IDs or let me know and I'll match it.
 */

/* =========================
   Globals & Utilities
   ========================= */
   let rawData = []; // loaded dataset

   function isValidDate(d) { return d instanceof Date && !isNaN(d); }
   
   function parseDate(value) {
     if (value === undefined || value === null) return null;
     const s = String(value).trim();
     if (!s) return null;
     // ISO yyyy-mm-dd
     const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
     if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
     // US mm/dd/yyyy
     const parts = s.split('/');
     if (parts.length === 3) {
       // allow mm/dd/yyyy
       return new Date(`${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}T00:00:00`);
     }
     const d = new Date(s);
     return isValidDate(d) ? d : null;
   }
   
   function toNumber(value) {
     if (value === undefined || value === null || value === '') return NaN;
     const n = parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
     return isNaN(n) ? NaN : n;
   }
   
   function b64EncodeUnicode(str) {
     try {
       return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(_, p1) {
         return String.fromCharCode('0x' + p1);
       }));
     } catch (e) {
       return '';
     }
   }
   
   /* =========================
      Formatters / Expose to window
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
   
   /* =========================
      Image Formatter (with state)
      ========================= */
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
   
     // column-filter inputs
     const filters = {};
     $('.column-filter').each(function () {
       const k = $(this).data('column');
       const v = $(this).val();
       if (v !== undefined && v !== null && String(v) !== '') filters[k] = v;
     });
   
     // acquired select & modal values
     const ac = $('#acquired-select').val();
     if (ac) filters['acquired'] = ac;
     if (ac === '__range__') {
       const rs = $('#date-range-start').val() || '';
       const re = $('#date-range-end').val() || '';
       if (rs || re) filters['acquired_range'] = `${rs}|${re}`;
     }
   
     // numeric selects & modal values
     const origSel = $('#original-select').val();
     if (origSel) filters['original_select'] = origSel;
     if (origSel === '__custom__') {
       const rs = $('#orig-range-min').val() || '';
       const re = $('#orig-range-max').val() || '';
       const rb = $('#orig-range-blank').is(':checked') ? '1' : '0';
       filters['original_range'] = `${rs}|${re}|${rb}`;
     }
   
     const currSel = $('#current-select').val();
     if (currSel) filters['current_select'] = currSel;
     if (currSel === '__custom__') {
       const rs = $('#curr-range-min').val() || '';
       const re = $('#curr-range-max').val() || '';
       const rb = $('#curr-range-blank').is(':checked') ? '1' : '0';
       filters['current_range'] = `${rs}|${re}|${rb}`;
     }
   
     state.filters = filters;
     return state;
   }
   
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
   
   /* =========================
      Filtering Helpers
      ========================= */
   
   // numeric operator parser (<=, >=, <, >, =)
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
   
   // evaluate a custom min/max pair for numeric dropdown/modal usage
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
   
   /* =========================
      applyCustomFilters — core filter function
      ========================= */
   function applyCustomFilters(data) {
     // date
     const acVal = $('#acquired-select').val() || '';
     const startDateStr = $('#date-range-start').val() || '';
     const endDateStr = $('#date-range-end').val() || '';
     const startDate = startDateStr ? parseDate(startDateStr) : null;
     const endDate = endDateStr ? parseDate(endDateStr) : null;
   
     // numeric selects & modal inputs
     const origSel = $('#original-select').val() || '';
     const currSel = $('#current-select').val() || '';
   
     const origCustomMin = $('#orig-range-min').val() || '';
     const origCustomMax = $('#orig-range-max').val() || '';
     const origCustomBlank = $('#orig-range-blank').is(':checked');
   
     const currCustomMin = $('#curr-range-min').val() || '';
     const currCustomMax = $('#curr-range-max').val() || '';
     const currCustomBlank = $('#curr-range-blank').is(':checked');
   
     // collect simple text column filters
     const textFilters = {};
     $('.column-filter').each(function () {
       const k = $(this).data('column');
       const v = $(this).val();
       if (v !== undefined && v !== null && String(v).trim() !== '') textFilters[k] = String(v).trim().toLowerCase();
     });
   
     return data.filter(row => {
       // --- Acquired date handling ---
       if (acVal === '__blank__') {
         if (isValidDate(parseDate(row.acquired))) return false;
       } else if (acVal && acVal.startsWith('year:')) {
         const y = parseInt(acVal.split(':')[1], 10);
         const d = parseDate(row.acquired);
         if (!isValidDate(d) || d.getFullYear() !== y) return false;
       } else if (acVal === '__range__') {
         // if neither boundary provided => no date filtering
         if (startDate || endDate) {
           const d = parseDate(row.acquired);
           if (!isValidDate(d)) return false;
           if (startDate && d < startDate) return false;
           if (endDate && d > endDate) return false;
         }
       }
       // else '' => no date filter
   
       // --- Original cost numeric dropdown/presets/modal ---
       if (origSel === '__blank__') {
         if (!isNaN(toNumber(row.original_cost))) return false;
       } else if (/^preset:/.test(origSel)) {
         // presets encoded as preset:under:25 or preset:over:500 etc
         const parts = origSel.split(':');
         if (parts[1] === 'under') {
           const mx = parts[2] ? parseFloat(parts[2]) : NaN;
           if (!isNaN(mx)) {
             const v = toNumber(row.original_cost);
             if (isNaN(v) || v > mx) return false;
           }
         } else if (parts[1] === 'over') {
           const mn = parts[2] ? parseFloat(parts[2]) : NaN;
           if (!isNaN(mn)) {
             const v = toNumber(row.original_cost);
             if (isNaN(v) || v <= mn) return false;
           }
         }
       } else if (origSel === '__custom__') {
         if (!evaluateMinMaxPair(row.original_cost, origCustomMin, origCustomMax, origCustomBlank)) return false;
       }
   
       // --- Current value numeric dropdown/presets/modal ---
       if (currSel === '__blank__') {
         if (!isNaN(toNumber(row.current_value))) return false;
       } else if (/^preset:/.test(currSel)) {
         const parts = currSel.split(':');
         if (parts[1] === 'under') {
           const mx = parts[2] ? parseFloat(parts[2]) : NaN;
           if (!isNaN(mx)) {
             const v = toNumber(row.current_value);
             if (isNaN(v) || v > mx) return false;
           }
         } else if (parts[1] === 'over') {
           const mn = parts[2] ? parseFloat(parts[2]) : NaN;
           if (!isNaN(mn)) {
             const v = toNumber(row.current_value);
             if (isNaN(v) || v <= mn) return false;
           }
         }
       } else if (currSel === '__custom__') {
         if (!evaluateMinMaxPair(row.current_value, currCustomMin, currCustomMax, currCustomBlank)) return false;
       }
   
       // --- Other column text filters ---
       for (const [k, v] of Object.entries(textFilters)) {
         if (k === 'original_cost' || k === 'current_value') {
           // legacy: support operator string typed directly into column-filter
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
   
   /* =========================
      Filter row injection & UI + Clear button
      ========================= */
   function populateAcquiredOptions() {
     const years = [...new Set(rawData
       .map(r => parseDate(r.acquired))
       .filter(d => isValidDate(d))
       .map(d => d.getFullYear()))].sort((a, b) => b - a);
     const $sel = $('#acquired-select');
     if (!$sel.length) return;
     let html = '<option value="">All</option>';
     html += '<option value="__blank__">Blank only</option>';
     html += '<option value="__range__">Custom Range…</option>';
     years.forEach(y => html += `<option value="year:${y}">${y}</option>`);
     $sel.html(html);
   }
   
   function buildNumericSelectHtml(id) {
     // id: 'original' or 'current'
     // options: All, Blank only, Under $25, Under $100, Over $500, Over $1k, Custom Range...
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
   
   function injectFilterRow() {
     const $thead = $('#catalog-table thead');
     const $filterRow = $('<tr class="filter-row"></tr>');
   
     $thead.find('th').each(function () {
       const field = $(this).data('field');
       const $cell = $('<td></td>');
   
       if (field === 'image') {
         // Clear All button placed here, fixed width 100px, hidden by default
          $cell.append(`<button id="clear-filters" class="btn btn-sm btn-warning" 
            style="width:100px; min-width:100px; max-width:100px; font-size:0.8em; display:none; 
                  margin: 4px auto 2px auto; display:block;">
            Clear All
          </button>`);
       } else if (field === 'acquired') {
         $cell.append(`<select id="acquired-select" class="form-control form-control-sm" data-column="acquired"></select>`);
       } else if (field === 'name/brand') {
         $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="name/brand" placeholder="Search title">');
       } else if (field === 'franchise' || field === 'size/model#' || field === 'source') {
         $cell.append(`<select class="column-filter form-control form-control-sm" data-column="${field}"><option value="">All</option></select>`);
       } else if (field === 'description') {
         $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="description" placeholder="Search description">');
       } else if (field === 'original_cost') {
         $cell.append(buildNumericSelectHtml('original'));
       } else if (field === 'current_value') {
         $cell.append(buildNumericSelectHtml('current'));
       } else if (field === 'is_verified') {
         $cell.append('<input type="text" class="column-filter form-control form-control-sm" data-column="is_verified" placeholder="yes">');
       }
   
       $filterRow.append($cell);
     });
   
     $thead.append($filterRow);
   
     // populate selects/inputs from data
     populateAcquiredOptions();
     ['franchise', 'size/model#', 'source'].forEach(col => {
       const unique = [...new Set(rawData.map(i => i[col]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
       const $sel = $(`select.column-filter[data-column="${col}"]`);
       $sel.empty().append('<option value="">All</option>');
       unique.forEach(v => $sel.append(`<option value="${v}">${v}</option>`));
     });
   
     // events: acquired
     $(document).on('change', '#acquired-select', function () {
       const val = $(this).val() || '';
       if (val === '__range__') {
         // open date modal (SD-B subtle slide); prefill if values present
         $('#date-range-start').val($('#date-range-start').val() || '');
         $('#date-range-end').val($('#date-range-end').val() || '');
         showDateRangeModal();
         updateClearButtonVisibility();
         return;
       }
       // normal selection -> hide modal if open and apply
       hideDateRangeModal();
       $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
       updateClearButtonVisibility();
     });
   
     // events: numeric selects
     $(document).on('change', '.numeric-select', function () {
       const id = $(this).attr('id'); // e.g. original-select
       const who = id.split('-')[0]; // original or current
       const val = $(this).val() || '';
       if (val === '__custom__') {
         // open numeric modal for appropriate field, prefill from inputs if present
         if (who === 'original') {
           $('#orig-range-min').val($('#orig-range-min').val() || '');
           $('#orig-range-max').val($('#orig-range-max').val() || '');
           $('#orig-range-blank').prop('checked', $('#orig-range-blank').is(':checked'));
           showNumericModal('original');
         } else {
           $('#curr-range-min').val($('#curr-range-min').val() || '');
           $('#curr-range-max').val($('#curr-range-max').val() || '');
           $('#curr-range-blank').prop('checked', $('#curr-range-blank').is(':checked'));
           showNumericModal('current');
         }
         updateClearButtonVisibility();
         return;
       }
       // other preset/blank/all -> apply filters
       $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
       updateClearButtonVisibility();
     });
   
     // column-filter inputs debounce
     let debounceT;
     $(document).on('input change', '.column-filter', function () {
       clearTimeout(debounceT);
       debounceT = setTimeout(() => {
         $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
         updateClearButtonVisibility();
       }, 200);
     });
   
     // numeric modal apply/cancel handlers
     $(document).on('click', '#orig-range-apply', function (e) {
       e.preventDefault();
       hideNumericModal('original');
       $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
       updateClearButtonVisibility();
     });
     $(document).on('click', '#orig-range-cancel', function (e) {
       e.preventDefault();
       hideNumericModal('original');
       // keep select on __custom__ (CR1)
       updateClearButtonVisibility();
     });
   
     $(document).on('click', '#curr-range-apply', function (e) {
       e.preventDefault();
       hideNumericModal('current');
       $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
       updateClearButtonVisibility();
     });
     $(document).on('click', '#curr-range-cancel', function (e) {
       e.preventDefault();
       hideNumericModal('current');
       updateClearButtonVisibility();
     });
   
     // date modal handlers
     $(document).on('click', '#date-range-apply', function (e) {
       e.preventDefault();
       hideDateRangeModal();
       $('#catalog-table').bootstrapTable('load', applyCustomFilters(rawData));
       updateClearButtonVisibility();
     });
     $(document).on('click', '#date-range-cancel', function (e) {
       e.preventDefault();
       hideDateRangeModal();
       updateClearButtonVisibility();
     });
   
     // Clear All button
     $(document).on('click', '#clear-filters', function (e) {
       e.preventDefault();
       // clear text filters
       $('.column-filter').val('');
       // reset selects
       $('#acquired-select').val('');
       $('.numeric-select').val('');
       // clear modal inputs
       $('#date-range-start, #date-range-end').val('');
       $('#orig-range-min, #orig-range-max').val('');
       $('#curr-range-min, #curr-range-max').val('');
       $('#orig-range-blank, #curr-range-blank').prop('checked', false);
       // hide modals if open
       hideDateRangeModal();
       hideNumericModal('original');
       hideNumericModal('current');
       // reload data
       $('#catalog-table').bootstrapTable('load', rawData);
       updateClearButtonVisibility();
     });
   
     // ensure Clear button visibility initial
     updateClearButtonVisibility();
   }
   
   /* =========================
      Modal show/hide helpers
      - date modal: #date-range-modal, .modal-box inside
      - numeric modals:
          #numeric-range-modal-original (or #numeric-range-modal-current)
          inside it: inputs #orig-range-min, #orig-range-max, #orig-range-blank, etc.
      ========================= */
   
   function showDateRangeModal() {
     const $m = $('#date-range-modal');
     if (!$m.length) return;
     $m.show();
     // SD-B subtle slide: modal-box already positioned with CSS translateY(-12px)
     $m.find('.modal-box').css({ transform: 'translateY(0)', opacity: 1 });
   }
   
   function hideDateRangeModal() {
     const $m = $('#date-range-modal');
     if (!$m.length) return;
     $m.find('.modal-box').css({ transform: 'translateY(-12px)', opacity: 0 });
     setTimeout(() => $m.hide(), 220);
   }
   
   function showNumericModal(which) {
     // which: 'original' or 'current'
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
   
   /* =========================
      Clear button visibility helper
      ========================= */
   function anyFilterActive() {
     // column text filters
     const hasColumnFilters = $('.column-filter').filter(function () {
       return $(this).val() && String($(this).val()).trim() !== '';
     }).length > 0;
   
     // acquired select
     const ac = $('#acquired-select').val();
     const hasAc = ac && ac !== '';
   
     // numeric selects
     const origSel = $('#original-select').val();
     const currSel = $('#current-select').val();
     const hasNumericSelect = (origSel && origSel !== '') || (currSel && currSel !== '');
   
     // numeric modal values
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
      Initialization
      ========================= */
   $(function () {
     $.getJSON('data/' + getItemType() + '.json', function (jsonData) {
       rawData = jsonData || [];
   
       // init table
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
         rowStyle: rowStyle
       });
   
       // inject filter row & populate dynamic selects
       injectFilterRow();
   
       // prepare modals: hide & set initial transform
       const $dateModal = $('#date-range-modal');
       if ($dateModal.length) {
         $dateModal.hide();
         $dateModal.find('.modal-box').css({ transform: 'translateY(-12px)', opacity: 0, transition: 'transform 220ms ease, opacity 220ms ease' });
       }
   
       ['#numeric-range-modal-original', '#numeric-range-modal-current'].forEach(sel => {
         const $m = $(sel);
         if ($m.length) {
           $m.hide();
           $m.find('.modal-box').css({ transform: 'translateY(-12px)', opacity: 0, transition: 'transform 220ms ease, opacity 220ms ease' });
         }
       });
   
       // expose helpers
       window.getTableState = getTableState;
       window.applyCustomFilters = applyCustomFilters;
   
       // ensure clear button visibility updated when table loads initially
       updateClearButtonVisibility();
     });
   });
   
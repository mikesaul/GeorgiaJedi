/**
 * script.js — Complete updated version for autographs.html
 *
 * Revisions:
 * - Robust image path normalization (accepts base id, full path, or filename with extension)
 * - Cache key uses basename (no path, no extension)
 * - getWatermarkedDataUrl handles thumb/full modes safely
 * - imageFormatter no longer double-encodes the `s` table-state param (preserves state when returning)
 * - Font-face loader tries absolute and relative font URLs
 *
 * Replace your existing /js/script.js with this file.
 */

(function () {
  'use strict';

  /* =========================
     Globals & Configuration
     ========================= */
  const DEFAULT_PAGE_SIZE = 10;
  let rawData = [];
  let currentFiltered = [];
  let exportMode = 'all'; // 'all' | 'filtered' | 'page' | 'selected'

  // Watermark cache (in-memory, page lifetime)
  // Map key: `${imageKey}:${mode}` where imageKey is basename (no path, no ext)
  const WATERMARK_CACHE = new Map();

  // Font load cache/promise
  const FONT_NAME = 'SFDistantGalaxy';
  const FONT_URL_RAW = 'css/fonts/SF Distant Galaxy AltOutline.ttf';
  const FONT_URL_CANDIDATES = [
    '/' + FONT_URL_RAW,        // absolute path (root)
    FONT_URL_RAW               // relative path
  ].map(u => encodeURI(u));
  let FONT_LOAD_PROMISE = null;

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
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
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

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      const ctx = this;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn.apply(ctx, args);
      }, delay);
    };
  }

  function csvEscape(val) {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (/[",\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* =========================
     Font Loading
     ========================= */
  function ensureFontLoaded() {
    if (FONT_LOAD_PROMISE) return FONT_LOAD_PROMISE;

    // Try multiple candidate URLs to reduce chance of 404
    if (window.FontFace) {
      // attempt candidate URLs one-by-one until one succeeds
      const tryLoad = (idx) => {
        if (idx >= FONT_URL_CANDIDATES.length) {
          return Promise.resolve(true); // fallback
        }
        const url = FONT_URL_CANDIDATES[idx];
        try {
          const ff = new FontFace(FONT_NAME, `url("${url}")`, { style: 'normal', weight: '400' });
          return ff.load().then(loadedFace => {
            try { document.fonts.add(loadedFace); } catch (e) {}
            return document.fonts.load(`12px "${FONT_NAME}"`).then(() => true).catch(() => true);
          }).catch(() => {
            // try next candidate
            return tryLoad(idx + 1);
          });
        } catch (e) {
          return tryLoad(idx + 1);
        }
      };
      FONT_LOAD_PROMISE = tryLoad(0).catch(() => true);
    } else {
      if (document.fonts && document.fonts.load) {
        FONT_LOAD_PROMISE = document.fonts.load(`12px "${FONT_NAME}"`).then(() => true).catch(() => true);
      } else {
        FONT_LOAD_PROMISE = Promise.resolve(true);
      }
    }
    return FONT_LOAD_PROMISE;
  }

  /* =========================
     Helpers: image path normalization & cache key
     ========================= */

  // Returns: { imageKey, fullSrc, thumbSrc }
  // imageInput may be:
  //  - base id like "OPIX_AmyAllen_AylaSecura"
  //  - filename like "OPIX_AmyAllen_AylaSecura.jpg"
  //  - relative path like "images/OPIX_...jpg"
  function normalizeImagePaths(imageInput) {
    if (!imageInput) {
      return {
        imageKey: '',
        fullSrc: 'images/100.png',
        thumbSrc: 'images/100.png'
      };
    }

    let input = String(imageInput).trim();

    // If input was provided with URL-encoding, decode it (defensive)
    try { input = decodeURIComponent(input); } catch (e) { /* ignore */ }

    // extract basename (no path, no ext)
    const filename = input.split('/').pop();
    const base = filename.replace(/\.[^/.]+$/, '');

    const imageKey = base;

    // Determine fullSrc:
    // - if input looks like a path or has an extension, use it as fullSrc
    // - else assume images/<base>.jpg
    const hasPathOrExt = input.indexOf('/') !== -1 || /\.[a-zA-Z0-9]{2,4}$/.test(input);
    let fullSrc = '';
    if (hasPathOrExt) {
      fullSrc = input;
    } else {
      fullSrc = `images/${base}.jpg`;
    }

    // Determine thumbSrc:
    // prefer images/thumbs/<base>_thumb.jpg if that matches your structure,
    // otherwise images/thumbs/<base>.jpg or images/<base>_thumb.jpg as fallback
    const thumbCandidates = [
      `images/thumbs/${base}_thumb.jpg`,
      `images/thumbs/${base}.jpg`,
      `images/${base}_thumb.jpg`,
      `images/${base}.jpg`
    ];
    // We can't synchronously check their existence without network requests, but we'll return the first candidate.
    // The watermark rendering will attempt to load the thumb and fall back if it fails.
    const thumbSrc = thumbCandidates[0];

    return { imageKey, fullSrc, thumbSrc };
  }

  /* =========================
     Scheduling helper
     ========================= */
  function scheduleWork(fn) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout: 500 });
    } else {
      setTimeout(fn, 16);
    }
  }

  /* =========================
     Watermark rendering & cache
     ========================= */

  // render watermark onto a canvas and return dataURL
  function renderWatermarkedDataUrl(imageUrl, watermarkText = 'GeorgiaJedi', sizeHints = null, rotation = -0.6, alpha = 0.5, fontSize = null) {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();

        // set crossOrigin only if host differs
        try {
          const u = new URL(imageUrl, window.location.href);
          if (u.origin !== window.location.origin) img.crossOrigin = 'anonymous';
        } catch (e) {
          // if URL parsing fails, don't set crossOrigin
        }

        img.onload = function () {
          ensureFontLoaded().then(() => {
            scheduleWork(() => {
              try {
                const naturalW = img.naturalWidth || img.width || (sizeHints && sizeHints.width) || 800;
                const naturalH = img.naturalHeight || img.height || (sizeHints && sizeHints.height) || Math.round(naturalW * 0.75);

                let w = naturalW;
                let h = naturalH;
                if (sizeHints && sizeHints.width) w = sizeHints.width;
                if (sizeHints && sizeHints.height) h = sizeHints.height;

                const MAX_DIM = 1600;
                if (w > MAX_DIM) {
                  const ratio = MAX_DIM / w;
                  w = Math.round(w * ratio);
                  h = Math.round(h * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');

                ctx.drawImage(img, 0, 0, w, h);

                ctx.save();
                ctx.translate(w / 2, h / 2);
                ctx.rotate(rotation);
                ctx.globalAlpha = alpha;

                const defaultFontPx = fontSize ? fontSize : Math.max(18, Math.round(w / 12));
                ctx.font = `${defaultFontPx}px "${FONT_NAME}", Arial`;
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                const step = Math.max(defaultFontPx * 4, 80);
                const span = Math.max(w, h) * 2;
                for (let x = -span; x <= span; x += step) {
                  for (let y = -span; y <= span; y += step * 1.5) {
                    const dx = x + (((y / step) % 2) ? step / 2 : 0);
                    ctx.fillText(watermarkText, dx, y);
                  }
                }

                ctx.restore();
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve(dataUrl);
              } catch (err) {
                reject(err);
              }
            });
          }).catch(() => {
            // fallback path if font load fails
            scheduleWork(() => {
              try {
                const naturalW = img.naturalWidth || img.width || (sizeHints && sizeHints.width) || 800;
                const naturalH = img.naturalHeight || img.height || (sizeHints && sizeHints.height) || Math.round(naturalW * 0.75);

                let w = naturalW;
                let h = naturalH;
                if (sizeHints && sizeHints.width) w = sizeHints.width;
                if (sizeHints && sizeHints.height) h = sizeHints.height;

                const MAX_DIM = 1600;
                if (w > MAX_DIM) {
                  const ratio = MAX_DIM / w;
                  w = Math.round(w * ratio);
                  h = Math.round(h * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');

                ctx.drawImage(img, 0, 0, w, h);

                ctx.save();
                ctx.translate(w / 2, h / 2);
                ctx.rotate(rotation);
                ctx.globalAlpha = alpha;

                const defaultFontPx = fontSize ? fontSize : Math.max(18, Math.round(w / 12));
                ctx.font = `${defaultFontPx}px Arial`;
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                const step = Math.max(defaultFontPx * 4, 80);
                const span = Math.max(w, h) * 2;
                for (let x = -span; x <= span; x += step) {
                  for (let y = -span; y <= span; y += step * 1.5) {
                    const dx = x + (((y / step) % 2) ? step / 2 : 0);
                    ctx.fillText(watermarkText, dx, y);
                  }
                }

                ctx.restore();
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve(dataUrl);
              } catch (err) {
                reject(err);
              }
            });
          });
        };

        img.onerror = function () {
          reject(new Error('Image failed to load: ' + imageUrl));
        };

        img.src = imageUrl;
      } catch (err) {
        reject(err);
      }
    });
  }

  // getWatermarkedDataUrl accepts either:
  //  - a base id (e.g. "OPIX_AmyAllen_AylaSecura")
  //  - a filename or path (e.g. "OPIX_AmyAllen_AylaSecura.jpg" or "images/OPIX_....jpg")
  // mode: 'thumb'|'full'
  function getWatermarkedDataUrl(imageInput, mode = 'thumb') {
    if (!imageInput) return Promise.resolve(null);

    // Normalize to get imageKey and candidate source URLs
    const { imageKey, fullSrc, thumbSrc } = normalizeImagePaths(imageInput);
    if (!imageKey) return Promise.resolve(null);
    const key = `${imageKey}:${mode}`;

    const existing = WATERMARK_CACHE.get(key);
    if (existing) {
      if (existing.status === 'ready') return Promise.resolve(existing.dataUrl);
      return existing.promise;
    }

    // Decide which source URL to feed the renderer
    const srcUrl = (mode === 'thumb') ? thumbSrc : fullSrc;
    const hints = (mode === 'thumb') ? { width: 256, height: 256 } : null;
    const fontSize = (mode === 'thumb') ? 14 : null;

    // placeholder promise
    let resolveFn, rejectFn;
    const p = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    WATERMARK_CACHE.set(key, { status: 'pending', promise: p, dataUrl: null });

    scheduleWork(() => {
      renderWatermarkedDataUrl(srcUrl, 'GeorgiaJedi', hints, -0.6, 0.5, fontSize)
        .then(dataUrl => {
          if (dataUrl) {
            WATERMARK_CACHE.set(key, { status: 'ready', promise: Promise.resolve(dataUrl), dataUrl });
            resolveFn(dataUrl);
          } else {
            WATERMARK_CACHE.set(key, { status: 'error', promise: Promise.resolve(null), dataUrl: null });
            resolveFn(null);
          }
        })
        .catch(err => {
          console.warn('Watermark render failed:', srcUrl, err);
          WATERMARK_CACHE.set(key, { status: 'error', promise: Promise.resolve(null), dataUrl: null });
          resolveFn(null);
        });
    });

    return p;
  }

  // Expose for debugging
  window._WATERMARK_CACHE = WATERMARK_CACHE;
  window.getWatermarkedDataUrl = getWatermarkedDataUrl;

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

  // detailFormatter optimized to use cached watermarked image when available.
  function detailFormatter(index, row) {
    if (!row) return '';
    if (row.__detail_html) return row.__detail_html;

    const detailImgId = `detail-img-${escapeHtml(String(row.id))}`;

    // Compute normalized paths for the row image
    const { imageKey, fullSrc } = normalizeImagePaths(row.image || '');
    let initialSrc = fullSrc || 'images/100.png';
    const cached = imageKey ? WATERMARK_CACHE.get(`${imageKey}:full`) : null;
    if (cached && cached.status === 'ready' && cached.dataUrl) {
      initialSrc = cached.dataUrl;
    }

    const title = row['name/brand'] || row.title || '';
    const description = row.description || '';
    const serial = row.serialnumber || '';
    const franchise = row.franchise || '';
    const source = row.source || '';
    const orig = currencyFormatter(row.original_cost);
    const curr = currencyFormatter(row.current_value);

    const html = `
      <div class="card" style="display:flex; border:1px solid #ddd; padding:10px;">
        <div style="flex:1; text-align:center;">
          <img id="${detailImgId}" data-original="${escapeHtml(row.image || '')}" src="${initialSrc}" style="max-width:100%; width:420px; border-radius:6px;">
        </div>
        <div style="flex:2; padding-left:20px;">
          <h4>${escapeHtml(title)}</h4>
          ${franchise ? `<p><b>Franchise:</b> ${escapeHtml(franchise)}</p>` : ''}
          ${description ? `<p>${escapeHtml(description)}</p>` : ''}
          ${source ? `<p><b>Source:</b> ${escapeHtml(source)}</p>` : ''}
          ${serial ? `<p><b>Serial#:</b> ${escapeHtml(serial)}</p>` : ''}
          ${orig ? `<p><b>Original Cost:</b> ${escapeHtml(orig)}</p>` : ''}
          ${curr ? `<p><b>Current Value:</b> ${escapeHtml(curr)}</p>` : ''}
        </div>
      </div>
    `;

    try { row.__detail_html = html; } catch (e) {}

    if (row.image && (!cached || cached.status !== 'ready')) {
      row.__needs_detail_update = true;
    } else {
      row.__needs_detail_update = false;
    }

    return html;
  }

  window.detailFormatter = detailFormatter;

  /* =========================
     Image formatter (thumbnails not watermarked)
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

    // IMPORTANT: do NOT double-encode here. Produce raw base64 string.
    let sParam = '';
    try { sParam = b64EncodeUnicode(JSON.stringify(getTableState())); } catch (e) { sParam = ''; }
    const sQuery = sParam ? `&s=${encodeURIComponent(sParam)}` : '';

    // row.image may be a base id or full path - use it directly in the href 'image' param
    // the imageview page's script expects image param to match thumbnails/full names; it will normalize.
    const imgInput = row.image || '';
    const { imageKey, fullSrc, thumbSrc } = normalizeImagePaths(imgInput);
    const thumbSrcResolved = thumbSrc || 'images/100.png';
    const thumbId = `thumb-${escapeHtml(String(row.id))}`;

    const initialSrc = thumbSrcResolved;

    if (imgInput) {
      return `<a href="imageview.html?image=${encodeURIComponent(imgInput)}&sender=${sender}${sQuery}">
                <img id="${thumbId}" class="wj-thumb" height="128" width="128" src="${initialSrc}" alt="thumb">
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
      // acquired date
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
     UI: filter row / modals
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
    const origSel = $('#original-select').val();
    const currSel = $('#current-select').val();
    const hasNumericSelect = (origSel && origSel !== '') || (currSel && currSel !== '');
    const hasNumericModalValues = ($('#orig-range-min').val() && $('#orig-range-min').val().trim() !== '') ||
      ($('#orig-range-max').val() && $('#orig-range-max').val().trim() !== '') ||
      ($('#curr-range-min').val() && $('#curr-range-min').val().trim() !== '') ||
      ($('#curr-range-max').val() && $('#curr-range-max').val().trim() !== '') ||
      $('#orig-range-blank').is(':checked') || $('#curr-range-blank').is(':checked');
    return hasColumnFilters || (ac && ac !== '') || hasNumericSelect || hasNumericModalValues;
  }

  function updateClearButtonVisibility() {
    $('#clear-filters').toggle(anyFilterActive());
  }

  /* =========================
     Exports
     ========================= */

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
      const cleanData = data.map(row => {
        const newRow = { ...row };
        ["OriginalCost", "CurrentValue"].forEach(key => {
          if (newRow[key] != null) {
            const num = parseFloat(newRow[key].toString().replace(/[^0-9.-]+/g,""));
            newRow[key] = isNaN(num) ? 0 : num;
          }
        });
        return newRow;
      });

      const ws = XLSX.utils.json_to_sheet(cleanData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Export");

      const headers = Object.keys(cleanData[0]);
      const origIdx = headers.indexOf("OriginalCost");
      const currIdx = headers.indexOf("CurrentValue");

      if (origIdx !== -1 || currIdx !== -1) {
        const totalRowNum = cleanData.length + 2;
        const totalLabelCell = XLSX.utils.encode_cell({ r: totalRowNum - 1, c: headers.length - 3 });
        ws[totalLabelCell] = { t: "s", v: "Total:" };

        ["OriginalCost", "CurrentValue"].forEach((key) => {
          const idx = key === "OriginalCost" ? origIdx : currIdx;
          if (idx !== -1) {
            const col = XLSX.utils.encode_col(idx);
            const formula = `SUM(${col}2:${col}${cleanData.length + 1})`;
            const cellRef = XLSX.utils.encode_cell({ r: totalRowNum - 1, c: idx });
            ws[cellRef] = { t: "n", f: formula, z: "$#,##0.00" };
          }
        });

        ws["!ref"] = XLSX.utils.encode_range({
          s: { r: 0, c: 0 },
          e: { r: totalRowNum - 1, c: headers.length - 1 }
        });

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

    const headers = Object.keys(data[0] || {});
    const body = data.map(row => headers.map(h => row[h] ?? ''));

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
    } else {
      dataToExport = rawData.slice();
    }

    if (!dataToExport || dataToExport.length === 0) {
      alert('No rows available to export.');
      return;
    }

    const mapped = dataToExport.map(r => {
      const baseImageInput = r.image ? r.image : '';
      const { imageKey, fullSrc } = normalizeImagePaths(baseImageInput);
      const cachedFull = imageKey ? WATERMARK_CACHE.get(`${imageKey}:full`) : null;
      const cachedThumb = imageKey ? WATERMARK_CACHE.get(`${imageKey}:thumb`) : null;
      const imageForExport = (cachedFull && cachedFull.status === 'ready' && cachedFull.dataUrl) ? cachedFull.dataUrl :
                              (cachedThumb && cachedThumb.status === 'ready' && cachedThumb.dataUrl) ? cachedThumb.dataUrl :
                              (fullSrc || '');

      return {
        ID: r.id,
        Acquired: r.acquired,
        Title: r['name/brand'] || r.title || '',
        Franchise: r.franchise || '',
        Description: r.description || '',
        Source: r.source || '',
        OriginalCost: r.original_cost || '',
        CurrentValue: r.current_value || '',
        IsVerified: r.is_verified || '',
        WatermarkedImage: imageForExport
      };
    });

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
      const cols = Object.keys(mapped[0] || {});
      const rowsCsv = [];
      rowsCsv.push(cols.map(c => csvEscape(c)).join(','));
      mapped.forEach(r => {
        const line = cols.map(c => csvEscape(r[c] ?? '')).join(',');
        rowsCsv.push(line);
      });
      const csv = rowsCsv.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename + '.csv';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }, 150);
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

    if (window.jspdf && !window.jsPDF) {
      try { window.jsPDF = window.jspdf.jsPDF; } catch (e) {}
    }
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
        clickToSelect: false,
        idField: 'id',
        detailView: true,
        detailViewByClick: true,
        detailFormatter: detailFormatter,
        rowStyle: rowStyle,
        showFooter: true
      });

      injectFilterRow();

      $('#date-range-modal').hide();
      $('#numeric-range-modal-original').hide();
      $('#numeric-range-modal-current').hide();

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

      function applyFiltersImmediate() {
        const f = applyCustomFilters(rawData);
        $('#catalog-table').bootstrapTable('load', f);
        autoSwitchExportModeIfFilteredActive();
        updateClearButtonVisibility();
      }
      const applyFiltersDebounced = debounce(applyFiltersImmediate, 200);

      $(document).on('input change', '.column-filter', function () {
        applyFiltersDebounced();
      });

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

        exportMode = "all";
        $('#exportModeBtn').text("Export Mode: All Rows");
        $('.export-mode').removeClass('active');
        $('.export-mode[data-mode="all"]').addClass('active');

        updateClearButtonVisibility();
      });

      function autoSwitchExportModeIfFilteredActive() {
        if (exportMode === "all") {
          exportMode = "filtered";
          $('#exportModeBtn').text("Export Mode: Filtered Rows");
          $('.export-mode').removeClass('active');
          $('.export-mode[data-mode="filtered"]').addClass('active');
        }
      }

      $(document).on('click', '.export-mode', function (e) {
        e.preventDefault();
        const mode = $(this).data('mode');
        if (!mode) return;
        exportMode = mode;
        $('.export-mode').removeClass('active');
        $(this).addClass('active');
        const labelMap = { all: "All Rows", filtered: "Filtered Rows", page: "Visible Data", selected: "Selected Rows" };
        $('#exportModeBtn').text("Export Mode: " + labelMap[mode]);
      });

      $(document).on('click', '#export-csv', function () { performExport('csv'); });
      $(document).on('click', '#export-excel', function () { performExport('excel'); });
      $(document).on('click', '#export-json', function () { performExport('json'); });
      $(document).on('click', '#export-pdf', function () { performExport('pdf'); });

      $(document).on('change input', '.column-filter, #acquired-select, .numeric-select, #orig-range-min, #orig-range-max, #curr-range-min, #curr-range-max, #orig-range-blank, #curr-range-blank', function () {
        setTimeout(updateExportModeLabel, 10);
      });

      // updateExportModeLabel helper (keeps UI in sync)
      function updateExportModeLabel() {
        const labelMap = { all: "All Rows", filtered: "Filtered Rows", page: "Visible Data", selected: "Selected Rows" };
        $('#exportModeBtn').text("Export Mode: " + (labelMap[exportMode] || "All Rows"));
      }

      // post-body: update detail imgs to cached watermarked images when ready
      $('#catalog-table').on('post-body.bs.table', function () {
        $('.bootstrap-table .detail-view .card img[id^="detail-img-"]').each(function () {
          const el = this;
          const idAttr = $(el).attr('id') || '';
          const match = idAttr.match(/^detail-img-(.+)$/);
          if (!match) return;
          const rowId = match[1];
          const row = (rawData || []).find(r => String(r.id) === String(rowId));
          if (!row || !row.image) return;
          const { imageKey } = normalizeImagePaths(row.image);
          if (!imageKey) return;
          const key = `${imageKey}:full`;
          const cacheEntry = WATERMARK_CACHE.get(key);
          if (cacheEntry && cacheEntry.status === 'ready' && cacheEntry.dataUrl) {
            if (el.src !== cacheEntry.dataUrl) el.src = cacheEntry.dataUrl;
            return;
          }
          getWatermarkedDataUrl(row.image, 'full').then(dataUrl => {
            if (dataUrl) {
              try { el.src = dataUrl; } catch (e) {}
            }
          }).catch(() => {});
        });
      });

      // expand-row: ensure detail image updates immediately
      $('#catalog-table').on('expand-row.bs.table', function (e, index, row, $detail) {
        try {
          if (!row || !row.image) return;
          const { imageKey } = normalizeImagePaths(row.image);
          if (!imageKey) return;
          const $img = $detail.find(`img#detail-img-${escapeHtml(String(row.id))}`);
          if ($img && $img.length) {
            const el = $img.get(0);
            const key = `${imageKey}:full`;
            const cacheEntry = WATERMARK_CACHE.get(key);
            if (cacheEntry && cacheEntry.status === 'ready' && cacheEntry.dataUrl) {
              if (el.src !== cacheEntry.dataUrl) el.src = cacheEntry.dataUrl;
            } else {
              getWatermarkedDataUrl(row.image, 'full').then(dataUrl => {
                if (dataUrl) {
                  try { el.src = dataUrl; } catch (e) {}
                }
              }).catch(() => {});
            }
          } else {
            $detail.find('img').each(function () {
              const el = this;
              const dataOriginal = $(el).attr('data-original') || '';
              if (String(dataOriginal) === String(row.image) || (el.src && el.src.indexOf(row.image) !== -1)) {
                getWatermarkedDataUrl(row.image, 'full').then(dataUrl => {
                  if (dataUrl) {
                    try { el.src = dataUrl; } catch (e) {}
                  }
                }).catch(() => {});
              }
            });
          }
        } catch (err) {
          console.warn('expand-row watermark update failed', err);
        }
      });

      updateClearButtonVisibility();
    }
  });

  window.performExport = performExport;

  /* =========================
     imageview.html integration
     - Will replace carousel / main images with the cached watermarked full image (when possible)
     - Works whether the image query param contains a base id or full path
     ========================= */
  (function wireImageviewIntegration() {
    function getQueryParam(name) {
      try {
        const qs = new URLSearchParams(window.location.search);
        return qs.get(name);
      } catch (e) {
        return null;
      }
    }

    function applyWatermarkToImageElements(imageParam) {
      if (!imageParam) return;
      // imageParam may be base id or a path - normalize
      const { imageKey } = normalizeImagePaths(imageParam);
      if (!imageKey) return;

      // First, try to update common main selectors
      const primarySelectors = ['#imageview-img', '#main-image', '.imageview-main img', 'img.viewer', 'img#viewer', '#imageCarousel img', '.carousel-inner img'];
      primarySelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (!el) return;
          // fast path: if cached
          const cacheEntry = WATERMARK_CACHE.get(`${imageKey}:full`);
          if (cacheEntry && cacheEntry.status === 'ready' && cacheEntry.dataUrl) {
            if (el.src !== cacheEntry.dataUrl) el.src = cacheEntry.dataUrl;
          } else {
            // attempt to generate & update
            getWatermarkedDataUrl(imageParam, 'full').then(dataUrl => {
              if (dataUrl && el) {
                try { el.src = dataUrl; } catch (e) {}
              }
            }).catch(() => {});
          }
        });
      });

      // update any img[data-imageid="<param>"]
      document.querySelectorAll(`img[data-imageid="${imageParam}"]`).forEach(el => {
        const cacheEntry = WATERMARK_CACHE.get(`${imageKey}:full`);
        if (cacheEntry && cacheEntry.status === 'ready' && cacheEntry.dataUrl) {
          if (el.src !== cacheEntry.dataUrl) el.src = cacheEntry.dataUrl;
        } else {
          getWatermarkedDataUrl(imageParam, 'full').then(dataUrl => {
            if (dataUrl && el) {
              try { el.src = dataUrl; } catch (e) {}
            }
          }).catch(() => {});
        }
      });

      // as a last measure update any <img> whose src contains the basename
      document.querySelectorAll('img').forEach(el => {
        try {
          if (!el.src) return;
          if (el.src.indexOf(imageKey) !== -1) {
            const cacheEntry = WATERMARK_CACHE.get(`${imageKey}:full`);
            if (cacheEntry && cacheEntry.status === 'ready' && cacheEntry.dataUrl) {
              if (el.src !== cacheEntry.dataUrl) el.src = cacheEntry.dataUrl;
            } else {
              getWatermarkedDataUrl(imageParam, 'full').then(dataUrl => {
                if (dataUrl && el) {
                  try { el.src = dataUrl; } catch (e) {}
                }
              }).catch(() => {});
            }
          }
        } catch (e) { /* ignore cross-origin read errors */ }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        const qImage = getQueryParam('image');
        if (qImage) applyWatermarkToImageElements(qImage);
      });
    } else {
      const qImage = getQueryParam('image');
      if (qImage) applyWatermarkToImageElements(qImage);
    }
  })();

  // helper used earlier in bindings
  function updateExportModeLabel() {
    const labelMap = { all: "All Rows", filtered: "Filtered Rows", page: "Visible Data", selected: "Selected Rows" };
    $('#exportModeBtn').text("Export Mode: " + (labelMap[exportMode] || "All Rows"));
  }

})(); // end closure

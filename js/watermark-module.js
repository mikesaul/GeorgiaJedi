/**
 * watermark-module.js
 * Fixed: accepts either a bare imageId (e.g., "OPIX_Thing") or a full image path
 * (e.g., "images/autographs/OPIX_Thing.jpg"). Cache keys are normalized to
 * the resolved srcUrl so we don't end up with images/images/... and duplicate work.
 */

(() => {
    const FONT_NAME = "SFDistantGalaxy";
    const FONT_REL_PATH = "css/fonts/SF Distant Galaxy AltOutline.ttf";
    const FONT_URL = encodeURI(FONT_REL_PATH);
  
    let FONT_LOAD_PROMISE = null;
  
    // Cache: key = `${srcUrl}:${mode}`, value = { status, promise, dataUrl }
    const WATERMARK_CACHE = new Map();
    window._WATERMARK_CACHE = WATERMARK_CACHE; // debug
  
    function scheduleWork(fn) {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(fn, { timeout: 500 });
      } else {
        setTimeout(fn, 16);
      }
    }
  
    function isSameOrigin(url) {
      try {
        const u = new URL(url, window.location.href);
        return u.origin === window.location.origin;
      } catch (e) {
        return false;
      }
    }
  
    function ensureFontLoaded() {
      if (FONT_LOAD_PROMISE) return FONT_LOAD_PROMISE;
  
      if (window.FontFace) {
        try {
          const ff = new FontFace(FONT_NAME, `url("${FONT_URL}")`);
          FONT_LOAD_PROMISE = ff.load().then(face => {
            try { document.fonts.add(face); } catch (_) {}
            return document.fonts.load(`12px "${FONT_NAME}"`).then(() => true).catch(() => true);
          }).catch(err => {
            console.warn("FontFace load failed:", FONT_URL, err);
            return true;
          });
        } catch (_) {
          FONT_LOAD_PROMISE = Promise.resolve(true);
        }
      } else if (document.fonts && document.fonts.load) {
        FONT_LOAD_PROMISE = document.fonts.load(`12px "${FONT_NAME}"`).then(() => true).catch(() => true);
      } else {
        FONT_LOAD_PROMISE = Promise.resolve(true);
      }
  
      return FONT_LOAD_PROMISE;
    }
  
    function renderWatermarkedDataUrl(imageUrl, watermarkText = "GeorgiaJedi", sizeHints = null, rotation = -0.6, alpha = 0.55, fontSize = null) {
      return new Promise((resolve, reject) => {
        try {
          const img = new Image();
          if (!isSameOrigin(imageUrl)) img.crossOrigin = "anonymous";
  
          img.onload = function () {
            ensureFontLoaded().then(() => {
              scheduleWork(() => {
                try {
                  const naturalW = img.naturalWidth || img.width || (sizeHints && sizeHints.width) || 1200;
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
  
                  const canvas = document.createElement("canvas");
                  canvas.width = w;
                  canvas.height = h;
                  const ctx = canvas.getContext("2d");
  
                  ctx.drawImage(img, 0, 0, w, h);
  
                  ctx.save();
                  ctx.translate(w / 2, h / 2);
                  ctx.rotate(rotation);
                  ctx.globalAlpha = alpha;
  
                  const finalFontPx = fontSize ? fontSize : Math.max(18, Math.round(w / 12));
                  ctx.font = `${finalFontPx}px "${FONT_NAME}", Arial`;
                  ctx.fillStyle = "#ffffff";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.shadowColor = "rgba(0,0,0,0.6)";
                  ctx.shadowBlur = 4;
                  ctx.shadowOffsetX = 1;
                  ctx.shadowOffsetY = 1;
  
                  const step = Math.max(finalFontPx * 4, 80);
                  const span = Math.max(w, h) * 2;
  
                  for (let x = -span; x <= span; x += step) {
                    for (let y = -span; y <= span; y += step * 1.5) {
                      const dx = x + ((y / step) % 2 ? step / 2 : 0);
                      ctx.fillText(watermarkText, dx, y);
                    }
                  }
  
                  ctx.restore();
  
                  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                  resolve(dataUrl);
                } catch (err) {
                  reject(err);
                }
              });
            }).catch(() => {
              // fallback drawing (system font)
              scheduleWork(() => {
                try {
                  const naturalW = img.naturalWidth || img.width || (sizeHints && sizeHints.width) || 1200;
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
  
                  const canvas = document.createElement("canvas");
                  canvas.width = w;
                  canvas.height = h;
                  const ctx = canvas.getContext("2d");
  
                  ctx.drawImage(img, 0, 0, w, h);
  
                  ctx.save();
                  ctx.translate(w / 2, h / 2);
                  ctx.rotate(rotation);
                  ctx.globalAlpha = alpha;
  
                  const finalFontPx = fontSize ? fontSize : Math.max(18, Math.round(w / 12));
                  ctx.font = `${finalFontPx}px Arial`;
                  ctx.fillStyle = "#ffffff";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.shadowColor = "rgba(0,0,0,0.6)";
                  ctx.shadowBlur = 4;
                  ctx.shadowOffsetX = 1;
                  ctx.shadowOffsetY = 1;
  
                  const step = Math.max(finalFontPx * 4, 80);
                  const span = Math.max(w, h) * 2;
                  for (let x = -span; x <= span; x += step) {
                    for (let y = -span; y <= span; y += step * 1.5) {
                      const dx = x + ((y / step) % 2 ? step / 2 : 0);
                      ctx.fillText(watermarkText, dx, y);
                    }
                  }
  
                  ctx.restore();
  
                  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                  resolve(dataUrl);
                } catch (err) {
                  reject(err);
                }
              });
            });
          };
  
          img.onerror = () => reject(new Error("Image failed to load: " + imageUrl));
          img.src = imageUrl;
        } catch (err) {
          reject(err);
        }
      });
    }
  
    /**
     * public getWatermarkedDataUrl(imageRef, mode)
     *
     * imageRef may be:
     * - a bare id like "OPIX_ABC"  -> resolves to "images/OPIX_ABC.jpg"
     * - a full path like "images/autographs/OPIX_ABC.jpg" -> used as-is
     *
     * mode: 'thumb' or 'full'
     */
    function getWatermarkedDataUrl(imageRef, mode = "full") {
      if (!imageRef) return Promise.resolve(null);
  
      // determine srcUrl:
      // if the ref looks like a path (contains "/" or ends with .jpg/.png/.webp), treat as full path
      let srcUrl;
      const looksLikePath = /[\/\\]/.test(imageRef) || /\.[a-zA-Z0-9]{2,4}$/.test(imageRef);
      if (looksLikePath) {
        srcUrl = imageRef;
      } else {
        srcUrl = (mode === "thumb") ? `images/thumbs/${imageRef}_thumb.jpg` : `images/${imageRef}.jpg`;
      }
  
      const key = `${srcUrl}:${mode}`;
      const existing = WATERMARK_CACHE.get(key);
      if (existing) {
        if (existing.status === "ready") return Promise.resolve(existing.dataUrl);
        return existing.promise;
      }
  
      const hints = (mode === "thumb") ? { width: 128, height: 128 } : null;
      const fontSize = (mode === "thumb") ? 14 : null;
  
      let resolveFn, rejectFn;
      const p = new Promise((resolve, reject) => { resolveFn = resolve; rejectFn = reject; });
  
      WATERMARK_CACHE.set(key, { status: "pending", promise: p, dataUrl: null });
  
      scheduleWork(() => {
        renderWatermarkedDataUrl(srcUrl, "GeorgiaJedi", hints, -0.6, 0.55, fontSize)
          .then(dataUrl => {
            if (dataUrl) {
              WATERMARK_CACHE.set(key, { status: "ready", promise: Promise.resolve(dataUrl), dataUrl });
              resolveFn(dataUrl);
            } else {
              WATERMARK_CACHE.set(key, { status: "error", promise: Promise.resolve(null), dataUrl: null });
              resolveFn(null);
            }
          })
          .catch(err => {
            console.warn("Watermark render failed:", srcUrl, err);
            WATERMARK_CACHE.set(key, { status: "error", promise: Promise.resolve(null), dataUrl: null });
            resolveFn(null);
          });
      });
  
      return p;
    }
  
    window.getWatermarkedDataUrl = getWatermarkedDataUrl;
    window.ensureWatermarkFont = ensureFontLoaded;
  
  })();
  
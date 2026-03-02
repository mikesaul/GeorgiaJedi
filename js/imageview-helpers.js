(function () {
  if (!window.getWatermarkedDataUrl) return;

  window.GJWatermark = {
    request(imageRef, style = 'single') {
      return window.getWatermarkedDataUrl(imageRef, 'full', style);
    },

    async applyToImageElement(imgEl, imageRef, style = 'single') {
      if (!imgEl) return;
      try {
        const dataUrl = await this.request(imageRef, style);
        if (dataUrl) imgEl.src = dataUrl;
      } catch (e) {
        console.warn('Watermark apply failed', e);
      }
    }
  };
})();

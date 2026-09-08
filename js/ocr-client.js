(() => {
  'use strict';

  function createOcrClient({ supabase, config = {}, bucket, onProgress = () => {}, fetchImpl = window.fetch.bind(window) }) {
    if (!supabase) throw new Error('Supabase must be connected before OCR can use OCR.space.');

    async function extract(items) {
      const tempPaths = [];
      try {
        const imageUrls = [];
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          if (item.kind === 'existing') {
            imageUrls.push(item.url);
            continue;
          }
          onProgress(`Preparing OCR image ${index + 1} of ${items.length}…`);
          const uploaded = await prepareOcrImage(item.file, index + 1);
          tempPaths.push(uploaded.path);
          imageUrls.push(uploaded.url);
        }
        if (!imageUrls.length) throw new Error('No usable image URLs were available for OCR.');

        onProgress(`Sending ${imageUrls.length} page${imageUrls.length === 1 ? '' : 's'} to OCR.space…`);
        const functionUrl = buildFunctionUrl(config);
        const headers = { 'Content-Type': 'application/json' };
        if (config.supabaseAnonKey) {
          headers.apikey = config.supabaseAnonKey;
          headers.Authorization = `Bearer ${config.supabaseAnonKey}`;
        }
        const response = await fetchImpl(functionUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ imageUrls })
        });
        let data = null;
        try {
          data = await response.json();
        } catch {}
        if (!response.ok) {
          throw new Error(data?.error || data?.message || `OCR function request failed (${response.status}).`);
        }
        if (!data?.ok) throw new Error(data?.error || 'OCR function returned an unexpected response.');
        return data;
      } finally {
        if (tempPaths.length) {
          try {
            await supabase.storage.from(bucket).remove(tempPaths);
          } catch (error) {
            console.warn('Temporary OCR cleanup failed', error);
          }
        }
      }
    }

    async function prepareOcrImage(file, pageNumber) {
      const processed = await resizeImageForOcr(file);
      const ext = processed.type === 'image/png' ? 'png' : 'jpg';
      const path = `ocr-temp/${Date.now()}-${Math.random().toString(36).slice(2)}-${pageNumber}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, processed, {
        upsert: true,
        contentType: processed.type
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('Could not build a public URL for an OCR image.');
      return { url: data.publicUrl, path };
    }

    return { extract };
  }

  function buildFunctionUrl(config) {
    const functionName = config.ocrFunction || 'recipe-tracker-ocr';
    if (!config.supabaseUrl) throw new Error('Supabase URL is missing from config.js.');
    return `${String(config.supabaseUrl).replace(/\/$/, '')}/functions/v1/${encodeURIComponent(functionName)}`;
  }

  async function resizeImageForOcr(file) {
    if (!file.type.startsWith('image/')) return file;
    const dataUrl = await fileToDataURL(file);
    const img = await loadImage(dataUrl);
    const safeName = file.name.replace(/\.[^.]+$/, '') || 'recipe-photo';
    const maxBytes = 950 * 1024;
    const maxEdges = [2000, 1800, 1600, 1400, 1200, 1000, 850];
    const qualities = [0.84, 0.78, 0.72, 0.64, 0.56, 0.48];

    for (const maxEdge of maxEdges) {
      let { width, height } = img;
      const largest = Math.max(width, height);
      if (largest > maxEdge) {
        const scale = maxEdge / largest;
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }

      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = width;
      baseCanvas.height = height;
      const baseCtx = baseCanvas.getContext('2d', { alpha: false, willReadFrequently: true });
      baseCtx.fillStyle = '#ffffff';
      baseCtx.fillRect(0, 0, width, height);
      baseCtx.drawImage(img, 0, 0, width, height);
      baseCtx.putImageData(enhanceImageForOcr(baseCtx.getImageData(0, 0, width, height)), 0, 0);

      for (const quality of qualities) {
        const blob = await canvasToBlob(baseCanvas, 'image/jpeg', quality);
        if (blob && blob.size <= maxBytes) {
          return new File([blob], `${safeName}.jpg`, { type: 'image/jpeg' });
        }
      }
    }

    throw new Error('Image is still too large for OCR.space after compression. Try a tighter crop or a screenshot.');
  }

  function enhanceImageForOcr(imageData) {
    const { data, width, height } = imageData;
    const pixelCount = width * height;
    const gray = new Uint8ClampedArray(pixelCount);
    let min = 255;
    let max = 0;

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const value = Math.round((0.299 * data[i]) + (0.587 * data[i + 1]) + (0.114 * data[i + 2]));
      gray[p] = value;
      if (value < min) min = value;
      if (value > max) max = value;
    }

    const range = Math.max(1, max - min);
    const contrastBoost = range < 110 ? 1.35 : 1.15;
    for (let p = 0; p < pixelCount; p += 1) {
      let value = Math.round(((gray[p] - min) * 255) / range);
      value = Math.max(0, Math.min(255, Math.round(((value - 128) * contrastBoost) + 128)));
      gray[p] = value;
    }

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      data[i] = gray[p];
      data[i + 1] = gray[p];
      data[i + 2] = gray[p];
      data[i + 3] = 255;
    }
    return imageData;
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read one of the selected images.'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read one of the selected images.'));
      img.src = src;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  window.RecipeTrackerOcr = { buildFunctionUrl, createOcrClient };
})();

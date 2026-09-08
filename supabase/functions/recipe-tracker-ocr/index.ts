const OCR_API_URL = 'https://api.ocr.space/parse/image';
const MAX_PAGES = 8;
const MAX_IMAGE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 25_000;
const ALLOWED_BUCKETS = new Set(['recipe_tracker_assets', 'foodie_recipe_assets']);

type OcrAttempt = {
  text: string;
  engine: number;
  error?: string;
};

type PageResult = {
  page: number;
  parsedText: string;
  engine?: number;
  retried: boolean;
  error?: string;
};

Deno.serve(async (request: Request) => {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);

  try {
    const apiKey = Deno.env.get('OCR_SPACE_API_KEY');
    const projectUrl = Deno.env.get('SUPABASE_URL');
    if (!apiKey) return json({ error: 'OCR is not configured on the server.' }, 500, cors);
    if (!projectUrl) return json({ error: 'Supabase project URL is unavailable.' }, 500, cors);

    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > 32_000) return json({ error: 'OCR request is too large.' }, 413, cors);

    let body: { imageUrls?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'OCR request must contain valid JSON.' }, 400, cors);
    }

    const imageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls.filter((value): value is string => typeof value === 'string')
      : [];
    if (!imageUrls.length) return json({ error: 'No recipe images were provided.' }, 400, cors);
    if (imageUrls.length > MAX_PAGES) {
      return json({ error: `OCR accepts at most ${MAX_PAGES} recipe pages at once.` }, 400, cors);
    }

    const allowedHost = new URL(projectUrl).host;
    for (const imageUrl of imageUrls) {
      if (!isAllowedStorageUrl(imageUrl, allowedHost)) {
        return json({ error: 'OCR only accepts images stored by this Recipe Tracker project.' }, 400, cors);
      }
    }

    const pages: PageResult[] = [];
    for (let index = 0; index < imageUrls.length; index += 1) {
      pages.push(await extractPage(imageUrls[index], index + 1, apiKey));
    }

    const successfulPages = pages.filter((page) => page.parsedText.trim());
    if (!successfulPages.length) {
      return json({
        error: pages.find((page) => page.error)?.error || 'OCR could not read any text from these images.',
        pages
      }, 422, cors);
    }

    const combinedText = pages
      .map((page) => `--- Page ${page.page} ---\n${page.parsedText}`.trim())
      .join('\n\n');

    return json({
      ok: true,
      combinedText,
      pages,
      failedPageCount: pages.length - successfulPages.length,
      retriedPageCount: pages.filter((page) => page.retried).length
    }, 200, cors);
  } catch (error) {
    console.error('Recipe Tracker OCR failure', error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected OCR failure.' }, 500, cors);
  }
});

async function extractPage(imageUrl: string, page: number, apiKey: string): Promise<PageResult> {
  try {
    const response = await fetchWithTimeout(imageUrl, {}, REQUEST_TIMEOUT_MS);
    if (!response.ok) {
      return { page, parsedText: '', retried: false, error: `Could not fetch recipe image (${response.status}).` };
    }

    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
    if (!contentType.startsWith('image/')) {
      return { page, parsedText: '', retried: false, error: 'A selected file is not an image.' };
    }

    const blob = await response.blob();
    if (!blob.size) return { page, parsedText: '', retried: false, error: 'A selected image is empty.' };
    if (blob.size > MAX_IMAGE_BYTES) {
      return { page, parsedText: '', retried: false, error: 'A selected image is larger than the OCR service allows.' };
    }

    const primary = await callOcrSpace(blob, contentType, apiKey, 3);
    if (!primary.error && qualityScore(primary.text) >= 55) {
      return { page, parsedText: cleanOcrText(primary.text), engine: primary.engine, retried: false };
    }

    const fallback = await callOcrSpace(blob, contentType, apiKey, 2);
    const best = qualityScore(fallback.text) > qualityScore(primary.text) ? fallback : primary;
    return {
      page,
      parsedText: cleanOcrText(best.text),
      engine: best.text ? best.engine : undefined,
      retried: true,
      error: best.text ? undefined : (fallback.error || primary.error || 'OCR returned no readable text.')
    };
  } catch (error) {
    return {
      page,
      parsedText: '',
      retried: false,
      error: error instanceof Error ? error.message : 'Unknown OCR error.'
    };
  }
}

async function callOcrSpace(blob: Blob, contentType: string, apiKey: string, engine: number): Promise<OcrAttempt> {
  const form = new FormData();
  form.append('apikey', apiKey);
  form.append('language', 'eng');
  form.append('isOverlayRequired', 'false');
  form.append('detectOrientation', 'true');
  form.append('scale', 'true');
  form.append('isTable', 'true');
  form.append('OCREngine', String(engine));
  form.append('file', blob, `recipe-image.${extensionFor(contentType)}`);

  const response = await fetchWithTimeout(OCR_API_URL, { method: 'POST', body: form }, REQUEST_TIMEOUT_MS);
  if (!response.ok) return { text: '', engine, error: `OCR.space request failed (${response.status}).` };

  let data: any;
  try {
    data = await response.json();
  } catch {
    return { text: '', engine, error: 'OCR.space returned an unreadable response.' };
  }

  const text = Array.isArray(data?.ParsedResults)
    ? data.ParsedResults.map((result: any) => String(result?.ParsedText || '')).join('\n')
    : '';
  const apiError = data?.IsErroredOnProcessing
    ? normalizeApiError(data?.ErrorMessage || data?.ErrorDetails)
    : '';
  return { text, engine, error: apiError || undefined };
}

function isAllowedStorageUrl(value: string, allowedHost: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.host !== allowedHost) return false;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\//);
    return !!match && ALLOWED_BUCKETS.has(decodeURIComponent(match[1]));
  } catch {
    return false;
  }
}

function cleanOcrText(value: string): string {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function qualityScore(value: string): number {
  const text = cleanOcrText(value);
  if (!text) return 0;
  const alphaNumeric = (text.match(/[a-z0-9]/gi) || []).length;
  const suspicious = (text.match(/[�|{}<>]/g) || []).length;
  const lines = text.split('\n').filter((line) => line.trim()).length;
  return Math.min(100, Math.round(text.length / 3) + Math.min(20, lines * 2) + Math.round((alphaNumeric / text.length) * 25) - (suspicious * 4));
}

function extensionFor(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('tiff')) return 'tif';
  if (contentType.includes('bmp')) return 'bmp';
  return 'jpg';
}

function normalizeApiError(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(' ');
  return String(value || 'OCR.space could not process this image.');
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = origin === 'https://tpoirier1969.github.io' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ? origin
    : 'https://tpoirier1969.github.io';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors }
  });
}

import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mirror of src/lib/ocr/image.ts scaleForOcr — keep in sync when changing floors.
 * Regression: PDF/image OCR must not force a 1.4× minimum scale that explodes
 * canvas size for already-large pages.
 */
const MIN_EDGE = 1400;
const MAX_EDGE = 2400;

function scaleForOcr(width, height) {
  const longEdge = Math.max(width, height);
  let scale = 1;
  if (longEdge < MIN_EDGE) scale = MIN_EDGE / longEdge;
  if (longEdge > MAX_EDGE) scale = MAX_EDGE / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** PDF render scale: target ~1800px long edge, allow down to 1.0 (not 1.4). */
function pdfRenderScale(unscaledWidth, unscaledHeight) {
  const target = 1800 / Math.max(unscaledWidth, unscaledHeight);
  return Math.min(2.4, Math.max(1.0, target));
}

test("scaleForOcr leaves mid-size images alone", () => {
  const size = scaleForOcr(1600, 1200);
  assert.equal(size.width, 1600);
  assert.equal(size.height, 1200);
});

test("scaleForOcr upscales tiny images to MIN_EDGE", () => {
  const size = scaleForOcr(700, 500);
  assert.equal(size.width, 1400);
  assert.equal(size.height, 1000);
});

test("pdfRenderScale does not force a 1.4 floor on large pages", () => {
  // 2000px page: target = 0.9 → clamped to 1.0 (old bug clamped to 1.4)
  assert.equal(pdfRenderScale(2000, 1500), 1.0);
  assert.ok(pdfRenderScale(900, 700) > 1.4);
});

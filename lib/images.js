// Previews are generated in the admin's browser at upload time: the original is
// optionally downscaled and watermarked, and only that derivative is
// world-readable. The full-resolution original stays locked behind the Storage
// rules either way.
//
// Doing this client-side keeps the whole app on App Hosting + Firestore +
// Storage -- no Cloud Functions, no image-processing extension to deploy. It is
// safe here because only the admin can upload.

const LOW_RES_MAX_EDGE = 1600;

// Even with low-res off we cap the canvas: browsers refuse to allocate beyond
// roughly 16k on a side, and a 6000px JPEG is already far past what a preview
// needs to look sharp.
const FULL_RES_MAX_EDGE = 4000;

export const DEFAULT_WATERMARK = "HOMICK FLICKS";

export async function buildPreview(
  file,
  { watermark = true, lowRes = true, mark = DEFAULT_WATERMARK } = {}
) {
  const bitmap = await createImageBitmap(file);

  const maxEdge = lowRes ? LOW_RES_MAX_EDGE : FULL_RES_MAX_EDGE;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  if (watermark) {
    drawTiledWatermark(ctx, width, height, mark);
    drawCornerMark(ctx, width, height, mark);
  }

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", lowRes ? 0.82 : 0.9)
  );

  return { blob, width, height };
}

function drawTiledWatermark(ctx, width, height, text) {
  const step = Math.max(width, height) / 4;
  const fontSize = Math.max(16, Math.round(width / 34));

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);

  const reach = Math.max(width, height);
  for (let x = -reach; x <= reach; x += step) {
    for (let y = -reach; y <= reach; y += step * 0.6) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

function drawCornerMark(ctx, width, height, text) {
  const fontSize = Math.max(13, Math.round(width / 52));
  const pad = Math.round(fontSize * 1.1);

  ctx.save();
  ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";

  // A soft shadow keeps the mark legible over both blown-out skies and shadows.
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = fontSize * 0.7;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(`© ${text}`, width - pad, height - pad);
  ctx.restore();
}

export function readableSize(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

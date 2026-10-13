/** Resize a photo in the browser to max 1600 px on the long side and encode as JPEG (D-004). Keeps the upload small and the model input cheap. */
export async function resizeToJpeg(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => loadViaImage(file));
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden'))), 'image/jpeg', quality));
}

function loadViaImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = () => reject(new Error('Bildformat wird nicht unterstützt'));
    img.src = URL.createObjectURL(file);
  });
}

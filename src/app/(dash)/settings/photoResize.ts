/** Browser only: shrink a photo to at most 1600px on its long side and save it as a JPEG under about a megabyte, so uploads stay quick and pages load fast. */
export async function resizeForPage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
  cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height);
  let blob: Blob | null = null;
  for (const q of [0.85, 0.75, 0.65, 0.5]) {
    blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/jpeg', q));
    if (blob && blob.size <= 1_000_000) break;
  }
  if (!blob) throw new Error('encode');
  return blob;
}

/** Выгрузка построенного чертежа в SVG и PNG (только на клиенте). */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(svg: string, filename = "chertezh.svg") {
  downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename);
}

export async function downloadPng(svg: string, filename = "chertezh.png", scale = 2) {
  const match = /width="(\d+(?:\.\d+)?)"\s+height="(\d+(?:\.\d+)?)"/.exec(svg);
  const width = match ? Number(match[1]) : 720;
  const height = match ? Number(match[2]) : 520;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Не удалось подготовить изображение."));
    image.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен.");
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Не удалось создать PNG.");
  downloadBlob(blob, filename);
}

export function downloadSceneJson(scene: unknown, filename = "scene.json") {
  downloadBlob(
    new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" }),
    filename,
  );
}

export async function readSceneJson(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}

export function downloadInfographicPng(dataUrl: string, topic?: string | null): void {
  const title = topic?.trim() || "без названия";
  const safe = title.replace(/[\\/:*?"<>|]+/g, "").slice(0, 120);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `инфографика: ${safe}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Binary-search the largest fontSize between min and max for which `content`
 * fits inside `container`. Re-runs whenever `deps` change.
 * The element targeted by `contentRef` has its inline fontSize set on each
 * iteration; line-height is multiplied. */
export function useFitText(opts: {
  containerRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  baseFontSize: number;
  minFontSize: number;
  lineHeight: number;
  deps: ReadonlyArray<unknown>;
  onMeasured?: (size: number) => void;
}): number {
  const { containerRef, contentRef, baseFontSize, minFontSize, lineHeight, deps, onMeasured } = opts;
  const [size, setSize] = useState(baseFontSize);
  const lastDeps = useRef<string>("");

  useLayoutEffect(() => {
    const c = containerRef.current;
    const el = contentRef.current;
    if (!c || !el) return;

    let lo = minFontSize;
    let hi = baseFontSize;
    let best = minFontSize;

    const fits = () => {
      return (
        el.scrollHeight <= c.clientHeight + 0.5 &&
        el.scrollWidth <= c.clientWidth + 0.5
      );
    };

    const apply = (fs: number) => {
      el.style.fontSize = `${fs}px`;
      el.style.lineHeight = String(lineHeight);
    };

    // First try max — common short-text fast path.
    apply(hi);
    if (fits()) {
      best = hi;
    } else {
      // Binary search to nearest integer px.
      for (let i = 0; i < 12 && lo + 1 < hi; i++) {
        const mid = Math.floor((lo + hi) / 2);
        apply(mid);
        if (fits()) {
          best = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      apply(best);
    }

    setSize(best);
    onMeasured?.(best);
    lastDeps.current = JSON.stringify(deps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return size;
}

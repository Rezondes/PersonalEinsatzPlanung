import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Usable content height for one A4-landscape printed page (210mm tall, 0.6cm @page margin top
 * and bottom, per printView.css), converted to CSS px (96px/inch, 25.4mm/inch), minus
 * .print-page's own 8px top/bottom padding, minus a ~12% safety margin. The margin is
 * deliberately generous: an on-screen measurement taken in one environment (e.g. this app's own
 * dev sandbox) still came out "minimally" over one page in the user's real browser's print-to-PDF
 * output despite comfortably fitting on screen there - most likely because "Arial" resolves to a
 * metrically slightly different substitute font across machines/OSes, which shifts every row's
 * height by a small amount that adds up over ~34 rows. Recompute by hand only if printView.css's
 * @page margin or .print-page padding change.
 */
const PAGE_CONTENT_HEIGHT_PX = Math.floor((((210 - 2 * 6) / 25.4) * 96 - 16) * 0.88);

/**
 * Shrinks the content by setting the `--print-scale` CSS custom property (printView.css multiplies
 * every print font-size/padding by it) - deliberately NOT a `transform: scale()`. A transform is
 * purely a visual/compositing effect: it never changes the element's actual layout box, so a print
 * engine's page-break/pagination decision (which page a given row of content lands on) is made
 * against the pre-transform, full-size layout - the transform then visually squeezes the content
 * into less space on screen, but in the real "print to PDF" pipeline the content still gets
 * paginated as if it were full size, and whatever falls past the first page's worth of untransformed
 * height is silently cut off instead of flowing to a second page. Shrinking font-size/padding
 * directly makes the row genuinely shorter, so pagination naturally agrees with what's rendered.
 */
function fitToOnePage(el: HTMLDivElement) {
  el.style.removeProperty('--print-scale');
  const naturalHeight = el.scrollHeight;
  if (naturalHeight <= PAGE_CONTENT_HEIGHT_PX) {
    return;
  }

  let scale = PAGE_CONTENT_HEIGHT_PX / naturalHeight;
  el.style.setProperty('--print-scale', String(scale));

  // Borders (1px each, ~34 rows) and the branch logo don't shrink proportionally with
  // font-size/padding, so the linear estimate above can slightly undershoot on a dense table -
  // one corrective pass measures the actual post-shrink height and nudges further if it's still
  // (barely) over the target, rather than trusting the linear estimate blindly.
  const actualHeight = el.scrollHeight;
  if (actualHeight > PAGE_CONTENT_HEIGHT_PX) {
    scale *= PAGE_CONTENT_HEIGHT_PX / actualHeight;
    el.style.setProperty('--print-scale', String(scale));
  }
}

/**
 * Measures its children's natural height and, if they don't fit within one printed page,
 * shrinks them (via printView.css's --print-scale-aware font-size/padding, not a transform - see
 * fitToOnePage) just enough to fit exactly one page - self-correcting for any future content
 * change (more employees' columns don't affect this at all since row count is fixed regardless of
 * headcount, but a future extra table row or larger font would automatically shrink to compensate)
 * instead of relying on a hand-picked font-size/padding that has to be re-verified by hand every
 * time. Re-measures again right before the browser actually prints (`beforeprint`), since that's
 * the only point where the measurement happens in the exact environment that produces the final
 * output.
 */
export function PrintPageContent({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    fitToOnePage(el);

    const handler = () => fitToOnePage(el);
    window.addEventListener('beforeprint', handler);
    return () => window.removeEventListener('beforeprint', handler);
  }, [children]);

  return <div ref={ref}>{children}</div>;
}

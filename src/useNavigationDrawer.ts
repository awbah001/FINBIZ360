import { useEffect, useRef, useState } from "react";

/** Keep the mobile navigation isolated and return focus to its opener. */
export default function useNavigationDrawer(open: boolean, close: () => void) {
  const sidebar = useRef<HTMLElement>(null);
  const background = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  const [compact, setCompact] = useState(false);
  closeRef.current = close;
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (sidebar.current) sidebar.current.inert = compact && !open;
  });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = sidebar.current;
    const main = background.current;
    const oldInert = main?.inert;
    const oldOverflow = document.body.style.overflow;
    if (main) main.inert = true;
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href]",
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const elements = controls();
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const resize = () => {
      if (window.matchMedia("(min-width: 761px)").matches) closeRef.current();
    };
    document.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    return () => {
      if (main) main.inert = oldInert || false;
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
      previous?.focus();
    };
  }, [open]);
  return { sidebar, background };
}

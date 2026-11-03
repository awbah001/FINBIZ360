import { useEffect } from "react";

export function allowWorkspaceNavigation() {
  return window.dispatchEvent(
    new Event("finbiz-before-navigation", { cancelable: true }),
  );
}

export default function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: Event) => {
      if (
        !event.defaultPrevented &&
        !window.confirm("Leave this page and discard your unsaved changes?")
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("finbiz-before-navigation", navigate);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("finbiz-before-navigation", navigate);
    };
  }, [dirty]);
}

'use client';

import * as React from 'react';

export function useFieldsetDisabledRef(): {
  ref: React.RefCallback<HTMLElement>;
  disabled: boolean;
} {
  const [disabled, setDisabled] = React.useState(false);
  const observerRef = React.useRef<MutationObserver | null>(null);

  const ref = React.useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node) {
      setDisabled(false);
      return;
    }

    function sync() {
      const fieldset = node?.closest('fieldset');
      setDisabled(fieldset?.disabled ?? false);
    }

    sync();

    const fieldset = node.closest('fieldset');
    if (!fieldset) return;

    const observer = new MutationObserver(sync);
    observer.observe(fieldset, {
      attributes: true,
      attributeFilter: ['disabled'],
    });
    observerRef.current = observer;
  }, []);

  return { ref, disabled };
}

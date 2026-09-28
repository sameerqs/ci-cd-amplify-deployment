'use client';

import * as React from 'react';

/**
 * Modal surfaces (Dialog / Sheet / Drawer) publish their own content DOM
 * node through this context. Portaled pickers (Select / Combobox / Popover /
 * DropdownMenu) consume it and render their floating layer **inside** the
 * modal subtree instead of `document.body`.
 *
 * Why: Radix and Vaul both register a `pointerdown` outside-click handler
 * that asks "is the click target a DOM descendant of my content node?". A
 * picker portaled to `document.body` is technically outside, so the modal
 * either dismisses or its drag/focus machinery swallows the click before
 * the `<SelectItem>` can fire. Re-parenting the picker into the modal
 * subtree eliminates that class of bug entirely.
 *
 * Outside of any modal, the context value is `null` and primitives fall
 * back to their default (`document.body`) portal target — preserving the
 * existing behaviour for non-modal call-sites.
 */
const PortalContainerContext = React.createContext<HTMLElement | null>(null);

interface PortalContainerProviderProps {
    container: HTMLElement | null;
    children: React.ReactNode;
}

export function PortalContainerProvider({
    container,
    children,
}: PortalContainerProviderProps) {
    return (
        <PortalContainerContext.Provider value={container}>
            {children}
        </PortalContainerContext.Provider>
    );
}

export function usePortalContainer(): HTMLElement | null {
    return React.useContext(PortalContainerContext);
}

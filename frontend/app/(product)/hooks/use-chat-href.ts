'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { PRODUCT_ROUTES } from '@/lib/routes';

/**
 * The Chat tab's destination, carrying the pet you last had open.
 *
 * why: the tab pointed at a bare /chat, so stepping over to Account and back
 * silently reset the open chat to whichever pet happens to sort first -- the
 * transcript you were reading was simply gone. This state survives that round
 * trip because the nav lives in the product layout, which is not unmounted
 * when the tab changes; while you are actually on /chat the URL still decides,
 * so nothing here can disagree with it.
 */
export function useChatHref(): string {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [lastPetId, setLastPetId] = useState<string | null>(null);

    if (pathname === PRODUCT_ROUTES.CHAT) {
        const current = searchParams.get('pet');
        if (current !== lastPetId) setLastPetId(current);
    }

    return lastPetId
        ? `${PRODUCT_ROUTES.CHAT}?pet=${encodeURIComponent(lastPetId)}`
        : PRODUCT_ROUTES.CHAT;
}

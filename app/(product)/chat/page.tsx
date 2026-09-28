'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';

import { useRequireOnboarded } from '@/lib/auth/use-auth-guard';
import { useFetch } from '@/lib/hooks/use-fetch';

import { usePets } from '../context/pets-context';
import { openConversation } from './_lib/api';
import { ChatWorkspace } from './_components/chat-workspace';

/**
 * Chat workspace (design 2d mobile, 2k desktop). The active pet lives in the
 * URL rather than client state so the desktop rail and the mobile chip row
 * drive the same selection and cannot drift apart.
 */
function ChatPageInner() {
    const { loading: guardLoading } = useRequireOnboarded();
    const { pets, loading: petsLoading } = usePets();
    const requested = useSearchParams().get('pet');
    const activePetId = (pets.find((pet) => pet.id === requested) ?? pets[0])?.id ?? null;

    // why: the pet id and its conversation settle together, as one value. The
    // workspace resets its transcript whenever activePetId changes and adopts
    // whatever conversation it is handed at that moment, so handing it the new
    // id before the new conversation arrived would file the previous pet's
    // transcript under the new pet. keepPreviousData keeps the current chat on
    // screen until the next one lands, instead of blanking on every switch.
    const fetchChat = useCallback(
        async () => ({
            activePetId,
            // why: an API hiccup here used to take the whole screen down. The
            // workspace renders perfectly well with a null conversation.
            conversation: activePetId
                ? await openConversation(activePetId).catch(() => null)
                : null,
        }),
        [activePetId],
    );
    const { state } = useFetch(guardLoading || petsLoading ? null : fetchChat, {
        keepPreviousData: true,
    });

    if (state.status !== 'ready') return null;

    return (
        <ChatWorkspace
            pets={pets}
            conversation={state.data.conversation}
            activePetId={state.data.activePetId}
        />
    );
}

export default function ChatPage() {
    return (
        <Suspense fallback={null}>
            <ChatPageInner />
        </Suspense>
    );
}

import { call } from '@/lib/utils/api-utils';

import type { Conversation } from '../../_lib/types';

const base = (petId: string) => `pets/${petId}/chat`;

export const openConversation = (petId: string, before?: number) =>
    call<Conversation>({
        endpoint: before ? `${base(petId)}/messages?before=${before}` : base(petId),
        method: 'GET',
        silent: true,
    });

export const sendChatMessage = (petId: string, form: FormData) =>
    call<Conversation>({
        endpoint: `${base(petId)}/messages`,
        method: 'POST',
        payload: form,
        isFormData: true,
        silent: true,
    });

export const confirmCaptureCard = (petId: string) =>
    call<Conversation>({
        endpoint: `${base(petId)}/card/confirm`,
        method: 'POST',
        silent: true,
    });

export const undoCaptureCard = (petId: string) =>
    call<Conversation>({
        endpoint: `${base(petId)}/card/undo`,
        method: 'POST',
        silent: true,
    });

type TrackableEvent = 'chip_tapped' | 'capture_sheet_opened';
type TrackProperty = string | number | boolean;

export const trackClientEvent = (
    event: TrackableEvent,
    properties?: Record<string, TrackProperty>,
) =>
    call<null>({
        endpoint: 'events',
        method: 'POST',
        payload: { event, properties: properties ?? {} },
        silent: true,
    });

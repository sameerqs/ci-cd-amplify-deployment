import { describe, expect, it } from 'vitest';

import {
    buildTimeline,
    MessageAuthor,
    type ChatMessage,
    type Conversation,
} from './types';

function message(
    id: string,
    author: MessageAuthor,
    createdAt: string,
): ChatMessage {
    return {
        id,
        author,
        body: id,
        isEmergencyNotice: false,
        createdAt,
        attachments: [],
    };
}

function conversation(messages: ChatMessage[]): Conversation {
    return {
        id: 'c1',
        petId: 'p1',
        messages,
        card: null,
        attachments: [],
        suggestedQuestion: null,
    };
}

describe('buildTimeline', () => {
    it('keeps the owner turn ahead of the reply it produced', () => {
        const items = buildTimeline(
            conversation([
                message('asked', MessageAuthor.Owner, '2026-09-23T10:00:00+00:00'),
                message('answered', MessageAuthor.Assistant, '2026-09-23T10:00:02+00:00'),
            ]),
        );

        expect(items.map((i) => (i.kind === 'message' ? i.message.id : i.kind))).toEqual([
            'asked',
            'answered',
        ]);
    });

    it('orders a "Z" echo against "+00:00" instants by time, not by string', () => {
        // why: lexically 'Z' sorts after '+', so the old string compare put a
        // freshly echoed turn after messages that were genuinely newer.
        const items = buildTimeline(
            conversation([
                message('older', MessageAuthor.Owner, '2026-09-23T10:00:00+00:00'),
                message('newer', MessageAuthor.Assistant, '2026-09-23T12:00:00+00:00'),
            ]),
            [message('echo', MessageAuthor.Owner, '2026-09-23T11:00:00Z')],
        );

        expect(items.map((i) => (i.kind === 'message' ? i.message.id : i.kind))).toEqual([
            'older',
            'echo',
            'newer',
        ]);
    });

    it('holds same-instant turns in the order the server sent them', () => {
        const at = '2026-09-23T10:00:00+00:00';
        const items = buildTimeline(
            conversation([
                message('first', MessageAuthor.Owner, at),
                message('second', MessageAuthor.Assistant, at),
            ]),
        );

        expect(items.map((i) => (i.kind === 'message' ? i.message.id : i.kind))).toEqual([
            'first',
            'second',
        ]);
    });

    it('renders an echo before the conversation has loaded', () => {
        const items = buildTimeline(null, [
            message('echo', MessageAuthor.Owner, '2026-09-23T10:00:00Z'),
        ]);

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ kind: 'message' });
    });

    it('is empty with nothing to show', () => {
        expect(buildTimeline(null)).toEqual([]);
    });
});

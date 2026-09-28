/**
 * Wire shapes for the pet-owner surface. These mirror what the PET-5 / PET-7 /
 * PET-11 endpoints will return; the screens are typed against them now so
 * swapping placeholder data for `call()` is a one-line change per module.
 */

import { VoteChoice } from '@/lib/enum';

export { VoteChoice };

export enum Species {
    Dog = 0,
    Cat = 1,
    Other = 2,
}

export const SPECIES_LABEL: Record<Species, string> = {
    [Species.Dog]: 'Dog',
    [Species.Cat]: 'Cat',
    [Species.Other]: 'Other',
};

export const SPECIES_ORDER: Species[] = [Species.Dog, Species.Cat, Species.Other];

export interface Pet {
    id: string;
    name: string;
    species: Species;
    age: string | null;
    weight: string | null;
    breed: string | null;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string | null;
}

/** "Beagle mix · 7 yrs" — whichever parts exist, in that order. */
export function petMetaLine(pet: Pet): string {
    return (
        [pet.breed, pet.age].filter(Boolean).join(' · ') ||
        SPECIES_LABEL[pet.species]
    );
}

export enum MessageAuthor {
    Assistant = 0,
    Owner = 1,
}

export interface CapturedEntry {
    id: string;
    text: string;
    /** "you said, 11:07 pm" — where this line came from. */
    provenance: string;
}

export interface CapturedGroup {
    /** Matches a row in the admin-managed `categories` table. */
    category: string;
    entries: CapturedEntry[];
}

export interface CaptureCard {
    groups: CapturedGroup[];
    isConfirmed: boolean;
}

export interface Attachment {
    id: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    /** Build the download URL from this; the raw name is never the key. */
    storageKey: string;
    createdAt: string;
}

export interface ChatMessage {
    id: string;
    author: MessageAuthor;
    body: string;
    /** The fixed "consult a vet" turn — rendered distinctly, never as chat. */
    isEmergencyNotice: boolean;
    createdAt: string;
    /** Files sent with this turn; they render inside its bubble. */
    attachments: Attachment[];
}

export interface Conversation {
    id: string;
    petId: string;
    messages: ChatMessage[];
    card: CaptureCard | null;
    /** Only files that belong to no message — uploads from before the composer. */
    attachments: Attachment[];
    /** Wording the assistant offered for a question it would not answer. */
    suggestedQuestion: string | null;
    hasMoreMessages?: boolean;
    nextBefore?: number | null;
}

export interface RoadmapEntry {
    id: string;
    title: string;
    description: string | null;
    /** What opens the comment box for this card specifically; null falls back
     * to a generic prompt keyed off the vote instead. */
    commentPrompt: string | null;
    /** The viewer's own vote, null until they pick one. */
    myVote: VoteChoice | null;
    note: string | null;
}

/**
 * Messages and attachments share one chronological stream: an attachment sent
 * between two messages belongs between them, not appended after everything.
 */
export type TimelineItem =
    | { kind: 'message'; at: string; message: ChatMessage }
    | { kind: 'attachment'; at: string; attachment: Attachment };

/**
 * `extraMessages` are locally-held turns not yet acknowledged by the server —
 * the composer's optimistic echo. They sort in by timestamp like any other.
 */
export function buildTimeline(
    conversation: Conversation | null,
    extraMessages: ChatMessage[] = [],
): TimelineItem[] {
    if (!conversation) {
        return extraMessages.map((message) => ({
            kind: 'message',
            at: message.createdAt,
            message,
        }));
    }
    const items: TimelineItem[] = [
        ...[...conversation.messages, ...extraMessages].map(
            (message): TimelineItem => ({
                kind: 'message',
                at: message.createdAt,
                message,
            }),
        ),
        ...conversation.attachments.map(
            (attachment): TimelineItem => ({
                kind: 'attachment',
                at: attachment.createdAt,
                attachment,
            }),
        ),
    ];
    // why: compared as instants, not as strings. The API sends "+00:00" offsets
    // and a local echo sends "Z"; lexically 'Z' sorts after '+', so a string
    // compare put every echoed turn after messages that are genuinely newer.
    // Sort is stable, so same-instant turns keep the order the server sent them.
    return items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** An attachment with the pet it belongs to — the account screen's list. */
export interface OwnerAttachment extends Attachment {
    petId: string;
    petName: string;
}

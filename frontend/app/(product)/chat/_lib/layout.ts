/**
 * The chat conversation's own reading width -- shared so the message list
 * and the composer agree on how wide "the chat column" is. `min(96%,1100px)`
 * tracks the viewport continuously rather than jumping at a fixed
 * breakpoint, and stays capped so a line of chat text never gets
 * uncomfortably wide on a large screen.
 */
export const CHAT_COLUMN_WIDTH = 'w-full max-w-[min(96%,1100px)]';

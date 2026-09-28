/**
 * Public-runtime config. Read once on the client; never mutated. The
 * `API_BASE` URL composes the NestJS server URL + global prefix + URI
 * version, so call sites only pass the resource part of the path
 * (e.g. `auth/login`).
 */

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || '';
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';

export const appSettings = {
    APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Pet2text',
    /** Mirrors the server's APP_TIMEZONE so persisted display strings match. */
    APP_TIMEZONE: process.env.NEXT_PUBLIC_APP_TIMEZONE || 'UTC',
    SERVER_URL,
    DOMAIN_URL: process.env.NEXT_PUBLIC_DOMAIN_URL || '',
    API_VERSION,
    /** Full prefix — e.g. https://api.example.com/api/v1. Always required: this
     * is a static site on its own origin, with no reverse proxy to fall back to. */
    API_BASE: SERVER_URL ? `${SERVER_URL}/api/${API_VERSION}` : `/api/${API_VERSION}`,
};

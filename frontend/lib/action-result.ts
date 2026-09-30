/**
 * Discriminated result returned by every module's client mutation function
 * (`_lib/actions.ts`) so form hooks and tables can branch on `ok` without
 * try/catch at the call site.
 */
export type ActionResult<TData = void> =
    | {
          ok: true;
          data: TData;
          warning?: { heading: string; message: string };
      }
    | { ok: false; message: string };

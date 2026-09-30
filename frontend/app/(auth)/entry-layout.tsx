import { BetaDisclaimer } from '@/components/product/beta-disclaimer';

/**
 * Unauthenticated entry shell (design 2a) — a single centred column on a warm
 * ground, phone-first, capped so it stays a column on desktop rather than
 * stretching. Replaces the starter's split illustration layout for the screens
 * the product actually ships.
 */
export function EntryLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-svh w-full flex-col bg-background">
            <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-8">
                <div className="w-full max-w-[21.25rem] sm:max-w-[24rem]">{children}</div>
            </div>
            <div className="px-6 pb-8 sm:px-8">
                <BetaDisclaimer className="mx-auto max-w-[21.25rem] sm:max-w-[24rem]" />
            </div>
        </div>
    );
}

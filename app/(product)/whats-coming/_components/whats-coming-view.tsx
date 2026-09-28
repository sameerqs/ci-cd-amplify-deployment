import { PRODUCT_ROUTES } from '@/lib/routes';

import { BackLink } from '../../_components/back-link';
import type { RoadmapEntry } from '../../_lib/types';
import { WhatsComingList } from './whats-coming-panel';

/**
 * The standalone What's Coming screen (design 2j).
 *
 * why: this used to cap at max-w-5xl (1024px) -- a fixed ceiling that stayed
 * identical from a laptop up to an ultrawide monitor, leaving most of a wide
 * screen empty. The grid itself now sizes its own columns continuously with
 * `auto-fit`/`minmax` rather than jumping at Tailwind breakpoints, so column
 * count tracks the viewport at every width; the outer cap is only raised
 * enough to stop a handful of cards stretching absurdly wide on a very large
 * display, not to pin the layout to one size.
 */
export function WhatsComingView({
    initialEntries,
}: {
    initialEntries: RoadmapEntry[];
}) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="px-5 pb-3 pt-3 sm:px-6">
                <div className="mx-auto w-full max-w-[1600px]">
                    <BackLink href={PRODUCT_ROUTES.ACCOUNT} label="Account" />
                    <h1 className="font-heading text-[24px] leading-[1.2] sm:text-[27px]">
                        What&apos;s coming
                    </h1>
                    <p className="mt-1 max-w-prose text-[13px] leading-[1.5] text-[var(--neutral-700)]">
                        Beta · nothing here works yet. Tell us what&apos;s worth
                        building.
                    </p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
                <div className="mx-auto w-full max-w-[1600px]">
                    <WhatsComingList
                        entries={initialEntries}
                        className="grid-cols-[repeat(auto-fit,minmax(260px,340px))]"
                    />
                </div>
            </div>
        </div>
    );
}

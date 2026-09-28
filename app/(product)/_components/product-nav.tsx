'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { AccountIcon, ChatBubbleIcon, SparkleIcon } from '@/components/product/brand-mark';
import { PRODUCT_ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

import { useChatHref } from '../hooks/use-chat-href';
import type { Pet } from '../_lib/types';

interface NavTab {
    label: string;
    href: string;
    Icon: typeof ChatBubbleIcon;
    /** Routes that should also light this tab up. */
    alsoMatches?: string[];
}

const TABS: NavTab[] = [
    {
        label: 'Chat',
        href: PRODUCT_ROUTES.CHAT,
        Icon: ChatBubbleIcon,
    },
    {
        label: 'Account',
        href: PRODUCT_ROUTES.ACCOUNT,
        Icon: AccountIcon,
    },
    {
        label: "What's coming",
        href: PRODUCT_ROUTES.WHATS_COMING,
        Icon: SparkleIcon,
    },
];

function isActive(pathname: string, tab: NavTab): boolean {
    const candidates = [tab.href, ...(tab.alsoMatches ?? [])];
    return candidates.some(
        (href) => pathname === href || pathname.startsWith(`${href}/`),
    );
}

/**
 * Bottom tab bar (design 2d/2i/2j). Hidden at lg, where ProductRail takes over.
 */
export function ProductNav() {
    const pathname = usePathname();
    const chatHref = useChatHref();

    return (
        <nav
            className="flex border-t border-border pb-6 pt-1.5 lg:hidden"
            aria-label="Main"
        >
            {TABS.map((tab) => {
                const active = isActive(pathname, tab);
                return (
                    <Link
                        key={tab.href}
                        href={tab.href === PRODUCT_ROUTES.CHAT ? chatHref : tab.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'flex flex-1 flex-col items-center gap-[3px] py-2',
                            active
                                ? 'text-primary'
                                : 'text-[var(--neutral-600)]',
                        )}
                    >
                        <tab.Icon size={23} />
                        <span
                            className={cn(
                                'text-[11.5px]',
                                active ? 'font-bold' : 'font-semibold',
                            )}
                        >
                            {tab.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}

/**
 * Desktop left rail (design 2k/2l) — same destinations, laid out vertically.
 */
export function ProductRail({ pets = [] }: { pets?: Pet[] }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const chatHref = useChatHref();
    const livePets = pets.filter((pet) => !pet.isArchived);
    const selectedPet = searchParams.get('pet');
    const onChat = pathname === PRODUCT_ROUTES.CHAT;

    return (
        <aside className="hidden shrink-0 flex-col border-r border-border bg-ground lg:flex lg:w-[15rem] xl:w-[16.5rem]">
            <div className="flex items-center gap-2.5 px-6 py-6">
                <ChatBubbleIcon size={20} className="text-primary" />
                <span className="font-heading text-[19px]">pet2text</span>
            </div>
            <nav className="flex flex-col gap-1 px-3" aria-label="Main">
                {TABS.map((tab) => {
                    const active = isActive(pathname, tab);
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href === PRODUCT_ROUTES.CHAT ? chatHref : tab.href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'flex items-center gap-3 rounded-full px-4 py-2.5 text-[14.5px]',
                                active
                                    ? 'bg-[var(--accent-200)] font-semibold text-[var(--accent-900)]'
                                    : 'text-[var(--neutral-700)] hover:bg-[var(--neutral-200)]',
                            )}
                        >
                            <tab.Icon size={19} />
                            {tab.label}
                        </Link>
                    );
                })}
            </nav>

            {livePets.length ? (
                <div className="mt-6 flex min-h-0 flex-1 flex-col px-3">
                    <div className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--neutral-600)]">
                        Pets
                    </div>
                    <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain">
                        {livePets.map((pet) => {
                            const active =
                                onChat &&
                                (selectedPet
                                    ? pet.id === selectedPet
                                    : pet.id === livePets[0]?.id);
                            return (
                                <li key={pet.id}>
                                    <Link
                                        href={`${PRODUCT_ROUTES.CHAT}?pet=${pet.id}`}
                                        aria-current={active ? 'true' : undefined}
                                        className={cn(
                                            'flex items-center gap-2.5 rounded-full px-4 py-2 text-[14px]',
                                            active
                                                ? 'bg-[var(--accent-200)] font-semibold text-[var(--accent-900)]'
                                                : 'text-[var(--neutral-700)] hover:bg-[var(--neutral-200)]',
                                        )}
                                    >
                                        <span
                                            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--neutral-200)] text-[11px] font-bold uppercase text-[var(--neutral-700)]"
                                            aria-hidden
                                        >
                                            {pet.name.charAt(0)}
                                        </span>
                                        <span className="truncate">{pet.name}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                    <Link
                        href={PRODUCT_ROUTES.NEW_CHAT}
                        className="mt-1.5 rounded-full px-4 py-2 text-[14px] text-primary hover:bg-[var(--neutral-200)]"
                    >
                        + Add a pet
                    </Link>
                </div>
            ) : null}
        </aside>
    );
}

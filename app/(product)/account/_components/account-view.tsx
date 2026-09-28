'use client';

import Link from 'next/link';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { downloadFile } from '@/lib/download-file';
import { signOut } from '@/lib/auth/sign-out';
import { PRODUCT_ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

import { humanSize } from '../../chat/_components/attachment-chip';
import {
    petMetaLine,
    type OwnerAttachment,
    type Pet,
    type RoadmapEntry,
} from '../../_lib/types';
import { usePetArchive } from '../hooks/use-pet-archive';
import { WhatsComingPanel } from '../../whats-coming/_components/whats-coming-panel';

interface AccountViewProps {
    email: string;
    initialPets: Pet[];
    attachments: OwnerAttachment[];
    whatsComing: RoadmapEntry[];
}

export function AccountView({
    email,
    initialPets,
    attachments,
    whatsComing,
}: AccountViewProps) {
    const {
        pets,
        busyId,
        pendingArchive,
        requestArchive,
        cancelArchive,
        confirmArchive,
    } = usePetArchive(initialPets);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="px-5 pb-2.5 pt-1">
                {/* why: capped with the same fluid `min()` as the body below
                    it rather than a fixed 560px, so the title lines up with
                    a body that is now also allowed to grow on a wide screen. */}
                <div className="mx-auto w-full max-w-[560px] lg:max-w-[min(92%,1400px)]">
                    <h1 className="font-heading text-[26px]">Account</h1>
                    <p className="mt-0.5 text-[12.5px] text-[var(--neutral-600)]">
                        {email} · signed in by magic link
                    </p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2.5 lg:grid lg:max-w-[min(92%,1400px)] lg:grid-cols-[7fr_3fr] lg:items-start lg:gap-6">
                  <div className="flex w-full min-w-0 flex-col gap-2.5">
                    <SectionLabel>Your pets</SectionLabel>

                    <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2">
                    {pets.map((pet) => (
                        <div
                            key={pet.id}
                            className={cn(
                                'flex items-center gap-3 rounded-[22px] border border-[var(--neutral-200)] bg-card px-4 py-3',
                                pet.isArchived && 'opacity-60',
                            )}
                        >
                            <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[var(--accent-200)] font-heading text-[16px] text-[var(--accent-900)]">
                                {pet.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span
                                    className={cn(
                                        'block truncate text-[15px] font-semibold',
                                        pet.isArchived && 'line-through',
                                    )}
                                >
                                    {pet.name}
                                </span>
                                <span className="block truncate text-[12px] text-[var(--neutral-600)]">
                                    {pet.isArchived
                                        ? 'Archived'
                                        : petMetaLine(pet)}
                                </span>
                            </span>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => requestArchive(pet)}
                                disabled={busyId === pet.id}
                                className="min-h-[38px] shrink-0 bg-card text-[12.5px]"
                            >
                                {pet.isArchived ? 'Restore' : 'Archive'}
                            </Button>
                        </div>
                    ))}

                    <Button
                        asChild
                        variant="secondary"
                        className="min-h-[68px] w-full border border-dashed border-[var(--neutral-300)] bg-transparent text-[15px] lg:min-h-[74px]"
                    >
                        <Link href={PRODUCT_ROUTES.NEW_CHAT}>+ Add a pet</Link>
                    </Button>
                    </div>

                    <SectionLabel className="pt-2.5">Attachments</SectionLabel>
                    <div className="rounded-[22px] border border-[var(--neutral-200)] bg-card px-4 py-3.5">
                        <p className="text-[12.5px] leading-[1.55] text-[var(--neutral-600)]">
                            Kept with the chat you added them to.
                        </p>
                        {attachments.length ? (
                            <ul className="mt-3 flex flex-wrap gap-2">
                                {attachments.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            onClick={() => void downloadFile(item.storageKey, item.filename)}
                                            className="flex items-center gap-2 rounded-full bg-[var(--neutral-200)] px-3 py-1.5 text-[12.5px] text-[var(--neutral-700)] hover:bg-[var(--neutral-300)]"
                                        >
                                            <span className="max-w-[180px] truncate">
                                                {item.filename}
                                            </span>
                                            <span className="text-[11px] text-[var(--neutral-600)]">
                                                {item.petName} · {humanSize(item.sizeBytes)}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-3 text-[12.5px] text-[var(--neutral-600)]">
                                Nothing attached yet. Photos and paperwork you add to a
                                chat appear here.
                            </p>
                        )}
                    </div>

                    <SectionLabel className="pt-2.5">Settings</SectionLabel>

                    <div className="overflow-hidden rounded-[22px] border border-[var(--neutral-200)] bg-card">
                        <SettingRow label="Email address" value={email} />
                        <SettingRow
                            label="What's coming"
                            href={PRODUCT_ROUTES.WHATS_COMING}
                            action="Vote"
                        />
                        <SettingRow
                            label="Terms & what this app isn't"
                            href={PRODUCT_ROUTES.TERMS}
                        />
                        <SignOutRow />
                    </div>

                    <p className="mx-1 mt-1 text-[11.5px] leading-[1.55] text-[var(--neutral-600)]">
                        Archiving hides a pet and their chat. Nothing is deleted,
                        and you can bring them back here.
                    </p>
                  </div>

                  <aside className="hidden min-w-0 lg:block">
                      <WhatsComingPanel entries={whatsComing} />
                  </aside>
                </div>
            </div>

            <AlertDialog
                open={pendingArchive !== null}
                onOpenChange={(open) => {
                    if (!open) cancelArchive();
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Archive {pendingArchive?.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This hides {pendingArchive?.name} and their whole chat.
                            Nothing is deleted, and you can bring them back from this
                            screen at any time.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep them here</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmArchive}>
                            Archive
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function SectionLabel({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'px-1 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--neutral-600)]',
                className,
            )}
        >
            {children}
        </div>
    );
}

const SETTING_ROW_CLASS =
    'flex w-full items-center px-4 py-3.5 text-left text-[14.5px] border-b border-[var(--neutral-200)] last:border-b-0';

function SignOutRow() {
    return (
        <button
            type="button"
            onClick={() => void signOut()}
            className={cn(
                SETTING_ROW_CLASS,
                'border-b border-[var(--neutral-200)] last:border-b-0 transition-colors hover:bg-[var(--neutral-100)]',
            )}
        >
            <span className="flex-1 text-[var(--accent-700)]">Sign out</span>
        </button>
    );
}

interface SettingRowProps {
    label: string;
    value?: string;
    action?: string;
    href?: string;
    isDanger?: boolean;
}

function SettingRow({ label, value, action, href, isDanger }: SettingRowProps) {
    const body = (
        <>
            <span
                className={cn(
                    'flex-1',
                    isDanger && 'text-[var(--accent-700)]',
                )}
            >
                {label}
            </span>
            {value ? (
                <span className="text-[13px] text-[var(--neutral-600)]">
                    {value}
                </span>
            ) : null}
            {action ? (
                <span className="text-[13px] font-semibold text-[var(--accent-700)]">
                    {action}
                </span>
            ) : null}
        </>
    );

    if (href) {
        return (
            <Link
                href={href}
                className={cn(SETTING_ROW_CLASS, 'transition-colors hover:bg-[var(--neutral-100)]')}
            >
                {body}
            </Link>
        );
    }

    return <div className={SETTING_ROW_CLASS}>{body}</div>;
}

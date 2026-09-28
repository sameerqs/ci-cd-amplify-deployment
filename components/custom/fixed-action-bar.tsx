'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/z-index';

interface FixedActionBarProps {
    children: ReactNode;
    className?: string;
}

export function FixedActionBar({ children, className }: FixedActionBarProps) {
    return (
        <>
            <div
                aria-hidden="true"
                className="h-[calc(2rem+env(safe-area-inset-bottom,0px))] shrink-0"
            />
            <div
                className={cn(
                    `fixed bottom-0 left-0 right-0 ${Z_INDEX.formFooter} border-t bg-background px-2 pt-3 shadow-lg`,
                    'pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]',
                    'md:left-(--sidebar-width)',
                    'group-has-data-[collapsible=icon]/sidebar-wrapper:md:left-[calc(var(--sidebar-width-icon)+1rem)]',
                    className,
                )}
            >
                {children}
            </div>
        </>
    );
}

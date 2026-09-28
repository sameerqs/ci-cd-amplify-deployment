'use client';

import { Suspense } from 'react';

import { useRequireOwnerRole } from '@/lib/auth/use-auth-guard';

import { ProductNav, ProductRail } from './_components/product-nav';
import { PetsProvider, usePets } from './context/pets-context';

function ProductShell({ children }: { children: React.ReactNode }) {
    const { pets } = usePets();

    return (
        <div className="flex h-svh overflow-hidden bg-background">
            <Suspense fallback={null}>
                <ProductRail pets={pets} />
            </Suspense>
            <div className="flex h-full min-w-0 flex-1 flex-col">
                <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {children}
                </main>
                <Suspense fallback={null}>
                    <ProductNav />
                </Suspense>
            </div>
        </div>
    );
}

/**
 * Shell for the pet-owner surface (design 2d/2i/2j mobile, 2k/2l desktop):
 * a bottom tab bar on phones, a left rail from lg up. The rail lists the
 * owner's pets so a desktop user can switch between them — the chip row that
 * does that on mobile is hidden at lg, and nothing replaced it before.
 *
 * why a client gate, not a server one: a static export has no server left at
 * request time to decide before a byte is sent, so this now waits on
 * useRequireOwnerRole()'s `loading` instead. A signed-out visitor still sees
 * the shell once loading resolves — the page beneath sends them to /login —
 * only an actual Admin/Super Admin is bounced away from here.
 */
export default function ProductLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { loading } = useRequireOwnerRole();
    if (loading) return null;

    return (
        <PetsProvider>
            <ProductShell>{children}</ProductShell>
        </PetsProvider>
    );
}

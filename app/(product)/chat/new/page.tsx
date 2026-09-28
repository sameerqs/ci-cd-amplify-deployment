'use client';

import { useRequireOnboarded } from '@/lib/auth/use-auth-guard';

import { PetForm } from './_components/pet-form';

/**
 * Pet form before a chat starts (design 2c).
 */
export default function NewChatPage() {
    const { loading } = useRequireOnboarded();
    if (loading) return null;

    return <PetForm />;
}

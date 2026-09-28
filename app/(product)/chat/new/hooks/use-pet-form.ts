'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm, type SubmitHandler, type UseFormReturn } from 'react-hook-form';

import { PRODUCT_ROUTES } from '@/lib/routes';
import { toast } from '@/lib/toast';

import { usePets } from '../../../context/pets-context';
import { createPetAction } from '../../../_lib/pets-actions';
import { Species } from '../../../_lib/types';
import { petSchema, type PetFormData, type PetFormInput } from '../_lib/schema';

interface UsePetFormResult {
    methods: UseFormReturn<PetFormInput, unknown, PetFormData>;
    onSubmit: SubmitHandler<PetFormData>;
    isSubmitting: boolean;
    species: Species;
    pickSpecies: (value: Species) => void;
    /** "Start Milo's chat" once a name is typed, generic before that. */
    submitLabel: string;
}

export function usePetForm(): UsePetFormResult {
    const router = useRouter();
    const { refetch: refetchRail } = usePets();
    const [isPending, startTransition] = useTransition();

    const methods = useForm<PetFormInput, unknown, PetFormData>({
        resolver: zodResolver(petSchema),
        mode: 'onBlur',
        defaultValues: {
            name: '',
            species: String(Species.Dog),
            age: '',
            weight: '',
            breed: '',
        },
    });

    const species = Number(methods.watch('species')) as Species;
    const name = methods.watch('name')?.trim();

    const pickSpecies = (value: Species) => {
        methods.setValue('species', String(value), {
            shouldValidate: true,
            shouldDirty: true,
        });
    };

    const onSubmit: SubmitHandler<PetFormData> = (values) => {
        startTransition(async () => {
            const result = await createPetAction({
                name: values.name,
                species: values.species,
                age: values.age,
                weight: values.weight,
                breed: values.breed,
            });

            if (!result.ok) {
                toast.error(result.message);
                methods.setError('root', { message: result.message });
                return;
            }

            toast.success(`${result.data.name} is ready to chat.`);
            refetchRail();
            router.push(`${PRODUCT_ROUTES.CHAT}?pet=${result.data.id}`);
        });
    };

    return {
        methods,
        onSubmit,
        isSubmitting: isPending,
        species,
        pickSpecies,
        submitLabel: name ? `Start ${name}'s chat` : 'Start the chat',
    };
}

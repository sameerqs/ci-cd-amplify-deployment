import { z } from 'zod';

import { optionalTrimmedString, requiredTrimmedString } from '@/lib/utils/zod-schema';
import { Species } from '../../../_lib/types';

/** Species arrives from a pressed button as a string; the backend takes the int. */
const speciesFromForm = z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(v)))
    .refine(
        (v) => v === Species.Dog || v === Species.Cat || v === Species.Other,
        { message: 'Pick a species.' },
    )
    .transform((v) => v as Species);

export const petSchema = z.object({
    name: requiredTrimmedString(50, 'Name'),
    species: speciesFromForm,
    age: optionalTrimmedString(20, 'Age'),
    weight: optionalTrimmedString(20, 'Weight'),
    breed: optionalTrimmedString(50, 'Breed'),
});

export type PetFormInput = z.input<typeof petSchema>;
export type PetFormData = z.output<typeof petSchema>;

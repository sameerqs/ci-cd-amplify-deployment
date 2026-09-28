// Mirror of `server/src/common/constants/*`. NEVER change a numeric
// value here without updating the backend (and writing a migration
// when any DB column reads it).

export enum UserStatus {
    Pending = 0,
    Active = 1,
    Rejected = 2,
}

export enum VoteChoice {
    Yes = 0,
    No = 1,
}

export const VOTE_CHOICE_LABEL: Record<VoteChoice, string> = {
    [VoteChoice.Yes]: 'Yes',
    [VoteChoice.No]: 'No',
};

export enum Gender {
    Male = 0,
    Female = 1,
    NoPreference = 2,
}

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
    [UserStatus.Pending]: 'Pending',
    [UserStatus.Active]: 'Active',
    [UserStatus.Rejected]: 'Rejected',
};

export const GENDER_LABEL: Record<Gender, string> = {
    [Gender.Male]: 'Male',
    [Gender.Female]: 'Female',
    [Gender.NoPreference]: 'Prefer Not to Say',
};

export type EnumSelectOption = { value: string; label: string };

export function enumSelectOptions<T extends number>(
    values: readonly T[],
    labels: Record<T, string>,
): EnumSelectOption[] {
    return values.map((value) => ({
        value: String(value),
        label: labels[value],
    }));
}

export const GENDER_OPTIONS: EnumSelectOption[] = enumSelectOptions(
    [Gender.Male, Gender.Female, Gender.NoPreference],
    GENDER_LABEL,
);

export const USER_STATUS_OPTIONS: EnumSelectOption[] = enumSelectOptions(
    [UserStatus.Pending, UserStatus.Active, UserStatus.Rejected],
    USER_STATUS_LABEL,
);

export enum FeedbackStatus {
    New = 0,
    Reviewed = 1,
    Planned = 2,
    Rejected = 3,
}

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
    [FeedbackStatus.New]: 'New',
    [FeedbackStatus.Reviewed]: 'Reviewed',
    [FeedbackStatus.Planned]: 'Planned',
    [FeedbackStatus.Rejected]: 'Rejected',
};

export const FEEDBACK_STATUS_OPTIONS: EnumSelectOption[] = enumSelectOptions(
    [
        FeedbackStatus.New,
        FeedbackStatus.Reviewed,
        FeedbackStatus.Planned,
        FeedbackStatus.Rejected,
    ],
    FEEDBACK_STATUS_LABEL,
);


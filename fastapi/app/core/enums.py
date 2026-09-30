from enum import IntEnum


class UserStatus(IntEnum):
    # why: PENDING and REJECTED predate signup_requests, which now holds the review
    # state; an account row is only ever ACTIVE or SUSPENDED. The values stay
    # reserved because persisted rows and the client enum are keyed on them.
    PENDING = 0
    ACTIVE = 1
    REJECTED = 2
    SUSPENDED = 3


USER_STATUS_LABELS: dict[UserStatus, str] = {
    UserStatus.PENDING: "Pending",
    UserStatus.ACTIVE: "Active",
    UserStatus.REJECTED: "Rejected",
    UserStatus.SUSPENDED: "Suspended",
}


class SignupStatus(IntEnum):
    PENDING = 0
    APPROVED = 1
    REJECTED = 2


SIGNUP_STATUS_LABELS: dict[SignupStatus, str] = {
    SignupStatus.PENDING: "Pending",
    SignupStatus.APPROVED: "Approved",
    SignupStatus.REJECTED: "Rejected",
}


class Species(IntEnum):
    DOG = 0
    CAT = 1
    OTHER = 2


SPECIES_LABELS: dict[Species, str] = {
    Species.DOG: "Dog",
    Species.CAT: "Cat",
    Species.OTHER: "Other",
}


class MessageAuthor(IntEnum):
    ASSISTANT = 0
    OWNER = 1


class VoteChoice(IntEnum):
    YES = 0
    NO = 1


VOTE_CHOICE_LABELS: dict[VoteChoice, str] = {
    VoteChoice.YES: "Yes",
    VoteChoice.NO: "No",
}


class FeedbackStatus(IntEnum):
    NEW = 0
    REVIEWED = 1
    PLANNED = 2
    REJECTED = 3


FEEDBACK_STATUS_LABELS: dict[FeedbackStatus, str] = {
    FeedbackStatus.NEW: "New",
    FeedbackStatus.REVIEWED: "Reviewed",
    FeedbackStatus.PLANNED: "Planned",
    FeedbackStatus.REJECTED: "Rejected",
}


class Gender(IntEnum):
    MALE = 0
    FEMALE = 1
    NO_PREFERENCE = 2


GENDER_LABELS: dict[Gender, str] = {
    Gender.MALE: "Male",
    Gender.FEMALE: "Female",
    Gender.NO_PREFERENCE: "Prefer not to say",
}

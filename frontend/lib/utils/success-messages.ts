export const SUCCESS_MESSAGES = {
    USER_INVITED: 'User has been invited successfully.',
    USER_UPDATED: 'User has been updated successfully.',
    USER_REMOVED: 'User has been removed successfully.',
    INVITATION_SENT: 'Invitation has been sent successfully.',

    ACCOUNT_CREATED: 'Account has been created successfully.',
    LOGIN_SUCCESS: 'You have been logged in successfully.',
    PROFILE_UPDATED: 'Profile has been updated successfully.',
    PASSWORD_CHANGED: 'Password has been changed successfully.',
    PASSWORD_RESET: 'Password has been reset successfully.',
    EMAIL_CHANGED: 'Email has been changed successfully.',
    VERIFICATION_LINK_SENT: 'Verification link has been sent successfully.',
    PASSWORD_RESET_LINK_SENT:
        'If an account exists for that email, a password reset link has been sent.',

    ITEM_DELETED: 'Item has been deleted successfully.',
    ITEM_ADDED: 'Item has been added successfully.',
    ITEM_RENAMED: 'Item has been renamed successfully.',
    CELLS_CLEARED: 'Cells have been cleared successfully.',
    CELLS_COPIED: 'Cells have been copied successfully.',
    CELLS_PASTED: 'Cells have been pasted successfully.',
    ROWS_DELETED: 'Rows have been deleted successfully.',
} as const;

export function sentToMessage(entity: string, recipient: string): string {
    return `${entity} has been sent to ${recipient} successfully.`;
}

export function invitationSentTo(recipient: string): string {
    return `Invitation has been sent to ${recipient} successfully.`;
}

export function bulkActionMessage(
    count: number,
    singular: string,
    plural: string,
    verb: string,
): string {
    const noun = count === 1 ? `1 ${singular}` : `${count} ${plural}`;
    const aux = count === 1 ? 'has' : 'have';
    return `${noun} ${aux} been ${verb} successfully.`;
}

export function entityDeletedMessage(entityLabel: string): string {
    return `${entityLabel} has been deleted successfully.`;
}

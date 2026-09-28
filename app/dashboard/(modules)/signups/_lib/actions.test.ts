import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApproveSignup = vi.fn();
const mockRejectSignup = vi.fn();

vi.mock('./api', () => ({
    approveSignup: (...args: unknown[]) => mockApproveSignup(...args),
    rejectSignup: (...args: unknown[]) => mockRejectSignup(...args),
}));

import { UserStatus } from '@/lib/enum';
import { ApiCallError } from '@/lib/utils/api-utils';

import { approveSignupAction, rejectSignupAction } from './actions';

const SIGNUP = {
    id: 'abc',
    email: 'owner@example.com',
    displayName: 'Pat Owner',
    status: UserStatus.Active,
    onboardingCompletedAt: null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: null,
};

describe('approveSignupAction', () => {
    beforeEach(() => {
        mockApproveSignup.mockReset();
    });

    it('returns the approved signup', async () => {
        mockApproveSignup.mockResolvedValueOnce({
            data: SIGNUP,
            warningHeading: '',
            warningMessage: '',
        });

        const result = await approveSignupAction('abc');

        expect(result).toEqual({ ok: true, data: SIGNUP, warning: undefined });
        expect(mockApproveSignup).toHaveBeenCalledWith('abc');
    });

    it('surfaces a soft warning when the approval email could not be sent', async () => {
        mockApproveSignup.mockResolvedValueOnce({
            data: SIGNUP,
            warningHeading: 'Approval email not sent',
            warningMessage: 'We could not email owner@example.com.',
        });

        const result = await approveSignupAction('abc');

        expect(result).toMatchObject({
            ok: true,
            warning: {
                heading: 'Approval email not sent',
                message: 'We could not email owner@example.com.',
            },
        });
    });

    it('surfaces the envelope message when the signup was already reviewed', async () => {
        mockApproveSignup.mockRejectedValueOnce(
            new ApiCallError('This account has already been reviewed.', null, 409),
        );

        const result = await approveSignupAction('abc');

        expect(result).toEqual({
            ok: false,
            message: 'This account has already been reviewed.',
        });
    });
});

describe('rejectSignupAction', () => {
    beforeEach(() => {
        mockRejectSignup.mockReset();
    });

    it('returns the rejected signup', async () => {
        const rejected = { ...SIGNUP, status: UserStatus.Rejected };
        mockRejectSignup.mockResolvedValueOnce(rejected);

        const result = await rejectSignupAction('abc');

        expect(result).toEqual({ ok: true, data: rejected });
    });

    it('reports a failure', async () => {
        mockRejectSignup.mockRejectedValueOnce(
            new ApiCallError('Signup not found', null, 404),
        );

        const result = await rejectSignupAction('abc');

        expect(result).toEqual({ ok: false, message: 'Signup not found' });
    });
});

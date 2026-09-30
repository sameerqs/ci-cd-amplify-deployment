import { call } from '@/lib/utils/api-utils';

import type { OwnerAttachment } from '../../_lib/types';

export const listOwnerAttachments = async (): Promise<OwnerAttachment[]> => {
    const res = await call<{ items: OwnerAttachment[] }>({
        endpoint: 'attachments',
        method: 'GET',
        silent: true,
    });
    return res?.items ?? [];
};

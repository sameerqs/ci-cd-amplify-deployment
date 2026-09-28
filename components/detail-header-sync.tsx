"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

import {
    DETAIL_HEADER_BACK_KEY,
    DETAIL_HEADER_NAME_KEY,
    DETAIL_HEADER_PARENT_BACK_KEY,
    DETAIL_HEADER_PARENT_NAME_KEY,
    withDetailHeaderParams,
} from "@/lib/utils/detail-header-query";

interface DetailHeaderSyncProps {
    name: string;
    backTo: string;
    /** Set on nested sub-routes (a child entity under its parent). */
    parentName?: string;
    parentBack?: string;
    children: React.ReactNode;
}

/**
 * Writes the entity name + back-target (and optionally parent name +
 * parent back-target) into the URL as search params so the global
 * site-header can pick them up. The header renders root / detail /
 * nested mode based on which params are present.
 *
 * Existing URL values win over the static props so deep-links and
 * back/forward navigation preserve filter state.
 */
export function DetailHeaderSync({
    name,
    backTo,
    parentName,
    parentBack,
    children,
}: DetailHeaderSyncProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const headerName = searchParams.get(DETAIL_HEADER_NAME_KEY);
    const headerBack = searchParams.get(DETAIL_HEADER_BACK_KEY);
    const headerParentName = searchParams.get(DETAIL_HEADER_PARENT_NAME_KEY);
    const headerParentBack = searchParams.get(DETAIL_HEADER_PARENT_BACK_KEY);

    useEffect(() => {
        if (!name) return;

        const expectedParentName = parentName ?? null;
        const expectedParentBack = parentBack ?? headerParentBack ?? null;

        const synced =
            headerName === name &&
            !!headerBack &&
            headerParentName === expectedParentName &&
            headerParentBack === expectedParentBack;
        if (synced) return;

        const resolvedBackTo = headerBack || backTo;
        const resolvedParentBack = headerParentBack || parentBack || undefined;

        const currentPath = searchParams.toString()
            ? `${pathname}?${searchParams.toString()}`
            : pathname;
        const newPath = withDetailHeaderParams(currentPath, {
            name,
            backTo: resolvedBackTo,
            parentName: parentName ?? undefined,
            parentBack: resolvedParentBack,
        });
        router.replace(newPath, { scroll: false });
    }, [
        name,
        backTo,
        parentName,
        parentBack,
        pathname,
        router,
        headerName,
        headerBack,
        headerParentName,
        headerParentBack,
    ]);

    return <>{children}</>;
}

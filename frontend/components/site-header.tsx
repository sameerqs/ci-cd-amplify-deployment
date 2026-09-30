"use client";

import { useRef } from "react";
import { ChevronRight } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { HoverTooltip } from "@/components/custom/hover-tooltip";
import { useIsTextTruncated } from "@/components/custom/truncated-text-with-tooltip";
import { GuardedLink } from "@/components/guarded-link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUnsavedChangesOptional } from "@/app/context/unsaved-changes-context";
import { isSafeDashboardBackTo } from "@/lib/utils/safe-back-to";
import { getModuleMeta, getModuleMetaForHref } from "@/lib/nav-config";
import { appSettings } from "@/lib/app-settings";
import { DASHBOARD_ROUTES } from "@/lib/routes";
import {
    DETAIL_HEADER_NAME_KEY,
    getDetailHeaderParams,
    isModuleTableListPath,
} from "@/lib/utils/detail-header-query";
import { getTitleFromPath } from "@/lib/utils/get-title-from-path";

/**
 * Site header.
 *
 * Three display modes — picked from the pathname + URL `detailName` /
 * `parentName` params:
 *
 *  - **Root** (list pages): `[module-icon] {Page title}`. Icon is the
 *    module-icon from `getModuleMeta(pathname)`; title comes from the
 *    pathname.
 *  - **Detail / Create**: `[module-icon-back] > {entityName-or-title}`.
 *    Icon is a back-link (uses `detailBack` from URL if set, falls back
 *    to the module list).
 *  - **Nested**: `[module-icon-back] > {parentName} > {childTitle}` —
 *    used by nested sub-routes like `/<parent>/[id]/<child>/new`. Both the
 *    icon (back to module list) and the parentName text (back to parent
 *    entity detail) are clickable; both honour unsaved-changes.
 *
 * Fixed positioning + sidebar-aware left margin so the header stays
 * stuck to the top while the sidebar collapses / expands.
 */
export function SiteHeader() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const unsaved = useUnsavedChangesOptional();

    const {
        name: detailName,
        backTo: detailBack,
        parentName,
        parentBack,
    } = getDetailHeaderParams(new URLSearchParams(searchParams.toString()));

    const moduleMeta =
        (isSafeDashboardBackTo(detailBack)
            ? getModuleMetaForHref(detailBack!)
            : null) ?? getModuleMeta(pathname);
    const Icon = moduleMeta?.icon;

    const breadcrumbType = getBreadcrumbType(pathname, {
        hasDetailName: Boolean(detailName),
        hasParentName: Boolean(parentName),
    });
    const titleFromPath = getTitleFromPath(pathname);
    const displayTitle =
        breadcrumbType === "root" ? titleFromPath : detailName || titleFromPath;

    const moduleListHref = moduleMeta?.listHref || DASHBOARD_ROUTES.HOME;
    const detailBackHref = detailBack || moduleListHref;

    const pushOrPrompt = (target: string) => {
        if (unsaved?.hasUnsavedChanges) {
            unsaved.requestLeave(target);
            return;
        }
        router.push(target);
    };

    return (
        <header
            className="fixed top-0 left-0 right-0 z-40 flex shrink-0 flex-col transition-[left] ease-linear md:left-(--sidebar-width) group-has-data-[collapsible=icon]/sidebar-wrapper:md:left-(--sidebar-width-icon)"
        >
            <div className="flex h-12 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground md:hidden">
                <GuardedLink
                    href={DASHBOARD_ROUTES.HOME}
                    className="text-lg font-semibold tracking-tight text-sidebar-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-md"
                    aria-label="Go to dashboard"
                >
                    {appSettings.APP_NAME}
                </GuardedLink>
                <SidebarTrigger
                    aria-label="Open navigation menu"
                    className="size-9 text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                />
            </div>
            <div className="flex h-14 w-full min-w-0 items-center border-b bg-background">
            <div className="flex w-full min-w-0 items-center gap-3 px-6 lg:px-8">
                {breadcrumbType === "root" && (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        {Icon && (
                            <Icon
                                className="size-5 shrink-0 text-foreground"
                                aria-hidden
                            />
                        )}
                        <HeaderBreadcrumbTitle title={displayTitle} />
                    </div>
                )}

                {breadcrumbType === "detail" && (
                    <nav
                        aria-label="Breadcrumb"
                        className="flex min-w-0 flex-1 items-center gap-2"
                    >
                        {Icon && (
                            <button
                                type="button"
                                onClick={() => pushOrPrompt(detailBackHref)}
                                aria-label="Back to list"
                                className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <Icon className="size-5" />
                            </button>
                        )}
                        <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                        />
                        <HeaderBreadcrumbTitle title={displayTitle} />
                    </nav>
                )}

                {breadcrumbType === "nested" && (
                    <nav
                        aria-label="Breadcrumb"
                        className="flex min-w-0 flex-1 items-center gap-2"
                    >
                        {Icon && (
                            <button
                                type="button"
                                onClick={() => pushOrPrompt(parentBack ?? moduleListHref)}
                                aria-label="Back to list"
                                className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <Icon className="size-5" />
                            </button>
                        )}
                        <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                        />
                        <HeaderBreadcrumbParent
                            label={parentName ?? ""}
                            onClick={() =>
                                pushOrPrompt(detailBack ?? moduleListHref)
                            }
                            disabled={!detailBack && !parentBack}
                        />
                        <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                        />
                        <HeaderBreadcrumbTitle title={displayTitle} />
                    </nav>
                )}
            </div>
            </div>
        </header>
    );
}

type BreadcrumbType = "root" | "detail" | "nested";

const headerTitleClassName =
    "min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground";

function HeaderBreadcrumbTitle({ title }: { title: string }) {
    const ref = useRef<HTMLHeadingElement>(null);
    const isTruncated = useIsTextTruncated(() => ref.current, [title]);
    const heading = (
        <h1 ref={ref} className={headerTitleClassName}>
            {title}
        </h1>
    );

    if (!isTruncated || !title.trim()) {
        return heading;
    }

    return <HoverTooltip content={title}>{heading}</HoverTooltip>;
}

function HeaderBreadcrumbParent({
    label,
    onClick,
    disabled,
}: {
    label: string;
    onClick: () => void;
    disabled: boolean;
}) {
    const ref = useRef<HTMLButtonElement>(null);
    const isTruncated = useIsTextTruncated(() => ref.current, [label]);
    const button = (
        <button
            ref={ref}
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="min-w-0 max-w-[40%] truncate cursor-pointer rounded px-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default"
        >
            {label}
        </button>
    );

    if (!isTruncated || !label.trim()) {
        return button;
    }

    return <HoverTooltip content={label}>{button}</HoverTooltip>;
}

/**
 * "root" = a known module list path or the dashboard home;
 * "nested" = `parentName` is set in the URL (sub-route like
 *   /<parent>/[id]/<child>/new);
 * "detail" = anything else that isn't a list (create / edit / detail).
 */
function getBreadcrumbType(
    pathname: string,
    flags: { hasDetailName: boolean; hasParentName: boolean },
): BreadcrumbType {
    if (pathname === DASHBOARD_ROUTES.HOME) return "root";
    if (isModuleTableListPath(pathname)) return "root";
    if (flags.hasParentName) return "nested";
    if (flags.hasDetailName) return "detail";

    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last === "new" || last === "edit") return "detail";

    const isId =
        /^[0-9a-fA-F]{24,32}$/.test(last) ||
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(
            last,
        );
    return isId ? "detail" : "root";
}

// Re-export for code that referenced these from the old header
export { DETAIL_HEADER_NAME_KEY };

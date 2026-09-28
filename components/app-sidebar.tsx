"use client";

import { ChevronRight, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarTrigger,
    useSidebar,
} from "@/components/ui/sidebar";
import { GuardedLink } from "@/components/guarded-link";
import { Button } from "@/components/ui/button";
import { NavUser } from "@/components/nav-user";
import { useAuth } from "@/app/context/auth-context";
import { getNavForUser, isNavItemActive, type NavItem } from "@/lib/nav-config";
import { DASHBOARD_ROUTES } from "@/lib/routes";
import { appSettings } from "@/lib/app-settings";
import { cn } from "@/lib/utils";

/**
 * Role-aware sidebar.
 *
 *  - `collapsible="icon"` so it collapses to an icon strip rather than
 *    sliding off-canvas.
 *  - Header row puts the SidebarTrigger inline with the brand wordmark,
 *    so the trigger stays visible in collapsed mode.
 *  - Nav items render the `lucide` icon from `nav-config.ts`. Active
 *    detection considers most-specific match — so a sidebar with both
 *    `/dashboard` and `/dashboard/queries` highlights the deeper one.
 *  - Items with `children` render as a Collapsible parent that expands to
 *    a list of sub-items.
 *  - The footer renders <NavUser /> which reads the AuthContext.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { isMobile, setOpenMobile } = useSidebar();
    const items = getNavForUser(user?.isSuperAdmin);
    const flatHrefs = collectHrefs(items);

    return (
        <Sidebar collapsible="icon" {...props} className="text-sidebar-foreground">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:!p-1.5 hover:bg-transparent focus:*:bg-transparent"
                        >
                            <div className="flex w-full items-center gap-2 px-1.5 py-3">
                                <SidebarTrigger className="hidden md:inline-flex text-white transition-colors duration-150 hover:bg-sidebar-accent [&_img]:brightness-0 [&_img]:invert" />
                                <GuardedLink
                                    href={DASHBOARD_ROUTES.HOME}
                                    className="flex flex-1 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-md"
                                    aria-label="Go to dashboard"
                                    onClick={() => {
                                        if (isMobile) setOpenMobile(false);
                                    }}
                                >
                                    <span className="text-lg font-semibold tracking-tight text-sidebar-primary-foreground">
                                        {appSettings.APP_NAME}
                                    </span>
                                </GuardedLink>
                                {isMobile && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0 text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                        onClick={() => setOpenMobile(false)}
                                        aria-label="Close navigation menu"
                                    >
                                        <X className="size-5" />
                                    </Button>
                                )}
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent className="flex flex-col gap-2">
                        <SidebarMenu className="flex flex-col gap-3">
                            {items.map((item) =>
                                item.children?.length ? (
                                    <ParentItem
                                        key={item.label}
                                        item={item}
                                        pathname={pathname}
                                        searchParams={searchParams}
                                        flatHrefs={flatHrefs}
                                    />
                                ) : (
                                    <LeafItem
                                        key={item.href ?? item.label}
                                        item={item}
                                        pathname={pathname}
                                        searchParams={searchParams}
                                        flatHrefs={flatHrefs}
                                    />
                                ),
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>{user && <NavUser />}</SidebarFooter>
        </Sidebar>
    );
}

function LeafItem({
    item,
    pathname,
    searchParams,
    flatHrefs,
}: {
    item: NavItem;
    pathname: string;
    searchParams: URLSearchParams;
    flatHrefs: string[];
}) {
    const { isMobile, setOpenMobile } = useSidebar();
    const isActive = isNavItemActive(
        pathname,
        searchParams,
        item.href,
        flatHrefs,
    );
    const Icon = item.icon;
    if (!item.href) return null;
    return (
        <GuardedLink
            href={item.href}
            onClick={() => {
                if (isMobile) setOpenMobile(false);
            }}
        >
            <SidebarMenuItem>
                <SidebarMenuButton
                    tooltip={item.label}
                    isActive={isActive}
                    className={cn(
                        "text-sm leading-[120%] h-7 p-3",
                        isActive
                            ? "font-semibold"
                            : "font-normal border-transparent text-sidebar-foreground/65!",
                    )}
                >
                    <Icon className="size-5 shrink-0" />
                    <span>{item.label}</span>
                </SidebarMenuButton>
                {item.badge !== undefined && item.badge > 0 ? (
                    <SidebarMenuBadge
                        className={cn(
                            "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-none",
                            isActive
                                ? "bg-sidebar-primary text-white!"
                                : "bg-white/20 text-white!",
                            item.badge < 10 && "size-5 px-0",
                        )}
                    >
                        {item.badge}
                    </SidebarMenuBadge>
                ) : null}
            </SidebarMenuItem>
        </GuardedLink>
    );
}

function ParentItem({
    item,
    pathname,
    searchParams,
    flatHrefs,
}: {
    item: NavItem;
    pathname: string;
    searchParams: URLSearchParams;
    flatHrefs: string[];
}) {
    const { isMobile, setOpenMobile } = useSidebar();
    const Icon = item.icon;
    const childHrefs = (item.children ?? [])
        .map((c) => c.href)
        .filter((h): h is string => Boolean(h));
    const isAnyChildActive = childHrefs.some((h) =>
        isNavItemActive(pathname, searchParams, h, flatHrefs),
    );

    return (
        <Collapsible defaultOpen={isAnyChildActive} asChild>
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        tooltip={item.label}
                        isActive={false}
                        className="group/collapsible text-sm leading-[120%] h-7 p-3 font-normal border-transparent text-sidebar-foreground/65!"
                    >
                        <Icon className="size-5 shrink-0" />
                        <span>{item.label}</span>
                        <ChevronRight className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {(item.children ?? []).map((child) => {
                            if (!child.href) return null;
                            const ChildIcon = child.icon;
                            const childActive = isNavItemActive(
                                pathname,
                                searchParams,
                                child.href,
                                flatHrefs,
                            );
                            return (
                                <SidebarMenuSubItem key={child.href}>
                                    <SidebarMenuSubButton
                                        asChild
                                        isActive={childActive}
                                        className={cn(
                                            childActive
                                                ? "font-semibold"
                                                : "text-sidebar-foreground/65!",
                                        )}
                                    >
                                        <GuardedLink
                                            href={child.href}
                                            onClick={() => {
                                                if (isMobile) setOpenMobile(false);
                                            }}
                                        >
                                            <ChildIcon className="size-4 shrink-0" />
                                            <span>{child.label}</span>
                                        </GuardedLink>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            );
                        })}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}

function collectHrefs(items: NavItem[]): string[] {
    const out: string[] = [];
    for (const item of items) {
        if (item.href) out.push(item.href);
        if (item.children) out.push(...collectHrefs(item.children));
    }
    return out;
}

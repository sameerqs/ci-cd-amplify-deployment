"use client";

import { IconDotsVertical, IconLogout } from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/app/context/auth-context";
import { useUnsavedChangesOptional } from "@/app/context/unsaved-changes-context";
import { formatPersonName } from "@/lib/utils/format-person-name";
import { signOut } from "@/lib/auth/sign-out";

function getUserInitials(user: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string;
}): string {
  const firstChar = (value: string | null | undefined) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed ? trimmed.charAt(0).toUpperCase() : "";
  };

  const fromFirstLast =
    firstChar(user.firstName) + firstChar(user.lastName);
  if (fromFirstLast.length >= 2) return fromFirstLast;
  if (fromFirstLast.length === 1) return fromFirstLast;

  const label = formatPersonName(user.firstName, user.lastName, user.displayName ?? "");
  const nameParts = label.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length >= 2) {
    return (
      nameParts[0].charAt(0).toUpperCase() +
      nameParts[nameParts.length - 1].charAt(0).toUpperCase()
    );
  }
  if (nameParts.length === 1) {
    return nameParts[0].charAt(0).toUpperCase();
  }

  const fromEmail = firstChar(user.email);
  if (fromEmail) return fromEmail;

  return "U";
}

export function NavUser(props: {
  user?: {
    email: string;
    avatar?: string;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string;
  };
}) {
  const { isMobile } = useSidebar();
  const { user: ctxUser } = useAuth();
  // Prefer the prop if supplied (test fixtures), else read from context.
  const user = props.user ?? {
    email: ctxUser?.email ?? "",
    firstName: ctxUser?.firstName ?? null,
    lastName: ctxUser?.lastName ?? null,
    displayName: ctxUser?.displayName,
  };
  const displayLabel = formatPersonName(
    user.firstName,
    user.lastName,
    user.displayName ?? user.email,
  );
  const unsaved = useUnsavedChangesOptional();
  const fallBackAvatar = getUserInitials(user);
  return (
    <SidebarMenu className="z-[9999px]!">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-white! data-[state=open]:hover:text-white! hover:text-white focus:text-white! [&_span]:data-[state=open]:text-inherit [&_.text-muted-foreground]:data-[state=open]:text-white/90"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale text-black">
                <AvatarImage src={user.avatar} alt={displayLabel} />
                <AvatarFallback className="rounded-lg ">
                  {fallBackAvatar}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayLabel}</span>
                <span className="text-sidebar-foreground/60 truncate text-xs font-normal leading-[150%]">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg !z-[10000]"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={displayLabel} />
                  <AvatarFallback className="rounded-lg">
                    {fallBackAvatar}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {displayLabel}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={async () => {
                if (unsaved?.hasUnsavedChanges) {
                  unsaved.requestLeave("__logout__");
                  return;
                }
                void signOut();
              }}
            >
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

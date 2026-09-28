"use client";

import * as React from "react";
import { Spinner } from "@/components/ui/spinner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import {
  DEFAULT_DIALOG_DESCRIPTION_MAX_LENGTH,
  truncateText,
} from "@/lib/utils/truncate-text";
import { cn, capitalizeEachWord } from "@/lib/utils";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  itemCount?: number;
  itemType?: string;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemCount = 1,
  itemType = "item",
}: DeleteConfirmationDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  const itemTypeLabel = capitalizeEachWord(itemType);
  const genericTitle = `Delete  ${itemTypeLabel}${itemCount > 1 ? "s" : ""}?`;
  const genericDescription = `Are you sure you want to delete ${itemCount > 1 ? "the selected " : "this "}${itemType}${itemCount > 1 ? "s" : ""}? This action cannot be undone.`;

  const isUserDelete = itemType?.toLowerCase() === "user";
  const useUserCopy = isUserDelete && title == null && description == null;
  const defaultTitle = useUserCopy
    ? itemCount > 1
      ? "Delete  Users?"
      : "Delete User?"
    : genericTitle;
  const defaultDescription = useUserCopy
    ? itemCount > 1
      ? "Are you sure you want to delete the selected users? This action cannot be undone."
      : "Are you sure you want to delete this user? This action cannot be undone."
    : genericDescription;

  const resolvedTitle = title ?? defaultTitle;
  const titleTruncated = truncateText(resolvedTitle);
  const resolvedDescription = description ?? defaultDescription;
  const descriptionTruncated = truncateText(
    resolvedDescription,
    DEFAULT_DIALOG_DESCRIPTION_MAX_LENGTH,
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle
            maxLength={false}
            title={
              titleTruncated.wasTruncated ? titleTruncated.full : undefined
            }
          >
            {titleTruncated.display}
          </AlertDialogTitle>
          <AlertDialogDescription
            maxLength={false}
            title={
              descriptionTruncated.wasTruncated
                ? descriptionTruncated.full
                : undefined
            }
          >
            {descriptionTruncated.display}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {isDeleting ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FixedActionBar } from "@/components/custom/fixed-action-bar";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { toast } from "@/lib/toast";
import { call } from "@/lib/utils/api-utils";
import { useGuardedRouter } from "@/components/form-guard";
import { capitalizeEachWord, cn } from "@/lib/utils";
import { stripDetailHeaderParams } from "@/lib/utils/detail-header-query";
import { resolveBackUrl } from "@/lib/utils/resolve-back-url";
import { entityDeletedMessage } from "@/lib/utils/success-messages";

interface FormFooterProgrammaticSubmit {
  onSave: () => void;
  onSaveAndClose?: () => void;
}

interface FormFooterProps {
  isSubmitting?: boolean;
  onCancel?: () => void;
  cancelRedirectUrl?: string;
  cancelLabel?: string;
  saveLabel?: string;
  /** Shown on the primary button while `isSubmitting` (defaults to "Saving..."). */
  saveSubmittingLabel?: string;
  saveAndCloseLabel?: string;
  deleteLabel?: string;
  showCancelButton?: boolean;
  showSaveButton?: boolean;
  showSaveAndCloseButton?: boolean;
  showDeleteButton?: boolean;
  containerClassName?: string;
  saveButtonClassName?: string;
  saveAndCloseButtonClassName?: string;
  deleteButtonClassName?: string;
  recordId?: string | number;
  deleteApiEndpoint?: string;
  itemType?: string;
  deleteConfirmTitle?: string;
  deleteConfirmDescription?: string;
  redirectAfterDelete?: string;
  showPreviousButton?: boolean;
  onPrevious?: () => void;
  previousLabel?: string;
  previousDisabled?: boolean;
  readOnly?: boolean;
  inline?: boolean;
  /** When set, Save uses type="button" and runs these callbacks so nested drawer UIs do not bubble submit to an outer `<form>`. */
  programmaticSubmit?: FormFooterProgrammaticSubmit;
}

const FormFooter = ({
  isSubmitting = false,
  onCancel,
  cancelRedirectUrl,
  cancelLabel = "Close",
  saveLabel = "Save",
  saveSubmittingLabel = "Saving...",
  saveAndCloseLabel = "Save & Close",
  deleteLabel = "Delete",
  showCancelButton = true,
  showSaveButton = true,
  showSaveAndCloseButton = true,
  showDeleteButton = false,
  containerClassName = "flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3",
  saveButtonClassName = "text-white",
  saveAndCloseButtonClassName = "text-white",
  deleteButtonClassName = "",
  recordId,
  deleteApiEndpoint,
  itemType = "record",
  deleteConfirmTitle,
  deleteConfirmDescription,
  redirectAfterDelete,
  showPreviousButton = false,
  onPrevious,
  previousLabel = "Previous",
  previousDisabled = false,
  readOnly = false,
  inline = false,
  programmaticSubmit,
}: FormFooterProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const guardedRouter = useGuardedRouter();
  const { setValue, control } = useFormContext();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCancel = () => {
    if (cancelRedirectUrl) {
      guardedRouter.push(resolveBackUrl(cancelRedirectUrl, searchParams));
    } else if (onCancel) {
      onCancel();
    } else {
      guardedRouter.back();
    }
  };

  const handleSave = () => {
    setValue("isSaveAndClose", false);
  };

  const handleSaveAndClose = (_e: React.MouseEvent<HTMLButtonElement>) => {
    setValue("isSaveAndClose", true);
  };

  const handleProgrammaticSave = () => {
    setValue("isSaveAndClose", false);
    programmaticSubmit?.onSave();
  };

  const handleProgrammaticSaveAndClose = () => {
    setValue("isSaveAndClose", true);
    programmaticSubmit?.onSaveAndClose?.();
  };

  const handleDeleteClick = () => {
    if (!recordId || !deleteApiEndpoint) {
      toast.error("Delete operation not configured properly");
      return;
    }
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recordId || !deleteApiEndpoint) {
      toast.error("Delete operation not configured properly");
      return;
    }

    setIsDeleting(true);
    try {
      await call({
        endpoint: `${deleteApiEndpoint}/${recordId}`,
        method: "DELETE",
      });

      toast.success(entityDeletedMessage(capitalizeEachWord(itemType)));
      setIsDeleteDialogOpen(false);

      if (redirectAfterDelete) {
        router.push(stripDetailHeaderParams(redirectAfterDelete));
        router.refresh();
      } else if (onCancel) {
        onCancel();
      } else {
        router.back();
        setTimeout(() => router.refresh(), 100);
      }
    } catch (error: unknown) {
      console.error("Delete error:", error);
      toast.error((error instanceof Error ? error.message : null) || `Failed to delete ${itemType}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const isSaveAndClose = useWatch({ name: "isSaveAndClose", control: control });
  const footerButtonClassName = "w-full sm:w-auto";

  const content = (
    <div className="max-w-full px-6 lg:px-8">
          <div className={containerClassName}>
            {showCancelButton && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting || isDeleting}
                className={footerButtonClassName}
              >
                {cancelLabel}
              </Button>
            )}
            {showPreviousButton && onPrevious && (
              <Button
                type="button"
                variant="outline"
                onClick={onPrevious}
                disabled={isSubmitting || isDeleting || previousDisabled}
                className={footerButtonClassName}
              >
                {previousLabel}
              </Button>
            )}
            {!readOnly &&
              showDeleteButton &&
              recordId &&
              deleteApiEndpoint && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isSubmitting || isDeleting}
                  className={cn(footerButtonClassName, deleteButtonClassName)}
                  onClick={handleDeleteClick}
                >
                  {isDeleting ? "Deleting..." : deleteLabel}
                </Button>
              )}
            {!readOnly && showSaveButton && (
              <Button
                type={programmaticSubmit ? "button" : "submit"}
                variant={
                  isSubmitting || isDeleting
                    ? "muted"
                    : "gradient"
                }
                disabled={isSubmitting || isDeleting}
                className={cn(footerButtonClassName, saveButtonClassName)}
                onClick={
                  programmaticSubmit
                    ? handleProgrammaticSave
                    : handleSave
                }
              >
                {isSubmitting && !isSaveAndClose
                  ? saveSubmittingLabel
                  : saveLabel}
              </Button>
            )}

            {!readOnly && showSaveAndCloseButton && (
              <Button
                type={programmaticSubmit ? "button" : "submit"}
                variant={
                  isSubmitting || isDeleting
                    ? "muted"
                    : "gradient"
                }
                disabled={isSubmitting || isDeleting }
                className={cn(footerButtonClassName, saveAndCloseButtonClassName)}
                onClick={
                  programmaticSubmit
                    ? handleProgrammaticSaveAndClose
                    : handleSaveAndClose
                }
              >
                {isSubmitting && isSaveAndClose
                  ? "Saving..."
                  : saveAndCloseLabel}
              </Button>
            )}
          </div>
        </div>
  );

  return (
    <>
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={deleteConfirmTitle}
        description={deleteConfirmDescription}
        itemType={itemType}
      />

      {inline ? (
        <div className="shrink-0 border-t bg-background px-2 py-3">{content}</div>
      ) : (
        <FixedActionBar>{content}</FixedActionBar>
      )}
    </>
  );
};

export default FormFooter;

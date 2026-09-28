import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Capitalize the first character of each word (e.g. "client item" → "Client Item"). */
export function capitalizeEachWord(str: string | undefined): string {
  if (str == null || str === "") return "";
  return str
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}


export function statusUpdateMessage(
  updatedCount: number,
  entityName: string,
  isActive: boolean,
  isSingleRecord = false,
): { type: "success" | "info"; message: string } {
  const status = isActive ? "Active" : "Inactive";
  const entity = capitalizeEachWord(entityName) || entityName;
  if (updatedCount === 0) {
    return {
      type: "info",
      message: isSingleRecord
        ? `${entity} is already ${status}.`
        : `The selected ${entityName}(s) are already ${status}.`,
    };
  }
  if (updatedCount === 1 || isSingleRecord) {
    return {
      type: "success",
      message: `${entity} marked as ${status}.`,
    };
  }
  return {
    type: "success",
    message: `The selected ${entityName}(s) have been marked as ${status}.`,
  };
}

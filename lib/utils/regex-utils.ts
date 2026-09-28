import { phoneRegex } from "@/app/(auth)/regex-utils";

export const isValidPhoneNumber = (value: unknown) => {
  if (value == null) return true;
  const s = String(value);
  if (s.trim() === "") return true;
  return phoneRegex.test(s);
};

export const zipRegex = /^\d{5}(-\d{4})?$/;

export const isValidZipCode = (value: unknown) => {
  if (value == null) return true;
  const s = String(value);
  if (s.trim() === "") return true;
  return zipRegex.test(s);
};
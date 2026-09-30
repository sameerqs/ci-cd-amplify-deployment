import { cn } from '@/lib/utils';

/** Shared shell for select triggers, combobox groups, and similar pickers. */
export const formControlSurfaceClassName = cn(
  'border-input rounded-full border bg-card shadow-xs',
  'transition-[color,box-shadow,border-color] outline-none',
  'hover:border-ring/50',
  'dark:bg-input/30 dark:hover:bg-input/50',
  'has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]',
  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
  'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
);

export const formControlDisabledClassName = cn(
  'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 disabled:hover:border-inherit',
);

/** When the inner control is disabled (explicit prop or fieldset), mute the group shell. */
export const formControlGroupDisabledClassName = cn(
  'has-[[data-slot=input-group-control]:disabled]:pointer-events-none',
  'has-[[data-slot=input-group-control]:disabled]:cursor-not-allowed',
  'has-[[data-slot=input-group-control]:disabled]:bg-muted',
  'has-[[data-slot=input-group-control]:disabled]:opacity-50',
  'has-[[data-slot=input-group-control]:disabled]:hover:border-inherit',
);

export const formControlHeightClassName =
  'h-[var(--density-control-height)] min-h-[var(--density-control-height)]';

import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

const controlClasses =
  "h-11 w-full rounded-lg border bg-card px-3 text-base text-foreground transition-[border-color] duration-150 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-expense";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
};

/** Etiqueta siempre visible, ayuda debajo y error junto al campo. */
export function Field({
  label,
  hint,
  error,
  className,
  ...props
}: ComponentProps<"input"> & FieldProps) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-desc` : undefined}
        className={controlClasses}
        {...props}
      />
      {(error || hint) && (
        <p
          id={`${id}-desc`}
          className={cn("text-[13px]", error ? "text-expense" : "text-muted-foreground")}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  className,
  children,
  ...props
}: ComponentProps<"select"> & Omit<FieldProps, "error">) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} className={controlClasses} {...props}>
        {children}
      </select>
      {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

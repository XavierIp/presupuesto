"use client";

import { cn } from "@/lib/cn";

/** Selector segmentado accesible (radios nativos con estilo de botones). */
export function Segmented({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "pressable flex h-10 cursor-pointer items-center justify-center rounded-md px-2 text-center text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
            value === option.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

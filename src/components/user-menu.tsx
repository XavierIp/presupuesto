import { getCurrentUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export async function UserMenu() {
  const user = await getCurrentUser();
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold"
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>
      </div>
      <SignOutButton />
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="size-9 rounded-full bg-muted" />
      <div className="grid flex-1 gap-1.5">
        <span className="h-3 w-24 rounded bg-muted" />
        <span className="h-3 w-32 rounded bg-muted" />
      </div>
    </div>
  );
}

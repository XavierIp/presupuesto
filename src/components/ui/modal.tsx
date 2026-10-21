"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { buttonClasses } from "./button";

const ModalContext = createContext<{ close: () => void } | null>(null);

/** Cierra el modal que contiene al componente (p. ej. tras guardar un formulario). */
export function useModal() {
  const ctx = use(ModalContext);
  if (!ctx) throw new Error("useModal debe usarse dentro de <Modal>");
  return ctx;
}

type TriggerProps = {
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  label: React.ReactNode;
  ariaLabel?: string;
};

/**
 * Modal sobre <dialog> nativo: foco atrapado, Escape y fondo gratis.
 * La animación vive en `.modal` (globals.css): centrado en escritorio, hoja inferior en móvil.
 */
export function Modal({
  title,
  description,
  trigger,
  children,
  openParam,
}: {
  title: string;
  description?: string;
  trigger: TriggerProps;
  children: React.ReactNode;
  /** Si la URL trae este parámetro (p. ej. `?nuevo=1`), el modal se abre solo y al cerrarlo se quita. */
  openParam?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        aria-label={trigger.ariaLabel}
        className={buttonClasses({
          variant: trigger.variant ?? "primary",
          className: trigger.className,
        })}
        onClick={() => ref.current?.showModal()}
      >
        {trigger.label}
      </button>
      {openParam && <OpenFromUrl param={openParam} dialog={ref} />}
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="modal border bg-card p-0 text-foreground shadow-xl"
        onClick={(e) => {
          // Clic en el fondo (fuera del contenido) cierra el modal.
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="grid gap-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <h2
                id={titleId}
                className="text-[22px] font-semibold tracking-[-0.01em]"
              >
                {title}
              </h2>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="pressable -mt-1 -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <ModalContext value={{ close }}>{children}</ModalContext>
        </div>
      </dialog>
    </>
  );
}

/** Abre el modal si la URL trae `param` y lo quita de la URL al cerrarlo. */
function OpenFromUrl({
  param,
  dialog,
}: {
  param: string;
  dialog: React.RefObject<HTMLDialogElement | null>;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.has(param);

  useEffect(() => {
    const el = dialog.current;
    if (!el || !requested) return;
    if (!el.open) el.showModal();
    const onClose = () => {
      const next = new URLSearchParams(window.location.search);
      next.delete(param);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    };
    el.addEventListener("close", onClose, { once: true });
    return () => el.removeEventListener("close", onClose);
  }, [requested, dialog, param, pathname, router]);

  return null;
}

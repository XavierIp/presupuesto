"use client";

import { useActionState, useRef } from "react";
import { toast } from "sonner";
import type { FormState } from "@/app/(app)/actions";
import { useModal } from "@/components/ui/modal";

/**
 * Conecta un formulario a una Server Action: al guardar, avisa, limpia y cierra el modal.
 * El aviso se lanza en cuanto responde la acción (no en un efecto), porque el refresco
 * posterior puede desmontar el formulario — p. ej. la fila "Pagar" pasa a "Pagado".
 */
export function useModalFormAction(
  action: (prev: FormState, formData: FormData) => Promise<FormState>,
  successMessage: string,
) {
  const modal = useModal();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result.ok) {
      toast.success(successMessage);
      formRef.current?.reset();
      modal.close();
    } else if (result.error) {
      toast.error(result.error);
    }
    return result;
  }, { ok: false });

  return { state, formAction, pending, formRef };
}

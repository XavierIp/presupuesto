"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { completeDni, type FormState } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cleanDni } from "@/lib/dni";

export function DniForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(completeDni, { ok: false });

  useEffect(() => {
    if (state.ok) toast.success("DNI guardado");
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-start gap-3" noValidate>
      <Field
        label="DNI"
        name="dni"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        required
        className="w-full max-w-[220px]"
        error={state.fieldErrors?.dni}
        onChange={(e) => {
          e.currentTarget.value = cleanDni(e.currentTarget.value);
        }}
      />
      <Button type="submit" disabled={pending} className="sm:mt-[26px]">
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Guardar DNI
      </Button>
    </form>
  );
}

import { z } from "zod";

/**
 * Campos de update MCP: omitir = não alterar; `null` = limpar no banco; valor = setar.
 * Diferente dos preprocessors de formulário que convertem null → undefined.
 */
export function mcpClearableUuid(): z.ZodOptional<
  z.ZodUnion<readonly [z.ZodString, z.ZodNull]>
> {
  return z.union([z.string().uuid("UUID inválido."), z.null()]).optional();
}

export function mcpClearableDate(): z.ZodOptional<
  z.ZodUnion<readonly [z.ZodString, z.ZodNull]>
> {
  return z
    .union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)."),
      z.null(),
    ])
    .optional();
}

export function mcpClearableIsoDateTime(): z.ZodOptional<
  z.ZodUnion<readonly [z.ZodString, z.ZodNull]>
> {
  return z.union([z.string().min(1), z.null()]).optional();
}

export function mcpClearableText(
  max: number,
): z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>> {
  return z.union([z.string().max(max), z.null()]).optional();
}

export function mcpClearableUuidList(): z.ZodOptional<
  z.ZodUnion<readonly [z.ZodArray<z.ZodString>, z.ZodNull]>
> {
  return z
    .union([z.array(z.string().uuid("UUID inválido.")), z.null()])
    .optional();
}

export function mcpClearableStringArray(): z.ZodOptional<
  z.ZodUnion<readonly [z.ZodArray<z.ZodString>, z.ZodNull]>
> {
  return z.union([z.array(z.string()), z.null()]).optional();
}

/** Aplica campo clearable ao patch Supabase (undefined = skip). */
export function applyClearable<T extends Record<string, unknown>>(
  patch: T,
  key: keyof T,
  value: unknown,
): void {
  if (value === undefined) return;
  (patch as Record<string, unknown>)[key as string] = value;
}

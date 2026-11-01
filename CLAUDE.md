# Cartivo

@AGENTS.md

## Comandos

- `pnpm dev` (127.0.0.1:5173) · `pnpm build` · `pnpm preview`
- `pnpm check` (tipos) · `pnpm lint` · `pnpm test` · `pnpm verify:core`
- `pnpm test:e2e` y `pnpm test:e2e:preview` cuando cambien Worker, audio o assets

## Cómo trabajar aquí

- Para cualquier incremento nuevo, entra en modo plan y usa la skill `cartivo-increment`.
- Para evaluar o integrar un núcleo, usa antes la skill `cartivo-core-gate`.
- AGENTS.md es la fuente de verdad de reglas; no dupliques reglas aquí.
- Nunca hagas push, abras PR ni cambies LICENSE, LICENSES.md o ADR-005 sin petición expresa.

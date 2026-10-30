# Fixtures legales y pruebas de regresión de emulación

**Estado:** estrategia de pruebas, **ninguna ROM incluida ni autorizada todavía**. Este documento evita descargar material de origen incierto y no modifica los tests de la PR #2.

## Reglas de procedencia

- Preferir crear **un homebrew propio** de Cartivo para cada prueba funcional; definir licencia explícita al crearlo.
- Un repositorio público de test ROMs **no** convierte automáticamente cada binario en redistribuible: revisar licencia, autor y aviso del **archivo individual**, y su versión/commit.
- Separar fuentes, toolchain, binarios y resultados; incluir SHA-256, pasos de build y copyright. Guardar solo lo autorizado; evitar cualquier ROM comercial, BIOS propietaria, key o juego sin permiso en Git, CI y artefactos.
- Una prueba privada de dump legalmente obtenido no da derecho a publicarlo; usar ruta local ignorada y no subir logs con rutas personales.
- Distinguir guardado de partida SRAM/Flash/Memory Card de *save state* del emulador.

## Fuentes de candidatos (no inclusión ni permiso verificado)

- [nes-test-roms de christopherpow](https://github.com/christopherpow/nes-test-roms): agregador de CPU/PPU/mappers. Auditar **cada subcarpeta y archivo**; seleccionar únicamente casos con origen y términos verificables.
- [NESdev Emulator Tests](https://www.nesdev.org/wiki/Emulator_tests): índice para localizar autoría/documentación; no implica licencia.
- [mGBA test suite](https://github.com/mgba-emu/mgba): explorar tests propios con sus licencias antes de copiar.
- Una fixture cartucho NES generada con nuestro propio programa simple (sin imágenes comerciales) permite verificar carga, entrada, audio y frames; otra prueba específicamente **battery-backed SRAM** debe escribir y releer progreso real.

## Manifiesto propuesto (ejemplo, valores vacíos hasta aprobación)

```yaml
fixture_id: nes-sram-homebrew-001
platform: nes
category: save-data
source_repository: null
source_commit: null
source_path: null
author: null
license_spdx: null
license_evidence_url: null
distribution_permission: pending  # approved/blocked/pending
build_toolchain: null
build_command: null
sha256: null
bytes: null
mapper: null
expected_behavior:
  - start_and_render
  - write_battery_ram
  - persist_close_reopen
  - export_import
ci_allowed: false
reviewer: null
```

## Plan incremental de casos

| ID | Plataforma | Qué demuestra | Oráculo de aprobación |
|---|---|---|---|
| REG-NES-01 | NES | Homebrew de arranque/CPU/PPU | Fotograma determinista o marcador verificable tras N frames |
| REG-NES-02 | NES | Teclado y mando | Entrada cambia estado visible; input release funciona |
| REG-NES-03 | NES | Audio | Se producen muestras válidas y audibles en prueba manual, sin underruns anómalos |
| REG-NES-04 | NES | **SRAM real** | El juego escribe valor, se termina proceso, se reabre y se confirma el valor |
| REG-NES-05 | NES | Export/import SRAM | Nuevo perfil restaura progreso tras importar |
| REG-NES-06 | NES | Desconexión / blur | Pausa y ningún botón permanece presionado |
| REG-NES-07 | NES | Offline | Shell, pack, fixture local reabren sin red y sin perder progreso |
| REG-NES-08 | NES | Update / rollback | Actualización no reinicia partida, migración de saves reversible |
| REG-ALL-01 | Multisistema | Corrupción, archivos demasiado grandes, formatos falsos | Errores explícitos sin enviar archivos ni bloquear UI |
| REG-ALL-02 | Multisistema | Identificación regional | Ediciones distintas no se fusionan por heurística |
| REG-ALL-03 | Multisistema | Capacidad de núcleo ausente | UI oculta o explica opción no implementada; no botones falsos |

Los tests de CPU/PPU/mappers/RTC/3D se añaden al aceptar cada núcleo; no simular su aprobación mediante mocks del shell. Los resultados de referencias upstream no son resultados de Cartivo.

## Gate FIXTURE-01

Antes de introducir cada binario: evidencia de licencia por archivo + hash y procedencia + prueba de reproducción + responsable. No almacenar fixtures en esta PR; únicamente se define el proceso. La primera ruta jugable exige al menos un fixture legal para boot/input/audio y otro con save data persistente demostrable, o un único fixture que cubra ambas condiciones.

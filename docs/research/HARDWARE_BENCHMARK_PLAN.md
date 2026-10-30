# Benchmarks de navegador y perfiles automáticos — protocolo reproducible

**Estado:** propuesta de instrumentación; **cero resultados medidos**. No es una promesa de fps, compatibilidad ni soporte universal.

## Objetivo

La UX empieza con `Automático` y no expone opciones técnicas innecesarias. Cartivo debe recomendar una configuración **segura por defecto** en función de *core + versión/build + juego + hardware + navegador*, sin alterar la velocidad emulada ni comprometer guardados. Cada optimización es reversible y debe demostrar beneficio.

## Grupos de hardware (categorías de ensayo, no detección infalible)

| Grupo | Ejemplo de clase | Qué se prueba |
|---|---|---|
| H-Low | Portátil antiguo, CPU eficiente/4–8 GB, GPU integrada | Ejecutar NES/GB/SNES sin throttling bajo modo original |
| H-Mid | Portátil actual gama media e iGPU | Múltiples filtros, PSP/N64 solo con evidencia por build |
| H-High | PC sobremesa con GPU dedicada | Escalado, 3D y laboratorio PS2 si la build permite |
| M-Android | Android de gama baja y media, térmicamente limitado | Memoria, suspensión, input BT y PWA |
| M-iOS | iPhone/iPad reciente con Safari PWA | Cuotas, suspensión, WebGL/audio, aislamiento real |
| A11y | Hardware con movimiento reducido/teclado | Input/UI y ausencia de degradación accesible |

No usar `navigator.hardwareConcurrency`, `deviceMemory` o `WEBGL_debug_renderer_info` como pruebas de rendimiento: son pistas, pueden faltar o estar limitadas por privacidad. Nunca exigir huellas de hardware ni subirlas por defecto.

## Metodología BENCH-01 por core/build/fixture

1. Registrar consentimiento y condiciones: modelo de equipo **sin identificadores únicos**, CPU/GPU aproximada si autorizada, RAM disponible si conocida, OS, browser, tab/PWA, modo energía, resolución y escala.
2. Anotar hash de fixture permitida, `core-id`, SHA, versión del toolchain, flags (`simd`/`threads`), renderer y ajustes aplicados.
3. Preparar dos situaciones: **cold start** sin pack cacheado y **warm start** con pack disponible. Medir por separado descarga, compilación, carga, primer fotograma, primer audio y primera entrada.
4. Calentar el emulador antes de la ventana de medida; medir como propuesta **3 repeticiones de 120 s** de un tramo de juego reproducible, sin prometer equivalencia exacta en móviles con throttling.
5. Medir velocidad real de la consola (no fps del display únicamente), frames emulados/presentados/perdidos, percentiles p50/p95/p99 de tiempos de frame, underruns/overruns de audio, input-to-frame donde exista instrumentación, GC/pausas y número de reinicios.
6. Estimar memoria por medios disponibles. `performance.memory` no está estandarizado, es solo Chromium y puede ignorar Workers; usar `measureUserAgentSpecificMemory` **solo cuando exista**, con permisos/aislamiento necesarios, y herramientas de navegador durante QA. Anotar `unavailable`, no inventar cero.
7. En móviles probar estabilidad térmica al menos 10 min, interrupción/recuperación, orientación, batería (cuando medible), reducción de refresco y cambios de pestaña. No extrapolar desde desktop.
8. Registrar resultados brutos (CSV/JSON), semilla/escenario, mediana y dispersión; comparar candidatos con igual fixture, equipo y condiciones. Ejecución web real, no mock.

[MDN Performance.memory](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory) · [Performance APIs](https://developer.mozilla.org/en-US/docs/Web/API/Performance).

## Esquema de resultados sugerido

```json
{
  "benchmarkSchemaVersion": 1,
  "coreId": "unset",
  "buildSha": "unset",
  "fixtureSha256": "unset",
  "environment": {
    "platformClass": "H-Low",
    "os": null, "browser": null, "mode": "tab",
    "renderer": null, "nativeResolution": null, "outputResolution": null
  },
  "settings": { "preset": "automatic" },
  "runs": [],
  "metrics": {
    "bootMs": null, "firstAudioMs": null,
    "speedRatioMedian": null, "frameTimeP95Ms": null,
    "audioUnderruns": null, "observedMemoryMiB": null
  },
  "result": "pending"
}
```

Los valores `null` denotan dato no disponible; el registro no es un benchmark ejecutado.

## Política de autoajuste propuesta (requiere medición)

- Al primer inicio: resolución **nativa** y aspect ratio correcto; audio adecuado y ajustes conservadores. No activar upscale ni filtros caros automáticamente sin perfil evaluado.
- Detectar capacidades **reales de build** (WASM SIMD, threading/COOP/COEP, WebGL2/WebGPU y memoria), no afirmar soporte general por versión de navegador.
- Al ejecutar: observar velocidad de emulación + audio + estabilidad, con histéresis; no bajar y subir ajustes cada segundo.
- Orden de degradación: efectos cosméticos → filtros/capas → resolución interna 3D cuando núcleo lo permite → alternativas del núcleo declaradas. **Nunca** sacrificar velocidad de juego o deshabilitar guardado como solución silenciosa.
- Un ajuste puede requerir reinicio de sesión; informar antes y conservar save data. Guardar elección manual por juego sin sobreescribirla con autoajuste.
- `Automático`, `Original`, `Mejorado` son etiquetas UX; capacidades no presentes se ocultan y no aparecen como botones inertes.

## Gates de aceptación

- BENCH-G0: instrumentación demuestra fuente de cada métrica; sin valores inventados ni `performance.memory` universal.
- BENCH-G1: NES en hardware objetivo reproduce fixture con velocidad/audio estables y resultados repetibles; umbrales se fijan con datos y ADR, no arbitrariamente.
- BENCH-G2: matriz multi-core validada en dos niveles de PC y móvil real cuando exista capacidad; no generalizar PS2 a todos los usuarios.
- BENCH-G3: regresión detecta cambios significativos en boot y frame pacing entre builds del mismo núcleo, con intervalos y condiciones; revisar antes de cambiar preset.
- No habilitar recolección remota identificable por defecto; consentimiento, minimización y borrado si se añade telemetría.

### Handoff

Astra conserva la implementación del Worker, el runtime y la API de performance. Esta PR solo define qué medir, cómo registrarlo y cómo decidir; **no añade scripts, dependencias ni contratos** al código H1.

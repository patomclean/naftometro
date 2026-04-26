# Naftometro — iOS/Safari Gotchas Resueltos

Lista de problemas específicos de iOS/Safari ya resueltos en versiones anteriores. **Antes de modificar código relacionado con scroll, layout o cache, leer esta lista.** Repetir un bug ya resuelto es el peor uso del tiempo.

## Texto vertical en celdas de fecha (v15.4)

**Síntoma**: en mobile, las fechas en `.trips-table` se renderizan letra por letra verticalmente.
**Causa**: `word-break: break-all` rompe en cada caracter en Safari.
**Solución**: usar `overflow-wrap: break-word` (NO `word-break`).

## Scroll no se reseteaba al cambiar de tab (v15.7)

**Síntoma**: al hacer swipe entre vistas, la nueva vista aparecía con el scroll donde había quedado.
**Causa**: las vistas comparten el viewport pero scroll independiente en mobile.
**Solución**: en cada `switchTab()`, hacer `view.scrollTo({ top: 0, behavior: 'instant' })` con un setTimeout de 150ms para que se ejecute después de la transición CSS.

## Safari ignora `flex-basis` en algunos contextos (v15.6-v15.7)

**Síntoma**: layouts con `flex: 1 1 50%` no se respetaban en iOS.
**Causa**: bug conocido de WebKit con flexbox + width %.
**Solución**: migrar esos layouts a CSS Grid (`display: grid; grid-template-columns: 1fr 1fr`).

## Scroll compartido entre las 3 vistas (v15.6-v15.8)

**Síntoma**: al scrollear en Home, el scroll de Detail también se movía.
**Causa**: las 3 vistas estaban en un container con `overflow-y: auto` único.
**Solución**: scroll independiente por vista, pero **solo en mobile** (`@media (max-width: 768px)`). En desktop el scroll natural anda mejor.

## Cache no se actualizaba en producción (v15.51)

**Síntoma**: usuarios PWA seguían viendo la versión vieja días después del deploy.
**Causa**: Service Worker cachea agresivo + Vercel CDN cachea estáticos.
**Solución triple**:
1. Query strings de versión en `index.html` (`style.css?v=18.14`)
2. Bump `CACHE_NAME` en `sw.js` cada release
3. `skipWaiting()` + `clients.claim()` en el SW
4. Headers en `vercel.json` con `must-revalidate` para todos los assets, `no-cache, no-store` específicamente para `sw.js`

## Viewport zoom accidental (v15.6)

**Síntoma**: al hacer doble tap en botones, el navegador zoomeaba.
**Solución**: en `<meta viewport>`, agregar `maximum-scale=1.0, user-scalable=no`.

## Touch targets demasiado chicos

**Regla iOS**: mínimo 44x44px para elementos tappables. `.btn-icon` ya cumple. Si agregás un botón nuevo, verificar.

## Notch / Dynamic Island

En `index.html` el meta `apple-mobile-web-app-status-bar-style="black-translucent"` y CSS con `padding-top: env(safe-area-inset-top)` en headers. Si agregás una nueva vista de pantalla completa, recordar el safe area.

## Inputs `type="datetime-local"` y zona horaria

**Síntoma**: la fecha guardada en DB difiere de la que el usuario eligió.
**Causa**: `datetime-local` devuelve string sin TZ, JS asume UTC al parsearlo.
**Solución**: tratar el valor como local time explícitamente al insertar a Supabase.

## Service Worker no se "actualiza" sin refresh manual

**Comportamiento normal**: el SW nuevo entra como "waiting" hasta que todas las pestañas se cierran. `skipWaiting()` lo fuerza a tomar control.

Si el usuario tiene la PWA "instalada" en el home screen, a veces necesita cerrar la app completamente (no solo minimizar) para que el SW nuevo entre.

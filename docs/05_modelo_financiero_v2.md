# Naftómetro — Modelo Financiero v2 (Documento de Diseño)

> **Estado:** Diseño consensuado, NO implementado. Este documento es la base a validar antes de programar nada.
> **Objetivo:** Reemplazar el modelo actual (PPP con revalúo + correction_factor) por un modelo **a costo, suma cero, transparente**, donde el que paga la nafta nunca pierde dinero.
> **Mockups visuales:** abrir `docs/mockups/modelo_v2_mockups.html` en el navegador para ver el UX/UI con el look real de la app.

---

## 1. Por qué cambiar el modelo

El modelo actual tiene 3 problemas detectados con datos reales (ver `docs/03` v18.15 y el análisis del vehículo Taos):

1. **No es suma cero en pesos.** La suma de balances ($30.824) ≠ valor físico del tanque ($83.490). Genera desconfianza.
2. **Revalúa la nafta vieja al precio nuevo** (promedio ponderado con markup). Poco transparente: "¿por qué mi nafta de ayer ahora vale más?".
3. **Los ajustes de reconciliación crean saldo de la nada** (`tank_audit_adjustment` suma +$82.269 en vez de 0).

**Principio rector del modelo nuevo:** *el que carga nafta recibe crédito por cada peso que puso, y solo se le debita por los km que él manejó. La nafta no consumida respalda su crédito. Al vaciarse el tanque, todo suma cero.*

---

## 2. El modelo "Pool a costo"

El tanque es **un solo pool** con dos números que se arrastran:
- `pool_litros` — litros que hay ahora en el tanque.
- `pool_costo` — lo que se pagó por esos litros (a costo, sin revalúo).

El **precio promedio** = `pool_costo / pool_litros`. Mezcla viejo y nuevo **a su costo real**; nunca marca para arriba la nafta vieja.

### 2.1 Las 3 acciones

**🛢️ Cargar nafta** (monto, litros, precio/l, [odómetro opcional], Factura A / descuento, [tanque lleno], fecha, nota, foto)
```
costo_efectivo = monto ± ajustes (Factura A encarece, descuento/reintegro abarata)
pool_litros += litros_cargados
pool_costo  += costo_efectivo          ← el pool usa el COSTO EFECTIVO, no el nominal
ledger: { driver: pagador, type: 'fuel_payment', amount: +monto_pagado }
```
> El modal **conserva todos los campos actuales** (Factura A, descuento, fecha/hora, nota, foto del ticket). El **odómetro es opcional**: si se deja vacío, la carga funciona igual; solo se pierde la mejora de precisión del km/l de ese ciclo. Factura A suma percepciones (encarece) y el descuento/reintegro abarata — ambos ajustan el costo efectivo que entra al pool.

**🚗 Registrar viaje** (km, piloto)
```
litros   = km / km_l_aprendido
costo    = litros * (pool_costo / pool_litros)
pool_litros -= litros
pool_costo  -= costo
ledger: { driver, type: 'trip_cost', amount: -costo }
```

**⛽ Tanque Lleno** (reconciliación — ver sección 4)
```
Al llenar a tope, el tanque físico = capacidad (ej. 50 L).
gap_litros = pool_litros (estimado) - capacidad
Si gap > 0  → se consumió nafta no registrada (viajes olvidados / km mal cargados)
Se redistribuye el costo del gap entre los viajes del ciclo (sección 4)
Se actualiza km_l_aprendido con el rinde real del ciclo
pool se reancla: pool_litros = capacidad
```

### 2.2 La garantía de suma cero

Invariante que se cumple **siempre**:
```
Σ (balances de todos los pilotos)  =  pool_costo  (valor del tanque a costo)
```
Cada peso que entra está, o cobrado a un viaje, o en el pool. Cuando `pool_litros → 0`, `pool_costo → 0` y la suma de balances → 0. **Nadie pierde.**

### 2.3 UI: Estado del tanque a costo
Ver mockup **D**. El tanque se muestra valuado **a costo** ($65.817 = lo que se pagó por los 26,7 L que quedan), con el desglose de quién aportó esa plata y la garantía de que la recuperan.

```
┌─────────────────────────────────────┐
│ ⛽ Tanque del Taos                   │
│ [████████████░░░░░░░░░]  26,7/50 L   │
│                    Costo prom: $2.461/L│
│ ─────────────────────────────────── │
│ Hay $65.817 de nafta, aportada por: │
│   🔴 PAPÁ ............... $40.500    │
│   🟣 Pato ............... $25.317    │
│ 🛡️ Respaldado: lo recuperan al      │
│    consumirse. No pueden perder.    │
└─────────────────────────────────────┘
```

---

## 3. El odómetro: ancla a la realidad física

El input manual más confiable del sistema es **el número de km del tablero**. Se agrega un campo **opcional** "Km del auto" en la carga de nafta.

### Qué resuelve
| Sin odómetro | Con odómetro |
|---|---|
| El km total depende de que carguen todos los viajes | El km total es dato físico (resta de odómetros) |
| El km/l se ensucia si falta un viaje | km/l exacto = `km tablero ÷ litros cargados` |
| El faltante se ve abstracto (litros/pesos) | El faltante se ve concreto: **"faltan 100 km"** |

La combinación **odómetro (verdad de km) + tanque lleno (verdad de litros)** clava la realidad física aunque los pilotos carguen viajes con imprecisión. Es lo que permite que el pagador "descanse" en la app.

> **El odómetro es OPCIONAL** (decisión de diseño). Una carga se puede registrar sin completarlo. Cuando se completa, la app calcula el rinde real del ciclo y mejora las estimaciones futuras; cuando no, se cae al estimador actual (km/l aprendido). Nunca bloquea la carga.

### UI: campo odómetro
Ver mockup **A**. Campo nuevo resaltado, con un hint que muestra el cálculo en vivo:

```
┌─────────────────────────────────────┐
│ ⛽ Cargar Nafta — PAPÁ               │
│ Monto total ($)   [ 79.995        ] │
│ Litros cargados   [ 32,5          ] │
│ Km del auto 🆕    [ 84.320        ] │  ← campo nuevo
│ 🔋 Tanque lleno              [ ON ] │
│ ┌─────────────────────────────────┐ │
│ │ 📊 Odómetro anterior 84.070 →   │ │
│ │ recorriste 250 km con ~24,9 L.  │ │
│ │ Rinde real: 10,04 km/l.         │ │
│ └─────────────────────────────────┘ │
│         [ Registrar carga ]         │
└─────────────────────────────────────┘
```

---

## 4. Reconciliación de 3 niveles (avisar → reclamar → repartir)

Cuando el Tanque Lleno detecta un faltante, el reparto parejo es el **último** recurso, no el primero:

1. **Avisar** — la app muestra el faltante en km concreto: *"Faltan ~100 km (~10 L, ~$24.600)"*.
2. **Reclamar** — se ofrece agregar el viaje olvidado para atribuirlo a quien corresponde (cero subsidio). Opcional: avisar al grupo por WhatsApp (`wa.me`, sin backend).
3. **Repartir** — solo si nadie reclama: se distribuye el costo del faltante entre los viajes del ciclo **proporcional a los km** (Decisión B). En el futuro, ponderable por eficiencia (Waze/Maps).

### Por qué importa el orden
Repartir por km es "justo según uso" pero **injusto en atribución**: si un piloto olvida un viaje, los otros lo subsidian (ver ejemplo sección 6). El paso "reclamar" evita eso cuando alguien efectivamente manejó.

### ¿Dónde aparece el aviso? (3 momentos — mockup E)
Para que no se pierda, el faltante se muestra en 3 lugares:
1. **Modal automático** apenas se guarda un "Tanque lleno" que cierra el ciclo (el momento natural).
2. **Banner persistente** arriba de la vista del vehículo (*"Reconciliación pendiente — faltan ~100 km · [Resolver]"*) hasta que alguien lo resuelva.
3. **Evento en el feed de Finanzas** como registro histórico.

### UI: alerta de reconciliación
Ver mockup **C** (la alerta) y **E** (dónde se ubica en la app).

```
┌─────────────────────────────────────┐
│ [1·Avisar] [2·Reclamar] [3·Repartir]│
│ ⚠️ Faltan kilómetros sin cargar     │
│ ┌─────────────────────────────────┐ │
│ │ El auto recorrió  +100 km       │ │
│ │ más de lo registrado            │ │
│ │ ≈ 10 L · ≈ $24.600              │ │
│ └─────────────────────────────────┘ │
│ [ ➕ Agregar el viaje olvidado ]    │
│ [ 🟢 Avisar al grupo (WhatsApp) ]   │
│ [ ⚖️ Repartir entre todos por km ]  │
└─────────────────────────────────────┘
```

---

## 5. Transparencia: cada peso con su explicación

Suma cero genera confianza solo si se **ve** por qué cambió el saldo. Cada piloto es **una fila desplegable**: se toca el nombre para abrir/cerrar su detalle (mockup **B**), evitando la saturación de líneas cuando hay muchos pilotos. Abierto, muestra las líneas explicadas, no un número mágico:

```
┌─────────────────────────────────────┐
│ 🔵 Marcos · 18 viajes · 1.124 km    │
│ 💰 Cargó nafta ............ +177.031 │
│ 🚗 Manejó (su consumo) .... −154.342 │
│ ⚖️ Ajuste: km sin cargar ... −17.680 │
│ ─────────────────────────────────── │
│ Balance .................. −$104.991 │
└─────────────────────────────────────┘
```

---

## 6. Ejemplos numéricos

### 6.1 Viaje olvidado, un solo piloto (caso limpio)
- Tanque lleno: 40 L a $2.000/L = $80.000 (PAPÁ). PAPÁ **+80.000**.
- Marcos maneja 100 km, los carga (10 km/l → 10 L → $20.000). Marcos **−20.000**.
- Marcos maneja otros 100 km y **se olvida** (gasta otros 10 L reales).
- PAPÁ rellena: carga 20 L a $2.200 = $44.000. PAPÁ **+44.000** (total +124.000).
  - Pool cree 50 L pero físico = 40 → **faltan 10 L** ≈ $20.800.
  - Solo Marcos manejó → Marcos absorbe todo: **−20.800** (total −40.800).
- **Resultado:** PAPÁ +83.200 = valor del tanque. Marcos −40.800 por sus 200 km reales. Suma = tanque. ✅

### 6.2 Viaje olvidado, 3 pilotos (la injusticia que evita el paso "reclamar")
- Logueado: A 100 km, B 100 km, C 100 km. A además olvidó 100 km.
- Faltan 10 L ≈ $20.000, repartido por km logueados (parejo) = **$6.667 c/u**.

| Piloto | Manejó real | Paga |
|---|---:|---:|
| A (olvidó) | 200 km | $26.667 |
| B (ok) | 100 km | $26.667 |
| C (ok) | 100 km | $26.667 |

A manejó el doble pero los 3 pagan igual → B y C subsidian a A con $6.667 c/u. **Por eso el paso "reclamar" (que A agregue su viaje) es clave: con odómetro, la app detecta los 100 km faltantes y los hace reclamables.**

### 6.3 Datos reales del Taos (estado actual, modelo viejo)
Para referencia de migración:
- `current_ppp` $2.461,38 · tanque real 26,74 L · valor a costo ≈ $65.817
- Balances: PAPÁ +137.888 · Pato +122.705 · Marcos −87.463 · Rafa −72.199 · Feli −57.545 · Belu −12.562
- Suma actual: +$30.824 (NO cero — el modelo viejo no cierra). El modelo v2 haría que esta suma = valor del tanque siempre.

---

## 7. Notificaciones (decidido: fase por fases)

**Fase 1 (sin infra nueva):**
- **Nivel 0:** aviso in-app al detectar faltante en Tanque Lleno.
- **Nivel 1:** botón "Avisar al grupo" → abre WhatsApp con mensaje pre-armado (`wa.me`, manual, sin backend).

**Fase 2 (futuro, requiere Supabase Edge Functions):**
- Email automático (Edge Function + proveedor tipo Resend).
- Push notifications (Web Push + VAPID).
- Cron de auto-reparto pasado el deadline (`pg_cron` / Edge Function agendada).
- Eventualmente WhatsApp Business API.

> Hoy la app es 100% cliente + Supabase, **sin servidor propio**. La Fase 2 introduce Edge Functions como pieza arquitectónica nueva.

---

## 8. Implicancias técnicas y plan de migración (Decisión C)

### Cambios de modelo
- `vehicles`: `current_ppp` + `virtual_liters` pasan a representar `pool_costo` + `pool_litros` (o columnas nuevas). **Una sola fuente de verdad** (elimina el bug "virtual_liters guardado ≠ calculateTankLevel").
- Nuevo campo opcional `odometer` en `payments` (o tabla aparte de lecturas).
- `tank_audit_adjustment` cambia de semántica: ahora **suma cero** (pura redistribución).
- `correction_factor` se reemplaza por `km_l_aprendido` (promedio móvil del rinde real).

### Migración de datos existentes — 2 opciones
1. **Recalcular toda la historia** con el modelo nuevo (riesgoso, el ledger es append-only; habría que reconstruir entradas).
2. **Trazar una línea** ("borrón y cuenta nueva"): cerrar saldos actuales con una entrada `opening_balance` y arrancar el pool desde el próximo tanque lleno. Más simple y seguro. **Recomendada.**

### Riesgo
Es el **corazón financiero** de la app. Requiere: tests de la invariante de suma cero, validación con datos reales, y despliegue cuidadoso. NO improvisar.

---

## 9. Checklist de validación antes de implementar
- [ ] ¿El modelo de pool refleja lo acordado? (sección 2)
- [ ] ¿El campo odómetro y su UX están claros? (sección 3, mockup A)
- [ ] ¿El flujo de 3 niveles es el deseado? (sección 4, mockup C)
- [ ] ¿La presentación transparente del balance convence? (sección 5, mockup B)
- [ ] ¿Migración por "línea nueva" o recálculo completo? (sección 8)
- [ ] ¿Capacidad real del tanque del Taos confirmada (50 L)?

---

*Documento de diseño v1 — Junio 2026. Asociado a la discusión de modelo financiero post-v18.15. Sin implementar.*

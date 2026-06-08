# Naftometro - Logica de Negocio

---

## MAPA DE FLUJOS — Los 3 Caminos Principales

Naftometro tiene tres flujos independientes que resuelven problemas distintos. Confundirlos es el error mas frecuente al analizar la app. Este mapa es la referencia canonica.

---

### FLUJO A: "Estimado → Verificado" (Reconciliacion de Viajes)

**Problema que resuelve:** Los costos de viaje se calculan con consumo *teorico*. El consumo real varia. Este flujo corrige retroactivamente los costos cuando hay datos reales.

**Actores:** Viajes (tabla `trips`) + Cargas de combustible (tabla `payments`) + Vehiculo (`vehicles.correction_factor`)

**Disparador:** El piloto marca una carga como **"Tanque lleno"** y ya existe un tanque lleno anterior (ciclo cerrado).

**Mecanismo:** `performTankAudit()` calcula el factor de desviacion real/estimado y recalcula `liters` y `cost` en cada trip del ciclo.

**Resultado visible:**
- Badge **checkmark verde** (✓) en la fila del viaje → significa "este costo es real, no estimado"
- Los viajes sin reconciliar muestran un badge gris **"Estimado"** (clickeable, explica que es aproximado)
- El campo `vehicles.correction_factor` se actualiza para mejorar estimaciones futuras

**Resultado en el ledger:** Entradas de tipo `tank_audit_adjustment` que ajustan la diferencia de costo por piloto.

**Metafora correcta:** *"El viaje pasa de ser una estimacion a tener el sello de auditoria."* / *"Del presupuesto a la factura real."*

**NO confundir con:** El saldo de deudas entre pilotos. Reconciliar un viaje no implica que alguien le pague a alguien — solo corrige el numero del costo.

---

### FLUJO B: "Deuda → Saldado" (Settlement entre Pilotos)

**Problema que resuelve:** Con el tiempo, un piloto puede haber cargado mas nafta de la que consumio (saldo positivo) y otro puede haber consumido mas de lo que cargo (saldo negativo). Este flujo transfiere dinero real entre pilotos para equilibrar.

**Actores:** Ledger (tabla `ledger`) + Usuarios autenticados + Smart Card

**Disparador:** El usuario toca **"Saldar"** en su Smart Card (solo visible cuando su balance es negativo).

**Mecanismo:** `handleSettleDebtSubmit()` inserta **dos entradas** en el ledger (contabilidad de doble entrada):
- `{ driver: pagador, type: 'transfer', amount: +monto }` — el deudor gana credito (su deuda disminuye)
- `{ driver: acreedor, type: 'transfer', amount: -monto }` — el acreedor pierde credito (cobra)

**Resultado visible:**
- **Smart Card** del pagador: pasa de *"Debes $X"* (clase `.debt`, borde rojo) a *"Estas al dia"* (neutral)
- **Activity Feed** (tab Finanzas): aparece el evento con descripcion *"Pago a [Piloto]"* y *"Cobro de [Piloto]"*
- El evento queda registrado como `debt_settled` en `audit_logs`

**Resultado en el ledger:** Dos entradas de tipo `transfer`. La suma de ambas es cero (invariante de doble entrada).

**Metafora correcta:** *"La deuda se convierte en un check verde de tranquilidad."* / *"Del rojo al equilibrio."*

**NO confundir con:** La reconciliacion de viajes. Saldar una deuda no cambia ningun costo de viaje ni modifica el `correction_factor` — solo reequilibra los saldos monetarios entre personas.

---

### FLUJO C: "Desconocido → Vinculado" (Identity Claim)

**Problema que resuelve:** Los pilotos son nombres de texto libre en `vehicles.drivers[]`. La app no sabe automaticamente que usuario de auth corresponde a que nombre de piloto.

**Actores:** `auth.users` + `vehicle_driver_mappings` + Smart Card

**Disparador:** El usuario se loguea y abre un vehiculo donde su nombre no esta mapeado.

**Mecanismo:** `openClaimIdentityModal()` muestra los pilotos sin dueno. El usuario toca su nombre → `insertDriverMapping()`.

**Resultado visible:**
- La **Smart Card** se activa (antes estaba oculta) mostrando el saldo personal del usuario
- El boton "Saldar" aparece si el balance es negativo
- El usuario puede acceder al Flujo B

**Metafora correcta:** *"El piloto pone su nombre en el asiento."* / *"De anonimo a protagonista."*

---

## Tabla Comparativa de los 3 Flujos

| | Flujo A: Reconciliacion | Flujo B: Settlement | Flujo C: Identity Claim |
|---|---|---|---|
| **Problema** | Costos inexactos | Deudas sin saldar | Usuario sin identidad |
| **Disparador** | Tanque lleno (ciclo) | Boton "Saldar" en Smart Card | Primer login en vehiculo |
| **Tabla principal** | `trips` (UPDATE) | `ledger` (INSERT x2) | `vehicle_driver_mappings` (INSERT) |
| **Ledger entry type** | `tank_audit_adjustment` | `transfer` | — (no usa ledger) |
| **Resultado visible** | Badge ✓ verde en viaje | Smart Card "Estas al dia" | Smart Card se activa |
| **Afecta costos?** | SI — recalcula `trips.cost` | NO | NO |
| **Afecta saldos?** | SI — por el ajuste de costo | SI — transferencia directa | NO (pero los revela) |
| **Es reversible?** | NO (ledger inmutable) | NO (ledger inmutable) | SI (se puede borrar el mapping) |

---

## Glosario de Terminos Criticos

| Termino | Definicion exacta | Contexto unico |
|---------|------------------|----------------|
| **"Estimado"** (badge gris) | Costo de viaje calculado con consumo teorico, aun no ajustado por datos reales | Flujo A — viajes |
| **"Verificado"** (badge ✓ verde) | Costo de viaje ajustado por reconciliacion de tanque lleno | Flujo A — viajes |
| **"Estas al dia"** (Smart Card neutral) | El balance personal del usuario es 0 o cercano a 0 | Flujo B — saldos |
| **"Debes plata"** (Smart Card roja) | El usuario consumio mas nafta de la que cargo | Flujo B — saldos |
| **"Te deben plata"** (Smart Card verde) | El usuario cargo mas nafta de la que consumio | Flujo B — saldos |
| **`transfer`** (ledger) | Entrada de doble entrada contable al saldar una deuda entre pilotos | Flujo B unicamente |
| **`tank_audit_adjustment`** (ledger) | Ajuste de costo post-reconciliacion, proporcional a los km de cada piloto | Flujo A unicamente |
| **`correction_factor`** | Multiplicador en el vehiculo que ajusta consumo teorico al real historico | Flujo A unicamente |
| **`is_reconciled`** | Flag en un trip que indica que su costo fue verificado con datos reales | Flujo A unicamente |
| **Clearing / Liquidacion sugerida** | Algoritmo greedy que calcula las transferencias MINIMAS para equilibrar saldos | Flujo B — paso previo al settlement |
| **PPP** (Precio Promedio Ponderado) | Precio del litro en el tanque, calculado ponderando cargas anteriores con la nueva | Independiente (afecta calculos de Flujo A) |

---

## Resumen del Problema

Multiples conductores ("pilotos") comparten un vehiculo. Cada piloto carga combustible y realiza viajes. La app necesita:

1. Calcular cuanto combustible consumio cada piloto
2. Calcular cuanto pago cada piloto en combustible
3. Determinar quien le debe a quien y cuanto
4. Conciliar estimaciones con datos reales cuando se llena el tanque
5. Mantener un libro contable inmutable como unica fuente de verdad (v17+)
6. Permitir que cada usuario sepa su saldo personal en tiempo real (v18.5+)

---

## 1. Calculo del Costo de un Viaje

### Formula Base

```
Litros consumidos = km / consumo (km/l)
Costo del viaje = litros consumidos * precio del combustible ($/l)
```

### Consumo segun Tipo de Manejo

Cada vehiculo tiene 3 tasas de consumo basadas en su modelo (desde VEHICLE_DATABASE):

| Tipo | Descripcion | Ejemplo (VW Gol 1.6) |
|------|-------------|----------------------|
| Urbano | Ciudad, trafico, muchas frenadas | 10.5 km/l |
| Mixto | Combinado ciudad + ruta | 12.5 km/l |
| Ruta | Autopista, velocidad constante | 15.0 km/l |

La funcion `getConsumptionForDriveType(vehicle, driveType)` selecciona la tasa correcta del `VEHICLE_DATABASE`. Si el modelo no esta en la base de datos, usa el consumo manual del vehiculo (`vehicle.consumption`).

### Precio del Combustible (PPP — Precio Promedio Ponderado)

Desde v17, el precio se toma del campo `vehicles.current_ppp` que se actualiza de forma persistente en Supabase. La funcion `getLatestFuelPrice(vehicle)` obtiene el precio mas reciente:

1. Usa `vehicle.current_ppp` si existe y es mayor a cero
2. Fallback: busca el `price_per_liter` del pago mas reciente con precio
3. Ultimo fallback: usa el `fuel_price` del vehiculo (precio de referencia manual)

### Ejemplo Completo

```
Viaje: 50 km en modo Urbano
Vehiculo: VW Gol Trend 1.6 (urbano = 10.5 km/l)
Precio nafta: $1,200/l

Litros = 50 / 10.5 = 4.76 litros
Costo = 4.76 * $1,200 = $5,714.29
```

### Impacto del correction_factor (v17)

Desde v17, el calculo real usa el `correction_factor` del vehiculo, que multiplica el consumo teorico para acercarlo al real historico acumulado:

```
consumo_ajustado = consumo_teorico_por_tipo * correction_factor
litros = km / consumo_ajustado
costo = litros * current_ppp
```

- `correction_factor = 1.0` → consumo identico al teorico
- `correction_factor = 1.094` → 9.4% mas consumo que el teorico

---

## 2. Precio Ponderado del Combustible (PPP)

Cuando se carga combustible, el precio del vehiculo se actualiza con un promedio ponderado que considera el combustible ya existente en el tanque:

### Formula

```
nuevo_ppp = (litros_virtuales_actuales * ppp_actual + monto_pagado) / (litros_virtuales_actuales + litros_nuevos)
```

Este valor se guarda como `vehicles.current_ppp` en la base de datos (persistente).

### Ejemplo

```
Tanque actual: 20 litros a $1,100/l (virtual_liters = 20, current_ppp = 1100)
Nueva carga: $30,000 por 25 litros ($1,200/l)

nuevo_ppp = (20 * 1100 + 30000) / (20 + 25)
nuevo_ppp = (22000 + 30000) / 45
nuevo_ppp = $1,155.56/l

Nuevo virtual_liters = 20 + 25 = 45
```

### Guardas defensivas del PPP (v18.15)

El promedio ponderado depende de `virtual_liters` y `current_ppp`, dos campos *derivados* que se persisten en `vehicles`. Si alguno se corrompe, el promedio se rompe (ver incidente v18.15: un `virtual_liters` de 80.091 hundio el PPP a ~$3). Por eso `handlePaymentSubmit()` aplica 3 guardas antes y despues de calcular el nuevo PPP:

1. **Clamp de `oldLiters`** — los litros previos se limitan a `[0, capacidad]` con `clampTankLiters()`. Un `virtual_liters` corrupto ya no puede dominar el promedio.
2. **Saneo de `oldPPP`** — si el PPP guardado es basura (menor al 10% del precio de la carga actual), no se usa para el blend; se asume que el combustible existente se compro a precio de mercado.
3. **Piso de `newPPP`** — si el resultado queda por debajo del 20% del precio de la carga, se usa directamente el precio de la carga.

Las 3 guardas son **inertes en operacion normal**: el promedio de dos precios realistas siempre cae entre ellos, lejos de los umbrales. Solo se activan ante valores imposibles.

---

## 3. Tanque Virtual

La app mantiene un "tanque virtual" que estima cuantos litros hay en el vehiculo en tiempo real. Desde v17, los litros virtuales se guardan como `vehicles.virtual_liters`.

### Algoritmo (`calculateTankLevel()`)

**Con punto de referencia (tanque lleno):**
1. Busca la ultima carga marcada como "Tanque lleno"
2. Parte de la capacidad total del tanque (del VEHICLE_DATABASE)
3. Suma las cargas posteriores (litros cargados)
4. Resta los viajes posteriores (litros consumidos)

```
nivel = capacidad_tanque
      + sum(cargas_posteriores.litros)
      - sum(viajes_posteriores.litros)
```

**Sin punto de referencia (fallback):**
```
nivel = sum(todas_las_cargas.litros) - sum(todos_los_viajes.litros)
```

**Cap a capacidad (v18.15):** el resultado se limita con `Math.min(nivel, capacidad_tanque)` — un tanque fisico no puede superar su capacidad. Esto corrige el sintoma visual "52/50 lts".

### Mantenimiento de `virtual_liters` (v17+, guardas v18.15)

Ademas del calculo on-the-fly de `calculateTankLevel()`, la app persiste `vehicles.virtual_liters` y lo actualiza incrementalmente:
- **Registrar viaje** (`handleTripSubmit`): resta los litros consumidos.
- **Registrar carga** (`handlePaymentSubmit`): suma los litros cargados (o resetea a capacidad si es tanque lleno).
- **Borrar viaje** (`handleDeleteTrip`): **devuelve los litros del viaje al tanque** (corregido en v18.15 — antes no lo hacia, causando el descuadre raiz del incidente v18.15).

Los 3 writes pasan por `clampTankLiters(vehicle, litros)`, que limita el valor a `[0, capacidad]`. Asi un valor corrupto no se puede persistir ni propagar al promedio ponderado del PPP.

### Capital del Tanque (v15.1)

Calcula el valor monetario del combustible en el tanque y lo atribuye a quien lo pago:

```
capital = nivel_tanque * precio_actual (current_ppp)
```

Muestra: "El auto tiene X litros valorados en $Y que fueron pagados por [nombres]"

La atribucion identifica los pilotos que cargaron combustible desde el ultimo tanque lleno hasta el momento actual.

---

## 4. Sistema de Ledger — Libro Contable (v17+)

### Concepto

Desde v17, el sistema de balances se basa en un libro contable **inmutable y append-only**. Cada operacion financiera genera una o mas entradas en la tabla `ledger`. El saldo de un piloto es siempre la suma de todas sus entradas.

```
Balance del piloto = SUM(ledger WHERE driver = piloto AND vehicle_id = vehiculo)
```

Positivo → le deben plata
Negativo → debe plata

### Tipos de Entradas en el Ledger

| type | Cuando se inserta | amount | Descripcion |
|------|------------------|--------|-------------|
| `fuel_payment` | Al registrar una carga de combustible | `+amount` (credito) | "Carga de nafta $XXX" |
| `trip_cost` | Al registrar un viaje | `-cost` (debito) | "Viaje XXkm" |
| `tank_audit_adjustment` | Al reconciliar un ciclo de tanque lleno | diferencia ajuste | "Ajuste reconciliacion +/-$X" |
| `transfer` | Al saldar una deuda (v18.6) | `+amount` (pagador) / `-amount` (acreedor) | "Pago a X" / "Cobro de X" |
| `opening_balance` | Al migrar vehiculos legacy | neto historico | "Saldo migrado desde sistema legacy v16" |

### Contabilidad de Doble Entrada (Settle Debt)

Al saldar una deuda, se crean DOS entradas en el ledger (partida doble):

```javascript
// Entrada 1: el pagador recibe credito (su deuda disminuye)
{ driver: myDriverName, type: 'transfer', amount: +amount, description: `Pago a ${creditor}` }

// Entrada 2: el acreedor pierde credito (su saldo positivo disminuye)
{ driver: creditor, type: 'transfer', amount: -amount, description: `Cobro de ${myDriverName}` }
```

Esto mantiene la invariante: la suma de todos los balances siempre es 0 (o cercana a 0 por diferencias de reconciliacion).

### Cascade al Eliminar (v18.4)

Cuando se elimina un trip o payment, los ledger entries relacionados se eliminan automaticamente via trigger BEFORE DELETE en PostgreSQL:

- Eliminar trip → elimina ledger entries con `type='trip_cost'` y `ref_id=trip.id`
- Eliminar payment → elimina ledger entries con `type IN ('fuel_payment','transfer')` y `ref_id=payment.id`

### Migracion de Vehiculos Legacy (v17)

Los vehiculos creados antes de v17 no tienen entradas en el ledger. Al cargarlos por primera vez, `migrateToLedger()` calcula el balance neto historico de cada piloto y crea una entrada `opening_balance`:

```javascript
net = sum(payments.amount para el piloto) - sum(trips.cost para el piloto)
// Se inserta: { type: 'opening_balance', amount: net, description: 'Saldo migrado...' }
```

---

## 5. Sistema de Balances

### Calculo de Saldo por Piloto

Desde v17, la fuente de verdad son las entradas del `ledger`. El balance es simplemente:

```
balance = SUM(ledger.amount WHERE driver = piloto)
```

Para vehiculos en transicion (sin ledger), se usa el calculo legacy:
```
balance = sum(payments.amount) - sum(trips.cost)
```

### Interpretacion

| Balance | Significado |
|---------|-------------|
| Positivo (+) | El piloto pago mas de lo que consumio (le deben) |
| Negativo (-) | El piloto consumio mas de lo que pago (debe) |
| Cerca de 0 | "Al dia" — esta equilibrado |

### Ejemplo con 3 Pilotos

```
           Pagos    Viajes    Balance
Pato:      $50,000  $30,000   +$20,000 (le deben)
Diego:     $20,000  $35,000   -$15,000 (debe)
Mama:      $10,000  $15,000   -$5,000  (debe)
```

---

## 6. Smart Card — Saldo Personal en Tiempo Real (v18.5+)

La Smart Card es una tarjeta en la pestaña "Resumen" que muestra al usuario logueado su situacion personal:

### Logica (`renderSmartCard()`)

1. Obtiene el nombre del piloto del usuario actual via `getMyDriverName(vehicle.id)` (que consulta `state.driverMappings`)
2. Suma todas las entradas del ledger donde `driver === myDriverName`
3. Determina el estado:

```
myBalance ≈ 0    → clase neutral, texto "Estas al dia"
myBalance > 0    → clase .clear (verde), "+$X Te deben plata"
myBalance < 0    → clase .debt (rojo), "-$X Debes plata" + boton "Saldar"
```

Si el usuario no tiene mapping (no reclamo un piloto), la Smart Card no se muestra.

---

## 7. Liquidacion Sugerida (Clearing)

### Algoritmo Greedy de Compensacion

Cuando los balances estan desnivelados, la app sugiere transferencias minimas para equilibrar:

1. **Separar** pilotos en deudores (balance < 0) y acreedores (balance > 0)
2. **Ordenar** ambas listas por monto (mayor a menor)
3. **Emparejar** el mayor deudor con el mayor acreedor
4. **Transferir** el minimo entre la deuda y el credito
5. **Reducir** ambos saldos y repetir

### Ejemplo

```
Acreedores: Pato (+$20,000)
Deudores:   Diego (-$15,000), Mama (-$5,000)

Resultado:
  Diego → Pato: $15,000
  Mama → Pato:  $5,000
```

### Saldar Deuda (Modal v18.6)

Cuando el usuario toca "Saldar" desde su Smart Card:
1. Se abre el modal de Saldar Deuda
2. Se listan los acreedores (pilotos con balance positivo, distintos del usuario)
3. El monto se pre-llena con la deuda total del usuario
4. Al confirmar, se insertan DOS entradas en el ledger (doble entrada contable)
5. Se re-renderiza la Smart Card y los balances

```javascript
// Pago a acreedor: debito para el pagador
{ driver: pagador, type: 'transfer', amount: +monto, description: `Pago a ${acreedor}` }

// Cobro del deudor: debito para el acreedor (reduce su credito)
{ driver: acreedor, type: 'transfer', amount: -monto, description: `Cobro de ${pagador}` }
```

### Pagos de Liquidacion Historicos

Antes de v17, los pagos de liquidacion se registraban como payments con:
- `liters_loaded = null` (no es combustible)
- `note` contiene "Saldado"
- Se detectan con: `note.toLowerCase().includes('saldado') && !liters_loaded`
- Se muestran con icono de billete y estilo violeta diferenciado

---

## 8. Reconciliacion de Tanque Lleno

### El Problema

Los costos de viaje son **estimaciones** basadas en consumo teorico. El consumo real varia por trafico, clima, estilo de manejo, presion de neumaticos, etc.

### La Solucion: Ciclos de Tanque Lleno

Cuando se llena el tanque, la app puede calcular el consumo **real** del ciclo:

```
Ciclo = todos los viajes y cargas entre dos llenados completos consecutivos
```

### Algoritmo (`performTankAudit()`)

**Paso 1: Identificar el ciclo**
- Busca las 2 ultimas cargas de "tanque lleno" (is_full_tank=true, liters_loaded>0)
- Filtra viajes y cargas entre esas dos fechas usando `occurred_at` o `created_at`

**Paso 2: Calcular desviacion**
```
litros_estimados = sum( km_viaje / consumo_teorico_por_tipo )  para cada viaje del ciclo
litros_reales = sum( litros_cargados )  para todas las cargas del ciclo

factor_desviacion = litros_reales / litros_estimados
```

**Paso 3: Ajustar cada viaje**
```
consumo_ajustado = consumo_teorico_por_tipo / factor_desviacion
nuevos_litros = km / consumo_ajustado
nuevo_costo = nuevos_litros * precio_combustible_al_momento_del_viaje
```

**Paso 4: Marcar como reconciliado**
- Cada viaje se actualiza con `is_reconciled = true`
- Se guarda `original_consumption` y `real_consumption`
- Se registra `reconciled_at`

**Paso 5: Insertar ajustes en ledger (v17)**
- Para cada piloto con viajes en el ciclo, se calcula la diferencia entre costo nuevo y viejo
- Se inserta un `tank_audit_adjustment` proporcional a los km de ese piloto en el ciclo

**Paso 6: Actualizar correction_factor del vehiculo (v17)**
```
correction_factor = total_litros_reales / total_litros_estimados_del_ciclo
```

### Ejemplo de Reconciliacion

```
Ciclo entre dos tanques llenos:
  Viaje 1: 100 km urbano (teorico: 10.5 km/l → estimado: 9.52 litros)
  Viaje 2: 200 km ruta (teorico: 15.0 km/l → estimado: 13.33 litros)
  Total estimado: 22.85 litros

  Cargas en el ciclo: 25 litros reales

  Factor: 25 / 22.85 = 1.094 (consumo real 9.4% mayor al teorico)

Ajuste:
  Viaje 1: consumo_real = 10.5 / 1.094 = 9.6 km/l → 10.42 litros
  Viaje 2: consumo_real = 15.0 / 1.094 = 13.71 km/l → 14.59 litros
```

### Verificacion de Viajes (`isTripVerified()`)

Un viaje se considera "verificado" cuando:
1. Tiene `is_reconciled = true` (fue ajustado por reconciliacion)
2. Existe una carga de tanque lleno posterior al viaje

Esto garantiza que el viaje fue incluido en al menos un ciclo completo de reconciliacion.

### Indicadores Visuales

| Estado | Badge | Color |
|--------|-------|-------|
| Verificado | Checkmark verde | Verde |
| Estimado | "Estimado" clickeable | Gris |

Al tocar "Estimado" aparece un popup explicando que el costo es una aproximacion basada en consumo teorico.

---

## 9. Memoria Reconstructiva

### Aprendizaje Adaptativo del Consumo (`recalculateGlobalConsumption()`)

Despues de cada reconciliacion, la app recalcula el consumo promedio historico del vehiculo:

1. Identifica **todos** los ciclos cerrados (pares consecutivos de tanques llenos)
2. Para cada ciclo: `consumo_real = km_totales / litros_totales`
3. Promedia todos los ciclos
4. Actualiza `vehicle.consumption` con el promedio historico

Esto hace que las futuras estimaciones sean cada vez mas precisas, ya que el consumo "aprendido" se basa en datos reales acumulados.

### Recalculo Global de Viajes (`recalculateTrips()`)

Si se edita el vehiculo y cambia el precio o el consumo, todos sus viajes no-reconciliados se recalculan:

```javascript
// Para cada trip con is_reconciled = false:
const nuevos_litros = trip.km / getConsumptionForDriveType(vehicle, trip.drive_type);
const nuevo_costo = nuevos_litros * current_ppp;
await updateTrip(trip.id, { liters: nuevos_litros, cost: nuevo_costo });
```

---

## 10. Sistema Fiscal (Factura A)

### Constantes Fiscales

```javascript
IIBB_RATE = 0.0366              // IIBB acumulado
IVA_PERC_RATE = 0.03            // Percepcion IVA 3%
ICL_VALUE = 288.7773            // Impuesto a los Combustibles Liquidos (valor fijo)
IDC_VALUE = 17.6889             // Infraestructura de Diferencia de Calidad
RATE_RELATION = (IIBB_RATE + IVA_PERC_RATE) / 1.21   // Relacion para calculo neto
```

### Desglose de Factura A

Cuando un pago es "Factura A", la app realiza ingenieria inversa desde el total pagado hacia el precio real:

```
neto_gravado = monto / (1 + IVA + IDC)
iva = neto_gravado * 0.21
idc = neto_gravado * 0.24216
percepciones = neto_gravado * (0.03 + 0.028)

precio_surtidor = (monto - percepciones) / litros     // precio sin percepciones
precio_efectivo = monto / litros                       // precio total (usado para balance)
```

Las percepciones fiscales (IIBB, IVA percepcion) no forman parte del costo real del combustible, por lo que se restan para obtener el precio que se uso en la bomba.

---

## 11. Activity Feed — Feed de Actividad (v18.5+)

### Construccion (`buildActivityItems()`)

El feed combina dos fuentes de datos en un unico listado cronologico descendente:

1. **payments** — cargas de combustible y liquidaciones de saldo
   - Tipo `fuel`: carga normal (liters_loaded > 0)
   - Tipo `settlement`: liquidacion (note contiene "saldado" y !liters_loaded)
2. **auditLogs** — eventos de eliminacion y deuda saldada
   - Solo los de tipo `trip_deleted`, `payment_deleted`, `debt_settled`

Los items se ordenan por fecha descendente (`b.date - a.date`) y se almacenan en `state.activityItems`.

### Paginacion

- Pagina de tamanio `ACTIVITY_PAGE_SIZE = 10`
- `state.activityPage` lleva el cursor (pagina 0 = primeros 10 items)
- "Ver mas" → incrementa cursor → `loadMoreActivity()`
- "Ver menos" → resetea a pagina 0 → `showLessActivity()`
- La carga es lazy: solo se construye cuando el usuario visita la pestaña "Finanzas"

---

## 12. Identity Claim — Vinculacion Usuario ↔ Piloto (v18+)

### Concepto

Los pilotos son texto libre dentro de `vehicles.drivers[]`. Para saber cual piloto corresponde a cada usuario logueado, existe la tabla `vehicle_driver_mappings`.

### Flujo de Reclamo

1. Usuario se loguea con email/password
2. Al abrir un vehiculo, si el usuario no tiene mapping, se abre automaticamente el modal de Claim Identity (v18.14)
3. El modal lista los pilotos del vehiculo que aun no tienen un usuario asociado
4. El usuario toca su nombre → se inserta en `vehicle_driver_mappings`
5. A partir de ahi, `getMyDriverName(vehicleId)` retorna su nombre
6. La Smart Card se activa con su saldo personal

### Funcion clave

```javascript
function getMyDriverName(vehicleId) {
  const mapping = state.driverMappings.find(m =>
    m.vehicle_id === vehicleId && m.user_id === state.profile?.id
  );
  return mapping?.driver_name || null;
}
```

Si retorna `null`, el usuario no tiene piloto reclamado y la Smart Card permanece oculta.

---

## 13. Dashboard Analytics

### Stats Generales

- **Total gastado:** `SUM(trips.cost)` de todos los viajes (o filtrados por vehiculo)
- **Total viajes:** `COUNT(trips)` filtrado
- **Total km:** `SUM(trips.km)` filtrado

### Comparacion Mensual

```
variacion = (gasto_mes_actual - gasto_mes_anterior) / gasto_mes_anterior * 100
```

Se muestra con flecha arriba/abajo y color verde/rojo/neutro.

### Ranking de Pilotos (`renderPilotRanking()`)

Para cada piloto con viajes, calcula la eficiencia real acumulada:
```
eficiencia = SUM(km) / SUM(liters)  → expresado en km/l
```

El ranking ordena de mayor a menor km/l. Los top 3 reciben medallas (oro, plata, bronce).

### Tendencia de Precios (`renderPriceTrend()`)

Muestra los ultimos 5 pagos con precio por litro (excluye liquidaciones). Si hay al menos 2, calcula la variacion porcentual entre el ultimo y el anterior:
```
diff = (latest_price - prev_price) / prev_price * 100
```

### Graficos Chart.js (v18.8+)

**Doughnut — KM por piloto (mes actual):**
- Filtra viajes del mes en curso
- Excluye pilotos con 0 km ese mes
- Ordena pilotos de menor a mayor km (sentido horario)
- Colores desde PILOT_COLORS[] segun indice en vehicle.drivers[]

**Mixed bar/line — Gasto y Eficiencia (ultimos 4 meses):**
- Barras (eje Y izquierdo): gasto total de combustible por mes (suma payments.amount donde liters_loaded > 0)
- Linea (eje Y derecho): costo por km = gasto_mes / km_mes
- Los 4 meses se calculan dinamicamente desde la fecha actual hacia atras

---

## 14. Flujo Completo de la App

### Registrar un Viaje

```
1. Piloto selecciona vehiculo
2. Ingresa km recorridos
3. Selecciona tipo de manejo (Urbano/Mixto/Ruta)
4. App calcula: litros = km / (consumo_tipo * correction_factor), costo = litros * current_ppp
5. Se guarda en Supabase (tabla trips)
6. Se inserta ledger entry: { type: 'trip_cost', amount: -costo, ref_id: trip.id }
7. Se actualiza vehicle.virtual_liters (resta litros consumidos)
8. Se re-renderizan: historial, balances, Smart Card, resumen, tanque virtual
```

### Registrar una Carga de Combustible

```
1. Piloto selecciona vehiculo
2. Ingresa monto pagado y litros cargados
3. Opcionalmente: marca tanque lleno, tipo factura, foto del ticket
4. App calcula precio efectivo por litro
5. Se guarda en Supabase (+ foto en Storage si existe)
6. Se inserta ledger entry: { type: 'fuel_payment', amount: +monto, ref_id: payment.id }
7. Se actualiza vehicle.current_ppp (promedio ponderado) y vehicle.virtual_liters
8. Si es tanque lleno y hay ciclo completo → reconciliacion automatica
9. Se re-renderizan: historial, balances, Smart Card, resumen, tanque virtual
```

### Ciclo de Reconciliacion

```
1. Piloto carga con "Tanque lleno" activado
2. App detecta 2 cargas de tanque lleno (actual + anterior)
3. Identifica viajes y cargas intermedias
4. Calcula factor de desviacion (real vs estimado)
5. Ajusta todos los viajes del ciclo (litros y costo)
6. Marca viajes como reconciliados (is_reconciled=true)
7. Inserta ledger entries tipo 'tank_audit_adjustment' por piloto
8. Actualiza vehicles.correction_factor con el factor del ciclo
9. Recalcula vehicle.consumption con promedio de todos los ciclos historicos
10. Actualiza balances con costos corregidos
```

### Saldar Deuda (v18.6)

```
1. Usuario ve saldo negativo en Smart Card → toca "Saldar"
2. Modal muestra acreedores y monto prellenado con deuda total
3. Usuario confirma
4. Se insertan 2 ledger entries (doble entrada contable)
5. Smart Card se actualiza al instante (balance ahora ~0)
6. Se registra evento 'debt_settled' en audit_logs
```

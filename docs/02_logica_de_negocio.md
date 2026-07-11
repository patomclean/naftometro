# Naftometro - Logica de Negocio

---

## MAPA DE FLUJOS — Los 3 Caminos Principales

Naftometro tiene tres flujos independientes que resuelven problemas distintos. Confundirlos es el error mas frecuente al analizar la app. Este mapa es la referencia canonica.

---

### FLUJO A: "Estimado → Verificado" (Reconciliacion de Viajes)

**Problema que resuelve:** Los costos de viaje se calculan con consumo *teorico*. El consumo real varia. Este flujo corrige retroactivamente los costos cuando hay datos reales.

**Actores:** Viajes (tabla `trips`) + Cargas de combustible (tabla `payments`) + Vehiculo (`vehicles.pool_litros`/`pool_costo`/`km_l_aprendido`, desde v19.0)

**Disparador:** El piloto marca una carga como **"Tanque lleno"** y ya existe un tanque lleno anterior (ciclo cerrado).

**Mecanismo (v19.0):** `performTankAudit()` aprende el rinde real (con guarda de plausibilidad 4-25 km/l) y reancla el pool a la capacidad fisica. **Ya NO recalcula `liters`/`cost` de trips existentes** — un viaje cobrado queda fijo. Ver seccion 8 para el detalle.

**Resultado visible:** el faltante (si lo hay) se reparte por promedio ponderado de km entre los pilotos del ciclo, va al Activity Feed, y actualiza el badge de rinde real aprendido en la ficha del vehiculo.

**Resultado en el ledger:** Entradas de tipo `tank_audit_adjustment`, cuya suma es **exactamente** el faltante descontado del pool (suma cero — ya no inyecta saldo de la nada, bug corregido en v19.0).

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

**NO confundir con:** La reconciliacion de viajes. Saldar una deuda no cambia ningun costo de viaje ni modifica el pool (`pool_litros`/`pool_costo`/`km_l_aprendido`) — solo reequilibra los saldos monetarios entre personas.

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
| **`tank_audit_adjustment`** (ledger) | Ajuste suma cero (v19.0), proporcional a los km de cada piloto en el ciclo | Flujo A unicamente |
| **`correction_factor`** | **DEPRECADO desde v19.0.** Multiplicador legacy que ajustaba consumo teorico al real. Reemplazado por `km_l_aprendido` | Flujo A (modelo viejo) |
| **`km_l_aprendido`** (v19.0) | Rinde real aprendido en km/l, con guarda de plausibilidad fisica (4-25 km/l) | Flujo A unicamente |
| **`pool_litros` / `pool_costo`** (v19.0) | Los dos numeros del tanque: litros actuales y costo real pagado por ellos. `pool_costo/pool_litros` = precio del pool | Nucleo financiero — reemplaza a PPP/virtual_liters |
| **`is_reconciled`** | Flag legacy en un trip. Desde v19.0 los viajes cobrados quedan fijos; ya no se re-precian | Flujo A (modelo viejo) |
| **Clearing / Liquidacion sugerida** | Algoritmo greedy que calcula las transferencias MINIMAS para equilibrar saldos | Flujo B — paso previo al settlement |
| **PPP** (Precio Promedio Ponderado) | **DEPRECADO desde v19.0.** Precio del litro con revaluo de nafta vieja. Reemplazado por el precio del pool (`pool_costo/pool_litros`), que NO revalua | Modelo viejo |

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

## 1-3. Modelo Financiero v2 — Pool a costo (v19.0)

> **DEPRECADO desde v19.0:** el modelo anterior (PPP con revaluo + `correction_factor` + `virtual_liters`) se reemplazo por el **pool a costo**. Las columnas viejas quedan en el schema (legacy, no se leen/escriben). Diseno completo, decisiones y validacion con datos reales en `docs/05_modelo_financiero_v2.md`.

### El pool: dos numeros, una sola fuente de verdad

El tanque es un **pool** representado por `vehicles.pool_litros` (cuantos litros hay) y `vehicles.pool_costo` (cuanto se pago por esos litros, a costo real — sin revaluo). El precio del combustible en cualquier momento es:

```
precio_pool = pool_costo / pool_litros
```

Este es un **promedio ponderado A COSTO** (metodo WAC — Weighted Average Cost — estandar contable: IFRS IAS2, SAP "moving average price"). Cuando conviven litros de distintas cargas a distinto precio, el precio del pool es el promedio ponderado por cantidad — **nunca revalua la nafta vieja al precio nuevo**.

**Ejemplo:** quedan 20 L comprados a $2.000 ($40.000) + se cargan 30 L a $2.500 ($75.000) → pool = 50 L / $115.000 → precio = **$2.300/L** (ni $2.000 ni $2.500). Un viaje que consume 10 L cuesta $23.000.

### Costo de un viaje

```
km_l = km_l_aprendido ajustado por tipo de manejo (Urbano/Mixto/Ruta, mismas proporciones que VEHICLE_DATABASE)
litros = km / km_l
costo = litros * precio_pool
pool_litros -= litros
pool_costo  -= costo
ledger: { driver, type: 'trip_cost', amount: -costo }
```

`km_l_aprendido` (`vehicles.km_l_aprendido`) reemplaza a `correction_factor`. Se actualiza en `performTankAudit()` (ver seccion 8) con una **guarda de plausibilidad fisica: solo se acepta un rinde entre 4 y 25 km/l**. Un ciclo con rinde implicito fuera de ese rango (data sucia — viajes sin cargar, flags mal puestos) **no contamina** el aprendizaje. Esta guarda es la que faltaba en el modelo viejo: sin ella, `correction_factor` llego a **4.8364** en producción, generando viajes de ~$900/km.

**Un viaje cobrado queda FIJO.** A diferencia del modelo viejo (`recalculateTrips` re-preciaba todos los viajes al cambiar el precio/consumo del vehiculo), en v19.0 esa funcion esta deprecada (no-op). Editar un vehiculo ya no cambia el costo de viajes pasados.

### Carga de combustible

```
costo_efectivo = monto - descuento  (Factura A ya viene sumada al monto via percepciones)
pool_litros += litros_cargados
pool_costo  += costo_efectivo
ledger: { driver: pagador, type: 'fuel_payment', amount: +costo_efectivo }
```

El neto que entra al pool es exactamente el mismo que se acredita en el ledger — por eso la invariante se mantiene sola.

### La invariante central

```
Σ (balance de todos los pilotos) = pool_costo   (SIEMPRE, exacto)
```

Cada peso que entra esta, o cobrado a un viaje, o todavia en el pool. El pool nunca llega a 0 L (siempre queda algo de nafta), asi que **siempre hay algun piloto con credito** = el que aporto la nafta que aun no se consumio. Ese credito esta **respaldado por nafta fisica** y se recupera al consumirse — no es "plata que le deben", es un activo. Al saldar deudas (Flujo B) se lleva a los **deudores** a cero; los acreedores conservan su credito por nafta.

### Borrado (viajes y cargas)

Al borrar un viaje o una carga, el cascade trigger borra la entrada del ledger, y el codigo **revierte litros Y costo del pool** (`applyPoolDelta` con signo invertido) para mantener la invariante exacta. Es el fix del bug raiz de v18.15 (que solo revertia litros, no costo) llevado a su forma completa.

### Capital del Tanque

En v19.0, el valor del tanque a costo **es** `pool_costo` directamente (no requiere multiplicar nivel × precio, ya viene calculado):

```
capital = pool_costo
```

Muestra: "Hay $X de nafta, aportada por [pilotos] — respaldado, lo recuperan al consumirse."

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

## 8. Reconciliacion de Tanque Lleno (v19.0 — suma cero)

> **Reescrita en v19.0.** El algoritmo viejo (factor de desviacion sin guardas, `tank_audit_adjustment` que inyectaba saldo neto de la nada) se reemplazo por una reconciliacion que **preserva la invariante** `Σ balances = pool_costo` de forma exacta. Ver `docs/05` §10-11 para el diagnostico y la validacion con datos reales (el bug viejo llego a inyectar +$82k de la nada; el `correction_factor` sin guardas llego a 4.8364 con data fuera de orden).

### El problema (sigue siendo el mismo)

Los costos de viaje son estimaciones basadas en el rinde aprendido. Cuando se llena el tanque a tope, la app puede comparar cuanto deberia quedar en el pool vs. cuanto realmente entra — la diferencia es nafta consumida y no registrada (viajes olvidados, km mal cargados).

### Algoritmo (`performTankAudit()`, v19.0)

**Paso 1: Identificar el ciclo** — igual que antes: viajes y cargas entre las 2 ultimas cargas "tanque lleno".

**Paso 2: Aprender el rinde real, CON GUARDA FISICA**
```
km_l_ciclo = km_totales_del_ciclo / litros_cargados_del_ciclo

SI km_l_ciclo esta fuera de [4, 25] km/l  → ciclo descartado, NO se aprende nada (data sucia)
SINO → km_l_aprendido = promedio_movil(km_l_aprendido_previo, km_l_ciclo)
```
Esta guarda es la que faltaba en el modelo viejo. Sin ella, un ciclo con cargas fuera de orden cronologico (viajes cargados despues de su tanque lleno correspondiente) puede implicar un rinde absurdo (ej: 0.5 km/l) que contaminaria toda estimacion futura.

**Paso 3: Reanclar el pool a la capacidad fisica**
```
gap_litros = pool_litros_estimado - capacidad_tanque   (>0 = se consumio sin registrar)
precio_pool = pool_costo / pool_litros
gap_costo = gap_litros * precio_pool
```

**Paso 4: Redistribuir el gap por PROMEDIO PONDERADO DE USO (suma cero)**
```
Para cada piloto con viajes en el ciclo:
  ajuste_piloto = gap_costo * (km_del_piloto_en_el_ciclo / km_totales_del_ciclo)
  ledger: { driver, type: 'tank_audit_adjustment', amount: -ajuste_piloto }

pool_costo -= gap_costo    // el pool baja EXACTO lo mismo que se reparte -> Σ = pool_costo se mantiene
pool_litros = capacidad_tanque   // reancla
```

**Diferencia clave vs. el modelo viejo:** el ajuste **no re-precia ningun viaje pasado** (queda tal cual se cobro). Solo agrega una entrada de ledger que corrige el balance de cada piloto — y esa entrada, sumada, es exactamente el `gap_costo` que se descuenta del pool. Nada se inventa: lo que un piloto "pierde" por el faltante es exactamente lo que el pool deja de valer.

### Ejemplo

```
Ciclo: A maneja 100 km, B maneja 300 km (400 km totales)
Tanque lleno anterior: pool a 50 L. Se llena de nuevo: entran 20 L, pero el
pool estimaba mas litros de los que la carga real reflejo -> faltan 8 L
(gap_litros = 8), a precio_pool $2.500/L -> gap_costo = $20.000

Reparto por km (25% A, 75% B):
  A: -$5.000 (ledger tank_audit_adjustment)
  B: -$15.000 (ledger tank_audit_adjustment)

pool_costo baja $20.000. Σ ledger sigue = pool_costo. Nada se inventa.
```

### Indicadores Visuales

El badge "Estimado"/"Verificado" y `isTripVerified()` de versiones anteriores ya no aplican de la misma forma: como los viajes cobrados quedan fijos, no hay un estado "recalculado" que mostrar. El indicador relevante ahora es el badge de **rinde real aprendido** (`km_l_aprendido`) en la ficha del vehiculo.

---

## 9. Aprendizaje del Rinde (v19.0)

> **Reemplaza a la "Memoria Reconstructiva" del modelo viejo.** `recalculateGlobalConsumption()` y `recalculateTrips()` quedan **deprecadas (no-op)** desde v19.0 — la primera aprendia sin guardas de plausibilidad (contribuyo al bug del factor 4.83); la segunda re-preciaba viajes ya cobrados, rompiendo la invariante y generando desconfianza ("¿por que cambio mi viaje de ayer?").

El aprendizaje del rinde real vive ahora **dentro de `performTankAudit()`** (seccion 8, Paso 2): promedio movil de `km_l_aprendido`, actualizado solo cuando el ciclo es fisicamente plausible (4-25 km/l). Editar el vehiculo (precio, consumo manual) **ya no re-precia** ningun viaje pasado — solo afecta las estimaciones de viajes futuros.

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

### Descuento / Reintegro y la unidad $/% (v18.17)

Desde v18.17, el modal de carga tiene un **switch `$ / %`** para el descuento. `getDiscountAmount(monto)` convierte el valor a pesos: si la unidad es `%`, devuelve `monto × pct/100`; si es `$`, el valor literal.

**🚩 Cambio importante:** hasta v18.16 el descuento se **guardaba** en `discount_amount` pero **no afectaba el costo** (`precio_efectivo = monto / litros`). Desde v18.17 el descuento **baja el costo de verdad**:

```
precio_efectivo = (monto - descuento) / litros
```

Y ese neto (`monto - descuento`) se usa tambien en:
- El **pool a costo** (`pool_costo`, desde v19.0 — antes era el promedio ponderado del PPP legacy).
- El **credito `fuel_payment`** del ledger (lo que se le acredita al pagador).

Solo afecta cargas CON descuento; las normales quedan identicas.

### Ida y vuelta — km efectivo (v18.19)

El modal de Registrar Viaje tiene un toggle **"Ida y vuelta"** que duplica los km. El km que se persiste es el **efectivo**, no el tipeado:

```javascript
function getEffectiveTripKm() {
  const base = parseFloat(dom.tripKm.value) || 0;
  return base * (dom.tripRoundTrip?.checked ? 2 : 1);
}
```

`getEffectiveTripKm()` se usa tanto en el **preview de costo en vivo** (`handleTripKmInput()`) como en el **guardado** (`handleTripSubmit()`), asi que el costo estimado y el viaje real siempre coinciden.

### Viajes frecuentes personalizados por piloto (v18.20-v18.21)

`renderFrequentTrips(driver)` deriva los destinos repetidos **del historial de cada piloto por separado** (los viajes de uno no le sirven a otro). Agrupa `state.trips` del piloto por `(nota normalizada + km redondeado)`, filtra los que aparecen 2+ veces, ordena por frecuencia y muestra hasta 4 chips. Solo se consideran viajes **con nota** (los identificables). Click en un chip autocompleta km/nota/tipo de manejo y recalcula el costo.

Desde v18.21, cada chip lleva un emoji inferido de la nota via `tripNoteEmoji(note)` (🏢 trabajo/oficina, 🏠 casa, 🏖️ costa, ❤️ novia, ⚽ deporte… fallback 📍; las claves destino tienen prioridad sobre "ida y vuelta"). El `data-note` del chip queda **limpio** (sin emoji) para no contaminar la nota guardada.

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

### Registrar un Viaje (v19.0)

```
1. Piloto selecciona vehiculo
2. Ingresa km recorridos
3. Selecciona tipo de manejo (Urbano/Mixto/Ruta)
4. App calcula: litros = km / km_l_aprendido_ajustado, costo = litros * (pool_costo/pool_litros)
5. Se guarda en Supabase (tabla trips) — este costo queda FIJO, no se re-precia despues
6. Se inserta ledger entry: { type: 'trip_cost', amount: -costo, ref_id: trip.id }
7. Se actualiza vehicle.pool_litros (-litros) y vehicle.pool_costo (-costo)
8. Se re-renderizan: historial, balances, Smart Card, resumen, tanque
```

### Registrar una Carga de Combustible (v19.0)

```
1. Piloto selecciona vehiculo
2. Ingresa monto pagado y litros cargados
3. Opcionalmente: marca tanque lleno, tipo factura, foto del ticket
4. App calcula el costo efectivo (monto - descuento, con percepciones si Factura A)
5. Se guarda en Supabase (+ foto en Storage si existe)
6. Se inserta ledger entry: { type: 'fuel_payment', amount: +costo_efectivo, ref_id: payment.id }
7. Se actualiza vehicle.pool_litros (+litros) y vehicle.pool_costo (+costo_efectivo)
8. Si es tanque lleno y hay ciclo completo → reconciliacion automatica (suma cero)
9. Se re-renderizan: historial, balances, Smart Card, resumen, tanque
```

### Ciclo de Reconciliacion (v19.0 — suma cero)

```
1. Piloto carga con "Tanque lleno" activado
2. App detecta 2 cargas de tanque lleno (actual + anterior)
3. Identifica viajes y cargas intermedias
4. Calcula el rinde real del ciclo; SI es fisicamente plausible (4-25 km/l) actualiza
   km_l_aprendido (promedio movil). Si no, descarta el aprendizaje (data sucia)
5. Calcula el gap entre pool_litros estimado y la capacidad fisica
6. Reparte el gap por PROMEDIO PONDERADO DE KM entre los pilotos del ciclo
7. Inserta ledger entries tipo 'tank_audit_adjustment' por piloto (suma = gap_costo exacto)
8. Descuenta gap_costo de pool_costo y reancla pool_litros = capacidad
9. Actualiza balances — NINGUN viaje pasado se re-precia
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

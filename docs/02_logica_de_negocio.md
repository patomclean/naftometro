# Naftometro - Logica de Negocio

## Resumen del Problema

Multiples conductores ("pilotos") comparten un vehiculo. Cada piloto carga combustible y realiza viajes. La app necesita:

1. Calcular cuanto combustible consumio cada piloto
2. Calcular cuanto pago cada piloto en combustible
3. Determinar quien le debe a quien y cuanto
4. Conciliar estimaciones con datos reales cuando se llena el tanque

---

## 1. Calculo del Costo de un Viaje

### Formula Base

```
Litros consumidos = km / consumo (km/l)
Costo del viaje = litros consumidos * precio del combustible ($/l)
```

### Consumo segun Tipo de Manejo

Cada vehiculo tiene 3 tasas de consumo basadas en su modelo:

| Tipo | Descripcion | Ejemplo (VW Gol 1.6) |
|------|-------------|----------------------|
| Urbano | Ciudad, trafico, muchas frenadas | 10.5 km/l |
| Mixto | Combinado ciudad + ruta | 12.5 km/l |
| Ruta | Autopista, velocidad constante | 15.0 km/l |

La funcion `getConsumptionForDriveType(vehicle, driveType)` selecciona la tasa correcta del `VEHICLE_DATABASE`. Si el modelo no esta en la base de datos, usa el consumo manual del vehiculo (`vehicle.consumption`).

### Precio del Combustible

La funcion `getLatestFuelPrice(vehicle)` obtiene el precio mas reciente:

1. Busca el `price_per_liter` del pago mas reciente que tenga precio
2. Si no hay pagos, usa el `fuel_price` del vehiculo (precio de referencia)

### Ejemplo Completo

```
Viaje: 50 km en modo Urbano
Vehiculo: VW Gol Trend 1.6 (urbano = 10.5 km/l)
Precio nafta: $1,200/l

Litros = 50 / 10.5 = 4.76 litros
Costo = 4.76 * $1,200 = $5,714.29
```

---

## 2. Precio Ponderado del Combustible

Cuando se carga combustible, el precio del vehiculo se actualiza con un promedio ponderado que considera el combustible ya existente en el tanque:

### Formula

```
nuevo_precio = (litros_en_tanque * precio_actual + monto_pagado) / (litros_en_tanque + litros_nuevos)
```

### Ejemplo

```
Tanque actual: 20 litros a $1,100/l
Nueva carga: $30,000 por 25 litros ($1,200/l)

nuevo_precio = (20 * 1100 + 30000) / (20 + 25)
nuevo_precio = (22000 + 30000) / 45
nuevo_precio = $1,155.56/l
```

Este precio ponderado se almacena en `vehicle.fuel_price` y se usa para futuros calculos de viajes.

---

## 3. Tanque Virtual

La app mantiene un "tanque virtual" que estima cuantos litros hay en el vehiculo en tiempo real.

### Algoritmo (`calculateTankLevel()`)

**Con punto de referencia (tanque lleno):**
1. Busca la ultima carga marcada como "Tanque lleno"
2. Parte de la capacidad total del tanque
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

### Capital del Tanque (v15.1)

Calcula el valor monetario del combustible en el tanque y lo atribuye a quien lo pago:

```
capital = nivel_tanque * precio_actual
```

Muestra: "El auto tiene X litros valorados en $Y que fueron pagados por [nombres]"

La atribucion identifica los pilotos que cargaron combustible desde el ultimo tanque lleno.

---

## 4. Sistema de Balances

### Calculo de Saldo por Piloto

Cada piloto tiene:
- **Credito:** Suma de todos sus pagos (`payments.amount`)
- **Debito:** Suma de todos sus costos de viaje (`trips.cost`)
- **Balance neto:** `credito - debito`

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

## 5. Liquidacion Sugerida (Clearing)

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

### Pagos de Liquidacion ("Saldado")

Cuando un piloto realiza un pago de liquidacion:
- Se crea un payment con `liters_loaded = null` (no es combustible)
- La nota incluye "Saldado de deuda a: [acreedor]"
- Se muestra con icono de billete y estilo violeta diferenciado

---

## 6. Reconciliacion de Tanque Lleno

### El Problema

Los costos de viaje son **estimaciones** basadas en consumo teorico. El consumo real varia por trafico, clima, estilo de manejo, presion de neumaticos, etc.

### La Solucion: Ciclos de Tanque Lleno

Cuando se llena el tanque, la app puede calcular el consumo **real** del ciclo:

```
Ciclo = todos los viajes y cargas entre dos llenados completos consecutivos
```

### Algoritmo (`performTankAudit()`)

**Paso 1: Identificar el ciclo**
- Busca las 2 ultimas cargas de "tanque lleno"
- Filtra viajes y cargas entre esas dos fechas

**Paso 2: Calcular desviacion**
```
litros_estimados = sum( km_viaje / consumo_teorico )  para cada viaje del ciclo
litros_reales = sum( litros_cargados )  para todas las cargas del ciclo

factor_desviacion = litros_reales / litros_estimados
```

**Paso 3: Ajustar cada viaje**
```
consumo_ajustado = consumo_teorico / factor_desviacion
nuevos_litros = km / consumo_ajustado
nuevo_costo = nuevos_litros * precio_combustible
```

**Paso 4: Marcar como reconciliado**
- Cada viaje se actualiza con `is_reconciled = true`
- Se guarda `original_consumption` y `real_consumption`
- Se registra `reconciled_at`

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

## 7. Memoria Reconstructiva

### Aprendizaje Adaptativo del Consumo (`recalculateGlobalConsumption()`)

Despues de cada reconciliacion, la app recalcula el consumo promedio historico del vehiculo:

1. Identifica **todos** los ciclos cerrados (pares consecutivos de tanques llenos)
2. Para cada ciclo: `consumo_real = km_totales / litros_totales`
3. Promedia todos los ciclos
4. Actualiza `vehicle.consumption` con el promedio historico

Esto hace que las futuras estimaciones sean cada vez mas precisas, ya que el consumo "aprendido" se basa en datos reales acumulados.

---

## 8. Sistema Fiscal (Factura A)

### Constantes Fiscales

```javascript
FISCAL_IVA_RATE = 0.21                   // IVA 21%
FISCAL_IDC_RATE = 0.24216                 // Impuesto a los Combustibles
FISCAL_PERCEPTION_IVA_RATE = 0.03         // Percepcion IVA 3%
FISCAL_PERCEPTION_IIBB_RATE = 0.028       // Percepcion IIBB 2.8%
```

### Desglose de Factura A

Cuando un pago es "Factura A", la app calcula:

```
neto_gravado = monto / (1 + IVA + IDC)
iva = neto_gravado * 0.21
idc = neto_gravado * 0.24216
percepciones = neto_gravado * (0.03 + 0.028)

precio_efectivo = (monto - percepciones) / litros
```

Las percepciones fiscales no forman parte del costo real del combustible, por lo que se restan para obtener el precio efectivo por litro.

---

## 9. Flujo Completo de la App

### Registrar un Viaje

```
1. Piloto selecciona vehiculo
2. Ingresa km recorridos
3. Selecciona tipo de manejo (Urbano/Mixto/Ruta)
4. App calcula: litros = km / consumo, costo = litros * precio
5. Se guarda en Supabase
6. Se re-renderizan: historial, balances, resumen, tanque virtual
```

### Registrar una Carga de Combustible

```
1. Piloto selecciona vehiculo
2. Ingresa monto pagado y litros cargados
3. Opcionalmente: marca tanque lleno, tipo factura, foto del ticket
4. App calcula precio efectivo por litro
5. Se guarda en Supabase (+ foto en Storage si existe)
6. Si es tanque lleno y hay ciclo completo → reconciliacion automatica
7. Se actualiza precio ponderado del vehiculo
8. Se re-renderizan: historial, balances, resumen, tanque virtual
```

### Ciclo de Reconciliacion

```
1. Piloto carga con "Tanque lleno" activado
2. App detecta 2 cargas de tanque lleno (actual + anterior)
3. Identifica viajes y cargas intermedias
4. Calcula factor de desviacion (real vs estimado)
5. Ajusta todos los viajes del ciclo
6. Marca viajes como reconciliados
7. Recalcula consumo aprendido del vehiculo
8. Actualiza balances con costos corregidos
```

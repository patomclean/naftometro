// ============================================================
// 1. CONSTANTS & CONFIGURATION
// ============================================================

const SUPABASE_URL = 'https://vablrtbwxitoiqyzyama.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhYmxydGJ3eGl0b2lxeXp5YW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NTkyOTAsImV4cCI6MjA4NjQzNTI5MH0.IK2tbR_QIwYDaBmYy1WPNai5o5BHGq_f8K6FQOft_ww';

// v13: Rich vehicle database with official specs (tank capacity, consumption by drive type)
const VEHICLE_DATABASE = {
  'VW Gol Trend 1.6':        { tank: 55, city_km_l: 10.5, mixed_km_l: 12.5, highway_km_l: 15.0 },
  'Toyota Corolla 1.8':      { tank: 60, city_km_l: 10.8, mixed_km_l: 13.0, highway_km_l: 15.5 },
  'Ford Ka 1.5':             { tank: 48, city_km_l: 12.0, mixed_km_l: 14.0, highway_km_l: 16.5 },
  'Fiat Cronos 1.3':         { tank: 48, city_km_l: 11.5, mixed_km_l: 13.5, highway_km_l: 15.5 },
  'Fiat Cronos 1.3 Drive':   { tank: 48, city_km_l: 12.6, mixed_km_l: 14.0, highway_km_l: 15.8 },
  'Chevrolet Onix 1.0T':     { tank: 40, city_km_l: 12.5, mixed_km_l: 15.0, highway_km_l: 17.5 },
  'Renault Sandero 1.6':     { tank: 50, city_km_l: 10.0, mixed_km_l: 12.0, highway_km_l: 14.5 },
  'Toyota Hilux 2.8 TD':     { tank: 80, city_km_l:  6.5, mixed_km_l:  8.5, highway_km_l: 11.0 },
  'Ford Ranger 3.2 TD':      { tank: 80, city_km_l:  6.0, mixed_km_l:  8.0, highway_km_l: 10.5 },
  'VW Amarok 2.0 TD':        { tank: 80, city_km_l:  7.0, mixed_km_l:  9.0, highway_km_l: 11.5 },
  'Peugeot 208 1.6':         { tank: 50, city_km_l: 11.0, mixed_km_l: 13.5, highway_km_l: 16.0 },
  'VW Taos 1.4 250 TSI':     { tank: 50, city_km_l: 10.1, mixed_km_l: 13.3, highway_km_l: 16.6 },
  'Toyota Corolla 2.0 SEG':  { tank: 50, city_km_l: 11.1, mixed_km_l: 14.5, highway_km_l: 17.7 },
};

function getVehicleTankCapacity(vehicle) {
  const spec = VEHICLE_DATABASE[vehicle.model];
  return spec ? spec.tank : null;
}

function getConsumptionForDriveType(vehicle, driveType) {
  const spec = VEHICLE_DATABASE[vehicle.model];
  if (spec) {
    if (driveType === 'Urbano') return spec.city_km_l;
    if (driveType === 'Ruta')   return spec.highway_km_l;
    return spec.mixed_km_l;
  }
  return vehicle.consumption;
}

function getDriveTypeEmoji(driveType) {
  if (driveType === 'Urbano') return '🏙️';
  if (driveType === 'Ruta')   return '🏁';
  return '🛣️';
}

// v14.6: Temporal helpers
function toLocalDatetimeValue(date) {
  const d = date || new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function getEventDate(record) {
  return new Date(record.occurred_at || record.created_at);
}

const FUEL_TYPES = [
  'Super (95 octanos)',
  'Premium (98 octanos)',
  'Diesel / Gasoil',
  'Infinia / V-Power',
];

const TABS = ['detail', 'home', 'dashboard'];

// v10: Fiscal constants for Factura A
const IIBB_RATE = 0.0366;
const IVA_PERC_RATE = 0.03;
const ICL_VALUE = 288.7773;
const IDC_VALUE = 17.6889;
const RATE_RELATION = (IIBB_RATE + IVA_PERC_RATE) / 1.21;

// ============================================================
// 2. SUPABASE INITIALIZATION
// ============================================================

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// 3. APPLICATION STATE
// ============================================================

const PILOT_COLORS = ['#7c5cfc', '#f59e0b', '#06b6d4', '#ec4899', '#10b981', '#f43f5e'];

const state = {
  vehicles: [],
  activeVehicleId: null,
  trips: [],
  payments: [],
  confirmAction: null,
  lastVisitedVehicleId: null,
  currentTab: 'home',
  dashboardLoaded: false,
  allTrips: [],
  allPayments: [],
  settlementMode: false,
  settlementDriver: null,
  editingPaymentId: null,
  editingTripId: null,
};

// ============================================================
// 4. DOM REFERENCES
// ============================================================

const $ = (sel) => document.querySelector(sel);
const dom = {
  viewsContainer: $('#views-container'),
  vehiclesGrid: $('#vehicles-grid'),
  noVehiclesMsg: $('#no-vehicles-msg'),
  homeLoading: $('#home-loading'),
  // Detail
  detailEmpty: $('#detail-empty'),
  vehiclePills: $('#vehicle-pills'),
  detailContent: $('#detail-content'),
  detailTitle: $('#detail-title'),
  vehicleModelBadge: $('#vehicle-model-badge'),
  vehicleConsumptionBadge: $('#vehicle-consumption-badge'),
  vehicleFuelTypeBadge: $('#vehicle-fuel-type-badge'),
  vehicleFuelPriceBadge: $('#vehicle-fuel-price-badge'),
  vehicleCostKmBadge: $('#vehicle-cost-km-badge'),
  vehicleLearnedBadge: $('#vehicle-learned-badge'),
  tripForm: $('#trip-form'),
  tripDriver: $('#trip-driver'),
  tripKm: $('#trip-km'),
  tripNote: $('#trip-note'),
  costPreviewValue: $('#cost-preview-value'),
  btnSubmitTrip: $('#btn-submit-trip'),
  summaryGrid: $('#summary-grid'),
  summaryTotalValue: $('#summary-total-value'),
  balancesGrid: $('#balances-grid'),
  btnQuickTrip: $('#btn-quick-trip'),
  btnQuickFuel: $('#btn-quick-fuel'),
  clearingSection: $('#clearing-section'),
  clearingList: $('#clearing-list'),
  paymentsList: $('#payments-list'),
  paymentsEmpty: $('#payments-empty'),
  tripsLoading: $('#trips-loading'),
  tripsEmpty: $('#trips-empty'),
  tripsTable: $('#trips-table'),
  tripsTbody: $('#trips-tbody'),
  // v13: Drive type selector
  tripDriveType: $('#trip-drive-type'),
  driveTypeSelector: $('#drive-type-selector'),
  tripOccurredAt: $('#trip-occurred-at'),
  paymentOccurredAt: $('#payment-occurred-at'),
  // Modals
  vehicleModal: $('#vehicle-modal'),
  modalTitle: $('#modal-title'),
  vehicleForm: $('#vehicle-form'),
  vehicleFormId: $('#vehicle-form-id'),
  vehicleNameInput: $('#vehicle-name'),
  vehicleModelSelect: $('#vehicle-model'),
  vehicleConsumptionInput: $('#vehicle-consumption'),
  vehicleFuelTypeSelect: $('#vehicle-fuel-type'),
  vehicleFuelPriceInput: $('#vehicle-fuel-price'),
  driversContainer: $('#drivers-container'),
  btnAddDriver: $('#btn-add-driver'),
  btnSubmitVehicle: $('#btn-submit-vehicle'),
  paymentModal: $('#payment-modal'),
  paymentForm: $('#payment-form'),
  paymentDriver: $('#payment-driver'),
  paymentAmount: $('#payment-amount'),
  paymentLiters: $('#payment-liters'),
  paymentPricePerLiter: $('#payment-price-per-liter'),
  paymentFullTank: $('#payment-full-tank'),
  paymentNote: $('#payment-note'),
  btnSubmitPayment: $('#btn-submit-payment'),
  // v10: Fiscal audit DOM refs
  btnToggleAdjustments: $('#btn-toggle-adjustments'),
  adjustmentsPanel: $('#adjustments-panel'),
  adjustmentsChevron: $('#adjustments-chevron'),
  paymentFacturaA: $('#payment-factura-a'),
  facturaADetail: $('#factura-a-detail'),
  paymentDiscount: $('#payment-discount'),
  paymentPriceSummary: $('#payment-price-summary'),
  summaryPaid: $('#summary-paid'),
  summaryPumpPrice: $('#summary-pump-price'),
  summaryEffectivePrice: $('#summary-effective-price'),
  summaryPerceptionNote: $('#summary-perception-note'),
  // v11: Tank indicator DOM refs
  tankIndicator: $('#tank-indicator'),
  tankBarFill: $('#tank-bar-fill'),
  tankLitersLabel: $('#tank-liters-label'),
  tankPriceLabel: $('#tank-price-label'),
  confirmModal: $('#confirm-modal'),
  confirmTitle: $('#confirm-title'),
  confirmMessage: $('#confirm-message'),
  btnConfirmOk: $('#btn-confirm-ok'),
  toastContainer: $('#toast-container'),
  // Bottom Nav
  bottomNav: $('#bottom-nav'),
  // Dashboard
  dashboardFilter: $('#dashboard-filter'),
  dashTotalSpent: $('#dash-total-spent'),
  dashTotalTrips: $('#dash-total-trips'),
  dashTotalKm: $('#dash-total-km'),
  dashCurrentMonth: $('#dash-current-month'),
  dashCurrentMonthLabel: $('#dash-current-month-label'),
  dashPrevMonth: $('#dash-prev-month'),
  dashPrevMonthLabel: $('#dash-prev-month-label'),
  dashVariation: $('#dash-variation'),
  dashPerVehicleCard: $('#dash-per-vehicle-card'),
  dashVehicleBreakdown: $('#dash-vehicle-breakdown'),
  dashRecentActivity: $('#dash-recent-activity'),
  dashNoActivity: $('#dash-no-activity'),
  dashPilotRanking: $('#dash-pilot-ranking'),
  dashPriceTrend: $('#dash-price-trend'),
};

// ============================================================
// 5. UTILITY FUNCTIONS
// ============================================================

function formatCurrency(n) {
  return '$' + Number(n).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrencyShort(n) {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 10000) return '$' + (n / 1000).toFixed(1) + 'k';
  return formatCurrency(n);
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function getDateGroup(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tripDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today - tripDay) / 86400000);

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays <= 7) return 'Esta semana';
  return 'Anteriores';
}

function getMonthName(date) {
  return date.toLocaleDateString('es-AR', { month: 'long' });
}

function getLatestFuelPrice(vehicle) {
  const latestWithPrice = state.payments.find(p => p.price_per_liter > 0);
  return latestWithPrice ? latestWithPrice.price_per_liter : vehicle.fuel_price;
}

// v10: Calculate fiscal breakdown for payment (ingenieria inversa)
function calculateFiscalBreakdown(amount, liters, isFacturaA, discount) {
  const result = {
    amount, liters,
    discount: discount || 0,
    isFacturaA,
    taxPerceptions: 0,
    montoSurtidor: amount,
    netoGravado: 0,
    pumpPrice: 0,
    effectivePrice: 0,
  };

  // Safe division: PE solo si litros > 0
  if (liters > 0) {
    result.effectivePrice = amount / liters;
  }

  if (isFacturaA && amount > 0) {
    // Percepciones se aplican sobre Neto Gravado (antes de IVA 21%, ICL e IDC)
    // S = (Total + RATE_RELATION * litros * (ICL + IDC)) / (1 + RATE_RELATION)
    const impFijos = liters > 0 ? liters * (ICL_VALUE + IDC_VALUE) : 0;
    result.montoSurtidor = (amount + RATE_RELATION * impFijos) / (1 + RATE_RELATION);
    // Neto Gravado (base imponible sin IVA ni impuestos fijos)
    if (liters > 0) {
      result.netoGravado = (result.montoSurtidor - impFijos) / 1.21;
    }
    // Percepciones impositivas
    result.taxPerceptions = amount - result.montoSurtidor;
    // Precio surtidor por litro
    result.pumpPrice = liters > 0 ? result.montoSurtidor / liters : 0;
  } else {
    // Sin Factura A: pump_price = PE
    result.pumpPrice = liters > 0 ? amount / liters : 0;
  }

  return result;
}

// v14.6: Calculate virtual tank level — resets at last full tank
function calculateTankLevel() {
  const vehicle = getActiveVehicle();
  const tankCap = vehicle ? getVehicleTankCapacity(vehicle) : null;

  // Find the last full-tank payment by occurred_at
  const lastFullTank = state.payments
    .filter(p => p.is_full_tank && p.liters_loaded > 0)
    .sort((a, b) => getEventDate(b) - getEventDate(a))[0];

  if (lastFullTank && tankCap) {
    const lastFullDate = getEventDate(lastFullTank);
    let level = tankCap;

    // Add loads after the last full tank (excluding itself)
    state.payments.forEach(p => {
      if (p.liters_loaded > 0 && p.id !== lastFullTank.id && getEventDate(p) > lastFullDate) {
        level += Number(p.liters_loaded);
      }
    });

    // Subtract trips after the last full tank
    state.trips.forEach(t => {
      if (t.liters > 0 && getEventDate(t) > lastFullDate) {
        level -= Number(t.liters);
      }
    });

    return +level.toFixed(2);
  }

  // Fallback: total sum (no full tank reference point)
  let litersIn = 0;
  state.payments.forEach(p => {
    if (p.liters_loaded > 0) litersIn += Number(p.liters_loaded);
  });
  let litersOut = 0;
  state.trips.forEach(t => {
    if (t.liters > 0) litersOut += Number(t.liters);
  });
  return +(litersIn - litersOut).toFixed(2);
}

// v11: Calculate weighted average price when adding fuel
function calculateWeightedPrice(tankLiters, currentPrice, newAmount, newLiters) {
  const effectiveTank = Math.max(tankLiters, 0);
  const totalLiters = effectiveTank + newLiters;
  if (totalLiters <= 0) return currentPrice;
  return +((effectiveTank * currentPrice + newAmount) / totalLiters).toFixed(2);
}

// v10: Update the dynamic price summary in payment modal
function updatePaymentPriceSummary() {
  const amount = parseFloat(dom.paymentAmount.value);
  const liters = parseFloat(dom.paymentLiters.value);
  const isFacturaA = dom.paymentFacturaA.checked;
  const discount = parseFloat(dom.paymentDiscount.value) || 0;

  if (!amount || amount <= 0 || !liters || liters <= 0) {
    toggleHidden(dom.paymentPriceSummary, true);
    return;
  }

  const breakdown = calculateFiscalBreakdown(amount, liters, isFacturaA, discount);

  dom.summaryPaid.textContent = formatCurrency(amount);
  dom.summaryPumpPrice.textContent = breakdown.pumpPrice
    ? formatCurrency(breakdown.pumpPrice) + '/l'
    : '-';
  dom.summaryEffectivePrice.textContent = breakdown.effectivePrice
    ? formatCurrency(breakdown.effectivePrice) + '/l'
    : '-';

  if (isFacturaA && breakdown.taxPerceptions > 0) {
    dom.summaryPerceptionNote.textContent =
      `Tu precio es mayor debido a ${formatCurrency(breakdown.taxPerceptions)} en percepciones impositivas`;
    toggleHidden(dom.summaryPerceptionNote, false);
  } else {
    toggleHidden(dom.summaryPerceptionNote, true);
  }

  toggleHidden(dom.paymentPriceSummary, false);
}

function calculateCost(km, consumption, fuelPrice) {
  const liters = km / consumption;
  const cost = liters * fuelPrice;
  return { liters: +liters.toFixed(2), cost: +cost.toFixed(2) };
}

function toggleHidden(el, hide) {
  if (el) el.classList.toggle('hidden', hide);
}

function setButtonLoading(btn, loading) {
  btn.disabled = loading;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  if (text) text.classList.toggle('hidden', loading);
  if (loader) loader.classList.toggle('hidden', !loading);
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast' + (type === 'error' ? ' toast-error' : '');
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3000);
}

function haptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

function getActiveVehicle() {
  return state.vehicles.find((v) => v.id === state.activeVehicleId) || null;
}

// ============================================================
// 6. NAVIGATION (3 views)
// ============================================================

function navigateTo(tab) {
  state.currentTab = tab;
  dom.viewsContainer.classList.remove('show-detail', 'show-dashboard');

  if (tab === 'detail') {
    dom.viewsContainer.classList.add('show-detail');
    renderVehiclePills();
    // Auto-load first/last vehicle if none selected
    if (!state.activeVehicleId && state.vehicles.length > 0) {
      const vehicleId = state.lastVisitedVehicleId || state.vehicles[0].id;
      selectVehicle(vehicleId);
    }
  } else if (tab === 'dashboard') {
    dom.viewsContainer.classList.add('show-dashboard');
    if (!state.dashboardLoaded) {
      loadDashboard();
    }
  }

  // Reset scroll to top on target view
  const viewMap = { detail: '#view-detail', home: '#view-home', dashboard: '#view-dashboard' };
  const targetView = $(viewMap[tab]);
  if (targetView) targetView.scrollTop = 0;

  updateActiveTab(tab);
}

function updateActiveTab(tab) {
  dom.bottomNav.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

// ============================================================
// 7. SWIPE GESTURE (3 views)
// ============================================================

function initSwipeGesture() {
  const container = dom.viewsContainer;
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let swiping = false;

  container.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
    swiping = false;
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = Math.abs(touch.clientY - startY);

    if (deltaY > 50 && !swiping) {
      tracking = false;
      return;
    }

    if (Math.abs(deltaX) > 20 && deltaY < 50) {
      swiping = true;
    }
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (!swiping) {
      tracking = false;
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const threshold = Math.min(80, window.innerWidth * 0.25);

    const currentIndex = TABS.indexOf(state.currentTab);

    if (deltaX > threshold && currentIndex > 0) {
      // Swipe right → go to previous tab
      navigateTo(TABS[currentIndex - 1]);
      haptic();
    } else if (deltaX < -threshold && currentIndex < TABS.length - 1) {
      // Swipe left → go to next tab
      navigateTo(TABS[currentIndex + 1]);
      haptic();
    }

    tracking = false;
    swiping = false;
  }, { passive: true });
}

// ============================================================
// 8. SUPABASE DATA FUNCTIONS (CRUD)
// ============================================================

async function fetchVehicles() {
  const { data, error } = await db
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function createVehicle(vehicle) {
  const { data, error } = await db
    .from('vehicles')
    .insert(vehicle)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateVehicle(id, updates) {
  const { data, error } = await db
    .from('vehicles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteVehicle(id) {
  const { error } = await db
    .from('vehicles')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

async function fetchTrips(vehicleId) {
  const { data, error } = await db
    .from('trips')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function createTrip(trip) {
  const { data, error } = await db
    .from('trips')
    .insert(trip)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateTrip(id, data) {
  const { error } = await db.from('trips').update(data).eq('id', id);
  if (error) throw error;
}

async function deleteTrip(id) {
  const { error } = await db
    .from('trips')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

async function deleteTripsForVehicle(vehicleId) {
  const { error } = await db
    .from('trips')
    .delete()
    .eq('vehicle_id', vehicleId);
  if (error) throw error;
}

// v13: Drive-type aware recalculation
async function recalculateTrips(vehicleId, vehiclePayload) {
  const { data: trips, error: fetchErr } = await db
    .from('trips')
    .select('*')
    .eq('vehicle_id', vehicleId);
  if (fetchErr) throw fetchErr;

  for (const trip of trips) {
    const driveType = trip.drive_type || 'Mixto';
    const consumption = getConsumptionForDriveType(vehiclePayload, driveType);
    const { liters, cost } = calculateCost(trip.km, consumption, vehiclePayload.fuel_price);
    const { error } = await db
      .from('trips')
      .update({ liters, cost })
      .eq('id', trip.id);
    if (error) throw error;
  }
}

async function fetchLastTrips(vehicleIds) {
  if (vehicleIds.length === 0) return {};
  const { data, error } = await db
    .from('trips')
    .select('vehicle_id, driver, created_at')
    .in('vehicle_id', vehicleIds)
    .order('created_at', { ascending: false });
  if (error) return {};
  const lastTrips = {};
  data.forEach((t) => {
    if (!lastTrips[t.vehicle_id]) lastTrips[t.vehicle_id] = t;
  });
  return lastTrips;
}

async function fetchLatestFuelPrices(vehicleIds) {
  if (vehicleIds.length === 0) return {};
  const { data, error } = await db
    .from('payments')
    .select('vehicle_id, price_per_liter')
    .in('vehicle_id', vehicleIds)
    .gt('price_per_liter', 0)
    .order('created_at', { ascending: false });
  if (error) return {};
  const prices = {};
  data.forEach((p) => {
    if (!prices[p.vehicle_id]) prices[p.vehicle_id] = p.price_per_liter;
  });
  return prices;
}

// --- Payments CRUD ---

async function fetchPayments(vehicleId) {
  const { data, error } = await db
    .from('payments')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function createPayment(payment) {
  const { data, error } = await db
    .from('payments')
    .insert(payment)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updatePayment(id, data) {
  const { error } = await db.from('payments').update(data).eq('id', id);
  if (error) throw error;
}

async function deletePayment(id) {
  const { error } = await db
    .from('payments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// --- Dashboard Data ---

async function fetchAllTrips() {
  const { data, error } = await db
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function fetchAllPayments() {
  const { data, error } = await db
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ============================================================
// 9. UI RENDERING FUNCTIONS
// ============================================================

async function renderVehicleCards() {
  dom.vehiclesGrid.innerHTML = '';
  toggleHidden(dom.homeLoading, true);

  if (state.vehicles.length === 0) {
    toggleHidden(dom.noVehiclesMsg, false);
    return;
  }

  toggleHidden(dom.noVehiclesMsg, true);

  const vehicleIds = state.vehicles.map((v) => v.id);
  const [lastTrips, latestPrices] = await Promise.all([
    fetchLastTrips(vehicleIds),
    fetchLatestFuelPrices(vehicleIds),
  ]);

  state.vehicles.forEach((v, index) => {
    const drivers = v.drivers || [];
    const lastTrip = lastTrips[v.id];
    const fuelPrice = latestPrices[v.id] || v.fuel_price;
    const costPerKm = fuelPrice / v.consumption;
    const isLastVisited = v.id === state.lastVisitedVehicleId;

    const card = document.createElement('div');
    card.className = 'vehicle-card' + (isLastVisited ? ' last-visited' : '');
    card.style.animationDelay = (index * 60) + 'ms';
    card.innerHTML = `
      <div class="vehicle-card-header">
        <div>
          <div class="vehicle-card-name">${v.name}</div>
          <div class="vehicle-card-model">${v.model}</div>
        </div>
        <span class="vehicle-card-arrow">&#8250;</span>
      </div>
      <div class="vehicle-card-badges">
        <span class="badge">${v.consumption} km/l</span>
        <span class="badge">${v.fuel_type}</span>
        <span class="badge badge-highlight">${formatCurrency(fuelPrice)}/l</span>
        <span class="badge badge-highlight">${formatCurrency(costPerKm)}/km</span>
      </div>
      <div class="vehicle-card-footer">
        <span>${drivers.length} persona${drivers.length !== 1 ? 's' : ''}</span>
        <span>${lastTrip ? formatDate(lastTrip.occurred_at || lastTrip.created_at) + ' · ' + lastTrip.driver : 'Sin viajes'}</span>
      </div>
    `;
    card.addEventListener('click', () => selectVehicle(v.id));
    dom.vehiclesGrid.appendChild(card);
  });
}

function renderVehiclePills() {
  dom.vehiclePills.innerHTML = '';

  if (state.vehicles.length === 0) {
    toggleHidden(dom.vehiclePills, true);
    return;
  }

  toggleHidden(dom.vehiclePills, false);

  state.vehicles.forEach((v) => {
    const pill = document.createElement('button');
    pill.className = 'vehicle-pill' + (v.id === state.activeVehicleId ? ' active' : '');
    pill.textContent = v.name;
    pill.addEventListener('click', () => {
      if (v.id !== state.activeVehicleId) {
        selectVehicle(v.id);
        haptic();
      }
    });
    dom.vehiclePills.appendChild(pill);
  });
}

function updatePillsActive() {
  dom.vehiclePills.querySelectorAll('.vehicle-pill').forEach((pill, i) => {
    pill.classList.toggle('active', state.vehicles[i] && state.vehicles[i].id === state.activeVehicleId);
  });
}

function renderVehicleDetail() {
  const vehicle = getActiveVehicle();
  if (!vehicle) {
    toggleHidden(dom.detailEmpty, state.vehicles.length > 0);
    toggleHidden(dom.vehiclePills, state.vehicles.length === 0);
    toggleHidden(dom.detailContent, true);
    return;
  }

  toggleHidden(dom.detailEmpty, true);
  toggleHidden(dom.detailContent, false);
  updatePillsActive();

  dom.detailTitle.textContent = vehicle.name;
  dom.vehicleModelBadge.textContent = vehicle.model;
  // v13: Show consumption by drive type if known model
  const spec = VEHICLE_DATABASE[vehicle.model];
  if (spec) {
    dom.vehicleConsumptionBadge.textContent =
      `🏙️${spec.city_km_l} · 🛣️${spec.mixed_km_l} · 🏁${spec.highway_km_l} km/l`;
  } else {
    dom.vehicleConsumptionBadge.textContent = vehicle.consumption + ' km/l';
  }
  dom.vehicleFuelTypeBadge.textContent = vehicle.fuel_type;
  const latestPrice = getLatestFuelPrice(vehicle);
  dom.vehicleFuelPriceBadge.textContent = formatCurrency(latestPrice) + '/l';

  const mixedConsumption = spec ? spec.mixed_km_l : vehicle.consumption;
  const costPerKm = latestPrice / mixedConsumption;
  dom.vehicleCostKmBadge.textContent = formatCurrency(costPerKm) + '/km';

  // v14.1: Show learned consumption if it differs from spec
  if (spec && Math.abs(vehicle.consumption - spec.mixed_km_l) > 0.3) {
    dom.vehicleLearnedBadge.textContent = `📊 Consumo histórico real: ${vehicle.consumption} km/l`;
    toggleHidden(dom.vehicleLearnedBadge, false);
  } else {
    toggleHidden(dom.vehicleLearnedBadge, true);
  }

  // v13: Tank indicator with real capacity
  const tankLevel = calculateTankLevel();
  const loads = state.payments.filter(p => p.liters_loaded > 0).map(p => Number(p.liters_loaded));
  const tankCap = getVehicleTankCapacity(vehicle);
  const effectiveCap = tankCap || (loads.length > 0 ? Math.max(...loads) : 50);

  if (state.payments.length > 0) {
    const tankPercent = Math.min(Math.max((tankLevel / effectiveCap) * 100, 0), 100);
    dom.tankBarFill.style.width = tankPercent + '%';
    dom.tankBarFill.className = 'tank-bar-fill' + (tankPercent < 20 ? ' tank-low' : '');
    dom.tankLitersLabel.textContent = tankCap
      ? `${tankLevel.toFixed(1)} / ${tankCap} lts`
      : `${tankLevel.toFixed(1)} lts`;
    dom.tankPriceLabel.textContent = `Precio Prom: ${formatCurrency(latestPrice)}/l`;
    toggleHidden(dom.tankIndicator, false);
  } else {
    toggleHidden(dom.tankIndicator, true);
  }

  renderDriverSelect(vehicle.drivers || []);
  // v14.6: Default occurred_at for trip form
  if (!state.editingTripId) dom.tripOccurredAt.value = toLocalDatetimeValue();

  // Apply stagger animation to detail content children
  const detailContent = dom.detailContent;
  detailContent.classList.remove('detail-stagger');
  void detailContent.offsetWidth;
  detailContent.classList.add('detail-stagger');
  Array.from(detailContent.children).forEach((child, i) => {
    child.style.animationDelay = (i * 50) + 'ms';
  });
}

function renderDriverSelect(drivers) {
  dom.tripDriver.innerHTML = '<option value="">Seleccionar...</option>';
  drivers.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    dom.tripDriver.appendChild(opt);
  });
}

function renderTrips() {
  const trips = state.trips;
  const vehicle = getActiveVehicle();
  const vehicleDrivers = vehicle ? (vehicle.drivers || []) : [];

  toggleHidden(dom.tripsLoading, true);

  if (trips.length === 0) {
    toggleHidden(dom.tripsEmpty, false);
    toggleHidden(dom.tripsTable, true);
    return;
  }

  toggleHidden(dom.tripsEmpty, true);
  toggleHidden(dom.tripsTable, false);

  dom.tripsTbody.innerHTML = '';

  // v14.7: Build audit cycle boundaries from full tank loads
  const fullTanks = state.payments
    .filter(p => p.is_full_tank && p.liters_loaded > 0)
    .sort((a, b) => getEventDate(b) - getEventDate(a));

  function getCycleHeader(trip) {
    const tripDate = getEventDate(trip);
    for (let i = 0; i < fullTanks.length - 1; i++) {
      const cycleEnd = getEventDate(fullTanks[i]);
      const cycleStart = getEventDate(fullTanks[i + 1]);
      if (tripDate > cycleStart && tripDate <= cycleEnd) {
        return `Ciclo ${formatDate(fullTanks[i + 1].occurred_at || fullTanks[i + 1].created_at)} — ${formatDate(fullTanks[i].occurred_at || fullTanks[i].created_at)}`;
      }
    }
    return null;
  }

  let currentGroup = '';

  trips.forEach((trip) => {
    const cycleHeader = getCycleHeader(trip);
    const groupKey = cycleHeader || getDateGroup(trip.occurred_at || trip.created_at);

    if (groupKey !== currentGroup) {
      currentGroup = groupKey;
      const groupRow = document.createElement('tr');
      if (cycleHeader) {
        groupRow.innerHTML = `<td colspan="8" class="trip-date-group trip-cycle-header">
          ${cycleHeader} <span class="badge-cycle">AUDITADO</span>
        </td>`;
      } else {
        groupRow.innerHTML = `<td colspan="8" class="trip-date-group">${groupKey}</td>`;
      }
      dom.tripsTbody.appendChild(groupRow);
    }

    const driverIdx = vehicleDrivers.indexOf(trip.driver);
    const pilotColor = PILOT_COLORS[driverIdx >= 0 ? driverIdx % PILOT_COLORS.length : 0];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Fecha ">${formatDate(trip.occurred_at || trip.created_at)}</td>
      <td data-label="Piloto " style="color:${pilotColor};font-weight:600">${trip.driver}</td>
      <td data-label="Km ">${Number(trip.km).toLocaleString('es-AR')}</td>
      <td data-label="Litros ">${Number(trip.liters).toFixed(2)}</td>
      <td data-label="Costo "><strong>${formatCurrency(trip.cost)}</strong>${(trip.is_reconciled === true || trip.is_reconciled === 'true') ? '<span class="reconciled-check" title="Costo verificado por auditoría">✓</span>' : ''}</td>
      <td data-label="Tipo ">${getDriveTypeEmoji(trip.drive_type)}</td>
      <td data-label="Nota " class="trip-note" title="${trip.note || ''}">${trip.note || '-'}</td>
      <td></td>
    `;
    // v14.2: Reconciliation check click handler
    const reconBadge = tr.querySelector('.reconciled-check');
    if (reconBadge) {
      reconBadge.addEventListener('click', () => showReconciliationBreakdown(trip));
    }
    // v12: Edit button for trips
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon btn-icon-edit';
    editBtn.title = 'Editar viaje';
    editBtn.innerHTML = '&#9998;';
    editBtn.addEventListener('click', () => openTripEditModal(trip));
    tr.lastElementChild.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-icon-danger';
    deleteBtn.title = 'Eliminar viaje';
    deleteBtn.innerHTML = '&#128465;';
    deleteBtn.addEventListener('click', () => handleDeleteTrip(trip.id));
    tr.lastElementChild.appendChild(deleteBtn);

    dom.tripsTbody.appendChild(tr);
  });
}

function renderSummary() {
  const vehicle = getActiveVehicle();
  const drivers = vehicle ? (vehicle.drivers || []) : [];
  const trips = state.trips;
  const totals = {};

  drivers.forEach((d) => {
    totals[d] = { km: 0, cost: 0, trips: 0 };
  });

  trips.forEach((trip) => {
    if (totals[trip.driver]) {
      totals[trip.driver].km += Number(trip.km);
      totals[trip.driver].cost += Number(trip.cost);
      totals[trip.driver].trips += 1;
    }
  });

  dom.summaryGrid.innerHTML = '';
  let grandTotal = 0;

  drivers.forEach((driver) => {
    const data = totals[driver];
    grandTotal += data.cost;

    const card = document.createElement('div');
    card.className = 'summary-card';
    card.innerHTML = `
      <div class="driver-name">${driver}</div>
      <div class="driver-cost">${formatCurrency(data.cost)}</div>
      <div class="driver-stats">${data.trips} viaje${data.trips !== 1 ? 's' : ''} · ${Number(data.km).toLocaleString('es-AR')} km</div>
    `;
    dom.summaryGrid.appendChild(card);
  });

  dom.summaryTotalValue.textContent = formatCurrency(grandTotal);
}

function renderBalances() {
  const vehicle = getActiveVehicle();
  const drivers = vehicle ? (vehicle.drivers || []) : [];

  // Créditos: cargas de combustible (payments)
  const credits = {};
  // Débitos: consumo por viajes (trips)
  const debits = {};
  drivers.forEach((d) => { credits[d] = 0; debits[d] = 0; });

  state.payments.forEach((p) => {
    if (credits[p.driver] !== undefined) credits[p.driver] += Number(p.amount);
  });
  state.trips.forEach((t) => {
    if (debits[t.driver] !== undefined) debits[t.driver] += Number(t.cost);
  });

  dom.balancesGrid.innerHTML = '';
  const balances = [];

  drivers.forEach((driver, idx) => {
    const credit = credits[driver];
    const debit = debits[driver];
    const net = +(credit - debit).toFixed(2);
    balances.push({ driver, net });
    const pilotColor = PILOT_COLORS[idx % PILOT_COLORS.length];

    const card = document.createElement('div');
    card.className = 'balance-card';
    card.style.borderLeft = `3px solid ${pilotColor}`;
    const isPositive = net > 0;
    const isZero = Math.abs(net) < 0.01;
    card.innerHTML = `
      <div class="balance-summary">
        <div class="driver-name" style="color:${pilotColor}">${driver}</div>
        <div class="balance-amount ${isZero ? 'clear' : isPositive ? 'clear' : 'debt'}">
          ${isZero ? 'Al dia' : (isPositive ? '+' : '') + formatCurrency(net)}
        </div>
      </div>
      <div class="balance-expand hidden">
        <div class="balance-detail">
          <span>Aportes:</span><strong>${formatCurrency(credit)}</strong>
        </div>
        <div class="balance-detail">
          <span>Consumo:</span><strong>${formatCurrency(debit)}</strong>
        </div>
        ${isZero ? '<span class="badge-clear">Saldado</span>' :
          isPositive ? '<span class="badge-clear">A favor</span>' : ''}
        ${net < -0.01 ? `<button class="btn-settle-pilot" data-driver="${driver}">Saldar cuenta</button>` : ''}
      </div>
    `;

    card.querySelector('.balance-summary').addEventListener('click', () => {
      card.querySelector('.balance-expand').classList.toggle('hidden');
    });

    const settleBtn = card.querySelector('.btn-settle-pilot');
    if (settleBtn) {
      settleBtn.addEventListener('click', () => handleClearPilotAccount(driver));
    }

    dom.balancesGrid.appendChild(card);
  });

  renderClearing(balances);
}

function renderClearing(balances) {
  const debtors = balances.filter(b => b.net < -0.01).map(b => ({ driver: b.driver, net: +Math.abs(b.net).toFixed(2) }));
  const creditors = balances.filter(b => b.net > 0.01).map(b => ({ driver: b.driver, net: +b.net.toFixed(2) }));

  debtors.sort((a, b) => b.net - a.net);
  creditors.sort((a, b) => b.net - a.net);

  const transfers = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = +Math.min(debtors[i].net, creditors[j].net).toFixed(2);
    if (amount > 0.01) {
      transfers.push({ from: debtors[i].driver, to: creditors[j].driver, amount });
    }
    debtors[i].net = +(debtors[i].net - amount).toFixed(2);
    creditors[j].net = +(creditors[j].net - amount).toFixed(2);
    if (debtors[i].net < 0.01) i++;
    if (creditors[j].net < 0.01) j++;
  }

  dom.clearingList.innerHTML = '';
  if (transfers.length === 0) {
    toggleHidden(dom.clearingSection, true);
    return;
  }

  toggleHidden(dom.clearingSection, false);
  transfers.forEach((t) => {
    const item = document.createElement('div');
    item.className = 'clearing-item';
    item.innerHTML = `
      <span>${t.from}</span>
      <span class="clearing-arrow">&rarr;</span>
      <span>${t.to}</span>
      <span class="clearing-amount">${formatCurrency(t.amount)}</span>
    `;
    dom.clearingList.appendChild(item);
  });
}

function renderPaymentHistory() {
  const payments = state.payments;
  const vehicle = getActiveVehicle();
  const vehicleDrivers = vehicle ? (vehicle.drivers || []) : [];
  dom.paymentsList.innerHTML = '';

  if (payments.length === 0) {
    toggleHidden(dom.paymentsEmpty, false);
    return;
  }

  toggleHidden(dom.paymentsEmpty, true);

  payments.forEach((p) => {
    const item = document.createElement('div');
    const isSettlement = p.note && p.note.toLowerCase().includes('saldado') && !p.liters_loaded;
    item.className = 'payment-item' + (isSettlement ? ' payment-item-settlement' : '');
    const driverIdx = vehicleDrivers.indexOf(p.driver);
    const dotColor = PILOT_COLORS[driverIdx >= 0 ? driverIdx % PILOT_COLORS.length : 0];
    const extraInfo = [];
    if (p.liters_loaded) extraInfo.push(`${p.liters_loaded} lts`);
    if (p.price_per_liter) extraInfo.push(`${formatCurrency(p.price_per_liter)}/l`);
    if (p.is_full_tank) extraInfo.push('Tanque lleno');
    const metaParts = [formatDate(p.occurred_at || p.created_at), ...extraInfo];
    if (p.note) metaParts.push(p.note);

    // v10: Badge Factura A
    const facturaBadge = (!isSettlement && p.invoice_type === 'Factura A')
      ? '<span class="badge-factura-a">FACTURA A</span>' : '';

    if (isSettlement) {
      item.innerHTML = `
        <div class="settlement-icon">&#128181;</div>
        <div class="payment-info">
          <div class="payment-driver">${p.driver}</div>
          <div class="payment-meta">${metaParts.join(' · ')}</div>
        </div>
        <span class="payment-amount settlement-amount">${formatCurrency(p.amount)}</span>
      `;
    } else {
      item.innerHTML = `
        <div class="pilot-dot" style="background:${dotColor}"></div>
        <div class="payment-info">
          <div class="payment-driver">${p.driver} ${facturaBadge}</div>
          <div class="payment-meta">${metaParts.join(' · ')}</div>
        </div>
        <span class="payment-amount">${formatCurrency(p.amount)}</span>
      `;
    }

    // v10: Info breakdown button for non-settlement payments
    if (!isSettlement && (p.tax_perceptions > 0 || p.discount_amount > 0 || p.liters_loaded)) {
      const infoBtn = document.createElement('button');
      infoBtn.className = 'btn-info-breakdown';
      infoBtn.title = 'Ver desglose';
      infoBtn.innerHTML = '\u24D8';
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPaymentBreakdown(p);
      });
      item.appendChild(infoBtn);
    }

    // v12: Edit button for non-settlement payments
    if (!isSettlement) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-icon btn-icon-edit';
      editBtn.title = 'Editar carga';
      editBtn.innerHTML = '&#9998;';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPaymentModal(p.id);
      });
      item.appendChild(editBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-icon-danger';
    deleteBtn.title = 'Eliminar carga';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.style.fontSize = '1.1rem';
    deleteBtn.addEventListener('click', () => handleDeletePayment(p));
    item.appendChild(deleteBtn);

    dom.paymentsList.appendChild(item);
  });
}

// v10: Show payment breakdown popup
function showPaymentBreakdown(payment) {
  const existing = document.querySelector('.payment-breakdown-popup');
  if (existing) existing.remove();

  const perceptions = payment.tax_perceptions || 0;
  const discount = payment.discount_amount || 0;
  const montoSurtidor = payment.amount - perceptions;
  const pumpPrice = payment.liters_loaded > 0 ? montoSurtidor / payment.liters_loaded : null;
  const effectivePrice = payment.liters_loaded > 0 ? payment.amount / payment.liters_loaded : null;

  const popup = document.createElement('div');
  popup.className = 'payment-breakdown-popup ticket-popup';

  let html = '<button class="breakdown-close" id="breakdown-close-btn">&times;</button>';

  if (pumpPrice !== null) {
    html += `<div class="breakdown-row">
      <span>Monto Surtidor:</span>
      <strong>${formatCurrency(montoSurtidor)}</strong>
    </div>`;
  }
  if (perceptions > 0) {
    html += `<div class="breakdown-row">
      <span>Impuestos (percepciones):</span>
      <strong>+${formatCurrency(perceptions)}</strong>
    </div>`;
  }
  if (discount > 0) {
    html += `<div class="breakdown-row">
      <span>Descuento/Reintegro:</span>
      <strong>-${formatCurrency(discount)}</strong>
    </div>`;
  }
  html += `<div class="breakdown-row total-row">
    <span>TOTAL PAGADO:</span>
    <strong>${formatCurrency(payment.amount)}</strong>
  </div>`;

  if (effectivePrice !== null) {
    html += `<div class="breakdown-row">
      <span>Precio Efectivo:</span>
      <strong>${formatCurrency(effectivePrice)}/l</strong>
    </div>`;
    if (pumpPrice !== null && perceptions > 0) {
      html += `<div class="breakdown-row">
        <span>Precio Surtidor:</span>
        <strong>${formatCurrency(pumpPrice)}/l</strong>
      </div>`;
    }
  }

  popup.innerHTML = html;
  document.body.appendChild(popup);

  popup.querySelector('#breakdown-close-btn').addEventListener('click', () => popup.remove());

  setTimeout(() => {
    const handler = (e) => {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 100);
}

// v14.2: Show reconciliation breakdown popup
function showReconciliationBreakdown(trip) {
  const existing = document.querySelector('.payment-breakdown-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = 'payment-breakdown-popup ticket-popup';

  const reconDate = trip.reconciled_at ? formatDate(trip.reconciled_at) : '—';
  const origConsumption = trip.original_consumption ? Number(trip.original_consumption).toFixed(1) : '—';
  const realConsumption = trip.real_consumption ? Number(trip.real_consumption).toFixed(1) : '—';

  popup.innerHTML = `
    <button class="breakdown-close" id="breakdown-close-btn">&times;</button>
    <div class="breakdown-row" style="font-weight:600;margin-bottom:0.5rem">
      ⚖️ Reconciliación de Viaje
    </div>
    <div class="breakdown-row">
      <span>Consumo estimado:</span>
      <strong>${origConsumption} km/l</strong>
    </div>
    <div class="breakdown-row">
      <span>Consumo real:</span>
      <strong>${realConsumption} km/l</strong>
    </div>
    <div class="breakdown-row total-row">
      <span>Ajustado el:</span>
      <strong>${reconDate}</strong>
    </div>
  `;

  document.body.appendChild(popup);
  popup.querySelector('#breakdown-close-btn').addEventListener('click', () => popup.remove());
  setTimeout(() => {
    const handler = (e) => {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 100);
}

function populateFormOptions() {
  Object.keys(VEHICLE_DATABASE).forEach((model) => {
    const spec = VEHICLE_DATABASE[model];
    const opt = document.createElement('option');
    opt.value = model;
    opt.textContent = `${model} (${spec.mixed_km_l} km/l · ${spec.tank}L)`;
    dom.vehicleModelSelect.appendChild(opt);
  });

  FUEL_TYPES.forEach((type) => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    dom.vehicleFuelTypeSelect.appendChild(opt);
  });
}

// --- Dynamic driver inputs in vehicle modal ---

function addDriverInput(name) {
  const row = document.createElement('div');
  row.className = 'driver-input-row';
  row.innerHTML = `
    <input type="text" class="driver-name-input" placeholder="Nombre" required value="${name || ''}">
    <button type="button" class="btn-icon btn-icon-danger btn-remove-driver" title="Quitar">&times;</button>
  `;
  row.querySelector('.btn-remove-driver').addEventListener('click', () => {
    row.remove();
  });
  dom.driversContainer.appendChild(row);
}

function getDriverNames() {
  const inputs = dom.driversContainer.querySelectorAll('.driver-name-input');
  const names = [];
  inputs.forEach((input) => {
    const val = input.value.trim();
    if (val) names.push(val);
  });
  return names;
}

// ============================================================
// 10. DASHBOARD
// ============================================================

async function loadDashboard() {
  try {
    const [allTrips, allPayments] = await Promise.all([
      fetchAllTrips(),
      fetchAllPayments(),
    ]);
    state.allTrips = allTrips;
    state.allPayments = allPayments;
    state.dashboardLoaded = true;
    populateDashboardFilter();
    renderDashboard();
  } catch (err) {
    showToast('Error al cargar dashboard: ' + err.message, 'error');
  }
}

function populateDashboardFilter() {
  const select = dom.dashboardFilter;
  // Keep "all" option, remove others
  while (select.options.length > 1) {
    select.remove(1);
  }
  state.vehicles.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.name;
    select.appendChild(opt);
  });
}

function renderDashboard() {
  const filterValue = dom.dashboardFilter.value;
  const filterVehicleId = filterValue === 'all' ? null : parseInt(filterValue);

  const trips = filterVehicleId
    ? state.allTrips.filter((t) => t.vehicle_id === filterVehicleId)
    : state.allTrips;

  // --- General Stats ---
  let totalSpent = 0;
  let totalKm = 0;
  trips.forEach((t) => {
    totalSpent += Number(t.cost);
    totalKm += Number(t.km);
  });

  dom.dashTotalSpent.textContent = formatCurrency(totalSpent);
  dom.dashTotalSpent.dataset.full = formatCurrency(totalSpent);
  dom.dashTotalSpent.dataset.short = formatCurrencyShort(totalSpent);
  dom.dashTotalTrips.textContent = trips.length;
  dom.dashTotalKm.textContent = totalKm.toLocaleString('es-AR', { maximumFractionDigits: 0 });

  // --- Monthly Comparison ---
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  let currentMonthTotal = 0;
  let prevMonthTotal = 0;

  trips.forEach((t) => {
    const d = new Date(t.created_at);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      currentMonthTotal += Number(t.cost);
    } else if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
      prevMonthTotal += Number(t.cost);
    }
  });

  const currentMonthDate = new Date(currentYear, currentMonth, 1);
  const prevMonthDate = new Date(prevYear, prevMonth, 1);

  dom.dashCurrentMonthLabel.textContent = getMonthName(currentMonthDate).charAt(0).toUpperCase() + getMonthName(currentMonthDate).slice(1);
  dom.dashPrevMonthLabel.textContent = getMonthName(prevMonthDate).charAt(0).toUpperCase() + getMonthName(prevMonthDate).slice(1);
  dom.dashCurrentMonth.textContent = formatCurrency(currentMonthTotal);
  dom.dashPrevMonth.textContent = formatCurrency(prevMonthTotal);

  // Variation
  if (prevMonthTotal > 0) {
    const variation = ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
    const sign = variation >= 0 ? '+' : '';
    const className = variation > 0 ? 'up' : variation < 0 ? 'down' : 'neutral';
    const arrow = variation > 0 ? '&#9650;' : variation < 0 ? '&#9660;' : '&#8211;';
    dom.dashVariation.innerHTML = `<span class="month-variation ${className}">${arrow} ${sign}${variation.toFixed(1)}% vs mes anterior</span>`;
  } else if (currentMonthTotal > 0) {
    dom.dashVariation.innerHTML = '<span class="month-variation neutral">Sin datos del mes anterior</span>';
  } else {
    dom.dashVariation.innerHTML = '';
  }

  // --- Per Vehicle Breakdown ---
  toggleHidden(dom.dashPerVehicleCard, !!filterVehicleId);

  if (!filterVehicleId) {
    const vehicleTotals = {};
    state.vehicles.forEach((v) => {
      vehicleTotals[v.id] = { name: v.name, spent: 0, trips: 0 };
    });

    state.allTrips.forEach((t) => {
      if (vehicleTotals[t.vehicle_id]) {
        vehicleTotals[t.vehicle_id].spent += Number(t.cost);
        vehicleTotals[t.vehicle_id].trips += 1;
      }
    });

    const entries = Object.values(vehicleTotals).filter((v) => v.trips > 0);
    const maxSpent = Math.max(...entries.map((v) => v.spent), 1);

    dom.dashVehicleBreakdown.innerHTML = '';
    entries.sort((a, b) => b.spent - a.spent).forEach((v) => {
      const pct = (v.spent / maxSpent) * 100;
      const item = document.createElement('div');
      item.className = 'vehicle-breakdown-item';
      item.innerHTML = `
        <div class="breakdown-header">
          <span class="breakdown-name">${v.name}</span>
          <span class="breakdown-value">${formatCurrency(v.spent)}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="breakdown-meta">${v.trips} viaje${v.trips !== 1 ? 's' : ''}</div>
      `;
      dom.dashVehicleBreakdown.appendChild(item);
    });

    if (entries.length === 0) {
      dom.dashVehicleBreakdown.innerHTML = '<p class="text-muted">Sin datos</p>';
    }
  }

  // --- Recent Activity ---
  const recentTrips = trips.slice(0, 5);

  if (recentTrips.length === 0) {
    dom.dashRecentActivity.innerHTML = '';
    toggleHidden(dom.dashNoActivity, false);
  } else {
    toggleHidden(dom.dashNoActivity, true);
    dom.dashRecentActivity.innerHTML = '';

    recentTrips.forEach((t) => {
      const vehicle = state.vehicles.find((v) => v.id === t.vehicle_id);
      const vehicleName = vehicle ? vehicle.name : 'Vehiculo';

      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <div class="activity-dot"></div>
        <div class="activity-info">
          <div class="activity-main">${t.driver} · ${vehicleName}</div>
          <div class="activity-meta">${formatDateShort(t.created_at)} · ${Number(t.km).toLocaleString('es-AR')} km</div>
        </div>
        <div class="activity-cost">${formatCurrency(t.cost)}</div>
      `;
      dom.dashRecentActivity.appendChild(item);
    });
  }

  // --- Analytics ---
  renderPilotRanking();
  renderPriceTrend();
}

// --- Pilot Ranking ---

function renderPilotRanking() {
  const filterValue = dom.dashboardFilter.value;
  const filterVehicleId = filterValue === 'all' ? null : parseInt(filterValue);

  const trips = filterVehicleId
    ? state.allTrips.filter(t => t.vehicle_id === filterVehicleId)
    : state.allTrips;

  const pilotStats = {};
  trips.forEach(t => {
    if (!pilotStats[t.driver]) pilotStats[t.driver] = { km: 0, liters: 0, trips: 0 };
    pilotStats[t.driver].km += Number(t.km);
    pilotStats[t.driver].liters += Number(t.liters);
    pilotStats[t.driver].trips += 1;
  });

  const ranking = Object.entries(pilotStats)
    .filter(([, s]) => s.liters > 0)
    .map(([driver, s]) => ({ driver, avg: +(s.km / s.liters).toFixed(1), trips: s.trips, km: s.km }))
    .sort((a, b) => b.avg - a.avg);

  const container = dom.dashPilotRanking;
  container.innerHTML = '';

  if (ranking.length === 0) {
    container.innerHTML = '<p class="text-muted">Sin datos suficientes</p>';
    return;
  }

  ranking.forEach((p, idx) => {
    const medal = idx === 0 ? '&#129351;' : idx === 1 ? '&#129352;' : idx === 2 ? '&#129353;' : '';
    const vehicle = filterVehicleId ? state.vehicles.find(v => v.id === filterVehicleId) : null;
    const driverIdx = vehicle ? (vehicle.drivers || []).indexOf(p.driver) : idx;
    const color = PILOT_COLORS[driverIdx >= 0 ? driverIdx % PILOT_COLORS.length : idx % PILOT_COLORS.length];

    const item = document.createElement('div');
    item.className = 'ranking-item';
    item.innerHTML = `
      <span class="ranking-medal">${medal}</span>
      <div class="ranking-info">
        <div class="ranking-name" style="color:${color}">${p.driver}</div>
        <div class="ranking-meta">${p.trips} viajes · ${p.km.toLocaleString('es-AR')} km</div>
      </div>
      <div class="ranking-value">${p.avg} km/l</div>
    `;
    container.appendChild(item);
  });
}

// --- Price Trend ---

function renderPriceTrend() {
  const filterValue = dom.dashboardFilter.value;
  const filterVehicleId = filterValue === 'all' ? null : parseInt(filterValue);

  const payments = (filterVehicleId
    ? state.allPayments.filter(p => p.vehicle_id === filterVehicleId)
    : state.allPayments)
    .filter(p => p.price_per_liter && p.price_per_liter > 0)
    .slice(0, 5);

  const container = dom.dashPriceTrend;
  container.innerHTML = '';

  if (payments.length === 0) {
    container.innerHTML = '<p class="text-muted">Sin precios registrados</p>';
    return;
  }

  payments.forEach(p => {
    const item = document.createElement('div');
    item.className = 'price-trend-item';
    item.innerHTML = `
      <div class="price-trend-date">${formatDateShort(p.created_at)}</div>
      <div class="price-trend-driver">${p.driver}</div>
      <div class="price-trend-value">${formatCurrency(p.price_per_liter)}/l</div>
    `;
    container.appendChild(item);
  });

  if (payments.length >= 2) {
    const latest = payments[0].price_per_liter;
    const prev = payments[1].price_per_liter;
    const diff = ((latest - prev) / prev * 100).toFixed(1);
    const trend = document.createElement('div');
    trend.className = `price-trend-indicator ${latest > prev ? 'up' : latest < prev ? 'down' : 'neutral'}`;
    trend.innerHTML = `${latest > prev ? '&#9650;' : latest < prev ? '&#9660;' : '&#8211;'} ${diff > 0 ? '+' : ''}${diff}% vs anterior`;
    container.appendChild(trend);
  }
}

// ============================================================
// 11. EVENT HANDLERS
// ============================================================

async function selectVehicle(vehicleId) {
  state.activeVehicleId = vehicleId;
  state.lastVisitedVehicleId = vehicleId;
  renderVehicleDetail();

  if (state.currentTab !== 'detail') {
    navigateTo('detail');
  } else {
    updatePillsActive();
  }

  $('#view-detail').scrollTop = 0;

  toggleHidden(dom.tripsLoading, false);
  toggleHidden(dom.tripsTable, true);
  toggleHidden(dom.tripsEmpty, true);

  try {
    const [trips, payments] = await Promise.all([
      fetchTrips(vehicleId),
      fetchPayments(vehicleId),
    ]);
    state.trips = trips;
    state.payments = payments;
    renderTrips();
    renderSummary();
    renderBalances();
    renderPaymentHistory();
    renderVehicleDetail(); // v11: Re-render con datos de tanque
  } catch (err) {
    showToast('Error al cargar datos: ' + err.message, 'error');
    toggleHidden(dom.tripsLoading, true);
  }
}

// --- Vehicle Modal ---

function openVehicleModal(mode, vehicleData) {
  state.modalMode = mode;
  dom.modalTitle.textContent = mode === 'edit' ? 'Editar vehiculo' : 'Agregar vehiculo';
  dom.vehicleForm.reset();
  dom.vehicleConsumptionInput.readOnly = true;
  dom.driversContainer.innerHTML = '';

  if (mode === 'edit' && vehicleData) {
    dom.vehicleFormId.value = vehicleData.id;
    dom.vehicleNameInput.value = vehicleData.name;
    dom.vehicleModelSelect.value = vehicleData.model;
    dom.vehicleConsumptionInput.value = vehicleData.consumption;
    dom.vehicleFuelTypeSelect.value = vehicleData.fuel_type;
    dom.vehicleFuelPriceInput.value = vehicleData.fuel_price;
    (vehicleData.drivers || []).forEach((name) => addDriverInput(name));
  } else {
    dom.vehicleFormId.value = '';
    addDriverInput('');
    addDriverInput('');
  }

  toggleHidden(dom.vehicleModal, false);
}

function closeVehicleModal() {
  toggleHidden(dom.vehicleModal, true);
}

async function handleVehicleSubmit(e) {
  e.preventDefault();
  const btn = dom.btnSubmitVehicle;
  setButtonLoading(btn, true);

  const drivers = getDriverNames();
  if (drivers.length === 0) {
    showToast('Agrega al menos una persona', 'error');
    setButtonLoading(btn, false);
    return;
  }

  const consumption = parseFloat(dom.vehicleConsumptionInput.value);
  const fuelPrice = parseFloat(dom.vehicleFuelPriceInput.value);

  if (!consumption || consumption <= 0) {
    showToast('El consumo debe ser mayor a 0', 'error');
    setButtonLoading(btn, false);
    return;
  }
  if (!fuelPrice || fuelPrice <= 0) {
    showToast('El precio del combustible debe ser mayor a 0', 'error');
    setButtonLoading(btn, false);
    return;
  }

  const payload = {
    name: dom.vehicleNameInput.value.trim(),
    model: dom.vehicleModelSelect.value,
    consumption,
    fuel_type: dom.vehicleFuelTypeSelect.value,
    fuel_price: fuelPrice,
    drivers,
  };

  try {
    if (state.modalMode === 'edit') {
      const editId = parseInt(dom.vehicleFormId.value);
      const oldVehicle = state.vehicles.find((v) => v.id === editId);

      await updateVehicle(editId, payload);

      if (oldVehicle &&
        (oldVehicle.fuel_price !== payload.fuel_price ||
          oldVehicle.consumption !== payload.consumption)) {
        await recalculateTrips(editId, payload);
      }

      showToast('Vehiculo actualizado');
      haptic();
    } else {
      await createVehicle(payload);
      showToast('Vehiculo agregado');
      haptic();
    }

    state.vehicles = await fetchVehicles();
    state.dashboardLoaded = false; // Force dashboard refresh

    if (state.modalMode === 'edit' && parseInt(dom.vehicleFormId.value) === state.activeVehicleId) {
      renderVehicleDetail();
      const [trips, payments] = await Promise.all([
        fetchTrips(state.activeVehicleId),
        fetchPayments(state.activeVehicleId),
      ]);
      state.trips = trips;
      state.payments = payments;
      renderTrips();
      renderSummary();
      renderBalances();
      renderPaymentHistory();
    }

    renderVehicleCards();
    closeVehicleModal();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// --- Vehicle Delete ---

function handleDeleteVehicleClick() {
  const vehicle = getActiveVehicle();
  if (!vehicle) return;

  dom.confirmTitle.textContent = 'Eliminar vehiculo';
  dom.confirmMessage.textContent =
    `¿Estas seguro de eliminar "${vehicle.name}"? Se eliminaran todos sus viajes y pagos.`;

  state.confirmAction = async () => {
    const btn = dom.btnConfirmOk;
    setButtonLoading(btn, true);
    try {
      await deleteVehicle(state.activeVehicleId);
      showToast('Vehiculo eliminado');
      haptic();
      state.vehicles = await fetchVehicles();
      state.activeVehicleId = null;
      state.dashboardLoaded = false;
      toggleHidden(dom.confirmModal, true);
      renderVehicleDetail(); // Show empty state
      navigateTo('home');
      renderVehicleCards();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  };

  toggleHidden(dom.confirmModal, false);
}

// --- Clear Trips ---

function handleClearTripsClick() {
  const vehicle = getActiveVehicle();
  if (!vehicle) return;
  if (state.trips.length === 0) {
    showToast('No hay viajes para limpiar', 'error');
    return;
  }

  dom.confirmTitle.textContent = 'Limpiar viajes';
  dom.confirmMessage.textContent =
    `¿Estas seguro de eliminar todos los viajes de "${vehicle.name}"?`;

  const btnText = dom.btnConfirmOk.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Limpiar';

  state.confirmAction = async () => {
    const btn = dom.btnConfirmOk;
    setButtonLoading(btn, true);
    try {
      await deleteTripsForVehicle(state.activeVehicleId);
      showToast('Viajes eliminados');
      haptic();
      state.trips = [];
      state.dashboardLoaded = false;
      renderTrips();
      renderSummary();
      renderBalances();
      toggleHidden(dom.confirmModal, true);
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
      if (btnText) btnText.textContent = 'Eliminar';
    }
  };

  toggleHidden(dom.confirmModal, false);
}

// --- Settle Pilot Account ---

function handleClearPilotAccount(driver) {
  const vehicle = getActiveVehicle();
  if (!vehicle) return;

  // Calcular deuda
  let credit = 0, debit = 0;
  state.payments.forEach(p => { if (p.driver === driver) credit += Number(p.amount); });
  state.trips.forEach(t => { if (t.driver === driver) debit += Number(t.cost); });
  const net = +(credit - debit).toFixed(2);

  if (net >= 0) {
    showToast(`${driver} no tiene deuda pendiente`, 'error');
    return;
  }

  const debt = Math.abs(net);

  // Abrir payment modal en modo saldado
  state.settlementMode = true;
  state.settlementDriver = driver;

  const select = dom.paymentDriver;
  select.innerHTML = `<option value="${driver}">${driver}</option>`;
  select.value = driver;

  dom.paymentAmount.value = debt.toFixed(2);
  dom.paymentLiters.value = '';
  dom.paymentPricePerLiter.value = '';
  dom.paymentFullTank.checked = false;
  dom.paymentNote.value = 'Saldado de deuda a: ';

  // Ocultar campos de combustible
  document.querySelectorAll('.settlement-hide').forEach(el => el.classList.add('hidden'));

  $('#payment-modal-title').textContent = `Saldar cuenta de ${driver}`;
  const btnText = dom.btnSubmitPayment.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Registrar saldo';

  toggleHidden(dom.paymentModal, false);
}

// --- Payment Modal ---

function openPaymentModal(editId) {
  state.settlementMode = false;
  state.settlementDriver = null;
  state.editingPaymentId = editId || null;

  const vehicle = getActiveVehicle();
  if (!vehicle) return;
  const select = dom.paymentDriver;
  select.innerHTML = '<option value="">Seleccionar...</option>';
  (vehicle.drivers || []).forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
  dom.paymentAmount.value = '';
  dom.paymentLiters.value = '';
  dom.paymentPricePerLiter.value = '';
  dom.paymentFullTank.checked = false;
  dom.paymentNote.value = '';

  // v10: Reset fiscal fields
  dom.paymentFacturaA.checked = false;
  dom.paymentDiscount.value = '';
  toggleHidden(dom.facturaADetail, true);
  toggleHidden(dom.adjustmentsPanel, true);
  toggleHidden(dom.paymentPriceSummary, true);
  dom.adjustmentsChevron.classList.remove('chevron-open');

  // Mostrar campos de combustible (ocultos en modo saldado)
  document.querySelectorAll('.settlement-hide').forEach(el => el.classList.remove('hidden'));

  // v12: Edit mode — pre-fill fields with existing payment data
  if (editId) {
    const p = state.payments.find(pay => pay.id === editId);
    if (!p) return;
    dom.paymentDriver.value = p.driver;
    dom.paymentAmount.value = p.amount;
    dom.paymentLiters.value = p.liters_loaded || '';
    dom.paymentPricePerLiter.value = p.price_per_liter ? Math.round(p.price_per_liter) : '';
    dom.paymentFullTank.checked = p.is_full_tank || false;
    dom.paymentNote.value = p.note || '';
    // v14.6: Restore occurred_at
    dom.paymentOccurredAt.value = p.occurred_at
      ? toLocalDatetimeValue(new Date(p.occurred_at))
      : toLocalDatetimeValue(new Date(p.created_at));
    // Fiscal fields
    dom.paymentFacturaA.checked = p.invoice_type === 'Factura A';
    dom.paymentDiscount.value = p.discount_amount || '';
    if (p.invoice_type === 'Factura A') {
      toggleHidden(dom.facturaADetail, false);
      toggleHidden(dom.adjustmentsPanel, false);
      dom.adjustmentsChevron.classList.add('chevron-open');
    }
    $('#payment-modal-title').textContent = 'Editar carga';
    const btnText = dom.btnSubmitPayment.querySelector('.btn-text');
    if (btnText) btnText.textContent = 'Guardar cambios';
    updatePaymentPriceSummary();
  } else {
    const btnText = dom.btnSubmitPayment.querySelector('.btn-text');
    if (btnText) btnText.textContent = 'Registrar carga';
    $('#payment-modal-title').textContent = 'Cargar combustible';
    // v14.6: Default occurred_at to now
    dom.paymentOccurredAt.value = toLocalDatetimeValue();
  }

  toggleHidden(dom.paymentModal, false);
}

function closePaymentModal() {
  state.settlementMode = false;
  state.settlementDriver = null;
  state.editingPaymentId = null;
  document.querySelectorAll('.settlement-hide').forEach(el => el.classList.remove('hidden'));
  toggleHidden(dom.paymentModal, true);
}

// v12: Edit trip — pre-fill inline form and scroll to it
function openTripEditModal(trip) {
  state.editingTripId = trip.id;
  dom.tripDriver.value = trip.driver;
  dom.tripKm.value = trip.km;
  dom.tripNote.value = trip.note || '';
  // v14.6: Restore occurred_at
  dom.tripOccurredAt.value = trip.occurred_at
    ? toLocalDatetimeValue(new Date(trip.occurred_at))
    : toLocalDatetimeValue(new Date(trip.created_at));
  // v13: Restore drive type
  const savedType = trip.drive_type || 'Mixto';
  if (dom.tripDriveType) dom.tripDriveType.value = savedType;
  if (dom.driveTypeSelector) {
    dom.driveTypeSelector.querySelectorAll('.drive-type-btn').forEach(b =>
      b.classList.toggle('drive-type-btn--active', b.dataset.type === savedType));
  }
  handleTripKmInput();
  const btnText = dom.btnSubmitTrip.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Guardar cambios';
  dom.tripForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function handlePaymentSubmit(e) {
  e.preventDefault();
  const btn = dom.btnSubmitPayment;
  setButtonLoading(btn, true);

  const driver = dom.paymentDriver.value;
  if (!driver) {
    showToast('Selecciona un piloto', 'error');
    setButtonLoading(btn, false);
    return;
  }

  const amount = parseFloat(dom.paymentAmount.value);
  if (!amount || amount <= 0) {
    showToast('Ingresa un monto valido', 'error');
    setButtonLoading(btn, false);
    return;
  }

  let litersLoaded = parseFloat(dom.paymentLiters.value) || null;
  let pricePerLiter = parseFloat(dom.paymentPricePerLiter.value) || null;
  const isFullTank = dom.paymentFullTank.checked;
  const isSettlement = state.settlementMode;

  // v11: Modo Distraído — si no hay litros ni precio, estimar con fuel_price actual
  const originalLiters = litersLoaded;
  if (!isSettlement && amount > 0 && !litersLoaded && !pricePerLiter) {
    const vehicle = getActiveVehicle();
    const refPrice = getLatestFuelPrice(vehicle);
    if (refPrice > 0) {
      litersLoaded = +(amount / refPrice).toFixed(1);
      pricePerLiter = +refPrice.toFixed(2);
      dom.paymentLiters.value = litersLoaded;
      dom.paymentPricePerLiter.value = Math.round(pricePerLiter);
    }
  }

  try {
    // v10: Compute fiscal breakdown
    const isFacturaA = isSettlement ? false : dom.paymentFacturaA.checked;
    const discountAmount = isSettlement ? 0 : (parseFloat(dom.paymentDiscount.value) || 0);
    const invoiceType = isFacturaA ? 'Factura A' : 'Ticket';

    let fiscalPerceptions = 0;
    let effectivePrice = null;

    if (!isSettlement && litersLoaded && litersLoaded > 0 && amount > 0) {
      const breakdown = calculateFiscalBreakdown(amount, litersLoaded, isFacturaA, discountAmount);
      fiscalPerceptions = +breakdown.taxPerceptions.toFixed(2);
      effectivePrice = +breakdown.effectivePrice.toFixed(2);
    }

    // v14.6: Temporal dimension
    const occurredAt = dom.paymentOccurredAt.value
      ? new Date(dom.paymentOccurredAt.value).toISOString()
      : new Date().toISOString();

    const paymentData = {
      vehicle_id: state.activeVehicleId,
      driver,
      amount,
      note: dom.paymentNote.value.trim() || null,
      liters_loaded: isSettlement ? null : litersLoaded,
      price_per_liter: isSettlement ? null : (effectivePrice || pricePerLiter),
      is_full_tank: isSettlement ? false : isFullTank,
      invoice_type: isSettlement ? 'Ticket' : invoiceType,
      tax_perceptions: isSettlement ? 0 : fiscalPerceptions,
      discount_amount: isSettlement ? 0 : discountAmount,
      occurred_at: occurredAt,
    };

    // v12: Update existing or create new
    if (state.editingPaymentId) {
      await updatePayment(state.editingPaymentId, paymentData);
      showToast('Carga actualizada');
      // v14.5: Recalculate global consumption after editing a payment
      state.payments = await fetchPayments(state.activeVehicleId);
      await recalculateGlobalConsumption();
    } else {
      await createPayment(paymentData);
      if (isSettlement) {
        showToast(`Saldo de ${formatCurrency(amount)} registrado para ${driver}`);
      } else if (!originalLiters) {
        showToast(`Carga registrada (${litersLoaded} lts estimados a ${formatCurrency(pricePerLiter)}/l)`);
      } else {
        showToast('Carga registrada');
      }
    }
    haptic();
    state.payments = await fetchPayments(state.activeVehicleId);
    state.dashboardLoaded = false;
    renderBalances();
    renderPaymentHistory();
    closePaymentModal();

    // Solo para cargas reales de combustible (no saldados)
    if (!isSettlement) {
      // v11: Precio Ponderado Dinámico (PPD)
      if (litersLoaded && litersLoaded > 0) {
        const vehicle = getActiveVehicle();
        if (vehicle) {
          const tankBefore = calculateTankLevel() - litersLoaded;
          const currentPrice = getLatestFuelPrice(vehicle);
          const weightedPrice = calculateWeightedPrice(
            tankBefore, currentPrice, amount, litersLoaded
          );
          if (vehicle.fuel_price !== weightedPrice) {
            await updateVehicle(state.activeVehicleId, { fuel_price: weightedPrice });
            state.vehicles = await fetchVehicles();
            renderVehicleDetail();
            renderVehicleCards();
          }
        }
      }

      // Auto-corrección de consumo si fue tanque lleno
      if (isFullTank) {
        await performTankAudit();
      }
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// --- v14.1: Tank Reconciliation & Adaptive Learning ---

async function performTankAudit() {
  const vehicle = getActiveVehicle();
  if (!vehicle) return;

  const tankCap = getVehicleTankCapacity(vehicle);
  if (!tankCap) return;

  // v14.6: Use occurred_at for chronological ordering
  const fullTankLoads = state.payments
    .filter(p => p.is_full_tank && p.liters_loaded > 0)
    .sort((a, b) => getEventDate(b) - getEventDate(a));

  if (fullTankLoads.length < 2) return;

  const latest = fullTankLoads[0];
  const previous = fullTankLoads[1];
  const latestDate = getEventDate(latest);
  const previousDate = getEventDate(previous);

  const cycleTrips = state.trips.filter(t => {
    const d = getEventDate(t);
    return d > previousDate && d <= latestDate;
  });
  const totalKm = cycleTrips.reduce((sum, t) => sum + Number(t.km), 0);
  if (totalKm <= 0) return;

  const cycleLoads = state.payments.filter(p => {
    if (!p.liters_loaded || p.liters_loaded <= 0) return false;
    const d = getEventDate(p);
    return d > previousDate && d <= latestDate;
  });
  const realLitersConsumed = cycleLoads.reduce((sum, p) => sum + Number(p.liters_loaded), 0);
  if (realLitersConsumed <= 0) return;

  const fuelPrice = getLatestFuelPrice(vehicle);

  // v14.3: Drive-type-aware deviation factor
  const estimatedLitersConsumed = cycleTrips.reduce((sum, t) => {
    const consumption = getConsumptionForDriveType(vehicle, t.drive_type);
    return sum + (t.km / consumption);
  }, 0);
  if (estimatedLitersConsumed <= 0) return;

  const deviationFactor = realLitersConsumed / estimatedLitersConsumed;
  const realConsumption = +(totalKm / realLitersConsumed).toFixed(1);

  // Phase 1: Reconciliation — recalculate cycle trips respecting drive_type
  let totalOldCost = 0;
  let totalNewCost = 0;

  for (const trip of cycleTrips) {
    totalOldCost += Number(trip.cost);
    const originalConsumption = getConsumptionForDriveType(vehicle, trip.drive_type);
    const adjustedConsumption = +(originalConsumption / deviationFactor).toFixed(1);
    const newLiters = +(trip.km / adjustedConsumption).toFixed(2);
    const newCost = +(newLiters * fuelPrice).toFixed(2);
    totalNewCost += newCost;

    // v14.4: Primary update — core fields that exist since v14.1
    const { error: primaryErr } = await db.from('trips')
      .update({ liters: newLiters, cost: newCost, is_reconciled: true })
      .eq('id', trip.id);

    if (primaryErr) {
      console.error('Reconciliation primary update failed:', trip.id, primaryErr);
      window.alert(`Error de reconciliación en viaje ${trip.id}: ${primaryErr.message || JSON.stringify(primaryErr)}`);
      continue;
    }

    // v14.4: Secondary update — metadata for popup (may fail if columns missing)
    const { error: metaErr } = await db.from('trips')
      .update({
        reconciled_at: new Date().toISOString(),
        original_consumption: originalConsumption,
        real_consumption: adjustedConsumption,
      })
      .eq('id', trip.id);

    if (metaErr) {
      console.warn('Reconciliation metadata update failed:', trip.id, metaErr);
    }
  }

  const adjustmentAmount = +(totalNewCost - totalOldCost).toFixed(2);
  state.trips = await fetchTrips(state.activeVehicleId);

  // Phase 2: Reconstructive memory — recalculate from all closed cycles
  await recalculateGlobalConsumption();

  // Re-render
  renderTrips();
  renderSummary();
  renderBalances();
  renderVehicleDetail();
  renderPaymentHistory();

  // Notification
  if (Math.abs(adjustmentAmount) > 0.01) {
    const sign = adjustmentAmount > 0 ? '+' : '';
    showToast(
      `Reconciliación: ${sign}${formatCurrency(adjustmentAmount)} ajustados · Consumo real: ${realConsumption} km/l`,
      adjustmentAmount > 0 ? 'error' : 'success'
    );
  } else {
    showToast(`Consumo verificado: ${realConsumption} km/l`);
  }
}

// v14.5: Reconstructive memory — recalculate consumption from ALL closed cycles
async function recalculateGlobalConsumption() {
  const vehicle = getActiveVehicle();
  if (!vehicle) return;
  const spec = VEHICLE_DATABASE[vehicle.model];
  if (!spec) return;

  // v14.6: Use occurred_at for chronological ordering
  const fullTanks = state.payments
    .filter(p => p.is_full_tank && p.liters_loaded > 0)
    .sort((a, b) => getEventDate(a) - getEventDate(b));

  if (fullTanks.length < 2) {
    if (vehicle.consumption !== spec.mixed_km_l) {
      await updateVehicle(state.activeVehicleId, { consumption: spec.mixed_km_l });
      state.vehicles = await fetchVehicles();
      renderVehicleDetail();
    }
    return;
  }

  let totalKmAllCycles = 0;
  let totalLitersAllCycles = 0;

  for (let i = 1; i < fullTanks.length; i++) {
    const prevDate = getEventDate(fullTanks[i - 1]);
    const currDate = getEventDate(fullTanks[i]);

    const cycleKm = state.trips
      .filter(t => { const d = getEventDate(t); return d > prevDate && d <= currDate; })
      .reduce((sum, t) => sum + Number(t.km), 0);

    const cycleLiters = state.payments
      .filter(p => {
        if (!p.liters_loaded || p.liters_loaded <= 0) return false;
        const d = getEventDate(p);
        return d > prevDate && d <= currDate;
      })
      .reduce((sum, p) => sum + Number(p.liters_loaded), 0);

    if (cycleKm > 0 && cycleLiters > 0) {
      totalKmAllCycles += cycleKm;
      totalLitersAllCycles += cycleLiters;
    }
  }

  if (totalKmAllCycles <= 0 || totalLitersAllCycles <= 0) return;

  const globalConsumption = +(totalKmAllCycles / totalLitersAllCycles).toFixed(1);

  if (vehicle.consumption !== globalConsumption) {
    await updateVehicle(state.activeVehicleId, { consumption: globalConsumption });
    state.vehicles = await fetchVehicles();
    renderVehicleDetail();
  }
}

// --- Payment Delete ---

function handleDeletePayment(payment) {
  dom.confirmTitle.textContent = 'Eliminar carga';
  dom.confirmMessage.textContent =
    `¿Eliminar la carga de ${formatCurrency(payment.amount)} de ${payment.driver}?`;

  const btnText = dom.btnConfirmOk.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Eliminar';

  state.confirmAction = async () => {
    const btn = dom.btnConfirmOk;
    setButtonLoading(btn, true);
    try {
      await deletePayment(payment.id);
      showToast('Carga eliminada');
      haptic();
      state.payments = await fetchPayments(state.activeVehicleId);
      state.dashboardLoaded = false;
      renderBalances();
      renderPaymentHistory();
      // v14.5: Recalculate global consumption after deleting a payment
      await recalculateGlobalConsumption();
      toggleHidden(dom.confirmModal, true);
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
      if (btnText) btnText.textContent = 'Eliminar';
    }
  };

  toggleHidden(dom.confirmModal, false);
}

// --- Trip Form ---

function handleTripKmInput() {
  const vehicle = getActiveVehicle();
  const km = parseFloat(dom.tripKm.value) || 0;
  if (vehicle && km > 0) {
    const driveType = dom.tripDriveType ? dom.tripDriveType.value : 'Mixto';
    const consumption = getConsumptionForDriveType(vehicle, driveType);
    const { cost } = calculateCost(km, consumption, getLatestFuelPrice(vehicle));
    dom.costPreviewValue.textContent = formatCurrency(cost);
  } else {
    dom.costPreviewValue.textContent = '$0,00';
  }
}

async function handleTripSubmit(e) {
  e.preventDefault();
  const vehicle = getActiveVehicle();
  if (!vehicle) return;

  const km = parseFloat(dom.tripKm.value);
  if (!km || km <= 0) {
    showToast('Ingresa los kilometros recorridos', 'error');
    return;
  }

  const driver = dom.tripDriver.value;
  if (!driver) {
    showToast('Selecciona un piloto', 'error');
    return;
  }

  // v13: Drive type selection
  const driveType = dom.tripDriveType ? dom.tripDriveType.value : 'Mixto';
  const consumption = getConsumptionForDriveType(vehicle, driveType);
  const { liters, cost } = calculateCost(km, consumption, getLatestFuelPrice(vehicle));

  // v14.6: Temporal dimension
  const occurredAt = dom.tripOccurredAt.value
    ? new Date(dom.tripOccurredAt.value).toISOString()
    : new Date().toISOString();

  // v11: Verificar tanque virtual
  const tankLevel = calculateTankLevel();
  if (tankLevel <= 0) {
    showToast('Tanque virtual vacio, usando precio de referencia', 'error');
  }

  const btn = dom.btnSubmitTrip;
  setButtonLoading(btn, true);

  try {
    // v12: Update existing or create new
    if (state.editingTripId) {
      await updateTrip(state.editingTripId, {
        driver,
        km,
        note: dom.tripNote.value.trim() || null,
        liters,
        cost,
        drive_type: driveType,
        occurred_at: occurredAt,
      });
      showToast('Viaje actualizado');
      state.editingTripId = null;
      const btnText = dom.btnSubmitTrip.querySelector('.btn-text');
      if (btnText) btnText.textContent = 'Registrar';
    } else {
      await createTrip({
        vehicle_id: state.activeVehicleId,
        driver,
        km,
        note: dom.tripNote.value.trim() || null,
        liters,
        cost,
        drive_type: driveType,
        occurred_at: occurredAt,
      });
      showToast('Viaje registrado');
    }
    haptic();
    dom.tripForm.reset();
    dom.costPreviewValue.textContent = '$0,00';
    // v14.6: Reset occurred_at to now
    dom.tripOccurredAt.value = toLocalDatetimeValue();
    // v13: Reset drive type selector
    dom.tripDriveType.value = 'Mixto';
    dom.driveTypeSelector.querySelectorAll('.drive-type-btn').forEach(b =>
      b.classList.toggle('drive-type-btn--active', b.dataset.type === 'Mixto'));
    state.trips = await fetchTrips(state.activeVehicleId);
    state.dashboardLoaded = false;
    renderTrips();
    renderSummary();
    renderBalances();
    renderVehicleDetail(); // v11: Update tank indicator
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// --- Trip Delete ---

async function handleDeleteTrip(tripId) {
  try {
    await deleteTrip(tripId);
    showToast('Viaje eliminado');
    haptic();
    state.trips = await fetchTrips(state.activeVehicleId);
    state.dashboardLoaded = false;
    renderTrips();
    renderSummary();
    renderBalances();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// --- Model Change ---

function handleModelChange() {
  const model = dom.vehicleModelSelect.value;
  const spec = VEHICLE_DATABASE[model];
  if (spec) {
    dom.vehicleConsumptionInput.value = spec.mixed_km_l;
  } else {
    dom.vehicleConsumptionInput.value = '';
  }
}

// --- Share / Export ---

function generateSummaryText() {
  const vehicle = getActiveVehicle();
  if (!vehicle) return '';
  const drivers = vehicle.drivers || [];

  const credits = {}, debits = {};
  drivers.forEach((d) => { credits[d] = 0; debits[d] = 0; });
  state.payments.forEach((p) => { if (credits[p.driver] !== undefined) credits[p.driver] += Number(p.amount); });
  state.trips.forEach((t) => { if (debits[t.driver] !== undefined) debits[t.driver] += Number(t.cost); });

  let totalConsumo = 0;
  const balances = [];
  drivers.forEach((d) => {
    totalConsumo += debits[d];
    balances.push({ driver: d, net: +(credits[d] - debits[d]).toFixed(2) });
  });

  // Clearing algorithm
  const debtors = balances.filter(b => b.net < -0.01).map(b => ({ driver: b.driver, net: +Math.abs(b.net).toFixed(2) }));
  const creditors = balances.filter(b => b.net > 0.01).map(b => ({ driver: b.driver, net: +b.net.toFixed(2) }));
  debtors.sort((a, b) => b.net - a.net);
  creditors.sort((a, b) => b.net - a.net);
  const transfers = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = +Math.min(debtors[i].net, creditors[j].net).toFixed(2);
    if (amount > 0.01) transfers.push({ from: debtors[i].driver, to: creditors[j].driver, amount });
    debtors[i].net = +(debtors[i].net - amount).toFixed(2);
    creditors[j].net = +(creditors[j].net - amount).toFixed(2);
    if (debtors[i].net < 0.01) i++;
    if (creditors[j].net < 0.01) j++;
  }

  let text = `Hola! Les comparto la liquidacion de *${vehicle.name}*\n\n`;
  text += `Consumo total: *${formatCurrency(totalConsumo)}* en ${state.trips.length} viaje${state.trips.length !== 1 ? 's' : ''}\n`;
  // v13: Liter consumption line
  const totalLiters = state.trips.reduce((sum, t) => sum + Number(t.liters || 0), 0);
  const tankCap = getVehicleTankCapacity(vehicle);
  const tankPct = tankCap > 0 ? ` (${Math.round((totalLiters / tankCap) * 100)}% del tanque)` : '';
  text += `Combustible consumido: *${totalLiters.toFixed(1)} litros*${tankPct}\n\n`;

  text += `Saldos:\n`;
  balances.forEach((b) => {
    const isZero = Math.abs(b.net) < 0.01;
    const status = isZero ? 'Al dia ✓' : (b.net > 0 ? `A favor *${formatCurrency(b.net)}*` : `Debe *${formatCurrency(Math.abs(b.net))}*`);
    text += `• ${b.driver}: ${status}\n`;
  });

  if (transfers.length > 0) {
    text += `\nTransferencias sugeridas:\n`;
    transfers.forEach((t) => { text += `• ${t.from} → ${t.to}: *${formatCurrency(t.amount)}*\n`; });
  }

  // v10: Include effective price info for recent fuel loads
  const recentLoads = state.payments
    .filter(p => p.liters_loaded > 0 && !(p.note && p.note.toLowerCase().includes('saldado')))
    .slice(0, 5);
  if (recentLoads.length > 0) {
    text += `\nUltimas cargas:\n`;
    recentLoads.forEach(p => {
      const pe = p.liters_loaded > 0 ? p.amount / p.liters_loaded : 0;
      text += `• ${p.driver} pago *${formatCurrency(p.amount)}* (Precio efectivo: *${formatCurrency(pe)}/l*)\n`;
    });
  }

  text += `\nVer detalle en:\nhttps://naftometro.vercel.app`;
  return text;
}

async function handleShare() {
  const text = generateSummaryText();
  if (!text) return;

  if (navigator.share) {
    try {
      await navigator.share({ text });
      haptic();
    } catch (err) {
      if (err.name !== 'AbortError') {
        fallbackCopy(text);
      }
    }
  } else {
    fallbackCopy(text);
  }
}

async function fallbackCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Resumen copiado al portapapeles');
    haptic();
  } catch {
    showToast('No se pudo copiar', 'error');
  }
}

// ============================================================
// 12. EVENT BINDING & INITIALIZATION
// ============================================================

function bindEvents() {
  // Add vehicle
  $('#btn-add-vehicle').addEventListener('click', () => openVehicleModal('add'));

  // Add trip from Home
  $('#btn-add-trip-home').addEventListener('click', () => {
    const vehicleId = state.activeVehicleId || state.lastVisitedVehicleId || (state.vehicles.length === 1 ? state.vehicles[0].id : null);
    if (vehicleId) {
      selectVehicle(vehicleId);
      haptic();
    } else if (state.vehicles.length > 1) {
      showToast('Selecciona un vehiculo primero', 'error');
    } else {
      showToast('Agrega un vehiculo primero', 'error');
    }
  });

  // Go to home from detail empty state
  $('#btn-go-home').addEventListener('click', () => {
    navigateTo('home');
    haptic();
  });

  // Share buttons
  $('#btn-share').addEventListener('click', handleShare);
  $('#btn-share-balances').addEventListener('click', handleShare);

  // v14.7: Action Center buttons
  dom.btnQuickTrip.addEventListener('click', () => {
    dom.tripForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    dom.tripKm.focus();
  });
  dom.btnQuickFuel.addEventListener('click', () => openPaymentModal());

  // Toggle dashboard total spent (exact vs short)
  dom.dashTotalSpent.addEventListener('click', () => {
    const el = dom.dashTotalSpent;
    const isFull = el.textContent === el.dataset.full;
    el.textContent = isFull ? el.dataset.short : el.dataset.full;
  });
  dom.dashTotalSpent.style.cursor = 'pointer';

  // Edit vehicle
  $('#btn-edit-vehicle').addEventListener('click', () => {
    const v = getActiveVehicle();
    if (v) openVehicleModal('edit', v);
  });

  // Delete vehicle
  $('#btn-delete-vehicle').addEventListener('click', handleDeleteVehicleClick);

  // Clear trips
  $('#btn-clear-trips').addEventListener('click', handleClearTripsClick);

  // Vehicle modal
  $('#btn-close-modal').addEventListener('click', closeVehicleModal);
  dom.vehicleModal.addEventListener('click', (e) => {
    if (e.target === dom.vehicleModal) closeVehicleModal();
  });

  // Vehicle form
  dom.vehicleForm.addEventListener('submit', handleVehicleSubmit);
  dom.vehicleModelSelect.addEventListener('change', handleModelChange);
  dom.btnAddDriver.addEventListener('click', () => addDriverInput(''));

  // Payment modal
  $('#btn-close-payment-modal').addEventListener('click', closePaymentModal);
  dom.paymentModal.addEventListener('click', (e) => {
    if (e.target === dom.paymentModal) closePaymentModal();
  });
  dom.paymentForm.addEventListener('submit', handlePaymentSubmit);

  // Smart auto-calc: Monto Total is the anchor (never auto-recalculated)
  // Liters change → recalc price/liter (amount stays)
  dom.paymentLiters.addEventListener('input', () => {
    const liters = parseFloat(dom.paymentLiters.value);
    const amount = parseFloat(dom.paymentAmount.value);
    if (liters > 0 && amount > 0) {
      dom.paymentPricePerLiter.value = Math.round(amount / liters);
    }
    updatePaymentPriceSummary();
  });
  // Price/liter change → recalc liters (amount stays)
  dom.paymentPricePerLiter.addEventListener('input', () => {
    const ppl = parseFloat(dom.paymentPricePerLiter.value);
    const amount = parseFloat(dom.paymentAmount.value);
    if (ppl > 0 && amount > 0) {
      dom.paymentLiters.value = (amount / ppl).toFixed(1);
    }
    updatePaymentPriceSummary();
  });
  // Amount change → recalc liters if price exists, else recalc price if liters exist
  dom.paymentAmount.addEventListener('input', () => {
    const amount = parseFloat(dom.paymentAmount.value);
    const liters = parseFloat(dom.paymentLiters.value);
    const ppl = parseFloat(dom.paymentPricePerLiter.value);
    if (amount > 0 && ppl > 0) {
      dom.paymentLiters.value = (amount / ppl).toFixed(1);
    } else if (amount > 0 && liters > 0) {
      dom.paymentPricePerLiter.value = Math.round(amount / liters);
    }
    updatePaymentPriceSummary();
  });

  // Quick amount buttons
  document.querySelectorAll('.quick-amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = parseFloat(dom.paymentAmount.value) || 0;
      dom.paymentAmount.value = (current + parseInt(btn.dataset.amount)).toFixed(2);
      dom.paymentAmount.dispatchEvent(new Event('input'));
      haptic();
    });
  });

  // v10: Ajustes de Precio toggle
  dom.btnToggleAdjustments.addEventListener('click', () => {
    const isHidden = dom.adjustmentsPanel.classList.contains('hidden');
    toggleHidden(dom.adjustmentsPanel, !isHidden);
    dom.adjustmentsChevron.classList.toggle('chevron-open', isHidden);
  });

  // v10: Factura A toggle
  dom.paymentFacturaA.addEventListener('change', () => {
    toggleHidden(dom.facturaADetail, !dom.paymentFacturaA.checked);
    updatePaymentPriceSummary();
  });

  // v10: Discount input
  dom.paymentDiscount.addEventListener('input', updatePaymentPriceSummary);

  // Trip form
  dom.tripForm.addEventListener('submit', handleTripSubmit);
  dom.tripKm.addEventListener('input', handleTripKmInput);

  // v13: Drive type selector
  dom.driveTypeSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.drive-type-btn');
    if (!btn) return;
    dom.driveTypeSelector.querySelectorAll('.drive-type-btn').forEach(b =>
      b.classList.remove('drive-type-btn--active'));
    btn.classList.add('drive-type-btn--active');
    dom.tripDriveType.value = btn.dataset.type;
    handleTripKmInput();
  });

  dom.tripKm.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dom.tripForm.requestSubmit();
    }
  });

  // Confirm modal
  $('#btn-confirm-cancel').addEventListener('click', () => {
    toggleHidden(dom.confirmModal, true);
    state.confirmAction = null;
  });
  dom.btnConfirmOk.addEventListener('click', () => {
    if (state.confirmAction) state.confirmAction();
  });
  dom.confirmModal.addEventListener('click', (e) => {
    if (e.target === dom.confirmModal) {
      toggleHidden(dom.confirmModal, true);
      state.confirmAction = null;
    }
  });

  // Bottom Nav tabs
  dom.bottomNav.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab !== state.currentTab) {
        navigateTo(tab);
        haptic();
      }
    });
  });

  // Dashboard filter
  dom.dashboardFilter.addEventListener('change', () => {
    if (state.dashboardLoaded) renderDashboard();
  });
}

async function init() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  populateFormOptions();
  bindEvents();
  initSwipeGesture();

  // Show detail empty state by default
  renderVehicleDetail();

  try {
    state.vehicles = await fetchVehicles();
    await renderVehicleCards();
  } catch (err) {
    showToast('Error de conexion con la base de datos. Verifica tu conexion a internet.', 'error');
    console.error('Init error:', err);
    toggleHidden(dom.homeLoading, true);
  }
}

document.addEventListener('DOMContentLoaded', init);

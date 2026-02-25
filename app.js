console.log("🚀 Naftómetro v18.14 cargado correctamente");

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

let kmChart = null;   // v18.8: Chart.js instance (KM doughnut)
let costChart = null; // v18.8: Chart.js instance (cost bar)

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
  balancesExpanded: false,
  pendingPhotoFile: null,
  photoRemoved: false,
  ledger: [],  // v17: Ledger entries for active vehicle
  profile: null,           // v18: user profile
  driverMappings: [],      // v18: driver mappings for active vehicle
  auditLogs: [],           // v18.5: audit log entries for active vehicle
  activityItems: [],       // v18.5: combined & sorted activity feed items
  activityPage: 0,         // v18.5: activity feed pagination cursor
  activeDetailTab: 'summary', // v18.5: current detail tab
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
  tripModal: $('#trip-modal'),
  tripModalTitle: $('#trip-modal-title'),
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
  adjustmentsDetails: $('#adjustments-details'),
  adjustmentsPanel: $('#adjustments-panel'),
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
  // v15: Photo evidence
  paymentPhotoInput: $('#payment-photo-input'),
  photoPreview: $('#photo-preview'),
  photoPreviewImg: $('#photo-preview-img'),
  btnCapturePhoto: $('#btn-capture-photo'),
  btnRemovePhoto: $('#btn-remove-photo'),
  photoViewerModal: $('#photo-viewer-modal'),
  photoViewerImg: $('#photo-viewer-img'),
  // v15.1: Tank capital
  tankCapitalSection: $('#tank-capital-section'),
  tankCapitalText: $('#tank-capital-text'),
  // v15.2: Vehicle selector
  vehicleSelectorModal: $('#vehicle-selector-modal'),
  vehicleSelectorList: $('#vehicle-selector-list'),
  // v18: Auth, Onboarding, Avatar Claim
  authModal: $('#auth-modal'),
  onboardingModal: $('#onboarding-modal'),
  avatarClaimModal: $('#avatar-claim-modal'),
  modalClaimIdentity: $('#modal-claim-identity'), // v18.14
  // v18.5/v18.6: Detail tabs & activity feed
  tabSummary: $('#tab-summary'),
  tabVehicle: $('#tab-vehicle'),
  tabFinances: $('#tab-finances'),           // v18.8 (renamed from tabHistory)
  smartCard: $('#smart-card'),
  smartCardAmount: $('#smart-card-amount'),
  smartCardStatus: $('#smart-card-status'),
  btnOpenSettleDebt: $('#btn-open-settle-debt'),
  btnOpenSettleDebt2: $('#btn-open-settle-debt-2'), // v18.8
  activityFeed: $('#activity-feed'),
  activityEmpty: $('#activity-empty'),
  btnLoadMoreActivity: $('#btn-load-more-activity'),
  btnShowLessActivity: $('#btn-show-less-activity'),
  // v18.6: Settle Debt Modal
  modalSettleDebt: $('#modal-settle-debt'),
  settleDebtCreditor: $('#settle-debt-creditor'),
  settleDebtAmount: $('#settle-debt-amount'),
};

// ============================================================
// 5. UTILITY FUNCTIONS
// ============================================================

// v15: Resize image before upload (max 1200px, JPEG 80% quality)
function resizeImage(file, maxSize = 1200) {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round(height * maxSize / width);
            width = maxSize;
          } else {
            width = Math.round(width * maxSize / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(resolve, 'image/jpeg', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// v15: Upload ticket photo to Supabase Storage
async function uploadTicketPhoto(file, vehicleId) {
  const resized = await resizeImage(file);
  const filename = `${vehicleId}/${Date.now()}.jpg`;
  const { error } = await db.storage.from('fuel-tickets').upload(filename, resized, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  const { data } = db.storage.from('fuel-tickets').getPublicUrl(filename);
  return data.publicUrl;
}

// v15: Open full-screen photo viewer
function openPhotoViewer(url) {
  // v15.5: Close any open popups
  document.querySelectorAll('.payment-breakdown-popup').forEach(p => p.remove());
  dom.photoViewerImg.src = url;
  toggleHidden(dom.photoViewerModal, false);
}

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

// v17: correctionFactor multiplies theoretical consumption (>1 = consumes more than spec)
function calculateCost(km, consumption, fuelPrice, correctionFactor = 1.0) {
  const adjustedConsumption = consumption / correctionFactor;
  const liters = km / adjustedConsumption;
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
// v18.5: DETAIL TAB SYSTEM
// ============================================================

const ACTIVITY_PAGE_SIZE = 10;

function switchDetailTab(tab) {
  state.activeDetailTab = tab;
  document.querySelectorAll('.detail-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.detailTab === tab);
  });
  // v18.8: tabs are summary / vehicle / finances
  toggleHidden(dom.tabSummary, tab !== 'summary');
  toggleHidden(dom.tabVehicle, tab !== 'vehicle');
  toggleHidden(dom.tabFinances, tab !== 'finances');
  // Lazy-load financial activity feed on first visit to the finances tab
  if (tab === 'finances' && state.activityItems.length === 0 && state.activeVehicleId) {
    buildAndRenderActivity();
  }
}

function renderSmartCard() {
  const vehicle = getActiveVehicle();
  if (!vehicle) { toggleHidden(dom.smartCard, true); return; }
  const myDriverName = getMyDriverName(vehicle.id);
  if (!myDriverName) { toggleHidden(dom.smartCard, true); return; }

  let myBalance = 0;
  if (state.ledger.length > 0) {
    state.ledger.forEach(e => {
      if (e.driver === myDriverName) myBalance += Number(e.amount);
    });
  } else {
    state.payments.forEach(p => { if (p.driver === myDriverName) myBalance += Number(p.amount); });
    state.trips.forEach(t => { if (t.driver === myDriverName) myBalance -= Number(t.cost); });
  }
  myBalance = +myBalance.toFixed(2);

  // v18.6: Clear state classes
  dom.smartCard.classList.remove('debt', 'clear');
  toggleHidden(dom.btnOpenSettleDebt, true);

  if (Math.abs(myBalance) < 0.01) {
    // Estás al día
    dom.smartCardAmount.textContent = formatCurrency(0);
    dom.smartCardStatus.innerHTML = '&#10003; Estas al dia';
  } else if (myBalance > 0) {
    // Saldo positivo: te deben
    dom.smartCard.classList.add('clear');
    dom.smartCardAmount.textContent = '+' + formatCurrency(myBalance);
    dom.smartCardStatus.textContent = 'Te deben plata';
  } else {
    // Saldo negativo: debés — mostrar botón Saldar
    dom.smartCard.classList.add('debt');
    dom.smartCardAmount.textContent = formatCurrency(myBalance);
    dom.smartCardStatus.textContent = 'Debes plata';
    toggleHidden(dom.btnOpenSettleDebt, false);
  }

  toggleHidden(dom.smartCard, false);
}

function buildActivityItems() {
  const items = [];

  // v18.8: Financial events only — no trips (trips are in "El Vehículo" tab)
  state.payments.forEach(p => {
    const isSett = p.note && p.note.toLowerCase().includes('saldado') && !p.liters_loaded;
    items.push({
      type: isSett ? 'settlement' : 'fuel',
      date: new Date(p.occurred_at || p.created_at),
      icon: isSett ? '&#128181;' : '&#9981;',
      iconClass: 'fuel',
      title: isSett ? `${p.driver} saldo su cuenta` : `${p.driver} cargo nafta`,
      meta: p.note || '',
      amount: '+' + formatCurrency(p.amount),
    });
  });

  // v18.8: Include debt settlement events + deletion audit events
  state.auditLogs
    .filter(log => log.action.includes('deleted') || log.action === 'debt_settled')
    .forEach(log => {
      const isDebt = log.action === 'debt_settled';
      items.push({
        type: 'audit',
        date: new Date(log.created_at),
        icon: isDebt ? '&#128176;' : '&#128465;',
        iconClass: isDebt ? 'fuel' : 'delete',
        title: log.description,
        meta: '',
        amount: '',
      });
    });

  items.sort((a, b) => b.date - a.date);
  state.activityItems = items;
  state.activityPage = 0;
}

async function buildAndRenderActivity() {
  if (state.auditLogs.length === 0 && state.activeVehicleId) {
    try {
      state.auditLogs = await fetchAuditLogs(state.activeVehicleId);
    } catch (e) {
      console.warn('Could not fetch audit logs:', e.message);
      state.auditLogs = [];
    }
  }
  buildActivityItems();
  renderActivityPage();
}

function renderActivityPage() {
  const end = (state.activityPage + 1) * ACTIVITY_PAGE_SIZE;
  const visible = state.activityItems.slice(0, end);
  const hasMore = end < state.activityItems.length;
  // v18.6: show "Ver menos" only when more than the first page is visible
  const canCollapse = state.activityPage > 0;

  dom.activityFeed.innerHTML = '';

  if (visible.length === 0) {
    toggleHidden(dom.activityEmpty, false);
    toggleHidden(dom.btnLoadMoreActivity, true);
    toggleHidden(dom.btnShowLessActivity, true);
    return;
  }

  toggleHidden(dom.activityEmpty, true);

  visible.forEach(item => {
    const el = document.createElement('div');
    el.className = 'activity-item';
    el.innerHTML = `
      <div class="activity-icon ${item.iconClass}">${item.icon}</div>
      <div class="activity-body">
        <div class="activity-title">${item.title}</div>
        <div class="activity-meta">${formatDate(item.date.toISOString())}${item.meta ? ' \u00b7 ' + item.meta : ''}</div>
      </div>
      ${item.amount ? `<div class="activity-amount">${item.amount}</div>` : ''}
    `;
    dom.activityFeed.appendChild(el);
  });

  toggleHidden(dom.btnLoadMoreActivity, !hasMore);
  toggleHidden(dom.btnShowLessActivity, !canCollapse); // v18.6
}

function loadMoreActivity() {
  state.activityPage++;
  renderActivityPage();
}

function showLessActivity() { // v18.6
  state.activityPage = 0;
  renderActivityPage();
}

// ============================================================
// v18.6: SALDAR DEUDA (Settle Debt)
// ============================================================

function openSettleDebtModal() {
  const vehicle = getActiveVehicle();
  if (!vehicle) return;
  const myDriverName = getMyDriverName(vehicle.id);
  if (!myDriverName) return;

  // Calculate my debt (negative balance)
  let myBalance = 0;
  if (state.ledger.length > 0) {
    state.ledger.forEach(e => {
      if (e.driver === myDriverName) myBalance += Number(e.amount);
    });
  }
  const myDebt = Math.abs(+myBalance.toFixed(2));

  // Build creditors list (drivers with positive balance)
  const netByDriver = {};
  state.ledger.forEach(e => {
    netByDriver[e.driver] = (netByDriver[e.driver] || 0) + Number(e.amount);
  });
  const creditors = Object.entries(netByDriver)
    .filter(([driver, net]) => driver !== myDriverName && net > 0.01)
    .sort((a, b) => b[1] - a[1]);

  if (creditors.length === 0) {
    showToast('No hay acreedores en este vehiculo', 'error');
    return;
  }

  // Populate select
  dom.settleDebtCreditor.innerHTML = creditors
    .map(([driver, net]) => `<option value="${driver}">${driver} (le deben ${formatCurrency(net)})</option>`)
    .join('');

  // Pre-fill amount with full debt
  dom.settleDebtAmount.value = myDebt > 0 ? Math.round(myDebt) : '';

  toggleHidden(dom.modalSettleDebt, false);
}

function closeSettleDebtModal() {
  toggleHidden(dom.modalSettleDebt, true);
  document.getElementById('settle-debt-form').reset();
}

async function handleSettleDebtSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-settle-debt-submit');
  if (btn.disabled) return;
  setButtonLoading(btn, true);

  const vehicle = getActiveVehicle();
  const myDriverName = getMyDriverName(vehicle.id);
  const creditor = dom.settleDebtCreditor.value.trim();
  const amount = parseFloat(dom.settleDebtAmount.value);

  if (!myDriverName) {
    showToast('No se pudo identificar tu piloto', 'error');
    setButtonLoading(btn, false);
    return;
  }
  if (!creditor) {
    showToast('Selecciona a quien le pagas', 'error');
    setButtonLoading(btn, false);
    return;
  }
  if (creditor === myDriverName) {
    showToast('No puedes pagarte a vos mismo', 'error');
    setButtonLoading(btn, false);
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    showToast('El monto debe ser mayor a cero', 'error');
    setButtonLoading(btn, false);
    return;
  }
  if (amount < 0.01) {
    showToast('El monto minimo es $0.01', 'error');
    setButtonLoading(btn, false);
    return;
  }

  try {
    // Double-entry: payer gets credit (positive), creditor gets debit (negative)
    await insertLedgerEntry({
      vehicle_id: state.activeVehicleId,
      driver: myDriverName,
      type: 'transfer',
      amount: +amount,
      ref_id: null,
      description: `Pago a ${creditor}`,
    });
    await insertLedgerEntry({
      vehicle_id: state.activeVehicleId,
      driver: creditor,
      type: 'transfer',
      amount: -(+amount),
      ref_id: null,
      description: `Pago recibido de ${myDriverName}`,
    });

    // Audit log
    try {
      await db.from('audit_logs').insert({
        vehicle_id: state.activeVehicleId,
        user_id: state.profile?.id || null,
        action: 'debt_settled',
        description: `${myDriverName} le pago ${formatCurrency(amount)} a ${creditor}`,
      });
    } catch (auditErr) {
      console.warn('Audit log failed (non-critical):', auditErr.message);
    }

    showToast(`Pago de ${formatCurrency(amount)} a ${creditor} registrado`);
    haptic();
    closeSettleDebtModal();
    // Full reload to reflect updated balances everywhere
    await selectVehicle(state.activeVehicleId);
  } catch (err) {
    showToast('Error al registrar el pago: ' + err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
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


  // v15.7: Post-transition scroll reset with instant behavior for iOS
  setTimeout(() => {
    document.querySelectorAll('.view-content').forEach(vc => {
      vc.scrollTo({ top: 0, behavior: 'instant' });
    });
  }, 150);

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

// v16.2: Generate a short random invite code and save to vehicle
async function generateInviteCode(vehicleId) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { error } = await db
    .from('vehicles')
    .update({ invite_code: code })
    .eq('id', vehicleId);
  if (error) throw error;
  return code;
}

// v16.2: Join vehicle by invitation code (calls server function)
async function joinVehicleByCode(code) {
  const { data, error } = await db.rpc('join_vehicle_by_code', { code });
  if (error) throw error;
  return data;
}

// v17: Ledger CRUD — append-only financial journal
async function fetchLedger(vehicleId) {
  const { data, error } = await db
    .from('ledger')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function insertLedgerEntry(entry) {
  const { data, error } = await db
    .from('ledger')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// v18: Profile CRUD
async function fetchProfile() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error && error.code === 'PGRST116') {
    const { data: created } = await db
      .from('profiles')
      .insert({ id: user.id })
      .select()
      .single();
    return created;
  }
  if (error) throw error;
  return data;
}

async function updateProfile(updates) {
  const { data: { user } } = await db.auth.getUser();
  const { data, error } = await db
    .from('profiles')
    .upsert({ id: user.id, ...updates })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// v18: Driver Mapping CRUD
async function fetchDriverMappings(vehicleId) {
  const { data, error } = await db
    .from('vehicle_driver_mappings')
    .select('*')
    .eq('vehicle_id', vehicleId);
  if (error) throw error;
  return data || [];
}

async function insertDriverMapping(mapping) {
  const { data, error } = await db
    .from('vehicle_driver_mappings')
    .insert(mapping)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// v18.5: Audit Logs CRUD
async function fetchAuditLogs(vehicleId) {
  const { data, error } = await db
    .from('audit_logs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// v17: Migrate legacy balances to ledger (opening_balance entries)
async function migrateToLedger(vehicleId, drivers) {
  const [trips, payments] = await Promise.all([
    fetchTrips(vehicleId),
    fetchPayments(vehicleId)
  ]);

  const credits = {};
  const debits = {};
  drivers.forEach(d => { credits[d] = 0; debits[d] = 0; });
  payments.forEach(p => { if (credits[p.driver] !== undefined) credits[p.driver] += Number(p.amount); });
  trips.forEach(t => { if (debits[t.driver] !== undefined) debits[t.driver] += Number(t.cost); });

  for (const driver of drivers) {
    const net = +(credits[driver] - debits[driver]).toFixed(2);
    if (Math.abs(net) > 0.01) {
      await insertLedgerEntry({
        vehicle_id: vehicleId,
        driver,
        type: 'opening_balance',
        amount: net,
        description: 'Saldo migrado desde sistema legacy v16'
      });
    }
  }
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

// v15.1: Determine if trip is truly verified (has a full-tank payment after it)
function isTripVerified(trip) {
  if (!trip.is_reconciled) return false;
  const tripDate = getEventDate(trip);
  return state.payments.some(p =>
    p.is_full_tank && p.liters_loaded > 0 && getEventDate(p) > tripDate
  );
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

  let currentGroup = '';

  trips.forEach((trip) => {
    const group = getDateGroup(trip.occurred_at || trip.created_at);
    if (group !== currentGroup) {
      currentGroup = group;
      const groupRow = document.createElement('tr');
      groupRow.innerHTML = `<td colspan="8" class="trip-date-group">${group}</td>`;
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
      <td data-label="Costo "><strong>${formatCurrency(trip.cost)}</strong>${isTripVerified(trip) ? '<span class="reconciled-check" title="Precio verificado">✓</span>' : '<span class="estimated-price" title="Precio estimado">Estimado</span>'}</td>
      <td data-label="Tipo ">${getDriveTypeEmoji(trip.drive_type)}</td>
      <td data-label="Nota " class="trip-note" title="${trip.note || ''}">${trip.note || '-'}</td>
      <td></td>
    `;
    // v14.2: Reconciliation check click handler
    const reconBadge = tr.querySelector('.reconciled-check');
    if (reconBadge) {
      reconBadge.addEventListener('click', () => showReconciliationBreakdown(trip));
    }
    // v15.1: Estimated price popup
    const estimatedBadge = tr.querySelector('.estimated-price');
    if (estimatedBadge) {
      estimatedBadge.addEventListener('click', () => showEstimatedExplanation());
    }
    // v12: Edit button for trips
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon btn-icon-edit';
    editBtn.title = 'Editar viaje';
    editBtn.innerHTML = '&#9998;';
    editBtn.addEventListener('click', () => openTripModal(trip));
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

  let grandTotal = 0;
  drivers.forEach((driver) => { grandTotal += totals[driver].cost; });

  // v18.7: Actor list — replace rigid card grid
  dom.summaryGrid.innerHTML = '';
  dom.summaryGrid.className = 'actor-list';

  // v18.10: Sort actors by cost descending (highest spender first, zero-cost last)
  const sortedActors = [...drivers].sort((a, b) => totals[b].cost - totals[a].cost);

  sortedActors.forEach((driver) => {
    const idx = drivers.indexOf(driver); // preserve original PILOT_COLORS assignment
    const data = totals[driver];
    const pct = grandTotal > 0 ? Math.round((data.cost / grandTotal) * 100) : 0;
    const color = PILOT_COLORS[idx % PILOT_COLORS.length];
    const initial = driver.charAt(0).toUpperCase();

    const row = document.createElement('div');
    row.className = 'actor-row';
    row.innerHTML = `
      <div class="actor-avatar" style="background:${color}">${initial}</div>
      <div class="actor-info">
        <div class="actor-name">${driver}</div>
        <div class="actor-bar-track">
          <div class="actor-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="actor-stats">${data.trips} viaje${data.trips !== 1 ? 's' : ''} · ${Number(data.km).toLocaleString('es-AR')} km · ${pct}%</div>
      </div>
      <div class="actor-cost">${formatCurrency(data.cost)}</div>
    `;
    dom.summaryGrid.appendChild(row);
  });

  dom.summaryTotalValue.textContent = formatCurrency(grandTotal);
}

// v18.8: Chart.js visualizations
function renderCharts() {
  const vehicle = getActiveVehicle();
  if (!vehicle || !window.Chart) return;

  if (kmChart)   { kmChart.destroy();   kmChart = null; }
  if (costChart) { costChart.destroy(); costChart = null; }

  const drivers = vehicle.drivers || [];
  const now = new Date();

  // A) Doughnut — KM per pilot, current month
  const currentMonthTrips = state.trips.filter(t => {
    const d = new Date(t.occurred_at || t.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const kmByDriver = {};
  drivers.forEach(d => { kmByDriver[d] = 0; });
  currentMonthTrips.forEach(t => {
    if (kmByDriver[t.driver] !== undefined) kmByDriver[t.driver] += Number(t.km);
  });
  const hasKmData = drivers.some(d => kmByDriver[d] > 0);
  const monthName = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  // v18.9: Filter out pilots with 0 km this month; sort ascending (lowest → highest clockwise)
  const activeDrivers = hasKmData
    ? [...drivers].filter(d => kmByDriver[d] > 0).sort((a, b) => kmByDriver[a] - kmByDriver[b])
    : [];
  const hasActiveDrivers = activeDrivers.length > 0;

  const ctxKm = document.getElementById('chart-km-donut');
  if (ctxKm) {
    kmChart = new Chart(ctxKm, {
      type: 'doughnut',
      data: {
        labels: hasActiveDrivers ? activeDrivers : ['Sin datos este mes'],
        datasets: [{
          data: hasActiveDrivers ? activeDrivers.map(d => kmByDriver[d]) : [1],
          backgroundColor: hasActiveDrivers
            ? activeDrivers.map(d => PILOT_COLORS[drivers.indexOf(d) % PILOT_COLORS.length])
            : ['rgba(255,255,255,0.1)'],
          borderWidth: 2,
          borderColor: 'rgba(0,0,0,0.25)',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 10 } },
          title: { display: true, text: `KM por piloto — ${monthName}`, color: '#e2e8f0', font: { size: 12, weight: '600' }, padding: { bottom: 8 } },
          tooltip: { callbacks: { label: ctx => hasActiveDrivers ? ` ${Number(ctx.raw).toLocaleString('es-AR')} km` : ' Sin datos este mes' } },
        },
      },
    });
  }

  // v18.10: Mixed chart — Gasto Total ($) bars + Costo por KM ($/km) line, last 4 months
  const months = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }) });
  }
  const monthCosts = months.map(m =>
    state.payments
      .filter(p => { const d = new Date(p.occurred_at || p.created_at); return d.getMonth() === m.month && d.getFullYear() === m.year && Number(p.liters_loaded) > 0; })
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  );
  const monthKmAll = months.map(m =>
    state.trips
      .filter(t => { const d = new Date(t.occurred_at || t.created_at); return d.getMonth() === m.month && d.getFullYear() === m.year; })
      .reduce((sum, t) => sum + Number(t.km || 0), 0)
  );
  const monthCostPerKm = monthCosts.map((cost, i) =>
    monthKmAll[i] > 0 ? +(cost / monthKmAll[i]).toFixed(2) : 0
  );

  const ctxCost = document.getElementById('chart-cost-bar');
  if (ctxCost) {
    costChart = new Chart(ctxCost, {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [
          {
            type: 'bar',
            label: 'Gasto Total',
            data: monthCosts,
            backgroundColor: PILOT_COLORS[0] + 'bb',
            borderColor: PILOT_COLORS[0],
            borderWidth: 1,
            borderRadius: 5,
            borderSkipped: false,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: '$/km',
            data: monthCostPerKm,
            borderColor: PILOT_COLORS[2],
            backgroundColor: PILOT_COLORS[2] + '33',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: PILOT_COLORS[2],
            fill: false,
            tension: 0.3,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 10 } },
          title: { display: true, text: 'Gasto y Eficiencia — ultimos 4 meses', color: '#e2e8f0', font: { size: 12, weight: '600' }, padding: { bottom: 8 } },
          tooltip: {
            callbacks: {
              label: ctx => ctx.datasetIndex === 0
                ? ` $${formatCurrency(ctx.raw)}`
                : ` $${Number(ctx.raw).toFixed(2)}/km`,
            },
          },
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y:  { position: 'left',  ticks: { color: PILOT_COLORS[0], callback: v => formatCurrency(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y1: { position: 'right', ticks: { color: PILOT_COLORS[2], callback: v => '$' + v + '/km' }, grid: { drawOnChartArea: false } },
        },
      },
    });
  }
}

function renderBalances() {
  const vehicle = getActiveVehicle();
  const drivers = vehicle ? (vehicle.drivers || []) : [];

  // v17: Balance from ledger (single source of truth post-migration)
  const netByDriver = {};
  drivers.forEach(d => { netByDriver[d] = 0; });

  if (state.ledger.length > 0) {
    // Ledger-based balance
    state.ledger.forEach(entry => {
      if (netByDriver[entry.driver] !== undefined) {
        netByDriver[entry.driver] += Number(entry.amount);
      }
    });
  } else {
    // Legacy fallback (pre-migration vehicles)
    state.payments.forEach(p => {
      if (netByDriver[p.driver] !== undefined) netByDriver[p.driver] += Number(p.amount);
    });
    state.trips.forEach(t => {
      if (netByDriver[t.driver] !== undefined) netByDriver[t.driver] -= Number(t.cost);
    });
  }

  dom.balancesGrid.innerHTML = '';
  const balances = [];

  // v17: Compute credits and debits for expanded detail view
  const creditsByDriver = {};
  const debitsByDriver = {};
  drivers.forEach(d => { creditsByDriver[d] = 0; debitsByDriver[d] = 0; });
  if (state.ledger.length > 0) {
    state.ledger.forEach(entry => {
      if (entry.amount > 0 && creditsByDriver[entry.driver] !== undefined) {
        creditsByDriver[entry.driver] += Number(entry.amount);
      } else if (entry.amount < 0 && debitsByDriver[entry.driver] !== undefined) {
        debitsByDriver[entry.driver] += Math.abs(Number(entry.amount));
      }
    });
  } else {
    state.payments.forEach(p => { if (creditsByDriver[p.driver] !== undefined) creditsByDriver[p.driver] += Number(p.amount); });
    state.trips.forEach(t => { if (debitsByDriver[t.driver] !== undefined) debitsByDriver[t.driver] += Number(t.cost); });
  }

  // v18.9: Sort drivers — most debt (most negative net) first → most credit (most positive) last
  const sortedDrivers = [...drivers].sort((a, b) => netByDriver[a] - netByDriver[b]);

  sortedDrivers.forEach((driver) => {
    const idx = drivers.indexOf(driver); // preserve original PILOT_COLORS assignment
    const net = +netByDriver[driver].toFixed(2);
    const credit = creditsByDriver[driver];
    const debit = debitsByDriver[driver];
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

    // v14.8: Respect master toggle state
    if (state.balancesExpanded) {
      card.querySelector('.balance-expand').classList.remove('hidden');
    }

    dom.balancesGrid.appendChild(card);
  });

  renderClearing(balances);
  renderTankCapital();
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

// v15.1: Show capital currently held in the tank
function renderTankCapital() {
  const vehicle = getActiveVehicle();
  if (!vehicle) {
    toggleHidden(dom.tankCapitalSection, true);
    return;
  }

  const level = calculateTankLevel();
  if (level <= 0.5) {
    toggleHidden(dom.tankCapitalSection, true);
    return;
  }

  const fuelPrice = getLatestFuelPrice(vehicle);
  const capitalValue = +(level * fuelPrice).toFixed(2);

  // Find who paid for fuel since last full-tank
  const lastFullTank = state.payments
    .filter(p => p.is_full_tank && p.liters_loaded > 0)
    .sort((a, b) => getEventDate(b) - getEventDate(a))[0];

  const contributions = {};
  const cutoffDate = lastFullTank ? getEventDate(lastFullTank) : new Date(0);

  state.payments.forEach(p => {
    if (p.liters_loaded > 0) {
      const pDate = getEventDate(p);
      if (pDate >= cutoffDate) {
        contributions[p.driver] = (contributions[p.driver] || 0) + Number(p.liters_loaded);
      }
    }
  });

  const contributors = Object.entries(contributions)
    .sort((a, b) => b[1] - a[1])
    .map(([driver]) => driver);

  const mainContributor = contributors.length > 0
    ? contributors.join(' y ')
    : 'los pilotos';

  dom.tankCapitalText.textContent =
    `El auto tiene ${level.toFixed(1)} litros valorados en ${formatCurrency(capitalValue)} que fueron pagados por ${mainContributor}.`;

  toggleHidden(dom.tankCapitalSection, false);
}

function renderPaymentHistory() {
  // v18.9: Only real fuel loads (liters_loaded > 0) — excludes transfers, settlements, adjustments
  const payments = state.payments.filter(p => Number(p.liters_loaded) > 0);
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
    // v15.7: Build meta pills
    const pills = [];
    pills.push(`<span class="meta-pill">${formatDate(p.occurred_at || p.created_at)}</span>`);
    if (p.liters_loaded) pills.push(`<span class="meta-pill">${p.liters_loaded} lts</span>`);
    if (p.price_per_liter) pills.push(`<span class="meta-pill">${formatCurrency(p.price_per_liter)}/l</span>`);
    if (p.is_full_tank) pills.push(`<span class="meta-pill pill-full">Tanque lleno</span>`);
    if (p.note) pills.push(`<span class="meta-pill">${p.note}</span>`);

    // v10: Badge Factura A
    const facturaBadge = (!isSettlement && p.invoice_type === 'Factura A')
      ? '<span class="badge-factura-a">FACTURA A</span>' : '';

    if (isSettlement) {
      item.innerHTML = `
        <div class="payment-header">
          <div class="payment-driver"><span class="settlement-icon">&#128181;</span>${p.driver}</div>
          <span class="payment-amount settlement-amount">${formatCurrency(p.amount)}</span>
        </div>
        <div class="payment-body">${pills.join('')}</div>
      `;
    } else {
      item.innerHTML = `
        <div class="payment-header">
          <div class="payment-driver"><span class="pilot-dot" style="background:${dotColor}"></span>${p.driver} ${facturaBadge}</div>
          <span class="payment-amount">${formatCurrency(p.amount)}</span>
        </div>
        <div class="payment-body">${pills.join('')}</div>
        <div class="payment-footer"></div>
      `;
    }

    // v15.7: Append action buttons to footer (or item for settlements)
    const footer = item.querySelector('.payment-footer');
    const btnTarget = footer || item;

    if (!isSettlement && p.photo_url) {
      const photoBtn = document.createElement('button');
      photoBtn.className = 'btn-icon btn-photo-evidence';
      photoBtn.title = 'Ver ticket';
      photoBtn.textContent = '\uD83D\uDCF7';
      photoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPhotoViewer(p.photo_url);
      });
      btnTarget.appendChild(photoBtn);
    }

    if (!isSettlement && (p.tax_perceptions > 0 || p.discount_amount > 0 || p.liters_loaded)) {
      const infoBtn = document.createElement('button');
      infoBtn.className = 'btn-info-breakdown';
      infoBtn.title = 'Ver desglose';
      infoBtn.innerHTML = '\u24D8';
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPaymentBreakdown(p);
      });
      btnTarget.appendChild(infoBtn);
    }

    if (!isSettlement) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-icon btn-icon-edit';
      editBtn.title = 'Editar carga';
      editBtn.innerHTML = '&#9998;';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPaymentModal(p.id);
      });
      btnTarget.appendChild(editBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-icon-danger';
    deleteBtn.title = 'Eliminar carga';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.style.fontSize = '1.1rem';
    deleteBtn.addEventListener('click', () => handleDeletePayment(p));
    btnTarget.appendChild(deleteBtn);

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

  // v15: Find closing full-tank payment photo
  let ticketPhotoUrl = null;
  if (trip.reconciled_at) {
    const reconDate = new Date(trip.reconciled_at);
    const closingPayment = state.payments
      .filter(p => p.is_full_tank && p.photo_url)
      .sort((a, b) => Math.abs(getEventDate(a) - reconDate) - Math.abs(getEventDate(b) - reconDate))
      [0];
    if (closingPayment && Math.abs(getEventDate(closingPayment) - reconDate) < 86400000) {
      ticketPhotoUrl = closingPayment.photo_url;
    }
  }

  const popup = document.createElement('div');
  popup.className = 'payment-breakdown-popup ticket-popup';

  const reconDateStr = trip.reconciled_at ? formatDate(trip.reconciled_at) : '—';
  const origConsumption = trip.original_consumption ? Number(trip.original_consumption).toFixed(1) : '—';
  const realConsumption = trip.real_consumption ? Number(trip.real_consumption).toFixed(1) : '—';

  popup.innerHTML = `
    <button class="breakdown-close" id="breakdown-close-btn">&times;</button>
    <div class="breakdown-row" style="font-weight:600;margin-bottom:0.5rem">
      ✓ Precio Verificado
    </div>
    <div class="breakdown-row">
      <span>Este viaje fue ajustado al costo real del surtidor.</span>
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
      <span>Verificado el:</span>
      <strong>${reconDateStr}</strong>
    </div>
    ${ticketPhotoUrl ? '<div class="breakdown-row"><button class="btn-view-ticket" id="btn-recon-view-ticket">&#128247; Ver Ticket Original</button></div>' : ''}
  `;

  document.body.appendChild(popup);
  popup.querySelector('#breakdown-close-btn').addEventListener('click', () => popup.remove());
  const viewTicketBtn = popup.querySelector('#btn-recon-view-ticket');
  if (viewTicketBtn) {
    viewTicketBtn.addEventListener('click', () => openPhotoViewer(ticketPhotoUrl));
  }
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

// v15.1: Popup explanation for estimated prices
function showEstimatedExplanation() {
  const existing = document.querySelector('.payment-breakdown-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = 'payment-breakdown-popup ticket-popup';
  popup.innerHTML = `
    <button class="breakdown-close" id="breakdown-close-btn">&times;</button>
    <div class="breakdown-row" style="font-weight:600;margin-bottom:0.5rem">
      Precio Estimado
    </div>
    <div class="breakdown-row">
      <span>Este precio es una estimación basada en la última carga. Se ajustará al valor real en el próximo tanque lleno.</span>
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

  // v18.5: Always open on Resumen tab when switching vehicle
  switchDetailTab('summary');

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
    const vehicle = getActiveVehicle();
    const [trips, payments, ledger, driverMappings, auditLogs] = await Promise.all([
      fetchTrips(vehicleId),
      fetchPayments(vehicleId),
      fetchLedger(vehicleId),
      fetchDriverMappings(vehicleId),
      fetchAuditLogs(vehicleId), // v18.5
    ]);
    state.trips = trips;
    state.payments = payments;
    state.ledger = ledger;
    state.driverMappings = driverMappings;
    state.auditLogs = auditLogs; // v18.5

    // v17: Auto-migrate legacy balances to ledger on first load
    if (state.ledger.length === 0 && (trips.length > 0 || payments.length > 0) && vehicle) {
      await migrateToLedger(vehicleId, vehicle.drivers || []);
      state.ledger = await fetchLedger(vehicleId);
    }

    renderTrips();
    renderSummary();
    renderBalances();
    renderPaymentHistory();
    renderSmartCard(); // v18.5
    renderCharts();    // v18.8
    renderVehicleDetail(); // v11: Re-render con datos de tanque

    // v18.14: Auto-popup identity claim if logged-in user has no mapping for this vehicle
    if (state.profile && !driverMappings.some(m => m.user_id === state.profile.id)) {
      openClaimIdentityModal(vehicle);
    }

    // v18.5: Reset activity feed (lazy-built when user visits that tab)
    state.activityItems = [];
    state.activityPage = 0;
    if (state.activeDetailTab === 'finances') buildAndRenderActivity(); // v18.8
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
  // v18.4: Debounce — disable immediately to prevent double submit
  const btn = dom.btnSubmitVehicle;
  if (btn.disabled) return;
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

  // v16.2: Include owner_id for RLS trigger
  const { data: { session } } = await db.auth.getSession();
  const payload = {
    name: dom.vehicleNameInput.value.trim(),
    model: dom.vehicleModelSelect.value,
    consumption,
    fuel_type: dom.vehicleFuelTypeSelect.value,
    fuel_price: fuelPrice,
    drivers,
    owner_id: session?.user?.id || null,
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

// v17: Find the main creditor for a debtor
function findMainCreditor(debtorDriver, drivers) {
  const nets = {};
  drivers.forEach(d => { nets[d] = 0; });
  if (state.ledger.length > 0) {
    state.ledger.forEach(e => { if (nets[e.driver] !== undefined) nets[e.driver] += Number(e.amount); });
  } else {
    state.payments.forEach(p => { if (nets[p.driver] !== undefined) nets[p.driver] += Number(p.amount); });
    state.trips.forEach(t => { if (nets[t.driver] !== undefined) nets[t.driver] -= Number(t.cost); });
  }
  // Find the driver with highest positive balance (biggest creditor)
  let maxNet = 0, creditor = null;
  for (const [d, n] of Object.entries(nets)) {
    if (d !== debtorDriver && n > maxNet) { maxNet = n; creditor = d; }
  }
  return creditor;
}

function handleClearPilotAccount(driver) {
  const vehicle = getActiveVehicle();
  if (!vehicle) return;

  // v17: Calculate debt from ledger
  let net = 0;
  if (state.ledger.length > 0) {
    state.ledger.forEach(entry => { if (entry.driver === driver) net += Number(entry.amount); });
    net = +net.toFixed(2);
  } else {
    let credit = 0, debit = 0;
    state.payments.forEach(p => { if (p.driver === driver) credit += Number(p.amount); });
    state.trips.forEach(t => { if (t.driver === driver) debit += Number(t.cost); });
    net = +(credit - debit).toFixed(2);
  }

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
  // v17: Auto-determine creditor from balances
  const creditorDriver = findMainCreditor(driver, vehicle.drivers || []);
  dom.paymentNote.value = `Saldado de deuda a: ${creditorDriver || ''}`;

  // Ocultar campos de combustible
  document.querySelectorAll('.settlement-hide').forEach(el => el.classList.add('hidden'));

  $('#payment-modal-title').textContent = `Saldar cuenta de ${driver}`;
  const btnText = dom.btnSubmitPayment.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Registrar saldo';

  toggleHidden(dom.paymentModal, false);
}

// --- Payment Modal ---

function openPaymentModal(editId) {
  // v15.5: Close any open popups
  document.querySelectorAll('.payment-breakdown-popup').forEach(p => p.remove());
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
  dom.adjustmentsDetails.open = false;
  toggleHidden(dom.paymentPriceSummary, true);

  // v15: Reset photo state
  state.pendingPhotoFile = null;
  state.photoRemoved = false;
  dom.paymentPhotoInput.value = '';
  dom.photoPreviewImg.src = '';
  toggleHidden(dom.photoPreview, true);
  toggleHidden(dom.btnCapturePhoto, false);

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
      dom.adjustmentsDetails.open = true;
    }
    // v15: Show existing photo in edit mode
    if (p.photo_url) {
      dom.photoPreviewImg.src = p.photo_url;
      toggleHidden(dom.photoPreview, false);
      toggleHidden(dom.btnCapturePhoto, true);
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
    // v18: Auto-select logged-in user's driver
    const myDriver = getMyDriverName(vehicle.id);
    if (myDriver) dom.paymentDriver.value = myDriver;
  }

  toggleHidden(dom.paymentModal, false);
}

function closePaymentModal() {
  state.settlementMode = false;
  state.settlementDriver = null;
  state.editingPaymentId = null;
  // v15: Cleanup photo state
  state.pendingPhotoFile = null;
  state.photoRemoved = false;
  document.querySelectorAll('.settlement-hide').forEach(el => el.classList.remove('hidden'));
  toggleHidden(dom.paymentModal, true);
}

// v14.8: Trip modal open/close
function openTripModal(editTrip) {
  const vehicle = getActiveVehicle();
  if (!vehicle) return;
  renderDriverSelect(vehicle.drivers || []);
  if (editTrip) {
    state.editingTripId = editTrip.id;
    dom.tripDriver.value = editTrip.driver;
    dom.tripKm.value = editTrip.km;
    dom.tripNote.value = editTrip.note || '';
    dom.tripOccurredAt.value = editTrip.occurred_at
      ? toLocalDatetimeValue(new Date(editTrip.occurred_at))
      : toLocalDatetimeValue(new Date(editTrip.created_at));
    const savedType = editTrip.drive_type || 'Mixto';
    if (dom.tripDriveType) dom.tripDriveType.value = savedType;
    if (dom.driveTypeSelector) {
      dom.driveTypeSelector.querySelectorAll('.drive-type-btn').forEach(b =>
        b.classList.toggle('drive-type-btn--active', b.dataset.type === savedType));
    }
    handleTripKmInput();
    dom.tripModalTitle.textContent = 'Editar viaje';
    dom.btnSubmitTrip.querySelector('.btn-text').textContent = 'Guardar cambios';
  } else {
    state.editingTripId = null;
    dom.tripForm.reset();
    dom.tripOccurredAt.value = toLocalDatetimeValue();
    dom.tripDriveType.value = 'Mixto';
    dom.driveTypeSelector.querySelectorAll('.drive-type-btn').forEach(b =>
      b.classList.toggle('drive-type-btn--active', b.dataset.type === 'Mixto'));
    dom.costPreviewValue.textContent = '$0,00';
    dom.tripModalTitle.textContent = 'Registrar viaje';
    dom.btnSubmitTrip.querySelector('.btn-text').textContent = 'Registrar viaje';
    // v18: Auto-select logged-in user's driver
    const myDriver = getMyDriverName(vehicle.id);
    if (myDriver) dom.tripDriver.value = myDriver;
  }
  toggleHidden(dom.tripModal, false);
}

function closeTripModal() {
  toggleHidden(dom.tripModal, true);
  state.editingTripId = null;
}

// v15.2: Vehicle selector modal for Home flow
function openVehicleSelector(onSelect) {
  dom.vehicleSelectorList.innerHTML = '';
  state.vehicles.forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'vehicle-selector-item';
    btn.textContent = v.name;
    btn.addEventListener('click', async () => {
      toggleHidden(dom.vehicleSelectorModal, true);
      await selectVehicle(v.id);
      if (onSelect) onSelect();
      haptic();
    });
    dom.vehicleSelectorList.appendChild(btn);
  });
  toggleHidden(dom.vehicleSelectorModal, false);
}

async function handlePaymentSubmit(e) {
  e.preventDefault();
  // v18.4: Debounce — disable immediately to prevent double submit
  const btn = dom.btnSubmitPayment;
  if (btn.disabled) return;
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

    // v15: Handle photo upload
    if (state.pendingPhotoFile) {
      try {
        paymentData.photo_url = await uploadTicketPhoto(state.pendingPhotoFile, state.activeVehicleId);
      } catch (photoErr) {
        console.warn('Photo upload failed:', photoErr);
        showToast('Foto no se pudo subir, carga guardada sin foto', 'error');
      }
      state.pendingPhotoFile = null;
    } else if (state.editingPaymentId && !state.photoRemoved) {
      const existing = state.payments.find(pay => pay.id === state.editingPaymentId);
      if (existing && existing.photo_url) paymentData.photo_url = existing.photo_url;
    }

    // v12: Update existing or create new
    if (state.editingPaymentId) {
      await updatePayment(state.editingPaymentId, paymentData);
      showToast('Carga actualizada');
      // v14.5: Recalculate global consumption after editing a payment
      state.payments = await fetchPayments(state.activeVehicleId);
      await recalculateGlobalConsumption();
    } else {
      const createdPayment = await createPayment(paymentData);

      // v17: Insert ledger entries
      if (isSettlement) {
        // Double-entry for settlements
        const creditorMatch = (dom.paymentNote.value || '').match(/Saldado de deuda a:\s*(.+)/i);
        const creditorDriver = creditorMatch ? creditorMatch[1].trim() : null;
        await insertLedgerEntry({
          vehicle_id: state.activeVehicleId, driver,
          type: 'transfer', amount: +amount,
          ref_id: createdPayment.id,
          description: creditorDriver ? `Saldo pagado a ${creditorDriver}` : 'Transferencia'
        });
        if (creditorDriver) {
          await insertLedgerEntry({
            vehicle_id: state.activeVehicleId, driver: creditorDriver,
            type: 'transfer', amount: -(+amount),
            ref_id: createdPayment.id,
            description: `Saldo recibido de ${driver}`
          });
        }
        showToast(`Saldo de ${formatCurrency(amount)} registrado para ${driver}`);
      } else {
        // Fuel payment = credit
        await insertLedgerEntry({
          vehicle_id: state.activeVehicleId, driver,
          type: 'fuel_payment', amount: +amount,
          ref_id: createdPayment.id,
          description: litersLoaded ? `Carga ${litersLoaded} lts` : `Pago combustible`
        });
        if (!originalLiters) {
          showToast(`Carga registrada (${litersLoaded} lts estimados a ${formatCurrency(pricePerLiter)}/l)`);
        } else {
          showToast('Carga registrada');
        }
      }
    }
    haptic();
    state.payments = await fetchPayments(state.activeVehicleId);
    state.ledger = await fetchLedger(state.activeVehicleId); // v17
    state.dashboardLoaded = false;
    renderBalances();
    renderPaymentHistory();
    closePaymentModal();

    // Solo para cargas reales de combustible (no saldados)
    if (!isSettlement) {
      // v17: PPP Persistente (Precio Promedio Ponderado)
      if (litersLoaded && litersLoaded > 0) {
        const vehicle = getActiveVehicle();
        if (vehicle) {
          const oldPPP = vehicle.current_ppp > 0 ? vehicle.current_ppp : getLatestFuelPrice(vehicle);
          const oldLiters = Math.max(vehicle.virtual_liters || 0, 0);
          const newTotalLiters = oldLiters + litersLoaded;
          let newPPP;
          if (newTotalLiters <= 0) {
            newPPP = effectivePrice || pricePerLiter || vehicle.fuel_price;
          } else {
            newPPP = +((oldLiters * oldPPP + amount) / newTotalLiters).toFixed(2);
          }
          const updates = {
            current_ppp: newPPP,
            virtual_liters: +newTotalLiters.toFixed(2),
            fuel_price: newPPP // mantener compatibilidad
          };
          if (isFullTank) {
            const tankCap = getVehicleTankCapacity(vehicle);
            if (tankCap) {
              updates.virtual_liters = tankCap;
              updates.last_full_tank_at = paymentData.occurred_at;
            }
          }
          await updateVehicle(state.activeVehicleId, updates);
          state.vehicles = await fetchVehicles();
          renderVehicleDetail();
          renderVehicleCards();
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

  // v17: Insert ledger tank_audit_adjustment entries per driver (proportional to km driven)
  if (Math.abs(adjustmentAmount) > 0.01) {
    const driverKm = {};
    cycleTrips.forEach(t => { driverKm[t.driver] = (driverKm[t.driver] || 0) + Number(t.km); });
    const totalCycleKm = Object.values(driverKm).reduce((a, b) => a + b, 0);
    for (const [drv, km] of Object.entries(driverKm)) {
      const proportion = km / totalCycleKm;
      const driverAdj = +(adjustmentAmount * proportion).toFixed(2);
      if (Math.abs(driverAdj) > 0.01) {
        await insertLedgerEntry({
          vehicle_id: vehicle.id, driver: drv,
          type: 'tank_audit_adjustment',
          amount: -(+driverAdj),
          description: `Ajuste auditoria tanque (factor: ${deviationFactor.toFixed(3)})`
        });
      }
    }
    state.ledger = await fetchLedger(state.activeVehicleId);
  }

  // v17: Update correction_factor (Total Real Liters / Total Theoretical Liters)
  const newCorrectionFactor = +(deviationFactor).toFixed(4);
  await updateVehicle(state.activeVehicleId, { correction_factor: newCorrectionFactor });

  // Phase 2: Reconstructive memory — recalculate from all closed cycles
  await recalculateGlobalConsumption();

  state.vehicles = await fetchVehicles(); // v17: refresh correction_factor
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
      // v15: Cleanup photo from storage (best-effort)
      if (payment.photo_url) {
        try {
          const path = payment.photo_url.split('/fuel-tickets/')[1];
          if (path) await db.storage.from('fuel-tickets').remove([decodeURIComponent(path)]);
        } catch (e) { /* orphan photo is acceptable */ }
      }
      showToast('Carga eliminada');
      haptic();
      // v18.4: Full state reload — cascade trigger deletes ledger rows,
      // so we must re-fetch ledger + vehicles to reflect correct balances
      const [payments, ledger, vehicles] = await Promise.all([
        fetchPayments(state.activeVehicleId),
        fetchLedger(state.activeVehicleId),
        fetchVehicles(),
      ]);
      state.payments = payments;
      state.ledger = ledger;
      state.vehicles = vehicles;
      state.dashboardLoaded = false;
      renderBalances();
      renderPaymentHistory();
      renderVehicleDetail();
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
    // v17: Use PPP and correction_factor in preview
    const tripPrice = vehicle.current_ppp > 0 ? vehicle.current_ppp : getLatestFuelPrice(vehicle);
    const corrFactor = vehicle.correction_factor || 1.0;
    const { cost } = calculateCost(km, consumption, tripPrice, corrFactor);
    dom.costPreviewValue.textContent = formatCurrency(cost);
  } else {
    dom.costPreviewValue.textContent = '$0,00';
  }
}

async function handleTripSubmit(e) {
  e.preventDefault();
  // v18.4: Debounce — disable immediately to prevent double submit
  const btn = dom.btnSubmitTrip;
  if (btn.disabled) return;
  setButtonLoading(btn, true);

  const vehicle = getActiveVehicle();
  if (!vehicle) { setButtonLoading(btn, false); return; }

  const km = parseFloat(dom.tripKm.value);
  if (!km || km <= 0) {
    showToast('Ingresa los kilometros recorridos', 'error');
    setButtonLoading(btn, false);
    return;
  }

  const driver = dom.tripDriver.value;
  if (!driver) {
    showToast('Selecciona un piloto', 'error');
    setButtonLoading(btn, false);
    return;
  }

  // v13: Drive type selection
  const driveType = dom.tripDriveType ? dom.tripDriveType.value : 'Mixto';
  const consumption = getConsumptionForDriveType(vehicle, driveType);
  // v17: Use PPP as price source, correction_factor for adjusted consumption
  const tripPrice = vehicle.current_ppp > 0 ? vehicle.current_ppp : getLatestFuelPrice(vehicle);
  const corrFactor = vehicle.correction_factor || 1.0;
  const { liters, cost } = calculateCost(km, consumption, tripPrice, corrFactor);

  // v14.6: Temporal dimension
  const occurredAt = dom.tripOccurredAt.value
    ? new Date(dom.tripOccurredAt.value).toISOString()
    : new Date().toISOString();

  // v11: Verificar tanque virtual
  const tankLevel = calculateTankLevel();
  if (tankLevel <= 0) {
    showToast('Tanque virtual vacio, usando precio de referencia', 'error');
  }

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
    } else {
      const createdTrip = await createTrip({
        vehicle_id: state.activeVehicleId,
        driver,
        km,
        note: dom.tripNote.value.trim() || null,
        liters,
        cost,
        drive_type: driveType,
        occurred_at: occurredAt,
      });
      // v17: Insert ledger entry (trip_cost = debit)
      await insertLedgerEntry({
        vehicle_id: state.activeVehicleId,
        driver,
        type: 'trip_cost',
        amount: -(+cost),
        ref_id: createdTrip.id,
        description: `Viaje ${km} km (${driveType})`
      });
      // v17: Decrease virtual liters
      const newVL = +((vehicle.virtual_liters || 0) - liters).toFixed(2);
      await updateVehicle(state.activeVehicleId, { virtual_liters: newVL });
      vehicle.virtual_liters = newVL;
      showToast('Viaje registrado');
    }
    haptic();
    closeTripModal();
    state.trips = await fetchTrips(state.activeVehicleId);
    state.ledger = await fetchLedger(state.activeVehicleId); // v17
    state.vehicles = await fetchVehicles(); // v17: refresh PPP/virtual_liters
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
    // v18.4: Full state reload — cascade trigger deletes ledger rows,
    // so we must re-fetch ledger + vehicles to reflect correct balances
    const [trips, ledger, vehicles] = await Promise.all([
      fetchTrips(state.activeVehicleId),
      fetchLedger(state.activeVehicleId),
      fetchVehicles(),
    ]);
    state.trips = trips;
    state.ledger = ledger;
    state.vehicles = vehicles;
    state.dashboardLoaded = false;
    renderTrips();
    renderSummary();
    renderBalances();
    renderVehicleDetail();
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

  // v17: Use ledger for balance calculation
  const netByDriver = {};
  drivers.forEach(d => { netByDriver[d] = 0; });
  if (state.ledger.length > 0) {
    state.ledger.forEach(entry => {
      if (netByDriver[entry.driver] !== undefined) netByDriver[entry.driver] += Number(entry.amount);
    });
  } else {
    state.payments.forEach(p => { if (netByDriver[p.driver] !== undefined) netByDriver[p.driver] += Number(p.amount); });
    state.trips.forEach(t => { if (netByDriver[t.driver] !== undefined) netByDriver[t.driver] -= Number(t.cost); });
  }

  let totalConsumo = state.trips.reduce((sum, t) => sum + Number(t.cost), 0);
  const balances = [];
  drivers.forEach((d) => {
    balances.push({ driver: d, net: +netByDriver[d].toFixed(2) });
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

// v16.2: Handle invite code generation and sharing
async function handleInvite() {
  const vehicle = getActiveVehicle();
  if (!vehicle) return;

  try {
    let code = vehicle.invite_code;
    if (!code) {
      code = await generateInviteCode(vehicle.id);
      vehicle.invite_code = code;
    }

    const inviteUrl = `https://naftometro.vercel.app/?invite=${code}`;
    const inviteText = `Unite a mi vehiculo "${vehicle.name}" en Naftometro!\n${inviteUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ text: inviteText });
        haptic();
      } catch (err) {
        if (err.name !== 'AbortError') {
          await fallbackCopy(inviteText);
        }
      }
    } else {
      await fallbackCopy(inviteText);
    }
  } catch (err) {
    console.error('Error generating invite code:', err);
    showToast('Error al generar codigo de invitacion', 'error');
  }
}

// v16.2: Handle joining a vehicle by invite code
async function handleJoinByCode() {
  const code = prompt('Ingresa el codigo de invitacion:');
  if (!code || !code.trim()) return;

  try {
    const result = await joinVehicleByCode(code.trim().toUpperCase());

    if (result && result.success) {
      showToast('Te uniste al vehiculo exitosamente!');
      haptic();
      state.vehicles = await fetchVehicles();
      await renderVehicleCards();
      renderVehicleDetail();

      // v18.2: Show avatar claim for the joined vehicle
      const vehicleId = result.vehicle_id;
      const vehicle = state.vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        await showAvatarClaimModal(vehicleId, vehicle.drivers || []);
      }
    } else {
      showToast(result?.error || 'Codigo invalido', 'error');
    }
  } catch (err) {
    console.error('Error joining vehicle:', err);
    showToast('Error al unirse al vehiculo', 'error');
  }
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

  // v15.2: Smart trip registration from Home
  $('#btn-add-trip-home').addEventListener('click', async () => {
    if (state.vehicles.length === 0) {
      showToast('Crea un vehiculo primero', 'error');
      return;
    }
    if (state.vehicles.length === 1) {
      await selectVehicle(state.vehicles[0].id);
      openTripModal();
      haptic();
      return;
    }
    // >1 vehicles: try remembered, else show selector
    const vehicleId = state.activeVehicleId || state.lastVisitedVehicleId;
    if (vehicleId) {
      await selectVehicle(vehicleId);
      openTripModal();
      haptic();
    } else {
      openVehicleSelector(() => openTripModal());
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

  // v16.2: Invite code
  $('#btn-invite').addEventListener('click', handleInvite);
  $('#btn-join-by-code').addEventListener('click', handleJoinByCode);

  // v14.8: Action Center buttons
  dom.btnQuickTrip.addEventListener('click', () => openTripModal());
  dom.btnQuickFuel.addEventListener('click', () => openPaymentModal());

  // v14.8: Trip modal close
  $('#btn-close-trip-modal').addEventListener('click', closeTripModal);
  dom.tripModal.addEventListener('click', (e) => {
    if (e.target === dom.tripModal) closeTripModal();
  });

  // v14.8: Balance card detail toggle (expand all / collapse all)
  $('#btn-toggle-all-balances').addEventListener('click', () => {
    state.balancesExpanded = !state.balancesExpanded;
    document.querySelectorAll('.balance-expand').forEach(el => {
      el.classList.toggle('hidden', !state.balancesExpanded);
    });
    const btn = $('#btn-toggle-all-balances');
    btn.innerHTML = state.balancesExpanded ? '&#9650;' : '&#8645;';
    btn.title = state.balancesExpanded ? 'Colapsar todos' : 'Expandir todos';
  });

  // v18.7: Collapse/expand the entire balances body section
  $('#btn-toggle-balances-body').addEventListener('click', () => {
    const body = document.getElementById('balances-body');
    const btn = document.getElementById('btn-toggle-balances-body');
    const isCollapsed = body.classList.toggle('collapsed');
    btn.classList.toggle('collapsed', isCollapsed);
    btn.setAttribute('aria-expanded', String(!isCollapsed));
    btn.title = isCollapsed ? 'Expandir' : 'Colapsar';
  });

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

  // v15: Photo capture
  dom.btnCapturePhoto.addEventListener('click', () => dom.paymentPhotoInput.click());
  dom.paymentPhotoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    state.pendingPhotoFile = file;
    const url = URL.createObjectURL(file);
    dom.photoPreviewImg.src = url;
    toggleHidden(dom.photoPreview, false);
    toggleHidden(dom.btnCapturePhoto, true);
  });
  dom.btnRemovePhoto.addEventListener('click', () => {
    state.pendingPhotoFile = null;
    state.photoRemoved = true;
    dom.paymentPhotoInput.value = '';
    if (dom.photoPreviewImg.src) URL.revokeObjectURL(dom.photoPreviewImg.src);
    dom.photoPreviewImg.src = '';
    toggleHidden(dom.photoPreview, true);
    toggleHidden(dom.btnCapturePhoto, false);
  });

  // v15: Photo viewer
  $('#btn-close-photo-viewer').addEventListener('click', () => toggleHidden(dom.photoViewerModal, true));
  dom.photoViewerModal.addEventListener('click', (e) => {
    if (e.target === dom.photoViewerModal) toggleHidden(dom.photoViewerModal, true);
  });

  // v15.2: Vehicle selector close
  $('#btn-close-vehicle-selector').addEventListener('click', () => toggleHidden(dom.vehicleSelectorModal, true));
  dom.vehicleSelectorModal.addEventListener('click', (e) => {
    if (e.target === dom.vehicleSelectorModal) toggleHidden(dom.vehicleSelectorModal, true);
  });

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

// ============================================================
// v18: AUTH, ONBOARDING, AVATAR CLAIM
// ============================================================

// v18: Get the driver name linked to the logged-in user for a vehicle
function getMyDriverName(vehicleId) {
  const { profile, driverMappings } = state;
  const mapping = driverMappings.find(m =>
    m.vehicle_id === vehicleId && m.user_id === profile?.id
  );
  return mapping?.driver_name || null;
}

// v18: Auth mode (login vs signup)
let authMode = 'login';

function openAuthModal() {
  authMode = 'login';
  updateAuthModalUI();
  toggleHidden(dom.authModal, false);
}

function closeAuthModal() {
  toggleHidden(dom.authModal, true);
  document.getElementById('auth-email-form').reset();
}

function updateAuthModalUI() {
  const isLogin = authMode === 'login';
  document.getElementById('btn-auth-submit').querySelector('.btn-text').textContent =
    isLogin ? 'Iniciar sesion' : 'Crear cuenta';
  document.getElementById('auth-toggle-text').textContent =
    isLogin ? 'No tenes cuenta?' : 'Ya tenes cuenta?';
  document.getElementById('btn-auth-toggle').textContent =
    isLogin ? 'Registrate' : 'Inicia sesion';
}

async function handleEmailAuth(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const btn = document.getElementById('btn-auth-submit');
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');

  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  btn.disabled = true;

  try {
    let result;
    if (authMode === 'login') {
      result = await db.auth.signInWithPassword({ email, password });
    } else {
      result = await db.auth.signUp({ email, password });
    }
    if (result.error) throw result.error;

    if (authMode === 'signup' && result.data?.user && !result.data.session) {
      showToast('Revisa tu email para confirmar tu cuenta');
    }
    closeAuthModal();
  } catch (err) {
    const msg = err.message || 'Error de autenticacion';
    showToast(msg, 'error');
  } finally {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    btn.disabled = false;
  }
}

// v18: Onboarding
async function showOnboardingModal() {
  const { data: { user } } = await db.auth.getUser();
  const nameInput = document.getElementById('onboarding-name');
  if (user?.user_metadata?.full_name && !nameInput.value) {
    nameInput.value = user.user_metadata.full_name;
  }
  toggleHidden(dom.onboardingModal, false);
}

async function handleOnboardingSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('onboarding-name').value.trim();
  const currency = document.getElementById('onboarding-currency').value;
  if (!name) return;

  try {
    state.profile = await updateProfile({
      display_name: name,
      currency: currency,
      onboarding_completed: true
    });
    toggleHidden(dom.onboardingModal, true);
    showToast('Perfil guardado!');
  } catch (err) {
    showToast('Error al guardar perfil', 'error');
  }
}

// v18.14: Contextual Identity Claim Modal
function openClaimIdentityModal(vehicle) {
  const claimedNames = state.driverMappings.map(m => m.driver_name);
  const available = (vehicle.drivers || []).filter(d => !claimedNames.includes(d));

  // All driver slots taken — nothing to offer, skip silently
  if (available.length === 0) return;

  const list = document.getElementById('claim-identity-list');
  list.innerHTML = '';
  available.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'avatar-claim-btn';
    btn.textContent = name;
    btn.addEventListener('click', () => handleClaimIdentity(vehicle.id, name, btn));
    list.appendChild(btn);
  });

  toggleHidden(dom.modalClaimIdentity, false);
}

function closeClaimIdentityModal() {
  toggleHidden(dom.modalClaimIdentity, true);
}

async function handleClaimIdentity(vehicleId, driverName, btn) {
  const original = btn.textContent;
  btn.textContent = 'Vinculando...';
  btn.disabled = true;
  try {
    await insertDriverMapping({
      vehicle_id: vehicleId,
      user_id: state.profile.id,
      driver_name: driverName,
    });
    state.driverMappings = await fetchDriverMappings(vehicleId);
    closeClaimIdentityModal();
    renderSmartCard();
    renderBalances();
    showToast(`Vinculado como "${driverName}"`);
  } catch (err) {
    btn.textContent = original;
    btn.disabled = false;
    showToast('Error al vincularse: ' + err.message, 'error');
  }
}

// v18: Avatar Claim (Tricount-style)
async function showAvatarClaimModal(vehicleId, drivers) {
  const mappings = await fetchDriverMappings(vehicleId);
  const claimedNames = mappings.map(m => m.driver_name);
  const unclaimedDrivers = drivers.filter(d => !claimedNames.includes(d));

  const list = document.getElementById('avatar-claim-list');
  list.innerHTML = '';

  unclaimedDrivers.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'avatar-claim-btn';
    btn.textContent = name;
    btn.addEventListener('click', () => handleAvatarClaim(vehicleId, name));
    list.appendChild(btn);
  });

  document.getElementById('btn-avatar-new').onclick = () => {
    toggleHidden(dom.avatarClaimModal, true);
    showToast('Pedi al dueno del vehiculo que te agregue como piloto');
  };

  toggleHidden(dom.avatarClaimModal, false);
}

async function handleAvatarClaim(vehicleId, driverName) {
  try {
    const { data: { user } } = await db.auth.getUser();
    await insertDriverMapping({
      vehicle_id: vehicleId,
      user_id: user.id,
      driver_name: driverName
    });
    toggleHidden(dom.avatarClaimModal, true);
    showToast(`Vinculado como "${driverName}"`);
    state.driverMappings = await fetchDriverMappings(vehicleId);
  } catch (err) {
    showToast('Error al vincular piloto', 'error');
  }
}

// v15.9: Welcome modal
function closeWelcomeModal() {
  const overlay = document.getElementById('welcome-overlay');
  if (overlay.classList.contains('hidden')) return;
  overlay.classList.add('welcome-overlay-fade');
  setTimeout(() => {
    toggleHidden(overlay, true);
    overlay.classList.remove('welcome-overlay-fade');
  }, 300);
  localStorage.setItem('naftometro_welcome_seen', '1');
}

function showWelcomeModal() {
  if (localStorage.getItem('naftometro_welcome_seen')) return;
  const overlay = document.getElementById('welcome-overlay');
  toggleHidden(overlay, false);
  document.getElementById('btn-welcome-start').addEventListener('click', closeWelcomeModal);
  // v15.10: Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeWelcomeModal();
  });
}

// v18: Auth UI helpers
function showApp() {
  document.getElementById('landing-page').style.display = 'none';
  toggleHidden(dom.authModal, true);
  document.getElementById('views-container').style.display = '';
  document.getElementById('bottom-nav').style.display = '';
  document.getElementById('btn-logout').style.display = '';
}

function showLogin() {
  document.getElementById('landing-page').style.display = '';
  document.getElementById('views-container').style.display = 'none';
  document.getElementById('bottom-nav').style.display = 'none';
  document.getElementById('btn-logout').style.display = 'none';
}

async function loadAppData() {
  populateFormOptions();
  bindEvents();
  initSwipeGesture();
  showWelcomeModal();
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

// v18: Check URL for invite parameter and save for auto-join (localStorage for persistence)
function checkUrlParameters() {
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get('invite');
  if (inviteCode) {
    localStorage.setItem('naftometro_pending_invite', inviteCode.trim().toUpperCase());
    window.history.replaceState({}, '', window.location.pathname);
  }
}

// v18: Process pending invite after session is active (localStorage for persistence)
async function processPendingInvite() {
  const code = localStorage.getItem('naftometro_pending_invite');
  if (!code) return;
  localStorage.removeItem('naftometro_pending_invite');

  try {
    const result = await joinVehicleByCode(code);
    if (result && result.success) {
      showToast('Te uniste con exito al vehiculo!');
      haptic();
      state.vehicles = await fetchVehicles();
      await renderVehicleCards();
      renderVehicleDetail();

      // v18: Show avatar claim for the joined vehicle
      const vehicleId = result.vehicle_id;
      const vehicle = state.vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        await showAvatarClaimModal(vehicleId, vehicle.drivers || []);
      }
    } else {
      showToast(result?.error || 'Codigo de invitacion invalido', 'error');
    }
  } catch (err) {
    console.error('Auto-join error:', err);
    showToast('Error al unirse al vehiculo', 'error');
  }
}

async function init() {
  // v18: Capture invite code from URL before anything else (localStorage)
  checkUrlParameters();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    // v18.11: Auto-reload when a new SW takes control via skipWaiting()
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  }

  // v18: Auth bindings (landing page + auth modal)
  document.getElementById('btn-open-auth').addEventListener('click', openAuthModal);
  document.getElementById('btn-close-auth-modal').addEventListener('click', closeAuthModal);
  dom.authModal.addEventListener('click', (e) => { if (e.target === dom.authModal) closeAuthModal(); });
  document.getElementById('btn-auth-google').addEventListener('click', () => {
    db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
  });
  document.getElementById('btn-auth-toggle').addEventListener('click', () => {
    authMode = authMode === 'login' ? 'signup' : 'login';
    updateAuthModalUI();
  });
  document.getElementById('auth-email-form').addEventListener('submit', handleEmailAuth);
  document.getElementById('onboarding-form').addEventListener('submit', handleOnboardingSubmit);

  // v18.5/v18.6: Detail tab switching
  document.querySelectorAll('.detail-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.detailTab;
      if (tab !== state.activeDetailTab) {
        switchDetailTab(tab);
        haptic();
      }
    });
  });
  document.getElementById('btn-load-more-activity').addEventListener('click', loadMoreActivity);
  document.getElementById('btn-show-less-activity').addEventListener('click', showLessActivity);

  // v18.10: Wire ALL settle-debt triggers safely — querySelectorAll never throws on missing elements
  document.querySelectorAll('#btn-open-settle-debt, #btn-open-settle-debt-2').forEach(btn => {
    btn.addEventListener('click', openSettleDebtModal);
  });
  document.getElementById('btn-skip-claim-identity').addEventListener('click', closeClaimIdentityModal); // v18.14
  document.getElementById('btn-close-settle-debt').addEventListener('click', closeSettleDebtModal);
  dom.modalSettleDebt.addEventListener('click', (e) => { if (e.target === dom.modalSettleDebt) closeSettleDebtModal(); });
  document.getElementById('settle-debt-form').addEventListener('submit', handleSettleDebtSubmit);

  // v18: Logout — clear cached state (preserve pending invite in localStorage)
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await db.auth.signOut();
    localStorage.removeItem('naftometro_welcome_seen');
    state.vehicles = [];
    state.activeVehicleId = null;
    state.trips = [];
    state.payments = [];
    state.dashboardLoaded = false;
    state.allTrips = [];
    state.allPayments = [];
    state.profile = null;
    state.driverMappings = [];
    state.auditLogs = [];      // v18.5
    state.activityItems = [];  // v18.5
    state.activityPage = 0;    // v18.5
    dom.vehiclesGrid.innerHTML = '';
    dom.tripsTbody.innerHTML = '';
    dom.paymentsList.innerHTML = '';
    showLogin();
  });

  // v18: Check initial session
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    showApp();
    // v18.13: Load profile BEFORE loadAppData so renderSmartCard has state.profile available
    state.profile = await fetchProfile();
    await loadAppData();
    // v18: Onboarding check
    if (state.profile && !state.profile.onboarding_completed) {
      await showOnboardingModal();
    }
    await processPendingInvite();
  } else {
    showLogin();
  }

  // v18: Listen for auth state changes (OAuth redirect, email login, token refresh)
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      showApp();
      // v18.13: Load profile BEFORE loadAppData so renderSmartCard has state.profile available
      state.profile = await fetchProfile();
      if (state.vehicles.length === 0) {
        await loadAppData();
      }
      // v18: Onboarding check
      if (state.profile && !state.profile.onboarding_completed) {
        await showOnboardingModal();
      }
      await processPendingInvite();
    } else if (event === 'SIGNED_OUT') {
      state.vehicles = [];
      state.activeVehicleId = null;
      state.profile = null;
      state.driverMappings = [];
      showLogin();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

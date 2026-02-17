// ============================================================
// 1. CONSTANTS & CONFIGURATION
// ============================================================

const SUPABASE_URL = 'https://vablrtbwxitoiqyzyama.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhYmxydGJ3eGl0b2lxeXp5YW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NTkyOTAsImV4cCI6MjA4NjQzNTI5MH0.IK2tbR_QIwYDaBmYy1WPNai5o5BHGq_f8K6FQOft_ww';

const VEHICLE_MODELS = {
  'VW Gol Trend 1.6': 12.5,
  'Toyota Corolla 1.8': 13.0,
  'Ford Ka 1.5': 14.0,
  'Fiat Cronos 1.3': 13.5,
  'Chevrolet Onix 1.0T': 15.0,
  'Renault Sandero 1.6': 12.0,
  'Toyota Hilux 2.8 TD': 8.5,
  'Ford Ranger 3.2 TD': 8.0,
  'VW Amarok 2.0 TD': 9.0,
  'Peugeot 208 1.6': 13.5,
  'VW Taos 1.4 250 TSI': 12.0,
};

const FUEL_TYPES = [
  'Super (95 octanos)',
  'Premium (98 octanos)',
  'Diesel / Gasoil',
  'Infinia / V-Power',
];

const TABS = ['detail', 'home', 'dashboard'];

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
  pendingConsumptionUpdate: null,
  settlementMode: false,
  settlementDriver: null,
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
  tripForm: $('#trip-form'),
  tripDriver: $('#trip-driver'),
  tripKm: $('#trip-km'),
  tripNote: $('#trip-note'),
  costPreviewValue: $('#cost-preview-value'),
  btnSubmitTrip: $('#btn-submit-trip'),
  summaryGrid: $('#summary-grid'),
  summaryTotalValue: $('#summary-total-value'),
  balancesGrid: $('#balances-grid'),
  btnAddFuel: $('#btn-add-fuel'),
  clearingSection: $('#clearing-section'),
  clearingList: $('#clearing-list'),
  paymentsList: $('#payments-list'),
  paymentsEmpty: $('#payments-empty'),
  tripsLoading: $('#trips-loading'),
  tripsEmpty: $('#trips-empty'),
  tripsTable: $('#trips-table'),
  tripsTbody: $('#trips-tbody'),
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

async function recalculateTrips(vehicleId, consumption, fuelPrice) {
  const { data: trips, error: fetchErr } = await db
    .from('trips')
    .select('*')
    .eq('vehicle_id', vehicleId);
  if (fetchErr) throw fetchErr;

  for (const trip of trips) {
    const { liters, cost } = calculateCost(trip.km, consumption, fuelPrice);
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
        <span>${lastTrip ? formatDate(lastTrip.created_at) + ' · ' + lastTrip.driver : 'Sin viajes'}</span>
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
  dom.vehicleConsumptionBadge.textContent = vehicle.consumption + ' km/l';
  dom.vehicleFuelTypeBadge.textContent = vehicle.fuel_type;
  const latestPrice = getLatestFuelPrice(vehicle);
  dom.vehicleFuelPriceBadge.textContent = formatCurrency(latestPrice) + '/l';

  const costPerKm = latestPrice / vehicle.consumption;
  dom.vehicleCostKmBadge.textContent = formatCurrency(costPerKm) + '/km';

  renderDriverSelect(vehicle.drivers || []);

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

  let currentGroup = '';

  trips.forEach((trip) => {
    const group = getDateGroup(trip.created_at);
    if (group !== currentGroup) {
      currentGroup = group;
      const groupRow = document.createElement('tr');
      groupRow.innerHTML = `<td colspan="7" class="trip-date-group">${group}</td>`;
      dom.tripsTbody.appendChild(groupRow);
    }

    const driverIdx = vehicleDrivers.indexOf(trip.driver);
    const pilotColor = PILOT_COLORS[driverIdx >= 0 ? driverIdx % PILOT_COLORS.length : 0];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Fecha ">${formatDate(trip.created_at)}</td>
      <td data-label="Piloto " style="color:${pilotColor};font-weight:600">${trip.driver}</td>
      <td data-label="Km ">${Number(trip.km).toLocaleString('es-AR')}</td>
      <td data-label="Litros ">${Number(trip.liters).toFixed(2)}</td>
      <td data-label="Costo "><strong>${formatCurrency(trip.cost)}</strong></td>
      <td data-label="Nota " class="trip-note" title="${trip.note || ''}">${trip.note || '-'}</td>
      <td></td>
    `;
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
      <div class="driver-name" style="color:${pilotColor}">${driver}</div>
      <div class="balance-amount ${isZero ? 'clear' : isPositive ? 'clear' : 'debt'}">
        ${isZero ? 'Al dia' : (isPositive ? '+' : '') + formatCurrency(net)}
      </div>
      <div class="balance-detail">Aportes: ${formatCurrency(credit)} · Consumo: ${formatCurrency(debit)}</div>
      ${isZero ? '<span class="badge-clear">Saldado</span>' :
        isPositive ? '<span class="badge-clear">A favor</span>' : ''}
      ${net < -0.01 ? `<button class="btn-settle-pilot" data-driver="${driver}">Saldar cuenta</button>` : ''}
    `;

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
    const metaParts = [formatDate(p.created_at), ...extraInfo];
    if (p.note) metaParts.push(p.note);

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
          <div class="payment-driver">${p.driver}</div>
          <div class="payment-meta">${metaParts.join(' · ')}</div>
        </div>
        <span class="payment-amount">${formatCurrency(p.amount)}</span>
      `;
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

function populateFormOptions() {
  Object.keys(VEHICLE_MODELS).forEach((model) => {
    const opt = document.createElement('option');
    opt.value = model;
    opt.textContent = model + ' (' + VEHICLE_MODELS[model] + ' km/l)';
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
        await recalculateTrips(editId, payload.consumption, payload.fuel_price);
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

function openPaymentModal() {
  state.settlementMode = false;
  state.settlementDriver = null;

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

  // Mostrar campos de combustible (ocultos en modo saldado)
  document.querySelectorAll('.settlement-hide').forEach(el => el.classList.remove('hidden'));
  const btnText = dom.btnSubmitPayment.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Registrar carga';

  $('#payment-modal-title').textContent = 'Cargar combustible';
  toggleHidden(dom.paymentModal, false);
}

function closePaymentModal() {
  state.settlementMode = false;
  state.settlementDriver = null;
  document.querySelectorAll('.settlement-hide').forEach(el => el.classList.remove('hidden'));
  toggleHidden(dom.paymentModal, true);
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

  const litersLoaded = parseFloat(dom.paymentLiters.value) || null;
  const pricePerLiter = parseFloat(dom.paymentPricePerLiter.value) || null;
  const isFullTank = dom.paymentFullTank.checked;

  try {
    const isSettlement = state.settlementMode;
    await createPayment({
      vehicle_id: state.activeVehicleId,
      driver,
      amount,
      note: dom.paymentNote.value.trim() || null,
      liters_loaded: isSettlement ? null : litersLoaded,
      price_per_liter: isSettlement ? null : pricePerLiter,
      is_full_tank: isSettlement ? false : isFullTank,
    });

    if (isSettlement) {
      showToast(`Saldo de ${formatCurrency(amount)} registrado para ${driver}`);
    } else {
      showToast('Carga registrada');
    }
    haptic();
    state.payments = await fetchPayments(state.activeVehicleId);
    state.dashboardLoaded = false;
    renderBalances();
    renderPaymentHistory();
    closePaymentModal();

    // Solo para cargas reales de combustible (no saldados)
    if (!isSettlement) {
      // Sincronizar fuel_price del vehículo con el precio de esta carga
      if (pricePerLiter && pricePerLiter > 0) {
        const vehicle = getActiveVehicle();
        if (vehicle && vehicle.fuel_price !== pricePerLiter) {
          await updateVehicle(state.activeVehicleId, { fuel_price: pricePerLiter });
          state.vehicles = await fetchVehicles();
          renderVehicleDetail();
          renderVehicleCards();
          showToast(`Precio actualizado: ${formatCurrency(pricePerLiter)}/l`);
        }
      }

      // Auto-corrección de consumo si fue tanque lleno
      if (isFullTank) {
        await checkRealConsumption();
      }
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// --- Auto-Corrección de Consumo ---

async function checkRealConsumption() {
  const vehicle = getActiveVehicle();
  if (!vehicle) return;

  const fullTankLoads = state.payments
    .filter(p => p.is_full_tank && p.liters_loaded > 0)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (fullTankLoads.length < 2) return;

  const latest = fullTankLoads[0];
  const previous = fullTankLoads[1];
  const latestDate = new Date(latest.created_at);
  const previousDate = new Date(previous.created_at);

  const tripsBetween = state.trips.filter(t => {
    const d = new Date(t.created_at);
    return d > previousDate && d <= latestDate;
  });
  const totalKm = tripsBetween.reduce((sum, t) => sum + Number(t.km), 0);
  if (totalKm <= 0) return;

  const loadsBetween = state.payments.filter(p => {
    if (!p.liters_loaded || p.liters_loaded <= 0) return false;
    const d = new Date(p.created_at);
    return d > previousDate && d <= latestDate;
  });
  const totalLiters = loadsBetween.reduce((sum, p) => sum + Number(p.liters_loaded), 0);
  if (totalLiters <= 0) return;

  const realConsumption = +(totalKm / totalLiters).toFixed(1);
  const deviation = Math.abs(realConsumption - vehicle.consumption) / vehicle.consumption;

  if (deviation > 0.05) {
    state.pendingConsumptionUpdate = { vehicleId: vehicle.id, value: realConsumption };
    showConsumptionToast(realConsumption, vehicle.consumption);
  }
}

function showConsumptionToast(realConsumption, currentConsumption) {
  const toast = document.createElement('div');
  toast.className = 'toast toast-action';
  toast.innerHTML = `
    <div>Consumo real detectado: <strong>${realConsumption} km/l</strong> (actual: ${currentConsumption} km/l)</div>
    <button class="toast-btn">Actualizar perfil</button>
  `;
  dom.toastContainer.appendChild(toast);

  toast.querySelector('.toast-btn').addEventListener('click', async () => {
    const pending = state.pendingConsumptionUpdate;
    if (pending) {
      try {
        await updateVehicle(pending.vehicleId, { consumption: pending.value });
        state.vehicles = await fetchVehicles();
        renderVehicleDetail();
        renderVehicleCards();
        showToast(`Consumo actualizado: ${pending.value} km/l`);
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
      state.pendingConsumptionUpdate = null;
    }
    toast.remove();
  });

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('toast-exit');
      toast.addEventListener('animationend', () => toast.remove());
    }
  }, 10000);
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
    const { cost } = calculateCost(km, vehicle.consumption, getLatestFuelPrice(vehicle));
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

  const { liters, cost } = calculateCost(km, vehicle.consumption, getLatestFuelPrice(vehicle));
  const btn = dom.btnSubmitTrip;
  setButtonLoading(btn, true);

  try {
    await createTrip({
      vehicle_id: state.activeVehicleId,
      driver,
      km,
      note: dom.tripNote.value.trim() || null,
      liters,
      cost,
    });
    showToast('Viaje registrado');
    haptic();
    dom.tripForm.reset();
    dom.costPreviewValue.textContent = '$0,00';
    state.trips = await fetchTrips(state.activeVehicleId);
    state.dashboardLoaded = false;
    renderTrips();
    renderSummary();
    renderBalances();
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
  if (model && VEHICLE_MODELS[model] != null) {
    dom.vehicleConsumptionInput.value = VEHICLE_MODELS[model];
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
  text += `Consumo total: *${formatCurrency(totalConsumo)}* en ${state.trips.length} viaje${state.trips.length !== 1 ? 's' : ''}\n\n`;

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

  // Fuel load button
  dom.btnAddFuel.addEventListener('click', () => openPaymentModal());

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
  });
  // Price/liter change → recalc liters (amount stays)
  dom.paymentPricePerLiter.addEventListener('input', () => {
    const ppl = parseFloat(dom.paymentPricePerLiter.value);
    const amount = parseFloat(dom.paymentAmount.value);
    if (ppl > 0 && amount > 0) {
      dom.paymentLiters.value = (amount / ppl).toFixed(1);
    }
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

  // Trip form
  dom.tripForm.addEventListener('submit', handleTripSubmit);
  dom.tripKm.addEventListener('input', handleTripKmInput);

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

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

// ============================================================
// 2. SUPABASE INITIALIZATION
// ============================================================

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// 3. APPLICATION STATE
// ============================================================

const state = {
  vehicles: [],
  activeVehicleId: null,
  trips: [],
  confirmAction: null,
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
  tripsLoading: $('#trips-loading'),
  tripsEmpty: $('#trips-empty'),
  tripsTable: $('#trips-table'),
  tripsTbody: $('#trips-tbody'),
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
  confirmModal: $('#confirm-modal'),
  confirmTitle: $('#confirm-title'),
  confirmMessage: $('#confirm-message'),
  btnConfirmOk: $('#btn-confirm-ok'),
  toastContainer: $('#toast-container'),
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

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function calculateCost(km, consumption, fuelPrice) {
  const liters = km / consumption;
  const cost = liters * fuelPrice;
  return { liters: +liters.toFixed(2), cost: +cost.toFixed(2) };
}

function toggleHidden(el, hide) {
  el.classList.toggle('hidden', hide);
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

function getActiveVehicle() {
  return state.vehicles.find((v) => v.id === state.activeVehicleId) || null;
}

// ============================================================
// 6. NAVIGATION
// ============================================================

function navigateTo(view) {
  if (view === 'detail') {
    dom.viewsContainer.classList.add('show-detail');
  } else {
    dom.viewsContainer.classList.remove('show-detail');
    // Scroll home view to top
    $('#view-home').scrollTop = 0;
  }
}

function navigateBack() {
  navigateTo('home');
  renderVehicleCards();
}

// ============================================================
// 7. SUPABASE DATA FUNCTIONS (CRUD)
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

// Fetch the latest trip for each vehicle (for home cards preview)
async function fetchLastTrips(vehicleIds) {
  if (vehicleIds.length === 0) return {};
  const { data, error } = await db
    .from('trips')
    .select('vehicle_id, driver, created_at')
    .in('vehicle_id', vehicleIds)
    .order('created_at', { ascending: false });
  if (error) return {};
  // Get only the first (most recent) trip per vehicle
  const lastTrips = {};
  data.forEach((t) => {
    if (!lastTrips[t.vehicle_id]) lastTrips[t.vehicle_id] = t;
  });
  return lastTrips;
}

// ============================================================
// 8. UI RENDERING FUNCTIONS
// ============================================================

async function renderVehicleCards() {
  dom.vehiclesGrid.innerHTML = '';
  toggleHidden(dom.homeLoading, true);

  if (state.vehicles.length === 0) {
    toggleHidden(dom.noVehiclesMsg, false);
    return;
  }

  toggleHidden(dom.noVehiclesMsg, true);

  // Fetch last trip per vehicle for preview
  const vehicleIds = state.vehicles.map((v) => v.id);
  const lastTrips = await fetchLastTrips(vehicleIds);

  state.vehicles.forEach((v) => {
    const drivers = v.drivers || [];
    const lastTrip = lastTrips[v.id];
    const costPerKm = v.fuel_price / v.consumption;

    const card = document.createElement('div');
    card.className = 'vehicle-card';
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
        <span class="badge badge-highlight">${formatCurrency(v.fuel_price)}/l</span>
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

function renderVehicleDetail() {
  const vehicle = getActiveVehicle();
  if (!vehicle) return;

  dom.detailTitle.textContent = vehicle.name;
  dom.vehicleModelBadge.textContent = vehicle.model;
  dom.vehicleConsumptionBadge.textContent = vehicle.consumption + ' km/l';
  dom.vehicleFuelTypeBadge.textContent = vehicle.fuel_type;
  dom.vehicleFuelPriceBadge.textContent = formatCurrency(vehicle.fuel_price) + '/l';

  const costPerKm = vehicle.fuel_price / vehicle.consumption;
  dom.vehicleCostKmBadge.textContent = formatCurrency(costPerKm) + '/km';

  renderDriverSelect(vehicle.drivers || []);
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

  toggleHidden(dom.tripsLoading, true);

  if (trips.length === 0) {
    toggleHidden(dom.tripsEmpty, false);
    toggleHidden(dom.tripsTable, true);
    return;
  }

  toggleHidden(dom.tripsEmpty, true);
  toggleHidden(dom.tripsTable, false);

  dom.tripsTbody.innerHTML = '';

  trips.forEach((trip) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Fecha ">${formatDate(trip.created_at)}</td>
      <td data-label="Conductor ">${trip.driver}</td>
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
// 9. EVENT HANDLERS
// ============================================================

async function selectVehicle(vehicleId) {
  state.activeVehicleId = vehicleId;
  renderVehicleDetail();
  navigateTo('detail');

  // Scroll detail view to top
  $('#view-detail').scrollTop = 0;

  // Show loading, hide table and empty
  toggleHidden(dom.tripsLoading, false);
  toggleHidden(dom.tripsTable, true);
  toggleHidden(dom.tripsEmpty, true);

  try {
    state.trips = await fetchTrips(vehicleId);
    renderTrips();
    renderSummary();
  } catch (err) {
    showToast('Error al cargar viajes: ' + err.message, 'error');
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

  const payload = {
    name: dom.vehicleNameInput.value.trim(),
    model: dom.vehicleModelSelect.value,
    consumption: parseFloat(dom.vehicleConsumptionInput.value),
    fuel_type: dom.vehicleFuelTypeSelect.value,
    fuel_price: parseFloat(dom.vehicleFuelPriceInput.value),
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
    } else {
      await createVehicle(payload);
      showToast('Vehiculo agregado');
    }

    state.vehicles = await fetchVehicles();

    // If editing the active vehicle and we're on detail view, refresh
    if (state.modalMode === 'edit' && parseInt(dom.vehicleFormId.value) === state.activeVehicleId) {
      renderVehicleDetail();
      state.trips = await fetchTrips(state.activeVehicleId);
      renderTrips();
      renderSummary();
    }

    // Refresh home cards
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
    `¿Estas seguro de eliminar "${vehicle.name}"? Se eliminaran todos sus viajes.`;

  state.confirmAction = async () => {
    const btn = dom.btnConfirmOk;
    setButtonLoading(btn, true);
    try {
      await deleteVehicle(state.activeVehicleId);
      showToast('Vehiculo eliminado');
      state.vehicles = await fetchVehicles();
      state.activeVehicleId = null;
      toggleHidden(dom.confirmModal, true);
      navigateBack();
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
      state.trips = [];
      renderTrips();
      renderSummary();
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
    const { cost } = calculateCost(km, vehicle.consumption, vehicle.fuel_price);
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
    showToast('Selecciona un conductor', 'error');
    return;
  }

  const { liters, cost } = calculateCost(km, vehicle.consumption, vehicle.fuel_price);
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
    dom.tripForm.reset();
    dom.costPreviewValue.textContent = '$0,00';
    state.trips = await fetchTrips(state.activeVehicleId);
    renderTrips();
    renderSummary();
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
    state.trips = await fetchTrips(state.activeVehicleId);
    renderTrips();
    renderSummary();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// --- Model Change (auto-fill consumption) ---

function handleModelChange() {
  const model = dom.vehicleModelSelect.value;
  if (model && VEHICLE_MODELS[model] != null) {
    dom.vehicleConsumptionInput.value = VEHICLE_MODELS[model];
  } else {
    dom.vehicleConsumptionInput.value = '';
  }
}

// ============================================================
// 10. EVENT BINDING & INITIALIZATION
// ============================================================

function bindEvents() {
  // Add vehicle
  $('#btn-add-vehicle').addEventListener('click', () => openVehicleModal('add'));

  // Back button
  $('#btn-back').addEventListener('click', navigateBack);

  // Edit vehicle
  $('#btn-edit-vehicle').addEventListener('click', () => {
    const v = getActiveVehicle();
    if (v) openVehicleModal('edit', v);
  });

  // Delete vehicle
  $('#btn-delete-vehicle').addEventListener('click', handleDeleteVehicleClick);

  // Clear trips
  $('#btn-clear-trips').addEventListener('click', handleClearTripsClick);

  // Modal close
  $('#btn-close-modal').addEventListener('click', closeVehicleModal);
  dom.vehicleModal.addEventListener('click', (e) => {
    if (e.target === dom.vehicleModal) closeVehicleModal();
  });

  // Vehicle form
  dom.vehicleForm.addEventListener('submit', handleVehicleSubmit);
  dom.vehicleModelSelect.addEventListener('change', handleModelChange);
  dom.btnAddDriver.addEventListener('click', () => addDriverInput(''));

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
}

async function init() {
  populateFormOptions();
  bindEvents();

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

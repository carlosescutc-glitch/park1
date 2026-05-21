/**
 * ==============================================================================
 * ARCHIVO PRINCIPAL DE JAVASCRIPT - PRECISION PARK (PROTOTIPO 2)
 * Arquitectura Premium: Base de Datos Relacional Local (JSDB), Tickets Digitales,
 * Generación de Códigos Únicos y QR, Cobros en Tiempo Real, Temporizadores
 * de Reservas, Reacomodo por Proximidad de 10s, Ruta BFS Inteligente y Admin Dashboard.
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================================================
     1. SISTEMA DE BASE DE DATOS LOCAL PERSISTENTE (JSDB)
     Administra 7 tablas relacionales en localStorage para garantizar portabilidad.
     ========================================================================== */
  const ParkingDB = {
    // Inicializa las llaves en localStorage si no existen y pre-pobla datos iniciales
    init() {
      // Crea las tablas básicas como arreglos vacíos si no existen
      if (!localStorage.getItem('parking_db_tickets')) {
        // Pre-poblar cajones ocupados al inicio para consistencia de datos de Prototype 1
        const initialTickets = [];
        const sectors = [
          { id: 'a', prefix: 'A-', count: 10 },
          { id: 'b', prefix: 'B-', count: 10 },
          { id: 'c', prefix: 'C-', count: 6 }
        ];
        
        sectors.forEach(sec => {
          for (let i = 1; i <= sec.count; i++) {
            const spotId = `${sec.prefix}${i < 10 ? '0' : ''}${i}`;
            // 20% de probabilidad de que esté ocupado inicialmente
            if (Math.random() > 0.8) {
              const entry = new Date(Date.now() - Math.random() * 4 * 3600 * 1000); // Entre 0 y 4 horas atrás
              const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
              let code = '';
              for (let k = 0; k < 7; k++) code += chars.charAt(Math.floor(Math.random() * chars.length));
              const today = new Date();
              code += String(today.getDate()).padStart(2, '0') + String(today.getMonth() + 1).padStart(2, '0') + today.getFullYear();
              
              initialTickets.push({
                id: 'init_' + spotId,
                code: code,
                spotId: spotId,
                status: 'active',
                vehicleStatus: 'Estacionado',
                entryTime: entry.toISOString(),
                exitTime: null,
                paymentMethod: 'N/A',
                tarifa: 15,
                totalPaid: 0,
                vehiclePlate: 'MXN-' + Math.floor(100 + Math.random() * 900),
                vehicleModel: 'Sedán Estándar',
                vehicleColor: 'Gris',
                conductor: 'Usuario Externo',
                isSimulated: true
              });
            }
          }
        });
        localStorage.setItem('parking_db_tickets', JSON.stringify(initialTickets));
      }
      
      if (!localStorage.getItem('parking_db_reservations')) localStorage.setItem('parking_db_reservations', JSON.stringify([]));
      if (!localStorage.getItem('parking_db_payments')) localStorage.setItem('parking_db_payments', JSON.stringify([]));
      if (!localStorage.getItem('parking_db_accessHistory')) localStorage.setItem('parking_db_accessHistory', JSON.stringify([]));
      if (!localStorage.getItem('parking_db_vehicles')) localStorage.setItem('parking_db_vehicles', JSON.stringify([]));
      
      // Tabla de Usuarios con perfil predeterminado
      if (!localStorage.getItem('parking_db_users')) {
        const defaultUsers = [
          { username: 'Alex Rivera', name: 'Alex Rivera', email: 'alex.rivera@example.com', level: 1, points: 12, visits: 4, avatar: '' }
        ];
        localStorage.setItem('parking_db_users', JSON.stringify(defaultUsers));
      }
    },
    
    // Obtiene una tabla completa parseada desde JSON
    getTable(name) {
      return JSON.parse(localStorage.getItem(`parking_db_${name}`) || '[]');
    },
    
    // Guarda una tabla completa serializada en JSON
    saveTable(name, data) {
      localStorage.setItem(`parking_db_${name}`, JSON.stringify(data));
    },
    
    // Inserta un nuevo registro con ID único y fecha de creación
    insert(table, item) {
      const data = this.getTable(table);
      item.id = item.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      item.createdAt = item.createdAt || new Date().toISOString();
      data.push(item);
      this.saveTable(table, data);
      return item;
    },
    
    // Actualiza un registro existente por ID
    update(table, id, updates) {
      const data = this.getTable(table);
      const index = data.findIndex(item => item.id === id);
      if (index !== -1) {
        data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
        this.saveTable(table, data);
        return data[index];
      }
      return null;
    },
    
    // Busca un registro único basado en una condición
    find(table, predicate) {
      return this.getTable(table).find(predicate);
    },
    
    // Filtra registros basados en una condición del usuario
    filter(table, predicate) {
      return this.getTable(table).filter(predicate);
    },
    
    // Borra y reinicia todas las tablas del sistema
    clearAll() {
      localStorage.removeItem('parking_db_tickets');
      localStorage.removeItem('parking_db_reservations');
      localStorage.removeItem('parking_db_payments');
      localStorage.removeItem('parking_db_accessHistory');
      localStorage.removeItem('parking_db_vehicles');
      this.init(); // Re-pobla con datos iniciales consistentes
    }
  };
  
  // Inicialización de la base de datos local
  ParkingDB.init();

  /* ==========================================================================
     2. LÓGICA DE INICIO DE SESIÓN Y NOTIFICACIONES TOAST
     ========================================================================== */
  const loginForm = document.getElementById('login-form');
  const loginScreen = document.getElementById('login-screen');
  const mainApp = document.getElementById('main-app');
  const toastContainer = document.getElementById('toast-container');

  // Evento de inicio de sesión
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginScreen.style.display = 'none';
    mainApp.style.display = 'flex';
    showToast('Inicio de sesión exitoso. Bienvenido a ParkNexus');
    // Registrar el acceso al sistema en el historial global
    ParkingDB.insert('accessHistory', {
      ticketId: 'SYS',
      type: 'Login',
      spotId: 'N/A'
    });
  });

  // Crea y despliega una notificación flotante (Toast)
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    // Colores e iconos de acuerdo con el tipo de alerta
    if (type === 'warning') {
      toast.style.background = '#f59e0b';
      toast.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
    } else {
      toast.style.background = '#22c55e';
      toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    }
    toastContainer.appendChild(toast);
    
    // Remueve suavemente la notificación con animación
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /* ==========================================================================
     3. MODO OSCURO Y PERFIL DE USUARIO
     ========================================================================== */
  const btnDarkMode = document.getElementById('btn-dark-mode');
  let isDarkMode = false;

  // Alterna entre tema claro y tema oscuro mediante atributos HTML
  btnDarkMode.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
      document.body.setAttribute('data-theme', 'dark');
      btnDarkMode.innerHTML = '<i class="fas fa-sun"></i>';
      showToast('Modo Oscuro Activado');
    } else {
      document.body.removeAttribute('data-theme');
      btnDarkMode.innerHTML = '<i class="fas fa-moon"></i>';
      showToast('Modo Claro Activado');
    }
  });

  // Eventos para el modal de edición de perfil
  const btnUserModal = document.getElementById('btn-user-modal');
  const userModal = document.getElementById('user-profile-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnSaveProfile = document.getElementById('btn-save-profile');
  const inputEditName = document.getElementById('input-edit-name');
  const inputEditEmail = document.getElementById('input-edit-email');

  // Abre el modal de perfil de usuario
  btnUserModal.addEventListener('click', () => {
    const user = ParkingDB.getTable('users')[0];
    if (user) {
      inputEditName.value = user.name;
      inputEditEmail.value = user.email;
    }
    userModal.style.display = 'flex';
  });
  
  // Cierra el modal de perfil de usuario
  btnCloseModal.addEventListener('click', () => userModal.style.display = 'none');
  
  // Guarda los cambios del perfil del usuario en la Base de Datos y actualiza la UI
  btnSaveProfile.addEventListener('click', () => {
    const user = ParkingDB.getTable('users')[0];
    if (user) {
      ParkingDB.update('users', user.id, {
        name: inputEditName.value,
        email: inputEditEmail.value
      });
      document.getElementById('display-user-name').innerText = inputEditName.value;
      document.getElementById('display-user-email').innerText = inputEditEmail.value;
    }
    userModal.style.display = 'none';
    showToast('Perfil actualizado correctamente');
  });

  /* ==========================================================================
     4. LÓGICA DE NIVELES Y EXPERIENCIA (XP)
     ========================================================================== */
  const levels = [
    { level: 1, req: 0 },
    { level: 2, req: 50 },
    { level: 3, req: 100 },
    { level: 4, req: 250 },
    { level: 5, req: 500 }
  ];

  // Actualiza la interfaz del perfil de usuario y la barra de progreso de experiencia (XP)
  function updateLevelUI() {
    const user = ParkingDB.getTable('users')[0];
    if (!user) return;

    let currentLvl = levels[0], nextLvl = levels[1];
    for (let i = 0; i < levels.length; i++) {
      if (user.points >= levels[i].req) {
        currentLvl = levels[i];
        nextLvl = levels[i + 1] || levels[i];
      }
    }
    
    // Guardar el nivel calculado del usuario en DB
    if (user.level !== currentLvl.level) {
      ParkingDB.update('users', user.id, { level: currentLvl.level });
    }

    document.getElementById('current-level').innerText = currentLvl.level;
    document.getElementById('current-points').innerText = user.points;
    document.getElementById('next-level-points').innerText = nextLvl.req;
    document.getElementById('visit-count').innerText = user.visits;
    
    const remaining = Math.max(0, nextLvl.req - user.points);
    if (document.getElementById('points-remaining')) document.getElementById('points-remaining').innerText = remaining;
    if (document.getElementById('next-level-display')) document.getElementById('next-level-display').innerText = nextLvl.level;

    let progress = 100;
    if (nextLvl.level !== currentLvl.level) {
      progress = ((user.points - currentLvl.req) / (nextLvl.req - currentLvl.req)) * 100;
    }
    document.getElementById('level-progress').style.width = `${progress}%`;
  }
  
  // Inicialización de la UI del nivel
  updateLevelUI();

  // Suma puntos (XP) al usuario y refresca su barra de progreso
  function addPoints(pts) {
    const user = ParkingDB.getTable('users')[0];
    if (user) {
      const newPoints = user.points + pts;
      ParkingDB.update('users', user.id, { points: newPoints });
      updateLevelUI();
    }
  }

  /* ==========================================================================
     5. GENERACIÓN AUTOMÁTICA DE CÓDIGO ÚNICO Y QR
     ========================================================================== */
  
  // Genera un código aleatorio de 7 caracteres (mayúsculas, minúsculas, números)
  // Valida que no exista en la base de datos y concatena la fecha DDMMYYYY
  function generateUniqueTicketCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    let finalCode = '';
    let isDuplicate = true;
    let attempts = 0;

    // Obtener la fecha en formato DDMMYYYY
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = dd + mm + yyyy;

    while (isDuplicate && attempts < 500) {
      randomPart = '';
      for (let i = 0; i < 7; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      finalCode = randomPart + dateStr;
      
      // Comprobar no duplicidad en la tabla de tickets
      const match = ParkingDB.find('tickets', t => t.code === finalCode);
      if (!match) {
        isDuplicate = false;
      }
      attempts++;
    }
    return finalCode;
  }

  /* ==========================================================================
     6. CONTROL EN TIEMPO REAL Y RENDERIZADO DE LOS SECTORES
     ========================================================================== */
  const sectorsConfig = [
    { id: 'a', prefix: 'A-', count: 10 },
    { id: 'b', prefix: 'B-', count: 10 },
    { id: 'c', prefix: 'C-', count: 6 }
  ];

  let selectedSpotId = null; 
  let savedCarSpotId = null; 
  let activeTicket = null; // Instancia del ticket activo del usuario actual

  // Inicializa la cuadrícula de estacionamientos
  function initSectorsGrid() {
    sectorsConfig.forEach(config => {
      const sectorElement = document.querySelector(`#sector-${config.id} .spots-grid`);
      if (!sectorElement) return;
      sectorElement.innerHTML = ''; // Limpia cuadrícula previa

      for (let i = 1; i <= config.count; i++) {
        const spotId = `${config.prefix}${i < 10 ? '0' : ''}${i}`;
        const spotDiv = document.createElement('div');
        spotDiv.className = 'spot';
        spotDiv.dataset.id = spotId;
        
        // Obtener estado real desde la base de datos local
        const activeTkt = ParkingDB.find('tickets', t => t.spotId === spotId && t.status === 'active');
        
        if (activeTkt) {
          if (activeTkt.vehicleStatus === 'Reservado') {
            // El cajón está Reservado
            spotDiv.classList.add('reserved');
            spotDiv.innerHTML = `<span class="spot-id">${spotId}</span><span class="spot-status">RESERVADO</span><i class="fas fa-calendar-check lock-icon" style="display:block; color:#f59e0b;"></i>`;
          } else {
            // El cajón está Ocupado
            spotDiv.classList.add('locked');
            spotDiv.innerHTML = `<span class="spot-id">${spotId}</span><span class="spot-status">OCUPADO</span><i class="fas fa-lock lock-icon" style="display:block;"></i>`;
          }
        } else {
          // El cajón está Libre
          spotDiv.innerHTML = `<span class="spot-id">${spotId}</span><span class="spot-status">LIBRE</span><i class="fas fa-lock lock-icon"></i>`;
        }
        
        // Añadir evento clic a cajones no bloqueados por otros usuarios
        spotDiv.addEventListener('click', () => {
          // Si el usuario ya tiene un ticket activo, no puede seleccionar otro lugar libre
          if (activeTicket) {
            showToast('Ya cuentas con un boleto activo. Termina tu estancia actual', 'warning');
            return;
          }
          
          const isOccupiedByOther = activeTkt && activeTkt.conductor !== 'Alex Rivera';
          if (!isOccupiedByOther) {
            handleSpotClick(spotId);
          }
        });
        
        sectorElement.appendChild(spotDiv);
      }
    });
    updateStats();
  }
  
  // Renderizado inicial
  initSectorsGrid();

  // Controla el clic en los cajones del croquis
  function handleSpotClick(spotId) {
    if (activeTicket) return;

    const allSpots = document.querySelectorAll('.spot');
    
    // Deselección
    if (selectedSpotId === spotId) {
      selectedSpotId = null;
      allSpots.forEach(s => {
        s.classList.remove('selected');
        // Restaurar estado visual original del spot
        const dbTkt = ParkingDB.find('tickets', t => t.spotId === s.dataset.id && t.status === 'active');
        if (!dbTkt) s.querySelector('.spot-status').innerText = 'LIBRE';
      });
      updateStats();
      syncMapSelection();
      return;
    }

    selectedSpotId = spotId;
    allSpots.forEach(s => {
      if (s.dataset.id === spotId) {
        s.classList.add('selected');
        s.querySelector('.spot-status').innerText = 'ELEGIDO';
      } else {
        s.classList.remove('selected');
        const dbTkt = ParkingDB.find('tickets', t => t.spotId === s.dataset.id && t.status === 'active');
        if (!dbTkt) s.querySelector('.spot-status').innerText = 'LIBRE';
      }
    });
    
    updateStats();
    syncMapSelection();
    showToast(`Cajón ${spotId} seleccionado. Haz clic en 'Reservar Lugar'`);
  }

  // Recalcula y actualiza la barra y números de ocupación en el header en tiempo real
  function updateStats() {
    const totalSpots = 26; 
    let occupied = 0;
    
    // Contar spots en la base de datos que estén ocupados o reservados
    const activeTickets = ParkingDB.filter('tickets', t => t.status === 'active');
    occupied = activeTickets.length;
    
    const available = Math.max(0, totalSpots - occupied);
    
    if (document.getElementById('header-available-text')) {
      document.getElementById('header-available-text').innerText = `${available < 10 ? '0' + available : available}/${totalSpots}`;
    }
    if (document.getElementById('val-available')) document.getElementById('val-available').innerText = available < 10 ? '0' + available : available;
    if (document.getElementById('val-occupied')) document.getElementById('val-occupied').innerText = occupied < 10 ? '0' + occupied : occupied;
    
    if (document.getElementById('occupancy-fill')) {
      const freePercent = (available / totalSpots) * 100;
      document.getElementById('occupancy-fill').style.width = `${100 - freePercent}%`;
    }
  }

  /* ==========================================================================
     7. SISTEMA AVANZADO DE RESERVACIONES CON TEMPORIZADOR DE EXPIRACIÓN (60s)
     ========================================================================== */
  const btnReserveSpot = document.getElementById('btn-reserve-spot');
  
  // Modales de Reserva
  const reservationModal = document.getElementById('reservation-modal');
  const btnCloseResModal = document.getElementById('btn-close-reservation-modal');
  const btnConfirmRes = document.getElementById('btn-confirm-reservation');
  const reserveSpotDisplay = document.getElementById('reserve-spot-display');
  const reserveUserName = document.getElementById('reserve-user-name');
  const reservePlate = document.getElementById('reserve-vehicle-plate');
  const reserveModel = document.getElementById('reserve-vehicle-model');
  const reserveColor = document.getElementById('reserve-vehicle-color');
  const reserveDuration = document.getElementById('reserve-duration');

  // Abre el formulario para registrar el vehículo e iniciar la reserva
  btnReserveSpot.addEventListener('click', () => {
    if (activeTicket) {
      showToast('Ya tienes un ticket activo en curso', 'warning');
      return;
    }
    if (!selectedSpotId) {
      showToast('Selecciona primero un cajón libre en el mapa o croquis', 'warning');
      return;
    }
    
    // Cargar datos predeterminados en el modal
    const user = ParkingDB.getTable('users')[0];
    if (user) reserveUserName.value = user.name;
    reserveSpotDisplay.value = selectedSpotId;
    
    reservationModal.style.display = 'flex';
  });

  // Cierra el modal de reservación
  btnCloseResModal.addEventListener('click', () => reservationModal.style.display = 'none');

  // Confirma la reservación, crea el ticket digital automático y arranca los temporizadores
  btnConfirmRes.addEventListener('click', () => {
    const plate = reservePlate.value.trim().toUpperCase();
    const model = reserveModel.value.trim();
    const color = reserveColor.value.trim();
    const conductor = reserveUserName.value.trim();

    if (!plate || !model || !color || !conductor) {
      showToast('Por favor, completa todos los campos del vehículo', 'warning');
      return;
    }

    // Cerrar modal
    reservationModal.style.display = 'none';

    // Generar el código alfanumérico único concatenado con DDMMYYYY
    const ticketCode = generateUniqueTicketCode();

    // 1. Registrar entrada en la tabla de Tickets
    const newTicket = ParkingDB.insert('tickets', {
      code: ticketCode,
      spotId: selectedSpotId,
      status: 'active',
      vehicleStatus: 'Reservado', // Estado inicial
      entryTime: new Date().toISOString(),
      exitTime: null,
      paymentMethod: 'N/A',
      tarifa: 15,
      totalPaid: 0,
      vehiclePlate: plate,
      vehicleModel: model,
      vehicleColor: color,
      conductor: conductor,
      isSimulated: false
    });

    // 2. Crear registro en la tabla de Reservaciones
    const limit = reserveDuration.value === 'demo' ? 60 : 3600; // 60 segundos demo, 1 hora estándar
    const newRes = ParkingDB.insert('reservations', {
      ticketId: newTicket.id,
      spotId: selectedSpotId,
      username: conductor,
      startTime: new Date().toISOString(),
      limitSeconds: limit,
      remainingSeconds: limit,
      status: 'Activa'
    });

    // 3. Crear registro en el Historial de Accesos
    ParkingDB.insert('accessHistory', {
      ticketId: newTicket.id,
      type: 'Reserva',
      spotId: selectedSpotId
    });

    // 4. Asignar como boleto activo del usuario actual
    activeTicket = newTicket;
    addPoints(15); // Sumar puntos XP por reservar

    // Limpiar selección del croquis
    selectedSpotId = null;
    
    // Reiniciar inputs del formulario
    reservePlate.value = '';
    reserveModel.value = '';
    reserveColor.value = '';

    // Refrescar vistas
    initSectorsGrid();
    if (mapGenerated) generateMapGrid();

    // Redirigir de inmediato al apartado de "Tickets y Pagos" para visualizarlo
    switchToView('tickets');
    refreshActiveTicketUI();

    showToast(`¡Reserva creada exitosamente! Boleto: ${ticketCode}`);
  });

  /* ==========================================================================
     8. SISTEMA DE COBROS, NOTIFICACIONES Y CONTADORES EN TIEMPO REAL
     ========================================================================== */
  
  // Hilo principal que ejecuta las actualizaciones cada segundo (Tickers de base de datos)
  setInterval(() => {
    const reservations = ParkingDB.getTable('reservations');
    const tickets = ParkingDB.getTable('tickets');
    let needsUpdate = false;

    // Procesar reservaciones activas de la base de datos
    reservations.forEach(res => {
      if (res.status === 'Activa') {
        res.remainingSeconds--;
        needsUpdate = true;

        // Si la reserva expira sin que el usuario llegue
        if (res.remainingSeconds <= 0) {
          res.status = 'Expirada';
          
          // Cambiar estado del ticket a Expirado
          const tIdx = tickets.findIndex(t => t.id === res.ticketId);
          if (tIdx !== -1) {
            tickets[tIdx].status = 'expired';
            tickets[tIdx].vehicleStatus = 'Expirado';
            tickets[tIdx].exitTime = new Date().toISOString();

            // Historial de accesos
            ParkingDB.insert('accessHistory', {
              ticketId: res.ticketId,
              type: 'Expiración',
              spotId: res.spotId
            });

            showToast(`La reserva del cajón ${res.spotId} ha vencido automáticamente`, 'warning');
          }
        }
      }
    });

    if (needsUpdate) {
      ParkingDB.saveTable('reservations', reservations);
      ParkingDB.saveTable('tickets', tickets);
      initSectorsGrid();
      if (mapGenerated) generateMapGrid();
    }

    // Refrescar contadores en la vista del ticket activo
    if (activeTicket) {
      // Recargar de base de datos para validar si ya cambió de estado (por ejemplo, si expiró)
      const current = ParkingDB.find('tickets', t => t.id === activeTicket.id);
      if (current) {
        activeTicket = current;
        if (activeTicket.status === 'expired' || activeTicket.status === 'paid') {
          activeTicket = null;
          refreshActiveTicketUI();
        } else {
          updateActiveTicketUIValues();
        }
      } else {
        activeTicket = null;
        refreshActiveTicketUI();
      }
    }
  }, 1000);

  // Refresca el esqueleto visual de la pestaña de Tickets
  function refreshActiveTicketUI() {
    const noTicketEl = document.getElementById('no-active-ticket');
    const wrapperEl = document.getElementById('active-ticket-wrapper');
    
    if (!activeTicket) {
      noTicketEl.style.display = 'block';
      wrapperEl.style.display = 'none';
      return;
    }

    noTicketEl.style.display = 'none';
    wrapperEl.style.display = 'block';

    // Rellenar datos fijos del ticket
    document.getElementById('ticket-alphanumeric-code').innerText = activeTicket.code;
    document.getElementById('ticket-spot-id').innerText = activeTicket.spotId;
    document.getElementById('ticket-vehicle-plate').innerText = activeTicket.vehiclePlate;
    document.getElementById('ticket-vehicle-model').innerText = activeTicket.vehicleModel;
    
    // Hora formateada de ingreso
    const entryDate = new Date(activeTicket.entryTime);
    document.getElementById('ticket-entry-time').innerText = entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Cargar QR CDN de forma dinámica
    const qrImg = document.getElementById('ticket-qr-img');
    const barcodeFallback = document.getElementById('ticket-barcode-fallback');
    
    qrImg.style.display = 'block';
    barcodeFallback.style.display = 'none';
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(activeTicket.code)}`;
    
    // Contingencia offline en caso de que falle la carga del QR
    qrImg.onerror = () => {
      qrImg.style.display = 'none';
      barcodeFallback.style.display = 'block';
      document.getElementById('barcode-text').innerText = activeTicket.code;
    };
  }

  // Actualiza los valores aritméticos de tiempo y tarifa por segundo en el ticket activo
  function updateActiveTicketUIValues() {
    if (!activeTicket) return;

    const statusBadge = document.getElementById('ticket-status-badge');
    const alertEl = document.getElementById('ticket-expiration-alert');
    const counterEl = document.getElementById('ticket-timer-counter');
    const priceEl = document.getElementById('ticket-price-counter');
    const timeLabelEl = document.getElementById('timer-kpi-label');

    // Cambiar insignias según el estado
    statusBadge.innerText = activeTicket.vehicleStatus;
    if (activeTicket.vehicleStatus === 'Reservado') {
      statusBadge.className = 'ticket-badge reserved';
      alertEl.style.display = 'flex';
      timeLabelEl.innerText = 'TIEMPO DE TOLERANCIA';
      
      // Buscar reservación correspondiente
      const res = ParkingDB.find('reservations', r => r.ticketId === activeTicket.id);
      if (res) {
        document.getElementById('ticket-expiration-countdown').innerText = res.remainingSeconds;
        
        // Conversión a HH:MM:SS
        const h = Math.floor(res.remainingSeconds / 3600);
        const m = Math.floor((res.remainingSeconds % 3600) / 60);
        const s = res.remainingSeconds % 60;
        counterEl.innerText = `${h<10?'0':''}${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
        priceEl.innerText = '$0.00 (Reserva)';
      }
    } else {
      // Estado: Estacionado
      statusBadge.className = 'ticket-badge parked';
      alertEl.style.display = 'none';
      timeLabelEl.innerText = 'TIEMPO ACUMULADO';

      // Calcular tiempo transcurrido en segundos
      const entryTime = new Date(activeTicket.entryTime).getTime();
      const elapsedSec = Math.floor((Date.now() - entryTime) / 1000);

      const h = Math.floor(elapsedSec / 3600);
      const m = Math.floor((elapsedSec % 3600) / 60);
      const s = elapsedSec % 60;
      counterEl.innerText = `${h<10?'0':''}${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}`;

      // TARIFA DINÁMICA: $0.20 MXN por segundo para demostración visual ágil
      const calculatedPrice = elapsedSec * 0.20;
      priceEl.innerText = `$${calculatedPrice.toFixed(2)}`;
    }
  }

  // Proximidad de llegada para completar la reserva (Simulación física en mapa)
  function checkProximity(px, py) {
    if (!activeTicket || activeTicket.vehicleStatus !== 'Reservado') return;

    const b = mapBlocksData.find(block => block.id === activeTicket.spotId);
    if (!b) return;

    const centerX = b.x + 15;
    const centerY = b.y + 22; 
    
    // Distancia euclidiana
    const dist = Math.sqrt(Math.pow(px - centerX, 2) + Math.pow(py - centerY, 2));

    // Si el triángulo "TÚ" ingresa al cajón reservado
    if (dist < 25) {
      registerArrival();
    }
  }

  // Cambia el estado de Reservado a Estacionado al llegar al cajón
  function registerArrival() {
    if (!activeTicket || activeTicket.vehicleStatus !== 'Reservado') return;
    
    // Actualizar ticket en base de datos
    ParkingDB.update('tickets', activeTicket.id, {
      vehicleStatus: 'Estacionado',
      entryTime: new Date().toISOString() // La tarifa arranca desde la llegada real
    });

    // Finalizar reservación asociada
    const res = ParkingDB.find('reservations', r => r.ticketId === activeTicket.id && r.status === 'Activa');
    if (res) {
      ParkingDB.update('reservations', res.id, { status: 'Completada' });
    }

    // Historial de accesos
    ParkingDB.insert('accessHistory', {
      ticketId: activeTicket.id,
      type: 'Entrada',
      spotId: activeTicket.spotId
    });

    showToast('¡Auto detectado en cajón! Entrada registrada de forma digital.');
    initSectorsGrid();
    if (mapGenerated) generateMapGrid();
    refreshActiveTicketUI();
  }

  /* ==========================================================================
     9. PASARELA DE PAGOS Y COMPROBANTES DIGITALES
     ========================================================================== */
  const btnPayTicket = document.getElementById('btn-pay-ticket');
  const paymentModal = document.getElementById('payment-modal');
  const btnClosePayModal = document.getElementById('btn-close-payment-modal');
  
  // Elementos del modal de pago
  const payTicketCode = document.getElementById('pay-ticket-code');
  const payTicketSpot = document.getElementById('pay-ticket-spot');
  const payTicketTime = document.getElementById('pay-ticket-time');
  const paySubtotal = document.getElementById('pay-subtotal');
  const payTax = document.getElementById('pay-tax');
  const payTotal = document.getElementById('pay-total');
  const payBtnAmount = document.getElementById('pay-btn-amount');
  
  // Métodos de pago
  const methodCard = document.getElementById('method-card');
  const methodCash = document.getElementById('method-cash');
  const cardFields = document.getElementById('card-fields-wrapper');
  const cashFields = document.getElementById('cash-fields-wrapper');
  const btnInsertCash = document.getElementById('btn-insert-cash');
  const btnSubmitPayment = document.getElementById('btn-submit-payment');
  let selectedMethod = 'Tarjeta';

  // Modal de Recibo
  const receiptModal = document.getElementById('receipt-modal');
  const btnCloseReceipt = document.getElementById('btn-close-receipt');

  // Abre la pasarela de pagos al presionar "Pagar y Salir"
  btnPayTicket.addEventListener('click', () => {
    if (!activeTicket) return;

    let elapsedSec = 0;
    let finalPrice = 0;

    if (activeTicket.vehicleStatus === 'Estacionado') {
      const entryTime = new Date(activeTicket.entryTime).getTime();
      elapsedSec = Math.floor((Date.now() - entryTime) / 1000);
      finalPrice = elapsedSec * 0.20;
    }

    // Desglose fiscal de la factura
    const subtotal = finalPrice / 1.16;
    const tax = finalPrice - subtotal;

    payTicketCode.innerText = activeTicket.code;
    payTicketSpot.innerText = activeTicket.spotId;
    
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    const s = elapsedSec % 60;
    payTicketTime.innerText = `${h<10?'0':''}${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}`;

    paySubtotal.innerText = `$${subtotal.toFixed(2)}`;
    payTax.innerText = `$${tax.toFixed(2)}`;
    payTotal.innerText = `$${finalPrice.toFixed(2)}`;
    payBtnAmount.innerText = `$${finalPrice.toFixed(2)}`;

    // Restablecer método predeterminado a Tarjeta
    selectedMethod = 'Tarjeta';
    methodCard.classList.add('active');
    methodCash.classList.remove('active');
    cardFields.style.display = 'block';
    cashFields.style.display = 'none';

    paymentModal.style.display = 'flex';
  });

  // Eventos para selección de método de pago
  methodCard.addEventListener('click', () => {
    selectedMethod = 'Tarjeta';
    methodCard.classList.add('active');
    methodCash.classList.remove('active');
    cardFields.style.display = 'block';
    cashFields.style.display = 'none';
  });

  methodCash.addEventListener('click', () => {
    selectedMethod = 'Efectivo';
    methodCash.classList.add('active');
    methodCard.classList.remove('active');
    cardFields.style.display = 'none';
    cashFields.style.display = 'block';
  });

  // Simulación física de inserción de dinero
  btnInsertCash.addEventListener('click', () => {
    showToast('Depósito de efectivo recibido correctamente. Saldo cubierto.');
  });

  btnClosePayModal.addEventListener('click', () => paymentModal.style.display = 'none');

  // Valida, procesa el cobro, registra el pago en la DB, libera el cajón y despliega el recibo
  btnSubmitPayment.addEventListener('click', () => {
    if (!activeTicket) return;

    let elapsedSec = 0;
    let finalPrice = 0;

    if (activeTicket.vehicleStatus === 'Estacionado') {
      const entryTime = new Date(activeTicket.entryTime).getTime();
      elapsedSec = Math.floor((Date.now() - entryTime) / 1000);
      finalPrice = elapsedSec * 0.20;
    }

    // 1. Guardar registro en la tabla de Pagos
    const payment = ParkingDB.insert('payments', {
      ticketId: activeTicket.id,
      monto: finalPrice,
      metodoPago: selectedMethod,
      timestamp: new Date().toISOString()
    });

    // 2. Actualizar estado del ticket a Completado
    ParkingDB.update('tickets', activeTicket.id, {
      status: 'paid',
      vehicleStatus: 'Completado',
      exitTime: new Date().toISOString(),
      paymentMethod: selectedMethod,
      totalPaid: finalPrice
    });

    // 3. Registrar Salida en historial de acceso
    ParkingDB.insert('accessHistory', {
      ticketId: activeTicket.id,
      type: 'Salida',
      spotId: activeTicket.spotId
    });

    // Incrementar visitas e XP del usuario
    const user = ParkingDB.getTable('users')[0];
    if (user) {
      ParkingDB.update('users', user.id, {
        points: user.points + 25, // +25 XP por completar ciclo
        visits: user.visits + 1
      });
      updateLevelUI();
    }

    // Configurar y desplegar comprobante impreso (Modal de recibo)
    document.getElementById('rec-trans-id').innerText = 'TX-' + payment.id.toUpperCase();
    document.getElementById('rec-ticket-code').innerText = activeTicket.code;
    document.getElementById('rec-spot').innerText = activeTicket.spotId;
    document.getElementById('rec-vehicle').innerText = activeTicket.vehicleModel + ' (' + activeTicket.vehicleColor + ')';
    document.getElementById('rec-plate').innerText = activeTicket.vehiclePlate;
    
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    const s = elapsedSec % 60;
    document.getElementById('rec-duration').innerText = `${h<10?'0':''}${h}h ${m<10?'0':''}${m}m ${s<10?'0':''}${s}s`;
    
    document.getElementById('rec-method').innerText = selectedMethod.toUpperCase();
    document.getElementById('rec-amount').innerText = `$${finalPrice.toFixed(2)}`;

    // Cerrar pasarela de pagos
    paymentModal.style.display = 'none';
    
    // Abrir recibo
    receiptModal.style.display = 'flex';

    // Liberar cajón de forma inmediata
    activeTicket = null;
    initSectorsGrid();
    if (mapGenerated) generateMapGrid();
    refreshActiveTicketUI();
  });

  // Cierra el comprobante
  btnCloseReceipt.addEventListener('click', () => {
    receiptModal.style.display = 'none';
    showToast('Comprobante digital enviado al correo del conductor.');
    // Redirigir a vista de sectores
    switchToView('list');
  });

  /* ==========================================================================
     10. VISTA ADMINISTRATIVA Y ESTADÍSTICAS (ADMIN PANEL)
     ========================================================================== */
  
  // Llena los indicadores financieros, gráfica SVG de ocupación y tabla de auditoría de BD
  function loadAdminDashboard() {
    const tickets = ParkingDB.getTable('tickets');
    const payments = ParkingDB.getTable('payments');
    const reservations = ParkingDB.getTable('reservations');
    const accessHistory = ParkingDB.getTable('accessHistory');

    // 1. Calcular KPIs principales
    let totalRevenue = 0;
    payments.forEach(p => totalRevenue += p.monto);
    
    const activeRes = reservations.filter(r => r.status === 'Activa').length;
    
    // Cajones ocupados actualmente
    const activeTkts = tickets.filter(t => t.status === 'active');
    const occupiedCount = activeTkts.length;
    
    document.getElementById('kpi-revenue').innerText = `$${totalRevenue.toFixed(2)}`;
    document.getElementById('kpi-occupancy').innerText = `${occupiedCount}/26`;
    document.getElementById('kpi-occupancy-percent').innerText = `${((occupiedCount/26)*100).toFixed(0)}% ocupación`;
    document.getElementById('kpi-reservations').innerText = activeRes;
    document.getElementById('kpi-access-count').innerText = accessHistory.length;

    // 2. Gráfico de barras SVG dinámico por Sector (Ocupación en vivo)
    let countA = 0, countB = 0, countC = 0;
    activeTkts.forEach(t => {
      if (t.spotId.startsWith('A-')) countA++;
      else if (t.spotId.startsWith('B-')) countB++;
      else if (t.spotId.startsWith('C-')) countC++;
    });

    const pctA = (countA / 10) * 100;
    const pctB = (countB / 10) * 100;
    const pctC = (countC / 6) * 100;

    // Altura de barras SVG (De abajo hacia arriba: y = 170 - altura, max altura es 150)
    const barA = document.getElementById('bar-sector-a');
    const barB = document.getElementById('bar-sector-b');
    const barC = document.getElementById('bar-sector-c');

    const heightA = (pctA / 100) * 150;
    const heightB = (pctB / 100) * 150;
    const heightC = (pctC / 100) * 150;

    barA.setAttribute('height', heightA);
    barA.setAttribute('y', 170 - heightA);
    document.getElementById('lbl-sector-a').innerText = `${pctA.toFixed(0)}%`;
    document.getElementById('lbl-sector-a').setAttribute('y', 160 - heightA);

    barB.setAttribute('height', heightB);
    barB.setAttribute('y', 170 - heightB);
    document.getElementById('lbl-sector-b').innerText = `${pctB.toFixed(0)}%`;
    document.getElementById('lbl-sector-b').setAttribute('y', 160 - heightB);

    barC.setAttribute('height', heightC);
    barC.setAttribute('y', 170 - heightC);
    document.getElementById('lbl-sector-c').innerText = `${pctC.toFixed(0)}%`;
    document.getElementById('lbl-sector-c').setAttribute('y', 160 - heightC);

    // 3. Renderizar tabla de base de datos para auditoría
    renderDatabaseTable();
  }

  // Renderiza la tabla seleccionada en el visor de base de datos
  const dbTableSelect = document.getElementById('db-table-select');
  dbTableSelect.addEventListener('change', renderDatabaseTable);

  function renderDatabaseTable() {
    const tableName = dbTableSelect.value;
    const data = ParkingDB.getTable(tableName);
    const headerEl = document.getElementById('db-table-header');
    const bodyEl = document.getElementById('db-table-body');
    
    headerEl.innerHTML = '';
    bodyEl.innerHTML = '';

    if (data.length === 0) {
      bodyEl.innerHTML = '<tr><td colspan="10" style="text-align:center;">La tabla está vacía en este momento.</td></tr>';
      return;
    }

    // Obtener llaves para el header de las columnas de la BD
    const keys = Object.keys(data[0]);
    const headerRow = document.createElement('tr');
    keys.forEach(k => {
      const th = document.createElement('th');
      th.innerText = k.toUpperCase();
      headerRow.appendChild(th);
    });
    headerEl.appendChild(headerRow);

    // Llenar registros
    data.forEach(row => {
      const tr = document.createElement('tr');
      keys.forEach(k => {
        const td = document.createElement('td');
        const val = row[k];
        
        // Formatear si es objeto o fecha muy larga
        if (typeof val === 'object' && val !== null) {
          td.innerText = JSON.stringify(val);
        } else {
          td.innerText = val === null ? 'NULL' : val;
        }
        tr.appendChild(td);
      });
      bodyEl.appendChild(tr);
    });
  }

  // Limpiar y resetear base de datos
  document.getElementById('btn-db-reset').addEventListener('click', () => {
    if (confirm('¿Estás seguro de que deseas formatear toda la base de datos local? Esto reiniciará el historial.')) {
      ParkingDB.clearAll();
      activeTicket = null;
      selectedSpotId = null;
      initSectorsGrid();
      if (mapGenerated) generateMapGrid();
      loadAdminDashboard();
      showToast('Base de datos restablecida a los valores de fábrica', 'warning');
    }
  });

  /* ==========================================================================
     11. NAVEGACIÓN COMPLETA ENTRE PESTAÑAS Y VISTAS
     ========================================================================== */
  const btnToggleMap = document.getElementById('btn-toggle-map');
  const listView = document.getElementById('list-view-container');
  const visualMap = document.getElementById('visual-map-container');
  const activityView = document.getElementById('activity-view-container');
  const ticketsView = document.getElementById('tickets-view-container');
  const adminView = document.getElementById('admin-view-container');
  const dashboardHeader = document.getElementById('dashboard-header');
  
  let currentView = 'list';

  // Maneja la redirección limpia de vistas ocultando contenedores específicos
  function switchToView(viewName) {
    currentView = viewName;
    
    // Ocultar todo por defecto
    listView.style.display = 'none';
    visualMap.style.display = 'none';
    activityView.style.display = 'none';
    ticketsView.style.display = 'none';
    adminView.style.display = 'none';
    dashboardHeader.style.display = 'none';

    // Desmarcar clases activas de la navegación
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));

    // Activar contenedor correspondiente
    switch(viewName) {
      case 'list':
        listView.style.display = 'flex';
        dashboardHeader.style.display = 'block';
        document.getElementById('nav-sector-status').classList.add('active');
        stopGeolocation();
        break;
      case 'map':
        visualMap.style.display = 'block';
        dashboardHeader.style.display = 'block';
        generateMapGrid();
        startGeolocation();
        break;
      case 'tickets':
        ticketsView.style.display = 'block';
        document.getElementById('nav-tickets').classList.add('active');
        populateSimSpotDropdown();
        refreshActiveTicketUI();
        stopGeolocation();
        break;
      case 'activity':
        activityView.style.display = 'block';
        document.getElementById('nav-mi-actividad').classList.add('active');
        renderHistoryTable();
        stopGeolocation();
        break;
      case 'admin':
        adminView.style.display = 'block';
        document.getElementById('nav-admin').classList.add('active');
        loadAdminDashboard();
        stopGeolocation();
        break;
    }
  }

  // Registro de clics del Sidebar Menu
  document.getElementById('nav-sector-status').addEventListener('click', () => switchToView('list'));
  document.getElementById('nav-tickets').addEventListener('click', () => switchToView('tickets'));
  document.getElementById('nav-mi-actividad').addEventListener('click', () => switchToView('activity'));
  document.getElementById('nav-admin').addEventListener('click', () => switchToView('admin'));

  // Botón flotante verde para alternar mapa
  btnToggleMap.addEventListener('click', () => {
    if (currentView !== 'map') switchToView('map');
    else switchToView('list');
  });

  // Llena la tabla estática de auditoría en la pestaña "Mi Actividad"
  function renderHistoryTable() {
    const list = ParkingDB.getTable('accessHistory');
    const tableBody = document.getElementById('activity-table-body');
    tableBody.innerHTML = '';
    
    if (list.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay registros históricos aún.</td></tr>';
      return;
    }

    list.reverse().forEach(h => {
      const time = new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const row = document.createElement('tr');
      row.innerHTML = `<td><strong>${h.type}</strong></td><td>${h.spotId}</td><td>Sector ${h.spotId.charAt(0)}</td><td>${time}</td>`;
      tableBody.appendChild(row);
    });
  }

  // Llena la lista de cajones libres en el simulador
  function populateSimSpotDropdown() {
    const select = document.getElementById('sim-spot-select');
    select.innerHTML = '';
    
    // Obtener cajones ocupados/reservados
    const activeTkts = ParkingDB.filter('tickets', t => t.status === 'active');
    const occupiedIds = activeTkts.map(t => t.spotId);

    const sectors = [
      { prefix: 'A-', count: 10 },
      { prefix: 'B-', count: 10 },
      { prefix: 'C-', count: 6 }
    ];

    sectors.forEach(sec => {
      for(let i=1; i<=sec.count; i++) {
        const spotId = `${sec.prefix}${i<10?'0':''}${i}`;
        if (!occupiedIds.includes(spotId)) {
          const opt = document.createElement('option');
          opt.value = spotId;
          opt.innerText = spotId;
          select.appendChild(opt);
        }
      }
    });
  }

  // --- LÓGICA DE SIMULADOR DE ACCESO DIRECTO ---
  const btnSimEntry = document.getElementById('btn-sim-entry');
  const btnSimExit = document.getElementById('btn-sim-exit');
  const simSpotSelect = document.getElementById('sim-spot-select');
  const simPlate = document.getElementById('sim-plate');
  const simVehicle = document.getElementById('sim-vehicle');
  const simCodeInput = document.getElementById('sim-ticket-code-input');
  const btnSimSearch = document.getElementById('btn-sim-search');

  // Simula que una pluma lee el auto y registra entrada directa en Ocupado
  btnSimEntry.addEventListener('click', () => {
    const spot = simSpotSelect.value;
    const plate = simPlate.value.trim().toUpperCase() || 'SIM-' + Math.floor(100 + Math.random()*900);
    const model = simVehicle.value.trim() || 'Simulador Sedan';

    if (!spot) {
      showToast('No hay cajones disponibles para simular entrada', 'warning');
      return;
    }

    const tktCode = generateUniqueTicketCode();
    const newTkt = ParkingDB.insert('tickets', {
      code: tktCode,
      spotId: spot,
      status: 'active',
      vehicleStatus: 'Estacionado', // Entrada directa
      entryTime: new Date().toISOString(),
      exitTime: null,
      paymentMethod: 'N/A',
      tarifa: 15,
      totalPaid: 0,
      vehiclePlate: plate,
      vehicleModel: model,
      vehicleColor: 'Blanco',
      conductor: 'Simulador',
      isSimulated: true
    });

    ParkingDB.insert('accessHistory', {
      ticketId: newTkt.id,
      type: 'Entrada',
      spotId: spot
    });

    activeTicket = newTkt;
    
    // Limpiar campos
    simPlate.value = '';
    simVehicle.value = '';

    initSectorsGrid();
    if (mapGenerated) generateMapGrid();
    populateSimSpotDropdown();
    refreshActiveTicketUI();

    showToast(`Simulación completada. Auto ingresó al cajón ${spot}`);
  });

  // Buscar boleto existente para saldarlo
  btnSimSearch.addEventListener('click', () => {
    const q = simCodeInput.value.trim();
    if (!q) return;

    // Buscar por código o placa
    const match = ParkingDB.find('tickets', t => (t.code === q || t.vehiclePlate === q) && t.status === 'active');
    
    if (match) {
      activeTicket = match;
      refreshActiveTicketUI();
      showToast(`Boleto cargado con éxito: ${match.code}`);
    } else {
      showToast('No se encontró ningún ticket activo con esos datos', 'warning');
    }
  });

  // Simula salida con código o escaneo
  btnSimExit.addEventListener('click', () => {
    const q = simCodeInput.value.trim();
    
    const target = q ? ParkingDB.find('tickets', t => (t.code === q || t.vehiclePlate === q) && t.status === 'active') : activeTicket;
    
    if (!target) {
      showToast('Introduce un código o selecciona un boleto activo para saldarlo', 'warning');
      return;
    }
    
    activeTicket = target;
    btnPayTicket.click(); // Disparar pasarela de pagos
    simCodeInput.value = '';
  });

  // Renderizar tabla histórica inicial de la vista de tickets
  function refreshTicketsHistoryTable() {
    const tickets = ParkingDB.getTable('tickets');
    const tbody = document.getElementById('tickets-table-body');
    tbody.innerHTML = '';

    if (tickets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay registros en la base de datos.</td></tr>';
      return;
    }

    tickets.reverse().forEach(t => {
      const tr = document.createElement('tr');
      const inTime = new Date(t.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const outTime = t.exitTime ? new Date(t.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
      
      let stateBadge = '';
      if (t.status === 'paid') stateBadge = `<span class="badge-available" style="padding:2px 8px; font-size:0.65rem;">PAGADO</span>`;
      else if (t.status === 'expired') stateBadge = `<span class="badge-occupied" style="padding:2px 8px; font-size:0.65rem; background:rgba(220,38,38,0.1); color:#ef4444;">EXPIRADO</span>`;
      else stateBadge = `<span class="badge-available" style="padding:2px 8px; font-size:0.65rem; background:rgba(245,158,11,0.1); color:#f59e0b;">ACTIVO</span>`;

      tr.innerHTML = `
        <td><strong style="font-family:monospace;">${t.code}</strong></td>
        <td><strong>${t.spotId}</strong></td>
        <td>${stateBadge}</td>
        <td>${t.vehiclePlate} (${t.vehicleModel})</td>
        <td>${inTime} / ${outTime}</td>
        <td>$${t.totalPaid.toFixed(2)}</td>
        <td><button class="btn-change-photo btn-view-old" data-id="${t.id}" style="padding:3px 8px; font-size:0.7rem;"><i class="fas fa-eye"></i></button></td>
      `;
      tbody.appendChild(tr);
    });

    // Clic para auditar boleto antiguo
    document.querySelectorAll('.btn-view-old').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const match = ParkingDB.find('tickets', t => t.id === id);
        if (match) {
          activeTicket = match;
          refreshActiveTicketUI();
          showToast(`Cargado ticket de auditoría: ${match.code}`);
        }
      });
    });
  }

  // Escuchar cuando se entra a Tickets para refrescar el historial
  document.getElementById('nav-tickets').addEventListener('click', refreshTicketsHistoryTable);

  /* ==========================================================================
     12. LÓGICA DEL MAPA VISUAL Y RUTEADO INTELIGENTE (BFS)
     ========================================================================== */
  let mapGenerated = false;
  let pathPoints = []; 
  let pathProgress = 0; 
  let mapBlocksData = []; 

  // Crea la grilla 2D del estacionamiento y dibuja los bloques de los Sectores A, B y C
  function generateMapGrid() {
    if (mapGenerated) { syncMapSelection(); return; }
    mapGenerated = true;

    const blocksContainer = document.getElementById('map-grid-blocks');
    const svgPath = document.getElementById('map-path-svg');
    mapBlocksData = [];
    
    // Sector A (Superior Izquierda)
    for(let i=1; i<=10; i++) {
      mapBlocksData.push({ id: `A-${i<10?'0':''}${i}`, x: 40 + ((i-1)%5)*40, y: 50 + Math.floor((i-1)/5)*50 });
    }
    // Sector B (Superior Derecha)
    for(let i=1; i<=10; i++) {
      mapBlocksData.push({ id: `B-${i<10?'0':''}${i}`, x: 280 + ((i-1)%5)*40, y: 50 + Math.floor((i-1)/5)*50 });
    }
    // Sector C (Centro Abajo)
    for(let i=1; i<=6; i++) {
      mapBlocksData.push({ id: `C-${i<10?'0':''}${i}`, x: 190 + ((i-1)%3)*40, y: 180 + Math.floor((i-1)/3)*50 });
    }

    mapBlocksData.forEach(b => {
      const el = document.createElement('div');
      el.className = `map-block`;
      el.id = `map-block-${b.id}`;
      el.style.left = `${b.x}px`;
      el.style.top = `${b.y}px`;
      el.innerText = b.id;
      
      blocksContainer.appendChild(el);
    });

    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    pathEl.setAttribute('class', 'path-line');
    pathEl.setAttribute('id', 'dynamic-path');
    svgPath.appendChild(pathEl);
    
    syncMapSelection();
  }

  // Sincroniza el mapa visual con el estado de ocupación real de los cajones
  function syncMapSelection() {
    if (!mapGenerated) return;

    mapBlocksData.forEach(b => {
      const el = document.getElementById(`map-block-${b.id}`);
      el.classList.remove('flashing', 'reserved', 'occupied', 'available');
      
      const dbTkt = ParkingDB.find('tickets', t => t.spotId === b.id && t.status === 'active');
      
      if (dbTkt) {
        if (dbTkt.vehicleStatus === 'Reservado') {
          el.classList.add('reserved');
        } else {
          el.classList.add('occupied');
        }
      } else {
        el.classList.add('available');
      }
    });

    const targetId = activeTicket ? activeTicket.spotId : selectedSpotId;

    if (targetId) {
      const el = document.getElementById(`map-block-${targetId}`);
      
      // Si está reservado formalmente no parpadea
      const isFormalRes = activeTicket && activeTicket.spotId === targetId;
      if (el && !isFormalRes) el.classList.add('flashing'); 

      const targetBlock = mapBlocksData.find(b => b.id === targetId);
      calculateIntelligentPathTo(targetBlock.x, targetBlock.y);
    } else {
      pathPoints = [];
      if (document.getElementById('dynamic-path')) document.getElementById('dynamic-path').setAttribute('points', '');
      document.getElementById('player-triangle').style.display = 'none';
    }
  }

  // Trazado de ruta BFS Inteligente
  function calculateIntelligentPathTo(targetX, targetY) {
    const gridScale = 10; 
    const cols = 52; 
    const rows = 42; 
    const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
    
    // Marcar obstáculos (Cajas) con un margen AMPLIO para evitar colisiones
    mapBlocksData.forEach(b => {
      const startC = Math.floor(b.x / gridScale);
      const endC = Math.ceil((b.x + 30) / gridScale);
      const startR = Math.floor(b.y / gridScale);
      const endR = Math.ceil((b.y + 45) / gridScale);
      
      // Margen de colisión de seguridad
      for(let r = startR - 2; r <= endR + 1; r++) {
         for(let c = startC - 2; c <= endC + 2; c++) {
            if(r >= 0 && r < rows && c >= 0 && c < cols) {
               grid[r][c] = 1; 
            }
         }
      }
    });

    // Inicio y fin del algoritmo BFS
    const startC = 25; 
    const startR = 38; 
    grid[startR][startC] = 0; 
    
    let endC = Math.floor((targetX + 15) / gridScale); 
    let endR = Math.ceil((targetY + 45) / gridScale) + 1; 
    
    for(let r = Math.floor(targetY/gridScale); r <= endR+2; r++) {
       if(r >= 0 && r < rows && endC >= 0 && endC < cols) {
          grid[r][endC] = 0;
          if (endC-1 >= 0) grid[r][endC-1] = 0;
          if (endC+1 < cols) grid[r][endC+1] = 0;
       }
    }

    const queue = [[startR, startC]];
    const cameFrom = new Map();
    cameFrom.set(`${startR},${startC}`, null);
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]]; 
    
    let found = false;
    while(queue.length > 0) {
       const [r, c] = queue.shift();
       if (r === endR && c === endC) { found = true; break; }
       
       for(let [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
             if (grid[nr][nc] === 0 && !cameFrom.has(`${nr},${nc}`)) {
                queue.push([nr, nc]);
                cameFrom.set(`${nr},${nc}`, [r, c]);
             }
          }
       }
    }
    
    pathPoints = [];
    if (found) {
       let curr = [endR, endC];
       while(curr) {
          pathPoints.push({ x: curr[1] * gridScale, y: curr[0] * gridScale });
          curr = cameFrom.get(`${curr[0]},${curr[1]}`);
       }
       pathPoints.reverse(); 
       pathPoints.push({ x: targetX + 15, y: targetY + 22 }); 
    } else {
       pathPoints = [ { x: 250, y: 380 }, { x: targetX + 15, y: targetY + 22 } ];
    }

    document.getElementById('player-triangle').style.display = 'flex';
    updatePlayerPosition(0); 
  }

  function getPathPoint(progress) {
    if (pathPoints.length === 0) return {x:0, y:0, segmentIndex:0, segProgress:0};
    let totalLen = 0;
    const segLens = [];
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const dx = pathPoints[i+1].x - pathPoints[i].x;
      const dy = pathPoints[i+1].y - pathPoints[i].y;
      const len = Math.sqrt(dx*dx + dy*dy);
      segLens.push(len); totalLen += len;
    }
    if (totalLen === 0) return { ...pathPoints[0], segmentIndex: 0, segProgress: 0 };
    const targetLen = progress * totalLen;
    let currentLen = 0;
    for (let i = 0; i < segLens.length; i++) {
      if (currentLen + segLens[i] >= targetLen) {
        const segProgress = segLens[i] === 0 ? 0 : (targetLen - currentLen) / segLens[i];
        const x = pathPoints[i].x + (pathPoints[i+1].x - pathPoints[i].x) * segProgress;
        const y = pathPoints[i].y + (pathPoints[i+1].y - pathPoints[i].y) * segProgress;
        return { x, y, segmentIndex: i, segProgress };
      }
      currentLen += segLens[i];
    }
    return { ...pathPoints[pathPoints.length - 1], segmentIndex: segLens.length - 1, segProgress: 1 };
  }

  function updatePlayerPosition(progress) {
    if (pathPoints.length === 0) return;
    progress = Math.max(0, Math.min(1, progress));
    pathProgress = progress;

    const pos = getPathPoint(progress);
    
    document.getElementById('player-triangle').style.left = `${pos.x}px`;
    document.getElementById('player-triangle').style.top = `${pos.y}px`;

    // Checar proximidad al cajón
    checkProximity(pos.x, pos.y);

    const pathEl = document.getElementById('dynamic-path');
    if (pathEl) {
      let pointsStr = `${pos.x},${pos.y} `;
      for (let i = pos.segmentIndex + 1; i < pathPoints.length; i++) {
        pointsStr += `${pathPoints[i].x},${pathPoints[i].y} `;
      }
      pathEl.setAttribute('points', pointsStr.trim());
    }
  }

  /* ==========================================================================
     13. BOTONES "GUARDAR AUTO" Y "ENCONTRAR AUTO"
     ========================================================================== */
  document.getElementById('btn-save-car').addEventListener('click', () => {
    const activeT = activeTicket || ParkingDB.find('tickets', t => t.conductor === 'Alex Rivera' && t.status === 'active');
    if (!activeT) {
      showToast('Debes tener un cajón reservado u ocupado primero', 'warning');
      return;
    }
    savedCarSpotId = activeT.spotId;
    registerArrival(); // Simular registro de llegada si no se hizo en el mapa
    showToast('Ubicación del vehículo guardada exitosamente.');
  });

  document.getElementById('btn-find-car').addEventListener('click', () => {
    if (!savedCarSpotId) {
      showToast('No has guardado ninguna ubicación de vehículo', 'warning');
      return;
    }
    showToast(`Ruta trazada hacia tu auto en cajón ${savedCarSpotId}`);
    switchToView('map');
  });

  /* ==========================================================================
     14. CONTROLES DE MOVIMIENTO Y GEOLOCALIZACIÓN SIMULADA
     ========================================================================== */
  window.addEventListener('keydown', (e) => {
    if (currentView !== 'map' || pathPoints.length === 0) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { 
      updatePlayerPosition(pathProgress + 0.03); 
      addPoints(1); 
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { 
      updatePlayerPosition(pathProgress - 0.03); 
    }
  });

  let geoWatchId = null;
  let lastLat = null, lastLon = null;

  function startGeolocation() {
    if ("geolocation" in navigator) {
      geoWatchId = navigator.geolocation.watchPosition((position) => {
        const lat = position.coords.latitude, lon = position.coords.longitude;
        if (lastLat !== null && lastLon !== null) {
          const dist = Math.abs(lat - lastLat) + Math.abs(lon - lastLon);
          if (dist > 0.000001 && pathPoints.length > 0) {
            updatePlayerPosition(pathProgress + 0.02); 
            addPoints(2);
          }
        }
        lastLat = lat; lastLon = lon;
      }, (e) => console.warn(e), { enableHighAccuracy: true });
    }
  }

  function stopGeolocation() {
    if (geoWatchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
  }
});

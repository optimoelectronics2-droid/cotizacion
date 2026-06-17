// ============================================
// TRIFUSION TECHNOLOGIES - APP.JS COMPLETO
// Todas las funciones de administrador + cotización pública
// ============================================

// Variables globales
let currentUser = null;
let products = [];
let invoiceItems = [];
let adminInvoiceItems = [];
let shippingCost = 0;
let includeShipping = true;
let activeTab = 'facturacion';
let cotizacionCounter = parseInt(localStorage.getItem('cotizacionCounter') || '0');

// Device Detection
const device = {
    isAndroid: /Android/i.test(navigator.userAgent),
    isIPhone: /iPhone|iPod/i.test(navigator.userAgent),
    isIPad: /iPad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    isWindows: /Windows/i.test(navigator.userAgent),
    isMac: /Macintosh|MacIntel|MacPPC|Mac68K/i.test(navigator.userAgent) && !(/iPhone|iPod|iPad/i.test(navigator.userAgent)),
    isMobile: /Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.innerWidth < 768),
    getOS: function() {
        if (this.isAndroid) return 'android';
        if (this.isIPhone) return 'iphone';
        if (this.isIPad) return 'ipad';
        if (this.isWindows) return 'windows';
        if (this.isMac) return 'mac';
        return 'unknown';
    }
};

const STORE_LOCATION = { lat: 18.4962009, lng: -69.8497819 };
const STORE_ADDRESS = 'Plaza Quiñónez Local, C. Club Activo 20-30 #3, Santo Domingo Este, República Dominicana';
const SHIPPING_COST_PER_KM = 45; // RD$45 por kilómetro

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('adminInvoiceDate')?.setAttribute('value', today);
    document.getElementById('adminInvoiceDate')?.setAttribute('max', today);
    
    loadStoreData();
    loadProducts();
    
    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateUI();
    });
    
    // Auto-detectar ubicación al cargar
    setTimeout(() => autoDetectLocation(), 500);
});

// ============================================
// CUSTOM DIALOGS (reemplazan prompt/alert/confirm nativos)
// ============================================

// --- Toast notifications ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) { alert(message); return; }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };
    toast.innerHTML = `<i class="fas fa-${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

// --- Quantity modal (reemplaza prompt de cantidad) ---
let _quantityCallback = null;

function openQuantityModal(product) {
    const modal = document.getElementById('quantityModal');
    const nameEl = document.getElementById('quantityProductName');
    const input = document.getElementById('quantityInput');
    if (!modal || !nameEl || !input) return;
    nameEl.textContent = product.name;
    input.value = '1';
    modal.classList.add('active');
    setTimeout(() => input.focus(), 100);
    input.select();
    _quantityCallback = (qty) => {
        if (qty <= 0) { showToast('Cantidad inválida', 'error'); return false; }
        invoiceItems.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price),
            quantity: qty,
            subtotal: parseFloat(product.price) * qty
        });
        modal.classList.remove('active');
        _quantityCallback = null;
        renderInvoiceProducts();
        calculateTotals();
        return true;
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = document.getElementById('quantityConfirmBtn');
    const quantityInput = document.getElementById('quantityInput');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            const qty = parseInt(document.getElementById('quantityInput')?.value) || 1;
            if (_quantityCallback) _quantityCallback(qty);
        });
    }
    if (quantityInput) {
        quantityInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const qty = parseInt(quantityInput.value) || 1;
                if (_quantityCallback) _quantityCallback(qty);
            }
        });
    }
});

function closeQuantityModal() {
    document.getElementById('quantityModal')?.classList.remove('active');
    _quantityCallback = null;
}

// --- Confirm modal (reemplaza confirm nativo) ---
let _confirmResolve = null;

function showConfirm(title, message, extra = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const msgEl = document.getElementById('confirmMessage');
        const extraEl = document.getElementById('confirmExtra');
        if (!modal || !titleEl || !msgEl) { resolve(false); return; }
        titleEl.innerHTML = `<i class="fas fa-question-circle"></i> ${title}`;
        msgEl.textContent = message;
        if (extraEl) {
            extraEl.textContent = extra;
            extraEl.style.display = extra ? 'block' : 'none';
        }
        modal.classList.add('active');
        _confirmResolve = resolve;
    });
}

function closeConfirmModal(result) {
    document.getElementById('confirmModal')?.classList.remove('active');
    if (_confirmResolve) _confirmResolve(result);
    _confirmResolve = null;
}

// ============================================
// ADMIN PANEL
// ============================================

function toggleAdminPanel() {
    const panel = document.getElementById('adminPanel');
    panel.classList.toggle('active');
}

async function login() {
    const email = document.getElementById('adminEmail')?.value;
    const password = document.getElementById('adminPassword')?.value;
    
    if (!email || !password) {
        showToast('Por favor ingresa correo y contraseña', 'warning');
        return;
    }
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        toggleAdminPanel();
        showToast('¡Bienvenido al Panel de Administración!', 'success');
        updateUI();
    } catch (error) {
        showToast('Credenciales incorrectas', 'error');
        console.error('Error login:', error);
    }
}

function logout() {
    auth.signOut().then(() => {
        showToast('Sesión cerrada', 'info');
        updateUI();
    });
}

function updateUI() {
    const dashboard = document.getElementById('dashboard');
    if (currentUser && dashboard) {
        dashboard.style.display = 'block';
        loadRecentQuotes();
        populateAdminProductSelect();
    } else if (dashboard) {
        dashboard.style.display = 'none';
    }
}

// ============================================
// TABS NAVIGATION
// ============================================

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Activate button
    event.target.classList.add('active');
    
    activeTab = tabName;
}

// ============================================
// STORE MANAGEMENT
// ============================================

function loadStoreData() {
    const defaults = {
        storeName: 'Trifusion Technologies',
        storePhone: '+1 (829) 872-5163',
        storeAddress: 'Autopista de San Isidro, Santo Domingo',
        storeLogo: ''
    };
    
    Object.keys(defaults).forEach(key => {
        if (!localStorage.getItem(key)) {
            localStorage.setItem(key, defaults[key]);
        }
    });
    
    const storeName = localStorage.getItem('storeName');
    const storePhone = localStorage.getItem('storePhone');
    const storeAddress = localStorage.getItem('storeAddress');
    const storeLogo = localStorage.getItem('storeLogo');
    
    const storeNameInput = document.getElementById('storeName');
    const storePhoneInput = document.getElementById('storePhone');
    const storeAddressInput = document.getElementById('storeAddress');
    const storeLogoInput = document.getElementById('storeLogo');
    const logoPreview = document.getElementById('logoPreview');
    
    if (storeNameInput) storeNameInput.value = storeName;
    if (storePhoneInput) storePhoneInput.value = storePhone;
    if (storeAddressInput) storeAddressInput.value = storeAddress;
    if (storeLogoInput) storeLogoInput.value = storeLogo;
    if (logoPreview && storeLogo) {
        logoPreview.src = storeLogo;
        logoPreview.style.display = 'block';
    }
}

function saveStore() {
    const storeName = document.getElementById('storeName').value;
    const storePhone = document.getElementById('storePhone').value;
    const storeAddress = document.getElementById('storeAddress').value;
    const storeLogo = document.getElementById('storeLogo').value;
    
    localStorage.setItem('storeName', storeName);
    localStorage.setItem('storePhone', storePhone);
    localStorage.setItem('storeAddress', storeAddress);
    localStorage.setItem('storeLogo', storeLogo);
    
    if (storeLogo && document.getElementById('logoPreview')) {
        document.getElementById('logoPreview').src = storeLogo;
        document.getElementById('logoPreview').style.display = 'block';
    }
    
    showToast('Configuración guardada exitosamente', 'success');
}

// ============================================
// PRODUCT MANAGEMENT
// ============================================

async function loadProducts() {
    try {
        const snapshot = await db.collection('products').orderBy('name').get();
        products = [];
        
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        renderProductsTable();
        populateProductModal();
        populateAdminProductSelect();
        
    } catch (error) {
        console.error('Error cargando productos:', error);
        showToast('Error al cargar productos', 'error');
    }
}

async function addProduct() {
    const code = document.getElementById('productCode').value;
    const name = document.getElementById('productName').value;
    const price = document.getElementById('productPrice').value;
    const description = document.getElementById('productDesc').value;
    const category = document.getElementById('productCategory').value;
    
    if (!name || !price || !category) {
        showToast('Nombre, precio y categoría son obligatorios', 'warning');
        return;
    }
    
    try {
        await db.collection('products').add({
            code: code || '',
            name: name.trim(),
            price: parseFloat(price),
            description: description || '',
            category: category,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Producto agregado exitosamente', 'success');
        document.getElementById('productCode').value = '';
        document.getElementById('productName').value = '';
        document.getElementById('productPrice').value = '';
        document.getElementById('productDesc').value = '';
        document.getElementById('productCategory').value = '';
        
        await loadProducts();
        
    } catch (error) {
        console.error('Error agregando producto:', error);
        showToast('Error al agregar producto', 'error');
    }
}

async function deleteProduct(id) {
    const confirmed = await showConfirm('Eliminar producto', '¿Eliminar este producto?');
    if (!confirmed) return;
    
    try {
        await db.collection('products').doc(id).delete();
        showToast('Producto eliminado', 'success');
        await loadProducts();
    } catch (error) {
        console.error('Error eliminando producto:', error);
        showToast('Error al eliminar', 'error');
    }
}

function renderProductsTable() {
    const tbody = document.getElementById('productsTable');
    if (!tbody) return;
    
    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">No hay productos registrados</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = products.map(product => `
        <tr>
            <td><strong>${product.name}</strong></td>
            <td>${product.category || '-'}</td>
            <td class="text-right">RD$ ${parseFloat(product.price).toLocaleString()}</td>
            <td class="text-center">
                <button class="btn-danger" style="padding: 6px 12px; font-size: 14px;" onclick="deleteProduct('${product.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function searchInventory() {
    const searchTerm = document.getElementById('searchInventory').value.toLowerCase();
    const rows = document.querySelectorAll('#productsTable tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// ============================================
// PRODUCT MODAL
// ============================================

function openProductModal() {
    document.getElementById('productModal')?.classList.add('active');
    document.getElementById('modalProductSearch').value = '';
    filterProductsModal();
}

function closeProductModal() {
    document.getElementById('productModal')?.classList.remove('active');
}

function populateProductModal() {
    const container = document.getElementById('productsListModal');
    if (!container) return;
    
    if (products.length === 0) {
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>No hay productos disponibles</p></div>';
        return;
    }
    
    filterProductsModal();
}

// Store quantities per product card
const _cardQtys = {};

function filterProductsModal() {
    const searchTerm = document.getElementById('modalProductSearch')?.value.toLowerCase() || '';
    const container = document.getElementById('productsListModal');
    if (!container) return;
    
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        (p.category && p.category.toLowerCase().includes(searchTerm)) ||
        (p.code && p.code.toLowerCase().includes(searchTerm))
    );
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="loading-state"><i class="fas fa-search" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;"></i><p>No se encontraron productos</p></div>';
        return;
    }
    
    container.innerHTML = filtered.map(product => {
        const pid = product.id;
        if (!(_cardQtys[pid])) _cardQtys[pid] = 1;
        return `
        <div class="product-card">
            <h4>${product.name}</h4>
            <p><i class="fas fa-folder"></i> ${product.category || 'Sin categoría'}</p>
            <p><i class="fas fa-barcode"></i> ${product.code || 'Sin código'}</p>
            <span class="price">RD$ ${parseFloat(product.price).toLocaleString()}</span>
            <div class="product-qty-row">
                <button class="qty-btn" onclick="adjustCardQty('${pid}', -1)">−</button>
                <span class="qty-value" id="qty_${pid}">${_cardQtys[pid]}</span>
                <button class="qty-btn" onclick="adjustCardQty('${pid}', 1)">+</button>
                <button class="btn-add-card" onclick="addProductFromCard('${pid}')"><i class="fas fa-cart-plus"></i> Agregar</button>
            </div>
        </div>
    `}).join('');
}

function adjustCardQty(productId, delta) {
    if (!(_cardQtys[productId])) _cardQtys[productId] = 1;
    _cardQtys[productId] = Math.max(1, _cardQtys[productId] + delta);
    const el = document.getElementById(`qty_${productId}`);
    if (el) el.textContent = _cardQtys[productId];
}

function addProductFromCard(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const qty = _cardQtys[productId] || 1;
    invoiceItems.push({
        id: productId,
        name: product.name,
        price: parseFloat(product.price),
        quantity: qty,
        subtotal: parseFloat(product.price) * qty
    });
    _cardQtys[productId] = 1;
    renderInvoiceProducts();
    calculateTotals();
    showToast(`${product.name} × ${qty} agregado`, 'success');
}

function selectProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    closeProductModal();
    openQuantityModal(product);
}

// ============================================
// ADMIN PRODUCT SELECT
// ============================================

function populateAdminProductSelect() {
    const select = document.getElementById('adminSelectedProduct');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Selecciona un producto --</option>';
    
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = `${product.name} - RD$ ${parseFloat(product.price).toLocaleString()}`;
        select.appendChild(option);
    });
}

// ============================================
// INVOICE MANAGEMENT - PUBLIC
// ============================================

function renderInvoiceProducts() {
    const container = document.getElementById('invoiceProducts');
    if (!container) return;
    
    if (invoiceItems.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-basket"></i>
                <p>Aún no has agregado productos</p>
                <button class="btn-outline" onclick="openProductModal()">
                    <i class="fas fa-plus"></i> Agregar tu primer producto
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = invoiceItems.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-meta">Cant: ${item.quantity} × RD$ ${item.price.toLocaleString()}</div>
            </div>
            <div class="cart-item-price">
                <span class="subtotal">RD$ ${item.subtotal.toLocaleString()}</span>
            </div>
            <button class="cart-item-remove" onclick="removeInvoiceItem(${index})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function removeInvoiceItem(index) {
    invoiceItems.splice(index, 1);
    renderInvoiceProducts();
    calculateTotals();
}

function calculateTotals() {
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('applyITBIS')?.checked || false;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const shipping = includeShipping ? shippingCost : 0;
    const total = subtotal + itbis + shipping;
    
    const subtotalEl = document.getElementById('subtotal');
    const itbisEl = document.getElementById('itbis');
    const shippingEl = document.getElementById('shipping');
    const totalEl = document.getElementById('total');
    
    if (subtotalEl) subtotalEl.textContent = `RD$ ${subtotal.toLocaleString()}`;
    if (itbisEl) itbisEl.textContent = `RD$ ${itbis.toLocaleString()}`;
    if (shippingEl) shippingEl.textContent = `RD$ ${shipping.toLocaleString()}`;
    if (totalEl) totalEl.textContent = `RD$ ${total.toLocaleString()}`;
}

// ============================================
// ADMIN INVOICE MANAGEMENT
// ============================================

function addProductToInvoiceAdmin() {
    const productId = document.getElementById('adminSelectedProduct').value;
    const quantity = parseInt(document.getElementById('adminProductQuantity').value) || 1;
    
    if (!productId) {
        showToast('Selecciona un producto', 'warning');
        return;
    }
    
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    adminInvoiceItems.push({
        id: productId,
        name: product.name,
        price: parseFloat(product.price),
        quantity: quantity,
        subtotal: parseFloat(product.price) * quantity
    });
    
    renderAdminInvoiceProducts();
    calculateTotalsAdmin();
    
    document.getElementById('adminSelectedProduct').value = '';
    document.getElementById('adminProductQuantity').value = '1';
}

function renderAdminInvoiceProducts() {
    const tbody = document.getElementById('adminInvoiceProducts');
    if (!tbody) return;
    
    if (adminInvoiceItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">No hay productos en la factura</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = adminInvoiceItems.map((item, index) => `
        <tr>
            <td><strong>${item.name}</strong></td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">RD$ ${item.price.toLocaleString()}</td>
            <td class="text-right">RD$ ${item.subtotal.toLocaleString()}</td>
            <td class="text-center">
                <button class="btn-danger" style="padding: 6px 12px; font-size: 14px;" onclick="removeAdminInvoiceItem(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function removeAdminInvoiceItem(index) {
    adminInvoiceItems.splice(index, 1);
    renderAdminInvoiceProducts();
    calculateTotalsAdmin();
}

function calculateTotalsAdmin() {
    const subtotal = adminInvoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('adminApplyITBIS')?.checked || false;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const total = subtotal + itbis;
    
    const subtotalEl = document.getElementById('adminSubtotal');
    const itbisEl = document.getElementById('adminItbis');
    const totalEl = document.getElementById('adminTotal');
    
    if (subtotalEl) subtotalEl.textContent = `RD$ ${subtotal.toLocaleString()}`;
    if (itbisEl) itbisEl.textContent = `RD$ ${itbis.toLocaleString()}`;
    if (totalEl) totalEl.textContent = `RD$ ${total.toLocaleString()}`;
}

// ============================================
// LOCATION & SHIPPING
// ============================================

function toggleShipping() {
    includeShipping = document.getElementById('includeShipping')?.checked || false;
    const shippingDetails = document.getElementById('shippingDetails');
    
    if (shippingDetails) {
        shippingDetails.style.display = includeShipping ? 'block' : 'none';
    }
    
    if (!includeShipping) {
        shippingCost = 0;
        _locationFound = false;
        document.getElementById('shippingCostDisplay').textContent = 'RD$ 0.00';
        document.getElementById('locationButtonText').textContent = 'Compartir Ubicación';
        document.getElementById('locationButtonText').disabled = false;
    } else {
        // Re-detect location when re-enabled
        setTimeout(autoDetectLocation, 300);
    }
    
    calculateTotals();
}

let _locationFound = false;

function autoDetectLocation() {
    const btn = document.getElementById('locationButtonText');
    const costDisplay = document.getElementById('shippingCostDisplay');
    const shippingEnabled = document.getElementById('includeShipping')?.checked;
    if (!btn || !costDisplay || !shippingEnabled) return;

    btn.textContent = 'Obteniendo ubicación GPS...';
    btn.disabled = true;
    _locationFound = false;

    if (!navigator.geolocation) {
        btn.textContent = 'GPS no disponible';
        btn.disabled = false;
        showManualShippingSelector();
        return;
    }

    // Try GPS with high accuracy, no cache
    navigator.geolocation.getCurrentPosition(
        (position) => {
            if (_locationFound) return;
            _locationFound = true;
            btn.textContent = 'Ubicación exacta obtenida';
            calculateShipping(position.coords.latitude, position.coords.longitude, btn, costDisplay);
        },
        (error) => {
            if (_locationFound) return;
            console.warn('GPS error:', error.message);
            // Retry once with lower accuracy but longer timeout
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (_locationFound) return;
                    _locationFound = true;
                    btn.textContent = 'Ubicación obtenida';
                    calculateShipping(position.coords.latitude, position.coords.longitude, btn, costDisplay);
                },
                (error2) => {
                    if (_locationFound) return;
                    console.warn('GPS retry failed:', error2.message);
                    btn.textContent = 'Compartir ubicación manualmente';
                    btn.disabled = false;
                    showManualShippingSelector();
                },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
            );
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
}

function shareLocation() {
    if (_locationFound) return;
    autoDetectLocation();
}

// Zonas de envío para República Dominicana (RD$)
const SHIPPING_ZONES = [
    { name: 'Santo Domingo Este (cerca de la tienda)', min: 0, max: 5, costPerKm: 45 },
    { name: 'Santo Domingo (DN)', min: 0, max: 25, costPerKm: 45 },
    { name: 'Provincia Santo Domingo', min: 0, max: 50, costPerKm: 45 },
    { name: 'Otras provincias cercanas', min: 0, max: 100, costPerKm: 45 },
    { name: 'Provincias lejanas', min: 0, max: 999, costPerKm: 45 }
];

function showManualShippingSelector() {
    const selector = document.getElementById('manualZoneSelector');
    if (!selector) return;
    const select = document.getElementById('shippingZoneSelect');
    if (!select) return;

    // Poblar opciones si no están
    if (select.options.length <= 1) {
        SHIPPING_ZONES.forEach((z, i) => {
            const est = Math.round(((z.min + z.max) / 2) * z.costPerKm);
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${z.name} (~RD$ ${est.toLocaleString()})`;
            select.appendChild(opt);
        });
    }

    selector.style.display = 'block';
    select.focus();
}

function onZoneSelect(el) {
    const costDisplay = document.getElementById('shippingCostDisplay');
    const btn = document.getElementById('locationButtonText');
    if (!costDisplay || !btn) return;

    const zone = SHIPPING_ZONES[parseInt(el.value)];
    if (zone) {
        const avgKm = (zone.min + zone.max) / 2;
        shippingCost = Math.round(avgKm * zone.costPerKm);
        costDisplay.textContent = `RD$ ${shippingCost.toLocaleString()}`;
        btn.textContent = 'Zona seleccionada ✓';
        calculateTotals();
    }
}

async function calculateShipping(lat, lng, btn, costDisplay) {
    try {
        // Intentar OSRM primero
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 6000);
        const url = `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${STORE_LOCATION.lng},${STORE_LOCATION.lat}?overview=false`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(t);
        const data = await res.json();

        if (data.code === 'Ok' && data.routes?.[0]) {
            const distKm = Math.round(data.routes[0].distance / 1000);
            shippingCost = Math.round(distKm * SHIPPING_COST_PER_KM);
            costDisplay.textContent = `RD$ ${shippingCost.toLocaleString()}`;
            btn.textContent = `Ubicación obtenida ✓`;
            btn.disabled = false;
            calculateTotals();
            return;
        }
        throw new Error('Ruta no disponible');
    } catch (e) {
        console.warn('OSRM falló, usando distancia lineal:', e);
        const dist = Math.round(haversine(lat, lng, STORE_LOCATION.lat, STORE_LOCATION.lng) * 1.3);
        shippingCost = Math.round(dist * SHIPPING_COST_PER_KM);
        costDisplay.textContent = `RD$ ${shippingCost.toLocaleString()}`;
        btn.textContent = 'Ubicación obtenida';
        btn.disabled = false;
        calculateTotals();
    }
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNextCotizacionNumber() {
    cotizacionCounter++;
    localStorage.setItem('cotizacionCounter', cotizacionCounter.toString());
    return `COT-${String(cotizacionCounter).padStart(5, '0')}`;
}

// ============================================
// PDF GENERATION
// ============================================

function generatePDF(action = 'save') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'letter');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;
    
    const storeName = localStorage.getItem('storeName') || 'Trifusion Technologies';
    const storePhone = localStorage.getItem('storePhone') || '+1 (829) 872-5163';
    const storeAddress = localStorage.getItem('storeAddress') || STORE_ADDRESS;
    const storeLogo = localStorage.getItem('storeLogo') || '';
    const clientName = document.getElementById('clientName')?.value.trim() || 'Cliente';
    const clientDoc = document.getElementById('clientDoc')?.value.trim() || '';
    const clientPhone = document.getElementById('clientPhone')?.value.trim() || '';
    const clientAddress = document.getElementById('clientAddress')?.value || '';
    const cotizacionNum = getNextCotizacionNumber();
    
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('applyITBIS')?.checked || false;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const shipping = includeShipping ? shippingCost : 0;
    const total = subtotal + itbis + shipping;
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Colors
    const primaryColor = [59, 130, 246];
    const darkColor = [15, 23, 42];
    const mutedColor = [100, 116, 139];
    const borderColor = [226, 232, 240];
    
    // Header
    if (storeLogo) {
        try { doc.addImage(storeLogo, 'JPEG', margin, y, 50, 15); } catch(e) {}
    } else {
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(storeName, margin, y + 8);
    }
    y += 8;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text(storeAddress, margin, y + 4);
    doc.text(`Tel: ${storePhone}`, margin, y + 8);
    
    // Quote number & date (right side)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(cotizacionNum, pageWidth - margin, y + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text(dateStr, pageWidth - margin, y + 14, { align: 'right' });
    
    y += 20;
    
    // Separator
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(1.5);
    doc.line(margin, y, pageWidth - margin, y);
    
    y += 10;
    
    // Client info
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('Datos del Cliente', margin, y);
    y += 7;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`Nombre: ${clientName}`, margin, y);
    if (clientDoc) { y += 5; doc.text(`Cédula/RNC: ${clientDoc}`, margin, y); }
    if (clientPhone) { y += 5; doc.text(`Teléfono: ${clientPhone}`, margin, y); }
    if (clientAddress) { y += 5; doc.text(`Dirección: ${clientAddress}`, margin, y); }
    
    y += 12;
    
    // Separator
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    
    // Products table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('Productos', margin, y);
    y += 8;
    
    const tableBody = invoiceItems.map((item, i) => [
        item.name,
        item.quantity.toString(),
        `RD$ ${item.price.toLocaleString()}`,
        `RD$ ${item.subtotal.toLocaleString()}`
    ]);
    
    doc.autoTable({
        startY: y,
        head: [['Producto', 'Cant.', 'Precio', 'Subtotal']],
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: primaryColor,
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 8.5,
            textColor: darkColor
        },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.45, halign: 'left' },
            1: { cellWidth: contentWidth * 0.15, halign: 'center' },
            2: { cellWidth: contentWidth * 0.2, halign: 'right' },
            3: { cellWidth: contentWidth * 0.2, halign: 'right' }
        },
        margin: { left: margin, right: margin },
        tableWidth: contentWidth
    });
    
    y = doc.lastAutoTable.finalY + 10;
    
    // Totals
    const totalX = pageWidth - margin - 80;
    const totalWidth = 80;
    
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.line(totalX, y, pageWidth - margin, y);
    y += 6;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('Subtotal:', totalX, y);
    doc.text(`RD$ ${subtotal.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
    y += 6;
    
    if (applyITBIS) {
        doc.text('ITBIS 18%:', totalX, y);
        doc.text(`RD$ ${itbis.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
        y += 6;
    }
    
    if (shipping > 0) {
        doc.text('Envío:', totalX, y);
        doc.text(`RD$ ${shipping.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
        y += 6;
    }
    
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(1.5);
    doc.line(totalX, y, pageWidth - margin, y);
    y += 6;
    
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('TOTAL:', totalX, y);
    doc.text(`RD$ ${total.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
    
    y += 20;
    
    // Footer
    const footerY = pageHeight - margin - 20;
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY, pageWidth - margin, footerY);
    
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text('Gracias por su preferencia. Esta cotización es válida por 7 días.', margin, footerY + 5);
    doc.text(`${storeName} · ${storePhone} · WhatsApp: wa.me/18298725163`, margin, footerY + 10);
    doc.text(storeAddress, margin, footerY + 15);
    
    // Page number
    doc.text(`Página 1 de 1`, pageWidth - margin, footerY + 15, { align: 'right' });
    
    doc.setProperties({
        title: `${cotizacionNum} - ${clientName}`,
        subject: 'Cotización',
        author: storeName
    });
    
    return { doc, cotizacionNum, clientName, total };
}

function getPDFBlob(doc) {
    return new Promise((resolve) => {
        const blob = doc.output('blob');
        resolve(blob);
    });
}

async function sharePDFFile(doc, fileName, message) {
    const blob = await getPDFBlob(doc);
    const file = new File([blob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: fileName,
                text: message || ''
            });
            return true;
        } catch (err) {
            if (err.name === 'AbortError') return true;
            console.warn('Web Share API falló:', err);
        }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
    return false;
}

function downloadPDF() {
    if (invoiceItems.length === 0) {
        showToast('No hay productos en la cotización', 'warning');
        return null;
    }
    
    const clientName = document.getElementById('clientName')?.value.trim() || 'Cliente';
    
    const result = generatePDF('download');
    if (!result) return null;
    
    const { doc, cotizacionNum, clientName: name } = result;
    const fileName = `${cotizacionNum}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    
    if (device.isIPhone || device.isIPad) {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    } else {
        doc.save(fileName);
    }
    
    return result;
}

// ============================================
// SAVE & SEND QUOTE
// ============================================

async function saveQuote() {
    const clientName = document.getElementById('clientName')?.value.trim() || 'Cliente';
    const clientDoc = document.getElementById('clientDoc')?.value.trim() || '';
    const clientPhone = document.getElementById('clientPhone')?.value.trim() || '';
    
    if (invoiceItems.length === 0) {
        showToast('No hay productos en la cotización', 'warning');
        return;
    }
    
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('applyITBIS')?.checked || false;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const shipping = includeShipping ? shippingCost : 0;
    const total = subtotal + itbis + shipping;
    
    const pdfResult = downloadPDF();
    if (!pdfResult) return;
    
    const { cotizacionNum } = pdfResult;
    
    const descripcion = invoiceItems.slice(0, 3).map(i => i.name).join(', ') + (invoiceItems.length > 3 ? ` +${invoiceItems.length - 3} más` : '');
    const today = new Date().toISOString().split('T')[0];
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    
    const footprint = {
        descripcion: descripcion,
        monto: total,
        fecha: today,
        idCotizacion: cotizacionNum,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt)
    };
    
    try {
        await db.collection('cotizaciones').add(footprint);
        showToast('Cotización guardada exitosamente', 'success');
        const sendWhatsApp = await showConfirm('Cotización guardada', '¿Deseas enviarla por WhatsApp ahora?');
        if (sendWhatsApp) await sendToWhatsApp(cotizacionNum);
    } catch (error) {
        console.error('Error guardando huella:', error);
        showToast('Error al guardar la cotización', 'error');
    }
}

async function sendToWhatsApp(cotizacionNum) {
    if (invoiceItems.length === 0) {
        showToast('No hay productos en la cotización', 'warning');
        return;
    }

    const clientName = document.getElementById('clientName')?.value.trim() || 'Cliente';

    const storeName = localStorage.getItem('storeName') || 'Trifusion Technologies';
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('applyITBIS')?.checked || false;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const shipping = includeShipping ? shippingCost : 0;
    const total = subtotal + itbis + shipping;

    const pdfResult = generatePDF('whatsapp');
    if (!pdfResult) return;

    const { doc, cotizacionNum: num, clientName: name } = pdfResult;
    const fileName = `${num}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    const message = `Cotización ${num} - ${storeName}\nTotal: RD$ ${total.toLocaleString()}\nCliente: ${clientName}`;

    const shared = await sharePDFFile(doc, fileName, message);
    if (!shared) {
        showToast('PDF descargado. Compártelo manualmente en WhatsApp.', 'info');
    }
}

function printInvoice() {
    if (invoiceItems.length === 0) {
        showToast('No hay productos en la cotización', 'warning');
        return;
    }
    
    const clientName = document.getElementById('clientName')?.value.trim() || 'Cliente';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Por favor permite las ventanas emergentes para imprimir', 'warning');
        return;
    }
    
    const storeName = localStorage.getItem('storeName') || 'Trifusion Technologies';
    const storePhone = localStorage.getItem('storePhone') || '+1 (829) 872-5163';
    const storeAddress = localStorage.getItem('storeAddress') || STORE_ADDRESS;
    const storeLogo = localStorage.getItem('storeLogo') || '';
    
    const clientDoc = document.getElementById('clientDoc')?.value.trim() || '';
    const clientPhone = document.getElementById('clientPhone')?.value.trim() || '';
    const clientAddress = document.getElementById('clientAddress')?.value || '';
    
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('applyITBIS')?.checked || false;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const shipping = includeShipping ? shippingCost : 0;
    const total = subtotal + itbis + shipping;
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' });
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cotización - ${storeName}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; background: #f8fafc; padding: 0; }
                .invoice { background: white; max-width: 216mm; margin: 0 auto; padding: 15mm 20mm; min-height: 279mm; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10mm; padding-bottom: 5mm; border-bottom: 3px solid #3b82f6; }
                .company h2 { color: #0f172a; font-size: 22pt; margin-bottom: 2mm; font-weight: 700; }
                .company p { color: #64748b; font-size: 9pt; margin: 1mm 0; line-height: 1.5; }
                .badge { background: #3b82f6; color: white; padding: 2mm 6mm; display: inline-block; font-weight: 700; font-size: 10pt; margin-top: 3mm; border-radius: 4px; }
                .client-section { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 8mm; }
                .client-section h3 { font-size: 11pt; color: #0f172a; margin-bottom: 3mm; border-bottom: 1px solid #e2e8f0; padding-bottom: 1mm; }
                .client-section p { font-size: 9.5pt; color: #334155; margin: 1.5mm 0; }
                .label { color: #64748b; font-weight: 600; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.03em; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 8mm; }
                th { background: #f1f5f9; color: #334155; font-weight: 600; text-align: left; padding: 3mm 4mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e2e8f0; }
                td { padding: 3mm 4mm; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 9.5pt; }
                tr:nth-child(even) td { background: #fafafa; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .totals { margin-top: 5mm; margin-left: auto; width: 200px; }
                .total-row { display: flex; justify-content: space-between; padding: 1.5mm 0; font-size: 9.5pt; }
                .total-row.final { margin-top: 3mm; padding-top: 3mm; border-top: 2px solid #3b82f6; }
                .total-row.final span { font-size: 13pt; font-weight: 700; color: #0f172a; }
                .total-row.final .total-amount { color: #3b82f6; }
                .footer { margin-top: 10mm; padding-top: 4mm; border-top: 2px solid #e2e8f0; font-size: 8pt; color: #64748b; line-height: 1.6; }
                @media print { 
                    body { background: white; } 
                    .invoice { box-shadow: none; padding: 0; }
                }
                @page { 
                    size: letter; 
                    margin: 0; 
                }
                @media screen {
                    .invoice { box-shadow: 0 20px 60px rgba(0,0,0,0.15); margin: 20px auto; border-radius: 12px; }
                }
            </style>
        </head>
        <body>
            <div class="invoice">
                <div class="header">
                    <div class="company">
                        ${storeLogo ? `<img src="${storeLogo}" style="max-height:40px;margin-bottom:5px;">` : ''}
                        <h2>${storeName}</h2>
                        <p>${storeAddress}</p>
                        <p>Teléfono: ${storePhone} · WhatsApp: wa.me/18298725163</p>
                        <span class="badge">COTIZACIÓN</span>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-size:10pt;font-weight:700;color:#0f172a;">${getNextCotizacionNumber()}</p>
                        <p style="font-size:9pt;color:#64748b;">${dateStr}</p>
                    </div>
                </div>
                
                <div class="client-section">
                    <div>
                        <h3>Cliente</h3>
                        <p><span class="label">Nombre:</span> ${clientName}</p>
                        ${clientDoc ? `<p><span class="label">Cédula/RNC:</span> ${clientDoc}</p>` : ''}
                        ${clientPhone ? `<p><span class="label">Teléfono:</span> ${clientPhone}</p>` : ''}
                    </div>
                    <div>
                        ${clientAddress ? `<h3>Dirección de Envío</h3><p>${clientAddress}</p>` : ''}
                        ${shipping > 0 ? `<p style="margin-top:3mm;"><span class="label">Costo de Envío:</span> RD$ ${shipping.toLocaleString()}</p>` : ''}
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="width:50%;">Producto</th>
                            <th class="text-center" style="width:12%;">Cant.</th>
                            <th class="text-right" style="width:19%;">Precio</th>
                            <th class="text-right" style="width:19%;">Importe</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoiceItems.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td class="text-center">${item.quantity}</td>
                            <td class="text-right">RD$ ${item.price.toLocaleString()}</td>
                            <td class="text-right">RD$ ${item.subtotal.toLocaleString()}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="totals">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>RD$ ${subtotal.toLocaleString()}</span>
                    </div>
                    ${applyITBIS ? `
                    <div class="total-row">
                        <span>ITBIS 18%:</span>
                        <span>RD$ ${itbis.toLocaleString()}</span>
                    </div>
                    ` : ''}
                    ${shipping > 0 ? `
                    <div class="total-row">
                        <span>Envío:</span>
                        <span>RD$ ${shipping.toLocaleString()}</span>
                    </div>
                    ` : ''}
                    <div class="total-row final">
                        <span>TOTAL:</span>
                        <span class="total-amount">RD$ ${total.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Gracias por su preferencia. Esta cotización es válida por 7 días.</p>
                    <p>${storeName} · ${storePhone} · WhatsApp: wa.me/18298725163</p>
                    <p>${storeAddress}</p>
                </div>
            </div>
            <script>
                window.onload = function() { window.print(); };
                window.onafterprint = function() { window.close(); };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

// ============================================
// ADMIN INVOICE FUNCTIONS
// ============================================

async function newInvoice() {
    if (adminInvoiceItems.length > 0) {
        const confirmNew = await showConfirm('Nueva factura', '¿Deseas iniciar una nueva factura? Se perderán los productos actuales.');
        if (!confirmNew) return;
    }
    
    adminInvoiceItems = [];
    document.getElementById('adminApplyITBIS').checked = false;
    document.getElementById('adminClientName').value = '';
    document.getElementById('adminClientDoc').value = '';
    document.getElementById('adminClientPhone').value = '';
    document.getElementById('adminClientAddress').value = '';
    document.getElementById('adminInvoiceNumber').value = '';
    document.getElementById('adminPaymentMethod').value = '';
    
    renderAdminInvoiceProducts();
    calculateTotalsAdmin();
}

function saveInvoice() {
    const clientName = document.getElementById('adminClientName').value.trim();
    const clientDoc = document.getElementById('adminClientDoc').value.trim();
    const clientPhone = document.getElementById('adminClientPhone').value.trim();
    const invoiceNumber = document.getElementById('adminInvoiceNumber').value.trim();
    const paymentMethod = document.getElementById('adminPaymentMethod').value;
    
    if (!clientName || !clientDoc || !clientPhone) {
        showToast('Nombre, cédula y teléfono son obligatorios', 'warning');
        return;
    }
    
    if (!invoiceNumber) {
        showToast('Número de factura es obligatorio', 'warning');
        return;
    }
    
    if (!paymentMethod) {
        showToast('Método de pago es obligatorio', 'warning');
        return;
    }
    
    if (adminInvoiceItems.length === 0) {
        showToast('No hay productos en la factura', 'warning');
        return;
    }
    
    const subtotal = adminInvoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('adminApplyITBIS').checked;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const total = subtotal + itbis;
    
    const invoiceData = {
        type: 'factura',
        clientId: clientName,
        clientDoc: clientDoc,
        clientPhone: clientPhone,
        clientAddress: document.getElementById('adminClientAddress').value || '',
        invoiceNumber: invoiceNumber,
        paymentMethod: paymentMethod,
        items: adminInvoiceItems,
        subtotal: subtotal,
        itbis: itbis,
        total: total,
        applyITBIS: applyITBIS,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('invoices').add(invoiceData)
        .then(() => {
            showToast('Factura guardada exitosamente', 'success');
            newInvoice();
        })
        .catch(error => {
            console.error('Error guardando factura:', error);
            showToast('Error al guardar la factura', 'error');
        });
}

function generateAdminPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'letter');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    const storeName = localStorage.getItem('storeName') || 'Trifusion Technologies';
    const storePhone = localStorage.getItem('storePhone') || '+1 (829) 872-5163';
    const storeAddress = localStorage.getItem('storeAddress') || STORE_ADDRESS;
    const clientName = document.getElementById('adminClientName').value.trim() || 'Cliente';
    const clientDoc = document.getElementById('adminClientDoc').value.trim() || '';
    const clientPhone = document.getElementById('adminClientPhone').value.trim() || '';
    const clientAddress = document.getElementById('adminClientAddress').value || '';
    const invoiceNumber = document.getElementById('adminInvoiceNumber').value || 'FAC-001';
    const paymentMethod = document.getElementById('adminPaymentMethod').value || 'efectivo';
    const paymentMethods = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', credito: 'Crédito a Cliente' };

    const subtotal = adminInvoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('adminApplyITBIS').checked;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const total = subtotal + itbis;
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' });

    const primaryColor = [239, 68, 68];
    const darkColor = [15, 23, 42];
    const mutedColor = [100, 116, 139];
    const borderColor = [226, 232, 240];

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(storeName, margin, y + 8);

    y += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text(storeAddress, margin, y + 4);
    doc.text(`Tel: ${storePhone}`, margin, y + 8);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`FACTURA ${invoiceNumber}`, pageWidth - margin, y + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text(dateStr, pageWidth - margin, y + 14, { align: 'right' });

    y += 22;

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(1.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('Datos del Cliente', margin, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`Nombre: ${clientName}`, margin, y);
    if (clientDoc) { y += 5; doc.text(`Cédula/RNC: ${clientDoc}`, margin, y); }
    if (clientPhone) { y += 5; doc.text(`Teléfono: ${clientPhone}`, margin, y); }
    if (clientAddress) { y += 5; doc.text(`Dirección: ${clientAddress}`, margin, y); }
    y += 5;
    doc.text(`Método de Pago: ${paymentMethods[paymentMethod] || paymentMethod}`, margin, y);

    y += 10;

    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('Productos', margin, y);
    y += 8;

    const contentWidth = pageWidth - margin * 2;
    const tableBody = adminInvoiceItems.map((item) => [
        item.name,
        item.quantity.toString(),
        `RD$ ${item.price.toLocaleString()}`,
        `RD$ ${item.subtotal.toLocaleString()}`
    ]);

    doc.autoTable({
        startY: y,
        head: [['Producto', 'Cant.', 'Precio', 'Subtotal']],
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: primaryColor,
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'center'
        },
        bodyStyles: { fontSize: 8.5, textColor: darkColor },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.45, halign: 'left' },
            1: { cellWidth: contentWidth * 0.15, halign: 'center' },
            2: { cellWidth: contentWidth * 0.2, halign: 'right' },
            3: { cellWidth: contentWidth * 0.2, halign: 'right' }
        },
        margin: { left: margin, right: margin },
        tableWidth: contentWidth
    });

    y = doc.lastAutoTable.finalY + 10;

    const totalX = pageWidth - margin - 80;
    const totalWidth = 80;

    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.line(totalX, y, pageWidth - margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('Subtotal:', totalX, y);
    doc.text(`RD$ ${subtotal.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
    y += 6;

    if (applyITBIS) {
        doc.text('ITBIS 18%:', totalX, y);
        doc.text(`RD$ ${itbis.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
        y += 6;
    }

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(1.5);
    doc.line(totalX, y, pageWidth - margin, y);
    y += 6;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('TOTAL:', totalX, y);
    doc.text(`RD$ ${total.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });

    y += 20;
    const footerY = doc.internal.pageSize.getHeight() - margin - 20;
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text('Gracias por su preferencia.', margin, footerY + 5);
    doc.text(`${storeName} · ${storePhone}`, margin, footerY + 10);
    doc.text(storeAddress, margin, footerY + 15);

    doc.setProperties({
        title: `Factura ${invoiceNumber} - ${clientName}`,
        subject: 'Factura',
        author: storeName
    });

    return doc;
}

async function sendInvoiceToWhatsApp() {
    if (adminInvoiceItems.length === 0) {
        showToast('No hay productos en la factura', 'warning');
        return;
    }
    
    const clientName = document.getElementById('adminClientName').value.trim();
    const clientDoc = document.getElementById('adminClientDoc').value.trim();
    const clientPhone = document.getElementById('adminClientPhone').value.trim();
    
    if (!clientName || !clientDoc || !clientPhone) {
        showToast('Completa los datos del cliente primero', 'warning');
        return;
    }

    const doc = generateAdminPDF();
    const invoiceNumber = document.getElementById('adminInvoiceNumber').value || 'FAC-001';
    const fileName = `Factura_${invoiceNumber}_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const storeName = localStorage.getItem('storeName') || 'Trifusion Technologies';

    const message = `Factura ${invoiceNumber} - ${storeName}\nCliente: ${clientName}`;
    const shared = await sharePDFFile(doc, fileName, message);
    if (!shared) {
        showToast('PDF descargado. Compártelo manualmente en WhatsApp.', 'info');
    }
}

function printInvoiceAdmin() {
    if (adminInvoiceItems.length === 0) {
        showToast('No hay productos en la factura', 'warning');
        return;
    }
    
    const clientName = document.getElementById('adminClientName').value.trim();
    const clientDoc = document.getElementById('adminClientDoc').value.trim();
    const clientPhone = document.getElementById('adminClientPhone').value.trim();
    
    if (!clientName || !clientDoc || !clientPhone) {
        showToast('Completa los datos del cliente primero', 'warning');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Por favor permite las ventanas emergentes', 'warning');
        return;
    }
    
    const storeName = localStorage.getItem('storeName') || 'Trifusion Technologies';
    const storePhone = localStorage.getItem('storePhone') || '+1 (829) 872-5163';
    const storeAddress = localStorage.getItem('storeAddress') || 'Autopista de San Isidro, Santo Domingo';
    
    const invoiceNumber = document.getElementById('adminInvoiceNumber').value || 'FAC-001';
    const paymentMethod = document.getElementById('adminPaymentMethod').value || 'efectivo';
    const paymentMethods = {
        'efectivo': 'Efectivo',
        'transferencia': 'Transferencia',
        'tarjeta': 'Tarjeta',
        'credito': 'Crédito a Cliente'
    };
    
    const subtotal = adminInvoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('adminApplyITBIS').checked;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const total = subtotal + itbis;
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Factura - ${storeName}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', Arial, sans-serif; }
                body { padding: 20px; background: #f8fafc; }
                .invoice { background: white; padding: 40px; border-radius: 12px; max-width: 800px; margin: 0 auto; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #ef4444; }
                .company h2 { color: #0f172a; font-size: 24px; margin-bottom: 5px; font-weight: 700; }
                .company p { color: #64748b; font-size: 13px; margin: 3px 0; line-height: 1.6; }
                .type { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 8px 20px; border-radius: 25px; font-weight: 700; font-size: 14px; display: inline-block; margin-top: 10px; }
                .info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
                .info-item { margin-bottom: 15px; }
                .info-label { font-weight: 600; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
                .info-value { color: #0f172a; font-size: 14px; font-weight: 500; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { background: #f1f5f9; color: #334155; font-weight: 600; text-align: left; padding: 12px 15px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
                td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .totals { margin-top: 20px; text-align: right; }
                .total-row { display: flex; justify-content: flex-end; margin-bottom: 10px; font-size: 14px; }
                .total-label { min-width: 120px; color: #475569; font-weight: 500; }
                .total-amount { min-width: 100px; color: #0f172a; font-weight: 600; text-align: right; padding: 0 10px; }
                .total-row.final { margin-top: 15px; padding-top: 15px; border-top: 2px solid #ef4444; }
                .total-label.final { font-size: 16px; color: #0f172a; font-weight: 700; }
                .total-amount.final { font-size: 20px; color: #ef4444; font-weight: 700; }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.8; }
                @media print { body { padding: 0; background: white; } .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="invoice">
                <div class="header">
                    <div class="company">
                        <h2>${storeName}</h2>
                        <p>${storeAddress}</p>
                        <p>Teléfono: ${storePhone}</p>
                        <span class="type">FACTURA OFICIAL</span>
                    </div>
                </div>
                
                <div class="info">
                    <div class="info-item">
                        <div class="info-label">Factura No.</div>
                        <div class="info-value">${invoiceNumber}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Fecha</div>
                        <div class="info-value">${new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Cliente</div>
                        <div class="info-value">${clientName}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Cédula/RNC</div>
                        <div class="info-value">${clientDoc}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Teléfono</div>
                        <div class="info-value">${clientPhone}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Método de Pago</div>
                        <div class="info-value">${paymentMethods[paymentMethod]}</div>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th class="text-center">Cant.</th>
                            <th class="text-right">Precio</th>
                            <th class="text-right">Importe</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${adminInvoiceItems.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td class="text-center">${item.quantity}</td>
                            <td class="text-right">RD$ ${item.price.toLocaleString()}</td>
                            <td class="text-right">RD$ ${item.subtotal.toLocaleString()}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="totals">
                    <div class="total-row">
                        <span class="total-label">Subtotal:</span>
                        <span class="total-amount">RD$ ${subtotal.toLocaleString()}</span>
                    </div>
                    ${applyITBIS ? `
                    <div class="total-row">
                        <span class="total-label">ITBIS 18%:</span>
                        <span class="total-amount">RD$ ${itbis.toLocaleString()}</span>
                    </div>
                    ` : ''}
                    <div class="total-row final">
                        <span class="total-label final">TOTAL:</span>
                        <span class="total-amount final">RD$ ${total.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Gracias por su preferencia.</p>
                    <p>${storeName} - ${storePhone}</p>
                    <p>WhatsApp: wa.me/18298725163</p>
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    window.close();
                }
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

// ============================================
// NEW QUOTE & RECENT QUOTES
// ============================================

async function newQuote() {
    if (invoiceItems.length > 0) {
        const confirmNew = await showConfirm('Nueva cotización', '¿Deseas iniciar una nueva cotización? Se perderán los productos actuales.');
        if (!confirmNew) return;
    }
    
    invoiceItems = [];
    shippingCost = 0;
    includeShipping = true;
    
    // Reset form
    document.getElementById('clientName').value = '';
    document.getElementById('clientDoc').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientAddress').value = '';
    document.getElementById('applyITBIS').checked = false;
    document.getElementById('includeShipping').checked = true;
    
    if (document.getElementById('shippingDetails')) {
        document.getElementById('shippingDetails').style.display = 'block';
    }
    
    // Clean up manual zone selector
    const zoneSelect = document.getElementById('shippingZoneSelect');
    if (zoneSelect) zoneSelect.remove();
    
    document.getElementById('shippingCostDisplay').textContent = 'RD$ 0.00';
    document.getElementById('locationButtonText').textContent = 'Compartir Ubicación';
    document.getElementById('locationButtonText').disabled = false;
    
    renderInvoiceProducts();
    calculateTotals();
}

async function loadRecentQuotes() {
    try {
        const snapshot = await db.collection('cotizaciones')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const tbody = document.getElementById('quotesTable');
        if (!tbody) return;
        
        if (snapshot.empty) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No hay cotizaciones en el historial</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return `
                <tr>
                    <td>${data.descripcion || 'N/A'}</td>
                    <td>${data.idCotizacion || 'N/A'}</td>
                    <td class="text-right">RD$ ${data.monto?.toLocaleString() || '0'}</td>
                    <td>${data.fecha || 'N/A'}</td>
                    <td class="text-center">
                        <button class="btn-danger" style="padding: 6px 12px; font-size: 14px;" onclick="deleteQuote('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando cotizaciones:', error);
    }
}

async function deleteQuote(id) {
    const confirmed = await showConfirm('Eliminar cotización', '¿Eliminar esta cotización?');
    if (!confirmed) return;
    
    try {
        await db.collection('cotizaciones').doc(id).delete();
        showToast('Cotización eliminada', 'success');
        loadRecentQuotes();
    } catch (error) {
        console.error('Error eliminando cotización:', error);
        showToast('Error al eliminar', 'error');
    }
}

async function cleanupExpiredQuotes() {
    try {
        const now = firebase.firestore.Timestamp.now();
        const snapshot = await db.collection('cotizaciones')
            .where('expiresAt', '<=', now)
            .limit(100)
            .get();
        
        if (snapshot.empty) return;
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`🗑️ Limpieza: ${snapshot.size} cotizaciones expiradas eliminadas`);
    } catch (error) {
        console.error('Error en limpieza de cotizaciones:', error);
    }
}

// Run cleanup every 6 hours
setInterval(cleanupExpiredQuotes, 6 * 60 * 60 * 1000);
// Run cleanup on load too
setTimeout(cleanupExpiredQuotes, 5000);

// ============================================
// CLEAR ALL QUOTES
// ============================================

async function clearAllQuotes() {
    const confirmed = await showConfirm('Borrar historial', '¿ESTÁS SEGURO DE BORRAR TODO EL HISTORIAL DE COTIZACIONES?', 'Esta acción no se puede deshacer.');
    if (!confirmed) return;
    
    try {
        const snapshot = await db.collection('cotizaciones').get();
        const batch = db.batch();
        
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        showToast('Todo el historial ha sido limpiado exitosamente', 'success');
        loadRecentQuotes();
    } catch (error) {
        console.error('Error limpiando historial:', error);
        showToast('Error al limpiar el historial', 'error');
    }
}

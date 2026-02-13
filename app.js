// ============================================
// TRIFUSION TECHNOLOGIES - APP.JS COMPLETO
// Todas las funciones de administrador + cotización pública
// ============================================

// Variables globales
let currentUser = null;
let products = [];
let invoiceItems = []; // Para cotización pública
let adminInvoiceItems = []; // Para facturación admin
let shippingCost = 0;
let includeShipping = true; // Para cotización pública
let activeTab = 'facturacion';

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
    
    // Evento para compartir ubicación
    const shareLocationBtn = document.getElementById('shareLocationBtn');
    if (shareLocationBtn) {
        shareLocationBtn.addEventListener('click', shareLocation);
    }
});

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
        alert('Por favor ingresa correo y contraseña');
        return;
    }
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        toggleAdminPanel();
        alert('¡Bienvenido al Panel de Administración!');
        updateUI();
    } catch (error) {
        alert('Credenciales incorrectas');
        console.error('Error login:', error);
    }
}

function logout() {
    auth.signOut().then(() => {
        alert('Sesión cerrada');
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
    
    alert('Configuración guardada exitosamente');
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
        alert('Error al cargar productos');
    }
}

async function addProduct() {
    const code = document.getElementById('productCode').value;
    const name = document.getElementById('productName').value;
    const price = document.getElementById('productPrice').value;
    const description = document.getElementById('productDesc').value;
    const category = document.getElementById('productCategory').value;
    
    if (!name || !price || !category) {
        alert('Nombre, precio y categoría son obligatorios');
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
        
        alert('Producto agregado exitosamente');
        document.getElementById('productCode').value = '';
        document.getElementById('productName').value = '';
        document.getElementById('productPrice').value = '';
        document.getElementById('productDesc').value = '';
        document.getElementById('productCategory').value = '';
        
        await loadProducts();
        
    } catch (error) {
        console.error('Error agregando producto:', error);
        alert('Error al agregar producto');
    }
}

async function deleteProduct(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    
    try {
        await db.collection('products').doc(id).delete();
        alert('Producto eliminado');
        await loadProducts();
    } catch (error) {
        console.error('Error eliminando producto:', error);
        alert('Error al eliminar');
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
    
    container.innerHTML = filtered.map(product => `
        <div class="product-card" onclick="selectProduct('${product.id}')">
            <h4>${product.name}</h4>
            <p><i class="fas fa-folder"></i> ${product.category || 'Sin categoría'}</p>
            <p><i class="fas fa-barcode"></i> ${product.code || 'Sin código'}</p>
            <span class="price">RD$ ${parseFloat(product.price).toLocaleString()}</span>
        </div>
    `).join('');
}

function selectProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const quantity = prompt('Cantidad:', '1') || '1';
    const qty = parseInt(quantity);
    
    if (isNaN(qty) || qty <= 0) {
        alert('Cantidad inválida');
        return;
    }
    
    invoiceItems.push({
        id: productId,
        name: product.name,
        price: parseFloat(product.price),
        quantity: qty,
        subtotal: parseFloat(product.price) * qty
    });
    
    closeProductModal();
    renderInvoiceProducts();
    calculateTotals();
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
    const tbody = document.getElementById('invoiceProducts');
    if (!tbody) return;
    
    if (invoiceItems.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fas fa-shopping-basket"></i>
                        <p>Aún no has agregado productos</p>
                        <button class="btn-outline" onclick="openProductModal()">
                            <i class="fas fa-plus"></i> Agregar tu primer producto
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = invoiceItems.map((item, index) => `
        <tr>
            <td><strong>${item.name}</strong></td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">RD$ ${item.price.toLocaleString()}</td>
            <td class="text-right">RD$ ${item.subtotal.toLocaleString()}</td>
            <td class="text-center">
                <button class="btn-danger" style="padding: 6px 12px; font-size: 14px;" onclick="removeInvoiceItem(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
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
        alert('Selecciona un producto');
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
        document.getElementById('shippingCostDisplay').textContent = 'RD$ 0.00';
        document.getElementById('locationButtonText').textContent = 'Compartir Ubicación';
    }
    
    calculateTotals();
}

function shareLocation() {
    if (!navigator.geolocation) {
        alert('Geolocalización no soportada en este dispositivo');
        return;
    }
    
    const buttonText = document.getElementById('locationButtonText');
    if (buttonText) buttonText.textContent = 'Obteniendo ubicación...';
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            calculateShipping(latitude, longitude);
            if (buttonText) buttonText.textContent = 'Ubicación Obtenida ✓';
        },
        (error) => {
            console.error('Error geolocalización:', error);
            alert('Error al obtener ubicación. Verifica que esté activada.');
            if (buttonText) buttonText.textContent = 'Reintentar Ubicación';
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function calculateShipping(lat, lng) {
    const random = Math.random();
    if (random < 0.4) shippingCost = 150;
    else if (random < 0.75) shippingCost = 250;
    else shippingCost = 350;
    
    document.getElementById('shippingCostDisplay').textContent = `RD$ ${shippingCost.toLocaleString()}`;
    calculateTotals();
}

// ============================================
// SAVE & SEND QUOTE
// ============================================

function saveQuote() {
    const clientName = document.getElementById('clientName')?.value.trim();
    const clientDoc = document.getElementById('clientDoc')?.value.trim();
    const clientPhone = document.getElementById('clientPhone')?.value.trim();
    
    if (!clientName || !clientDoc || !clientPhone) {
        alert('Por favor completa todos los datos personales obligatorios (Nombre, Cédula y Teléfono)');
        return;
    }
    
    if (invoiceItems.length === 0) {
        alert('No hay productos en la cotización');
        return;
    }
    
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('applyITBIS')?.checked || false;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const shipping = includeShipping ? shippingCost : 0;
    const total = subtotal + itbis + shipping;
    
    const quoteData = {
        type: 'cotizacion',
        clientId: clientName,
        clientDoc: clientDoc,
        clientPhone: clientPhone,
        clientAddress: document.getElementById('clientAddress')?.value || '',
        items: invoiceItems,
        subtotal: subtotal,
        itbis: itbis,
        shipping: shipping,
        total: total,
        applyITBIS: applyITBIS,
        includeShipping: includeShipping,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('quotes').add(quoteData)
        .then(() => {
            alert('✅ Cotización guardada exitosamente');
            const sendWhatsApp = confirm('¿Deseas enviar esta cotización por WhatsApp ahora?');
            if (sendWhatsApp) sendToWhatsApp();
        })
        .catch(error => {
            console.error('Error guardando cotización:', error);
            alert('Error al guardar la cotización');
        });
}

function sendToWhatsApp() {
    if (invoiceItems.length === 0) {
        alert('No hay productos en la cotización');
        return;
    }
    
    const clientName = document.getElementById('clientName')?.value.trim() || 'Cliente';
    const storeName = localStorage.getItem('storeName') || 'Trifusion Technologies';
    const subtotal = parseFloat(document.getElementById('subtotal')?.textContent.replace(/[^0-9.-]+/g, "") || 0);
    const itbis = parseFloat(document.getElementById('itbis')?.textContent.replace(/[^0-9.-]+/g, "") || 0);
    const total = parseFloat(document.getElementById('total')?.textContent.replace(/[^0-9.-]+/g, "") || 0);
    const applyITBIS = document.getElementById('applyITBIS')?.checked || false;
    
    let message = `¡Hola ${clientName}! 👋\n\nGracias por cotizar con *${storeName}*\n\n📋 *DETALLE DE COTIZACIÓN:*\n\n`;
    
    invoiceItems.forEach((item, index) => {
        message += `${index + 1}. *${item.name}*\n   Cantidad: ${item.quantity}\n   Precio: RD$ ${item.price.toLocaleString()}\n   Subtotal: RD$ ${item.subtotal.toLocaleString()}\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `💵 *SUBTOTAL:* RD$ ${subtotal.toLocaleString()}\n`;
    
    if (applyITBIS) {
        message += `📊 *ITBIS 18%:* RD$ ${itbis.toLocaleString()}\n`;
    }
    
    if (includeShipping && shippingCost > 0) {
        message += `🚚 *ENVÍO:* RD$ ${shippingCost.toLocaleString()}\n`;
    }
    
    message += `💰 *TOTAL:* RD$ ${total.toLocaleString()}\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    message += `📞 *Contacto:*\n`;
    message += `WhatsApp: wa.me/18298725163\n`;
    message += `Teléfono: +1 (829) 872-5163\n\n`;
    message += `📍 *Dirección:*\n`;
    message += `${localStorage.getItem('storeAddress') || 'Autopista de San Isidro, Santo Domingo'}\n\n`;
    message += `¡Estamos a su disposición para resolver todas tus dudas! 🚀\n\n`;
    message += `*Trifusion Technologies*\n`;
    message += `Soluciones Tecnológicas Premium 💻📱🖨️`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/18298725163?text=${encodedMessage}`, '_blank');
}

function printInvoice() {
    if (invoiceItems.length === 0) {
        alert('No hay productos en la cotización');
        return;
    }
    
    const clientName = document.getElementById('clientName')?.value.trim();
    if (!clientName) {
        alert('Por favor ingresa tu nombre primero');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Por favor permite las ventanas emergentes para imprimir');
        return;
    }
    
    const storeName = localStorage.getItem('storeName') || 'Trifusion Technologies';
    const storePhone = localStorage.getItem('storePhone') || '+1 (829) 872-5163';
    const storeAddress = localStorage.getItem('storeAddress') || 'Autopista de San Isidro, Santo Domingo';
    
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('applyITBIS')?.checked || false;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const shipping = includeShipping ? shippingCost : 0;
    const total = subtotal + itbis + shipping;
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cotización - ${storeName}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', Arial, sans-serif; }
                body { padding: 20px; background: #f8fafc; }
                .invoice { background: white; padding: 40px; border-radius: 12px; max-width: 800px; margin: 0 auto; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #3b82f6; }
                .company h2 { color: #0f172a; font-size: 24px; margin-bottom: 5px; font-weight: 700; }
                .company p { color: #64748b; font-size: 13px; margin: 3px 0; line-height: 1.6; }
                .type { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 8px 20px; border-radius: 25px; font-weight: 700; font-size: 14px; display: inline-block; margin-top: 10px; }
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
                .total-row.final { margin-top: 15px; padding-top: 15px; border-top: 2px solid #3b82f6; }
                .total-label.final { font-size: 16px; color: #0f172a; font-weight: 700; }
                .total-amount.final { font-size: 20px; color: #3b82f6; font-weight: 700; }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.8; }
                @media print { body { padding: 0; background: white; } .no-print { display: none; } }
                @page { margin: 1cm; }
            </style>
        </head>
        <body>
            <div class="invoice">
                <div class="header">
                    <div class="company">
                        <h2>${storeName}</h2>
                        <p>${storeAddress}</p>
                        <p>Teléfono: ${storePhone}</p>
                        <span class="type">COTIZACIÓN</span>
                    </div>
                </div>
                
                <div class="info">
                    <div class="info-item">
                        <div class="info-label">Cliente</div>
                        <div class="info-value">${clientName}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Fecha</div>
                        <div class="info-value">${new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
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
                        <span class="total-label">Subtotal:</span>
                        <span class="total-amount">RD$ ${subtotal.toLocaleString()}</span>
                    </div>
                    ${applyITBIS ? `
                    <div class="total-row">
                        <span class="total-label">ITBIS 18%:</span>
                        <span class="total-amount">RD$ ${itbis.toLocaleString()}</span>
                    </div>
                    ` : ''}
                    ${includeShipping && shippingCost > 0 ? `
                    <div class="total-row">
                        <span class="total-label">Envío:</span>
                        <span class="total-amount">RD$ ${shippingCost.toLocaleString()}</span>
                    </div>
                    ` : ''}
                    <div class="total-row final">
                        <span class="total-label final">TOTAL:</span>
                        <span class="total-amount final">RD$ ${total.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Gracias por su preferencia. Esta cotización es válida por 7 días.</p>
                    <p>${storeName} - ${storePhone}</p>
                    <p>WhatsApp: wa.me/18298725163</p>
                    <p>Dirección: ${storeAddress}</p>
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
// ADMIN INVOICE FUNCTIONS
// ============================================

function newInvoice() {
    if (adminInvoiceItems.length > 0) {
        const confirmNew = confirm('¿Deseas iniciar una nueva factura? Se perderán los productos actuales.');
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
        alert('Nombre, cédula y teléfono son obligatorios');
        return;
    }
    
    if (!invoiceNumber) {
        alert('Número de factura es obligatorio');
        return;
    }
    
    if (!paymentMethod) {
        alert('Método de pago es obligatorio');
        return;
    }
    
    if (adminInvoiceItems.length === 0) {
        alert('No hay productos en la factura');
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
            alert('✅ Factura guardada exitosamente');
            newInvoice();
        })
        .catch(error => {
            console.error('Error guardando factura:', error);
            alert('Error al guardar la factura');
        });
}

function sendInvoiceToWhatsApp() {
    if (adminInvoiceItems.length === 0) {
        alert('No hay productos en la factura');
        return;
    }
    
    const clientName = document.getElementById('adminClientName').value.trim();
    const clientDoc = document.getElementById('adminClientDoc').value.trim();
    const clientPhone = document.getElementById('adminClientPhone').value.trim();
    
    if (!clientName || !clientDoc || !clientPhone) {
        alert('Completa los datos del cliente primero');
        return;
    }
    
    const storeName = localStorage.getItem('storeName') || 'Trifusion Technologies';
    const invoiceNumber = document.getElementById('adminInvoiceNumber').value || 'FAC-001';
    const subtotal = adminInvoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const applyITBIS = document.getElementById('adminApplyITBIS').checked;
    const itbis = applyITBIS ? subtotal * 0.18 : 0;
    const total = subtotal + itbis;
    
    let message = `¡Hola ${clientName}! 👋\n\nAquí está tu *FACTURA OFICIAL* de *${storeName}*\n\n📋 *DETALLE DE FACTURA:*\n\n`;
    message += `📄 *Factura No.:* ${invoiceNumber}\n`;
    message += `👤 *Cliente:* ${clientName}\n`;
    message += `🆔 *Cédula/RNC:* ${clientDoc}\n`;
    message += `📞 *Teléfono:* ${clientPhone}\n\n`;
    
    adminInvoiceItems.forEach((item, index) => {
        message += `${index + 1}. ${item.name}\n   Cantidad: ${item.quantity}\n   Precio: RD$ ${item.price.toLocaleString()}\n   Subtotal: RD$ ${item.subtotal.toLocaleString()}\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `💵 *SUBTOTAL:* RD$ ${subtotal.toLocaleString()}\n`;
    
    if (applyITBIS) {
        message += `📊 *ITBIS 18%:* RD$ ${itbis.toLocaleString()}\n`;
    }
    
    message += `💰 *TOTAL:* RD$ ${total.toLocaleString()}\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    message += `📞 Para más información:\n`;
    message += `WhatsApp: wa.me/18298725163\n\n`;
    message += `¡Gracias por tu preferencia! 🚀`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/18298725163?text=${encodedMessage}`, '_blank');
}

function printInvoiceAdmin() {
    if (adminInvoiceItems.length === 0) {
        alert('No hay productos en la factura');
        return;
    }
    
    const clientName = document.getElementById('adminClientName').value.trim();
    const clientDoc = document.getElementById('adminClientDoc').value.trim();
    const clientPhone = document.getElementById('adminClientPhone').value.trim();
    
    if (!clientName || !clientDoc || !clientPhone) {
        alert('Completa los datos del cliente primero');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Por favor permite las ventanas emergentes');
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

function newQuote() {
    if (invoiceItems.length > 0) {
        const confirmNew = confirm('¿Deseas iniciar una nueva cotización? Se perderán los productos actuales.');
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
    
    document.getElementById('shippingCostDisplay').textContent = 'RD$ 0.00';
    document.getElementById('locationButtonText').textContent = 'Compartir Ubicación';
    
    renderInvoiceProducts();
    calculateTotals();
}

async function loadRecentQuotes() {
    try {
        const snapshot = await db.collection('quotes')
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
                    <td>${data.clientId || 'N/A'}</td>
                    <td>${data.clientDoc || 'N/A'}</td>
                    <td class="text-right">RD$ ${data.total?.toLocaleString() || '0'}</td>
                    <td>${data.createdAt?.toDate().toLocaleDateString('es-DO') || 'N/A'}</td>
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
    if (!confirm('¿Eliminar esta cotización?')) return;
    
    try {
        await db.collection('quotes').doc(id).delete();
        alert('Cotización eliminada');
        loadRecentQuotes();
    } catch (error) {
        console.error('Error eliminando cotización:', error);
        alert('Error al eliminar');
    }
}

// ============================================
// CLEAR ALL QUOTES
// ============================================

async function clearAllQuotes() {
    if (!confirm('⚠️ ¿ESTÁS SEGURO DE BORRAR TODO EL HISTORIAL DE COTIZACIONES?\n\nEsta acción no se puede deshacer.')) return;
    
    try {
        const snapshot = await db.collection('quotes').get();
        const batch = db.batch();
        
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        alert('✅ Todo el historial ha sido limpiado exitosamente');
        loadRecentQuotes();
    } catch (error) {
        console.error('Error limpiando historial:', error);
        alert('Error al limpiar el historial');
    }
}

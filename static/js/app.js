/**
 * app.js - Lógica del frontend para GastoTrack
 * SPA con navegación, gráficas Chart.js y comunicación con API Flask.
 */

// ========== ESTADO GLOBAL ==========
let categorias = [];
let chartCategorias = null;
let chartMensual = null;
let reporteAnio = new Date().getFullYear();
let reporteMes = new Date().getMonth() + 1;
let deleteTargetId = null;

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    setupNavigation();
    setupMobileToggle();
    setHeaderDate();
    setDefaultDate();
    loadCategorias().then(() => {
        navigateTo('dashboard');
    });
});

// ========== NAVEGACIÓN SPA ==========
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            navigateTo(view);
        });
    });
}

function navigateTo(view) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`[data-view="${view}"]`);
    if (navItem) navItem.classList.add('active');

    // Update views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) viewEl.classList.add('active');

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');

    // Load data
    switch(view) {
        case 'dashboard': loadDashboard(); break;
        case 'transacciones': loadTransacciones(); break;
        case 'nueva': resetForm(); break;
        case 'reportes': loadReporte(); break;
    }

    lucide.createIcons();
}

function setupMobileToggle() {
    const toggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('sidebar');
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.getElementById('main-content').addEventListener('click', () => sidebar.classList.remove('open'));
}

// ========== UTILIDADES ==========
function formatMoney(amount) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function setHeaderDate() {
    const d = new Date();
    document.getElementById('header-date').textContent = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function setDefaultDate() {
    document.getElementById('form-fecha').value = new Date().toISOString().split('T')[0];
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const icon = type === 'success' ? 'check-circle' : 'alert-circle';
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => { toast.classList.add('fadeOut'); setTimeout(() => toast.remove(), 400); }, 3000);
}

async function apiFetch(url, options = {}) {
    try {
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
        return data;
    } catch (err) {
        showToast(err.message, 'error');
        throw err;
    }
}

// ========== CATEGORÍAS ==========
async function loadCategorias() {
    try {
        categorias = await apiFetch('/api/categorias');
        populateCategoriaSelects();
    } catch (e) { console.error('Error cargando categorías:', e); }
}

function populateCategoriaSelects() {
    const selects = [document.getElementById('form-categoria'), document.getElementById('filter-categoria')];
    selects.forEach(select => {
        if (!select) return;
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);
        categorias.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.nombre;
            select.appendChild(opt);
        });
    });
}

// ========== DASHBOARD ==========
async function loadDashboard() {
    try {
        const data = await apiFetch('/api/dashboard');
        
        // Update stats
        document.getElementById('stat-balance').textContent = formatMoney(data.balance);
        document.getElementById('stat-ingresos').textContent = formatMoney(data.ingresos_mes);
        document.getElementById('stat-gastos').textContent = formatMoney(data.gastos_mes);
        document.getElementById('stat-transacciones').textContent = data.transacciones_mes;

        // Charts
        renderChartCategorias(data.gastos_por_categoria);
        renderChartMensual(data.mensual);

        // Recent transactions
        renderRecentTransactions(data.ultimas_transacciones);
        
        lucide.createIcons();
    } catch (e) { console.error('Error cargando dashboard:', e); }
}

function renderChartCategorias(datos) {
    const ctx = document.getElementById('chart-categorias');
    if (chartCategorias) chartCategorias.destroy();

    const legendEl = document.getElementById('chart-categorias-legend');
    
    if (!datos || datos.length === 0) {
        chartCategorias = new Chart(ctx, { type: 'doughnut', data: { labels: ['Sin datos'], datasets: [{ data: [1], backgroundColor: ['rgba(100,116,139,0.3)'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
        legendEl.innerHTML = '<span class="legend-item" style="color:var(--text-muted)">Sin gastos este mes</span>';
        return;
    }

    chartCategorias = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: datos.map(d => d.nombre),
            datasets: [{
                data: datos.map(d => d.total),
                backgroundColor: datos.map(d => d.color),
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17,24,39,0.95)',
                    titleColor: '#f1f5f9', bodyColor: '#94a3b8',
                    borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                    padding: 12, cornerRadius: 8,
                    callbacks: { label: ctx => ` ${formatMoney(ctx.parsed)}` }
                }
            }
        }
    });

    legendEl.innerHTML = datos.map(d => `<span class="legend-item"><span class="legend-dot" style="background:${d.color}"></span>${d.nombre}</span>`).join('');
}

function renderChartMensual(datos) {
    const ctx = document.getElementById('chart-mensual');
    if (chartMensual) chartMensual.destroy();

    if (!datos || datos.length === 0) {
        chartMensual = new Chart(ctx, { type: 'bar', data: { labels: ['Sin datos'], datasets: [{ data: [0] }] }, options: { responsive: true, maintainAspectRatio: false } });
        return;
    }

    const labels = datos.map(d => { const [y, m] = d.mes.split('-'); return MESES[parseInt(m)-1]?.substring(0,3) || d.mes; });

    chartMensual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ingresos',
                    data: datos.map(d => d.ingresos),
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor: '#10b981',
                    borderWidth: 1, borderRadius: 6, borderSkipped: false
                },
                {
                    label: 'Gastos',
                    data: datos.map(d => d.gastos),
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderColor: '#ef4444',
                    borderWidth: 1, borderRadius: 6, borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b' } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', callback: v => '$' + (v/1000) + 'k' } }
            },
            plugins: {
                legend: { labels: { color: '#94a3b8', usePointStyle: true, padding: 16 } },
                tooltip: {
                    backgroundColor: 'rgba(17,24,39,0.95)',
                    titleColor: '#f1f5f9', bodyColor: '#94a3b8',
                    borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                    padding: 12, cornerRadius: 8,
                    callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}` }
                }
            }
        }
    });
}

function renderRecentTransactions(transacciones) {
    const container = document.getElementById('recent-transactions');
    if (!transacciones || transacciones.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">No hay transacciones aún</div>';
        return;
    }
    container.innerHTML = transacciones.map(t => `
        <div class="transaction-item">
            <div class="transaction-icon" style="background:${t.categoria_color || '#64748b'}">
                <i data-lucide="${t.categoria_icono || 'circle'}"></i>
            </div>
            <div class="transaction-info">
                <div class="transaction-desc">${t.descripcion || t.categoria_nombre}</div>
                <div class="transaction-meta">${t.categoria_nombre} · ${formatDate(t.fecha)}</div>
            </div>
            <div class="transaction-amount ${t.tipo}">
                ${t.tipo === 'ingreso' ? '+' : '-'}${formatMoney(t.monto)}
            </div>
        </div>
    `).join('');
}

// ========== TRANSACCIONES ==========
async function loadTransacciones() {
    try {
        const params = new URLSearchParams();
        const tipo = document.getElementById('filter-tipo').value;
        const cat = document.getElementById('filter-categoria').value;
        const fi = document.getElementById('filter-fecha-inicio').value;
        const ff = document.getElementById('filter-fecha-fin').value;
        if (tipo) params.set('tipo', tipo);
        if (cat) params.set('categoria_id', cat);
        if (fi) params.set('fecha_inicio', fi);
        if (ff) params.set('fecha_fin', ff);

        const transacciones = await apiFetch(`/api/transacciones?${params.toString()}`);
        renderTransaccionesTable(transacciones);
        lucide.createIcons();
    } catch (e) { console.error('Error cargando transacciones:', e); }
}

function renderTransaccionesTable(transacciones) {
    const tbody = document.getElementById('tbody-transacciones');
    const empty = document.getElementById('table-empty');

    if (!transacciones || transacciones.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = transacciones.map(t => `
        <tr>
            <td>${formatDate(t.fecha)}</td>
            <td><span class="type-badge ${t.tipo}">${t.tipo}</span></td>
            <td><span class="cat-badge"><span class="cat-dot" style="background:${t.categoria_color}"></span>${t.categoria_nombre}</span></td>
            <td>${t.descripcion || '—'}</td>
            <td><span class="transaction-amount ${t.tipo}">${t.tipo === 'ingreso' ? '+' : '-'}${formatMoney(t.monto)}</span></td>
            <td>
                <div class="transaction-actions">
                    <button class="btn btn-icon btn-ghost" onclick="editarTransaccion(${t.id})" title="Editar"><i data-lucide="pencil"></i></button>
                    <button class="btn btn-icon btn-ghost" onclick="confirmarEliminar(${t.id})" title="Eliminar" style="color:var(--accent-red)"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function limpiarFiltros() {
    document.getElementById('filter-tipo').value = '';
    document.getElementById('filter-categoria').value = '';
    document.getElementById('filter-fecha-inicio').value = '';
    document.getElementById('filter-fecha-fin').value = '';
    loadTransacciones();
}

// ========== FORMULARIO ==========
function resetForm() {
    document.getElementById('form-id').value = '';
    document.getElementById('form-transaccion').reset();
    document.getElementById('tipo-gasto').checked = true;
    document.getElementById('form-title').textContent = 'Nueva Transacción';
    document.getElementById('form-subtitle').textContent = 'Registra un ingreso o gasto';
    setDefaultDate();
    lucide.createIcons();
}

async function editarTransaccion(id) {
    try {
        const t = await apiFetch(`/api/transacciones?limit=100`);
        const trans = t.find(x => x.id === id);
        if (!trans) { showToast('Transacción no encontrada', 'error'); return; }

        navigateTo('nueva');
        document.getElementById('form-id').value = trans.id;
        document.getElementById('form-title').textContent = 'Editar Transacción';
        document.getElementById('form-subtitle').textContent = 'Modifica los datos de la transacción';
        document.getElementById(`tipo-${trans.tipo}`).checked = true;
        document.getElementById('form-monto').value = trans.monto;
        document.getElementById('form-fecha').value = trans.fecha;
        document.getElementById('form-categoria').value = trans.categoria_id;
        document.getElementById('form-descripcion').value = trans.descripcion || '';
        lucide.createIcons();
    } catch (e) { console.error('Error cargando transacción:', e); }
}

async function guardarTransaccion(e) {
    e.preventDefault();
    const id = document.getElementById('form-id').value;
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    const monto = parseFloat(document.getElementById('form-monto').value);
    const fecha = document.getElementById('form-fecha').value;
    const categoria_id = parseInt(document.getElementById('form-categoria').value);
    const descripcion = document.getElementById('form-descripcion').value;

    if (!tipo || !monto || !fecha || !categoria_id) {
        showToast('Completa todos los campos obligatorios', 'error');
        return;
    }

    const body = JSON.stringify({ tipo, monto, fecha, categoria_id, descripcion });

    try {
        if (id) {
            await apiFetch(`/api/transacciones/${id}`, { method: 'PUT', body });
            showToast('Transacción actualizada');
        } else {
            await apiFetch('/api/transacciones', { method: 'POST', body });
            showToast('Transacción registrada');
        }
        resetForm();
        navigateTo('transacciones');
    } catch (e) { console.error('Error guardando:', e); }
}

// ========== ELIMINAR ==========
function confirmarEliminar(id) {
    deleteTargetId = id;
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('btn-confirmar-eliminar').onclick = () => eliminarTransaccion();
    lucide.createIcons();
}

function cerrarModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    deleteTargetId = null;
}

async function eliminarTransaccion() {
    if (!deleteTargetId) return;
    try {
        await apiFetch(`/api/transacciones/${deleteTargetId}`, { method: 'DELETE' });
        showToast('Transacción eliminada');
        cerrarModal();
        loadTransacciones();
    } catch (e) { console.error('Error eliminando:', e); }
}

// ========== REPORTES ==========
function cambiarMesReporte(delta) {
    reporteMes += delta;
    if (reporteMes > 12) { reporteMes = 1; reporteAnio++; }
    if (reporteMes < 1) { reporteMes = 12; reporteAnio--; }
    loadReporte();
}

async function loadReporte() {
    document.getElementById('report-mes-label').textContent = `${MESES[reporteMes-1]} ${reporteAnio}`;
    try {
        const data = await apiFetch(`/api/reportes/mensual?anio=${reporteAnio}&mes=${reporteMes}`);
        
        document.getElementById('report-ingresos').textContent = formatMoney(data.ingresos);
        document.getElementById('report-gastos').textContent = formatMoney(data.gastos);
        document.getElementById('report-balance').textContent = formatMoney(data.balance);
        document.getElementById('report-promedio').textContent = formatMoney(data.gasto_diario_promedio);

        renderBreakdown(data.desglose, data.gastos);
        lucide.createIcons();
    } catch (e) { console.error('Error cargando reporte:', e); }
}

function renderBreakdown(desglose, totalGastos) {
    const container = document.getElementById('breakdown-list');
    const empty = document.getElementById('report-empty');

    if (!desglose || desglose.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    const maxTotal = Math.max(...desglose.map(d => d.total));
    container.innerHTML = desglose.map(d => {
        const pct = maxTotal > 0 ? (d.total / maxTotal * 100) : 0;
        return `
        <div class="breakdown-item">
            <div class="transaction-icon" style="background:${d.color};width:36px;height:36px">
                <i data-lucide="${d.icono}" style="width:16px;height:16px"></i>
            </div>
            <div class="breakdown-bar-container">
                <div class="breakdown-bar-label">
                    <span>${d.categoria}</span>
                    <span>${d.cantidad} transacción${d.cantidad > 1 ? 'es' : ''} · ${d.tipo}</span>
                </div>
                <div class="breakdown-bar">
                    <div class="breakdown-bar-fill" style="width:${pct}%;background:${d.color}"></div>
                </div>
            </div>
            <div class="breakdown-amount" style="color:${d.tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--accent-red)'}">
                ${d.tipo === 'ingreso' ? '+' : '-'}${formatMoney(d.total)}
            </div>
        </div>`;
    }).join('');
}

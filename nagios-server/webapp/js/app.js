const API_BASE = `${window.location.protocol}//${window.location.hostname}:8080/api`;
const REFRESH_INTERVAL = 30000;

let state = {
    hosts: [],
    services: [],
    templates: [],
    status: { hosts: [], services: [] },
    currentPage: 'dashboard'
};

// API Functions
const api = {
    async get(endpoint) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error(`GET ${endpoint}:`, error);
            showNotification('Error loading data', 'error');
            return null;
        }
    },

    async post(endpoint, data) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error(`POST ${endpoint}:`, error);
            showNotification('Error saving data', 'error');
            return null;
        }
    },

    async put(endpoint, data) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error(`PUT ${endpoint}:`, error);
            showNotification('Error updating data', 'error');
            return null;
        }
    },

    async delete(endpoint) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error(`DELETE ${endpoint}:`, error);
            showNotification('Error deleting data', 'error');
            return null;
        }
    }
};

// Load Data
async function loadHosts() {
    const hosts = await api.get('/hosts');
    if (hosts) {
        state.hosts = hosts;
        renderHosts();
        updateDashboard();
    }
}

async function loadServices() {
    const services = await api.get('/services');
    if (services) {
        state.services = services;
        renderServices();
        updateDashboard();
    }
}

async function loadTemplates() {
    const templates = await api.get('/templates');
    if (templates) {
        state.templates = templates;
        renderServiceCheckboxes();
    }
}

async function loadStatus() {
    const status = await api.get('/status');
    if (status) {
        state.status = status;
        updateDashboard();
    }
}

// Render Functions
function renderHosts() {
    const tbody = document.getElementById('hostsTableBody');
    if (!state.hosts || state.hosts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hosts configured</td></tr>';
        return;
    }

    tbody.innerHTML = state.hosts.map(host => {
        const hostStatus = state.status.hosts.find(h => h.name === host.hostname);
        const status = hostStatus ? getStatus(hostStatus.status) : 'unknown';
        
        return `
            <tr>
                <td><strong>${escape(host.hostname)}</strong></td>
                <td>${escape(host.ip_address)}</td>
                <td>${escape(host.alias || '-')}</td>
                <td><span class="status-badge status-${status}">${status}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editHost('${escape(host.hostname)}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteHost('${escape(host.hostname)}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderServices() {
    const tbody = document.getElementById('servicesTableBody');
    if (!state.services || state.services.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No services configured</td></tr>';
        return;
    }

    tbody.innerHTML = state.services.map(service => {
        const serviceStatus = state.status.services.find(s => 
            s.host === service.hostname && s.service === service.service_name
        );
        const status = serviceStatus ? getServiceStatus(serviceStatus.status) : 'unknown';
        
        return `
            <tr>
                <td><strong>${escape(service.hostname)}</strong></td>
                <td>${escape(service.service_name)}</td>
                <td><code>${escape(service.check_command)}</code></td>
                <td><span class="status-badge status-${status}">${status}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editService(${service.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteService(${service.id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderServiceCheckboxes() {
    const container = document.getElementById('serviceCheckboxes');
    if (!state.templates || state.templates.length === 0) {
        container.innerHTML = '<p class="text-center">No service templates available</p>';
        return;
    }

    container.innerHTML = state.templates.map(template => `
        <div class="checkbox-item">
            <input type="checkbox" id="template-${template.id}" value="${escape(template.check_command)}" 
                   data-name="${escape(template.template_name)}">
            <label for="template-${template.id}">${escape(template.template_name)}</label>
        </div>
    `).join('');
}

function updateDashboard() {
    document.getElementById('totalHosts').textContent = state.hosts.length;
    document.getElementById('totalServices').textContent = state.services.length;
    
    const healthy = state.status.hosts.filter(h => h.status === 0).length;
    document.getElementById('healthyHosts').textContent = healthy;
    
    const alerts = state.status.hosts.filter(h => h.status !== 0).length + 
                   state.status.services.filter(s => s.status !== 0).length;
    document.getElementById('alerts').textContent = alerts;
    
    updateActivity();
}

function updateActivity() {
    const container = document.getElementById('recentActivity');
    const activities = state.status.hosts.slice(0, 5).map(host => ({
        text: `Host ${host.name} is ${getStatus(host.status)}`,
        status: getStatus(host.status)
    }));
    
    if (activities.length === 0) {
        container.innerHTML = '<div class="activity-item">No recent activity</div>';
        return;
    }
    
    container.innerHTML = activities.map(a => `
        <div class="activity-item">
            <span class="status-badge status-${a.status}">${a.status}</span>
            <span>${escape(a.text)}</span>
        </div>
    `).join('');
}

// CRUD Operations
async function addHost(e) {
    e.preventDefault();
    const data = {
        hostname: document.getElementById('hostName').value,
        ip_address: document.getElementById('hostIp').value,
        alias: document.getElementById('hostAlias').value
    };
    
    const result = await api.post('/hosts', data);
    if (result && result.success) {
        showNotification('Host added successfully', 'success');
        closeModal('addHostModal');
        document.getElementById('addHostForm').reset();
        await loadHosts();
        await loadStatus();
    }
}

async function editHost(hostname) {
    const host = await api.get(`/hosts/${encodeURIComponent(hostname)}`);
    if (host) {
        document.getElementById('editHostName').value = host.hostname;
        document.getElementById('editHostIp').value = host.ip_address;
        document.getElementById('editHostAlias').value = host.alias || '';
        openModal('editHostModal');
    }
}

async function updateHost(e) {
    e.preventDefault();
    const hostname = document.getElementById('editHostName').value;
    const data = {
        ip_address: document.getElementById('editHostIp').value,
        alias: document.getElementById('editHostAlias').value
    };
    
    const result = await api.put(`/hosts/${encodeURIComponent(hostname)}`, data);
    if (result && result.success) {
        showNotification('Host updated successfully', 'success');
        closeModal('editHostModal');
        await loadHosts();
        await loadStatus();
    }
}

async function deleteHost(hostname) {
    if (!confirm(`Delete host "${hostname}"?`)) return;
    
    const result = await api.delete(`/hosts/${encodeURIComponent(hostname)}`);
    if (result && result.success) {
        showNotification('Host deleted successfully', 'success');
        await loadHosts();
        await loadServices();
        await loadStatus();
    }
}

async function addServices(e) {
    e.preventDefault();
    const hostname = document.getElementById('serviceHost').value;
    const checkboxes = document.querySelectorAll('#serviceCheckboxes input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        showNotification('Please select at least one service', 'error');
        return;
    }
    
    const services = Array.from(checkboxes).map(cb => ({
        hostname: hostname,
        service_name: cb.dataset.name,
        check_command: cb.value
    }));
    
    const result = await api.post('/services', services);
    if (result && result.success) {
        showNotification(`Added ${result.added} service(s) successfully`, 'success');
        closeModal('addServiceModal');
        document.getElementById('addServiceForm').reset();
        document.querySelectorAll('#serviceCheckboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
        await loadServices();
        await loadStatus();
    }
}

async function editService(id) {
    const service = await api.get(`/services/${id}`);
    if (service) {
        document.getElementById('editServiceId').value = service.id;
        document.getElementById('editServiceName').value = service.service_name;
        
        // Populate check command dropdown
        const select = document.getElementById('editServiceCheckCommand');
        select.innerHTML = '<option value="">Select command...</option>' +
            state.templates.map(t => 
                `<option value="${escape(t.check_command)}" ${t.check_command === service.check_command ? 'selected' : ''}>${escape(t.template_name)}</option>`
            ).join('');
        
        openModal('editServiceModal');
    }
}

async function updateService(e) {
    e.preventDefault();
    const id = document.getElementById('editServiceId').value;
    const data = {
        service_name: document.getElementById('editServiceName').value,
        check_command: document.getElementById('editServiceCheckCommand').value
    };
    
    const result = await api.put(`/services/${id}`, data);
    if (result && result.success) {
        showNotification('Service updated successfully', 'success');
        closeModal('editServiceModal');
        await loadServices();
        await loadStatus();
    }
}

async function deleteService(id) {
    if (!confirm('Delete this service?')) return;
    
    const result = await api.delete(`/services/${id}`);
    if (result && result.success) {
        showNotification('Service deleted successfully', 'success');
        await loadServices();
        await loadStatus();
    }
}

// Modal Functions
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function populateHostSelect() {
    const select = document.getElementById('serviceHost');
    select.innerHTML = '<option value="">Choose a host...</option>' +
        state.hosts.map(h => `<option value="${escape(h.hostname)}">${escape(h.hostname)}</option>`).join('');
}

// Navigation
function navigateToPage(page) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}-page`).classList.add('active');
    
    document.getElementById('pageTitle').textContent = 
        page === 'dashboard' ? 'Dashboard' : 
        page === 'hosts' ? 'Hosts' : 'Services';
    
    state.currentPage = page;
}

// Utility
function escape(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatus(code) {
    const statuses = { 0: 'ok', 1: 'warning', 2: 'critical' };
    return statuses[code] || 'unknown';
}

function getServiceStatus(code) {
    const statuses = { 0: 'ok', 1: 'warning', 2: 'critical', 3: 'unknown' };
    return statuses[code] || 'unknown';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#4f46e5'};
        color: white; border-radius: 8px; z-index: 10000;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

// Initialize
async function init() {
    // Event Listeners
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToPage(item.dataset.page);
        });
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active');
        });
    });

    document.getElementById('addHostBtn').addEventListener('click', () => {
        openModal('addHostModal');
    });

    document.getElementById('addServiceBtn').addEventListener('click', () => {
        populateHostSelect();
        openModal('addServiceModal');
    });

    document.getElementById('refreshBtn').addEventListener('click', async () => {
        showNotification('Refreshing...', 'info');
        await loadAll();
    });

    document.getElementById('addHostForm').addEventListener('submit', addHost);
    document.getElementById('editHostForm').addEventListener('submit', updateHost);
    document.getElementById('addServiceForm').addEventListener('submit', addServices);
    document.getElementById('editServiceForm').addEventListener('submit', updateService);

    // Load initial data
    await loadAll();

    // Auto-refresh
    setInterval(() => {
        if (state.currentPage === 'dashboard') {
            loadStatus();
        }
    }, REFRESH_INTERVAL);
}

async function loadAll() {
    await Promise.all([
        loadHosts(),
        loadServices(),
        loadTemplates(),
        loadStatus()
    ]);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

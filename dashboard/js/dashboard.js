const chartManager = new ChartManager();
let currentLogs = [];
let autoRefreshInterval;
const defaultRefreshRate = 30000;

// Element references
const els = {
    // Header
    healthStatus: document.getElementById('health-status'),
    statusDot: document.getElementById('status-dot'),
    lastRefresh: document.getElementById('last-refresh'),
    currentTime: document.getElementById('current-time'),
    navRefreshBtn: document.getElementById('nav-refresh-btn'),
    envBadge: document.getElementById('header-env-badge'),
    regionBadge: document.getElementById('header-region-badge'),
    viewTitle: document.getElementById('view-title'),
    
    // Notifications & Profile
    notificationsBtn: document.getElementById('nav-notifications-btn'),
    notificationCount: document.getElementById('notification-count'),
    notificationsDropdown: document.getElementById('notifications-dropdown'),
    notificationsList: document.getElementById('notifications-list'),
    clearNotificationsBtn: document.getElementById('clear-notifications'),
    profileChip: document.getElementById('profile-chip'),
    profileDropdown: document.getElementById('profile-dropdown'),
    usernameDisplay: document.getElementById('username-display'),
    dropdownUserName: document.getElementById('dropdown-user-name'),
    userAvatar: document.getElementById('user-avatar'),
    
    // Navigation items
    navDashboard: document.getElementById('nav-dashboard'),
    navExplorer: document.getElementById('nav-explorer'),
    navAlarms: document.getElementById('nav-alarms'),
    navSettings: document.getElementById('nav-settings'),
    btnDashboardViewAll: document.getElementById('btn-dashboard-view-all'),
    btnDropdownSettings: document.getElementById('btn-dropdown-settings'),
    
    // Views
    viewDashboardPanel: document.getElementById('view-dashboard-panel'),
    viewExplorerPanel: document.getElementById('view-explorer-panel'),
    viewAlarmsPanel: document.getElementById('view-alarms-panel'),
    viewSettingsPanel: document.getElementById('view-settings-panel'),
    
    // Global components
    errorPanel: document.getElementById('error-panel'),
    retryBtn: document.getElementById('retry-btn'),
    
    // KPI metrics
    kpiTotal: document.getElementById('kpi-total'),
    kpiInfo: document.getElementById('kpi-info'),
    kpiWarning: document.getElementById('kpi-warning'),
    kpiError: document.getElementById('kpi-error'),
    kpiCritical: document.getElementById('kpi-critical'),
    kpiHealth: document.getElementById('kpi-health'),
    kpiHealthDesc: document.getElementById('kpi-health-desc'),
    kpiRecentErrors: document.getElementById('kpi-recent-errors'),
    kpiAuthFailures: document.getElementById('kpi-auth-failures'),
    kpiLambda: document.getElementById('kpi-lambda'),
    kpiAlarms: document.getElementById('kpi-alarms'),
    
    // Charts
    pieCtx: document.getElementById('levelPieChart'),
    barCtx: document.getElementById('serviceBarChart'),
    timelineCtx: document.getElementById('timelineChart'),
    
    // Tables
    tableBody: document.getElementById('logs-table-body'),
    dashboardTableBody: document.getElementById('dashboard-recent-logs-body'),
    emptyState: document.getElementById('empty-state'),
    alarmsHistoryBody: document.getElementById('alarms-history-body'),
    
    // Explorer Toolbar Filters
    searchInput: document.getElementById('search-input'),
    serviceFilter: document.getElementById('service-filter'),
    levelFilter: document.getElementById('level-filter'),
    timeFilter: document.getElementById('time-filter'),
    clearFiltersBtn: document.getElementById('clear-filters-btn'),
    toolbarRefreshBtn: document.getElementById('toolbar-refresh-btn'),
    resultsCountLabel: document.getElementById('results-count-label'),
    
    // Explorer Exports
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnExportJson: document.getElementById('btn-export-json'),
    
    // Explorer Pagination
    prevPageBtn: document.getElementById('prev-page'),
    nextPageBtn: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info'),
    
    // Settings console form
    settingsRefreshEnable: document.getElementById('settings-refresh-enable'),
    settingsRefreshInterval: document.getElementById('settings-refresh-interval'),
    themeBtnDark: document.getElementById('theme-btn-dark'),
    themeBtnLight: document.getElementById('theme-btn-light'),
    
    // Settings AWS form
    settingsEnvironment: document.getElementById('settings-environment'),
    settingsRegion: document.getElementById('settings-region'),
    settingsEndpoint: document.getElementById('settings-endpoint'),
    btnSeedLogs: document.getElementById('btn-seed-logs'),
    awsSettingsForm: document.getElementById('aws-settings-form')
};

const UI_SKELETON_IDS = [
    'kpi-total', 'kpi-info', 'kpi-warning', 'kpi-error', 'kpi-critical',
    'pie-skeleton', 'bar-skeleton', 'timeline-skeleton',
    'kpi-health', 'kpi-recent-errors', 'kpi-auth-failures', 'kpi-lambda', 'kpi-alarms'
];

let state = {
    currentTab: 'dashboard',
    service: 'ALL',
    level: 'ALL',
    timeWindow: 'ALL', // ALL, 15m, 1h, 24h
    search: '',
    page: 1,
    pageSize: 10,
    notifications: [],
    alarms: [
        { name: "auth-service-critical-errors", status: "ALARM", triggers: 1, active: true },
        { name: "payment-service-failure-rate", status: "OK", triggers: 0, active: true },
        { name: "inventory-service-db-timeout", status: "OK", triggers: 0, active: true },
        { name: "sqs-ingestion-backlog", status: "OK", triggers: 0, active: true }
    ],
    alarmHistory: [
        { timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), name: "auth-service-critical-errors", transition: "OK → ALARM", message: "Sum > 0 critical events matching count: 3" },
        { timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), name: "sqs-ingestion-backlog", transition: "ALARM → OK", message: "Queue backlog dropped below threshold count: 480" }
    ]
};

// Clock
setInterval(() => {
    if (els.currentTime) {
        els.currentTime.textContent = new Date().toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }
}, 1000);

// Switch SPA tab views
function switchTab(tabId) {
    state.currentTab = tabId;
    
    // Manage sidebar active styles
    [els.navDashboard, els.navExplorer, els.navAlarms, els.navSettings].forEach(nav => {
        if (nav) nav.classList.remove('active');
    });
    
    // Manage panels visibility
    [els.viewDashboardPanel, els.viewExplorerPanel, els.viewAlarmsPanel, els.viewSettingsPanel].forEach(panel => {
        if (panel) panel.classList.add('hidden');
    });
    
    // Update active visual elements
    if (tabId === 'dashboard') {
        els.navDashboard.classList.add('active');
        els.viewDashboardPanel.classList.remove('hidden');
        els.viewTitle.textContent = "Dashboard Overview";
        // Re-render dashboard components to update chart layouts correctly
        updateDashboard();
    } else if (tabId === 'explorer') {
        els.navExplorer.classList.add('active');
        els.viewExplorerPanel.classList.remove('hidden');
        els.viewTitle.textContent = "Log Explorer";
        updateDashboard();
    } else if (tabId === 'alarms') {
        els.navAlarms.classList.add('active');
        els.viewAlarmsPanel.classList.remove('hidden');
        els.viewTitle.textContent = "Alarms Configuration";
        renderAlarms();
    } else if (tabId === 'settings') {
        els.navSettings.classList.add('active');
        els.viewSettingsPanel.classList.remove('hidden');
        els.viewTitle.textContent = "System Settings";
        loadSettingsForm();
    }
    
    // Hide dropdowns on tab switch
    els.profileDropdown.classList.add('hidden');
    els.notificationsDropdown.classList.add('hidden');
    
    // Scroll content top
    window.scrollTo(0, 0);
}

// Listen to Tab Navigation
els.navDashboard.addEventListener('click', () => switchTab('dashboard'));
els.navExplorer.addEventListener('click', () => switchTab('explorer'));
els.navAlarms.addEventListener('click', () => switchTab('alarms'));
els.navSettings.addEventListener('click', () => switchTab('settings'));
if (els.btnDashboardViewAll) {
    els.btnDashboardViewAll.addEventListener('click', () => switchTab('explorer'));
}
if (els.btnDropdownSettings) {
    els.btnDropdownSettings.addEventListener('click', () => switchTab('settings'));
}

// Theme management (Dark vs Light)
function initTheme() {
    const activeTheme = localStorage.getItem('cloudpulse_theme') || 'dark';
    if (activeTheme === 'light') {
        document.body.classList.add('light-theme');
        els.themeBtnDark.classList.remove('active');
        els.themeBtnLight.classList.add('active');
    } else {
        document.body.classList.remove('light-theme');
        els.themeBtnLight.classList.remove('active');
        els.themeBtnDark.classList.add('active');
    }
}

els.themeBtnDark.addEventListener('click', () => {
    localStorage.setItem('cloudpulse_theme', 'dark');
    document.body.classList.remove('light-theme');
    els.themeBtnLight.classList.remove('active');
    els.themeBtnDark.classList.add('active');
    updateDashboard();
});

els.themeBtnLight.addEventListener('click', () => {
    localStorage.setItem('cloudpulse_theme', 'light');
    document.body.classList.add('light-theme');
    els.themeBtnDark.classList.remove('active');
    els.themeBtnLight.classList.add('active');
    updateDashboard();
});

// Dropdowns logic (Profile + Notifications)
els.profileChip.addEventListener('click', (e) => {
    e.stopPropagation();
    els.profileDropdown.classList.toggle('hidden');
    els.notificationsDropdown.classList.add('hidden');
});

els.notificationsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    els.notificationsDropdown.classList.toggle('hidden');
    els.profileDropdown.classList.add('hidden');
});

document.addEventListener('click', () => {
    els.profileDropdown.classList.add('hidden');
    els.notificationsDropdown.classList.add('hidden');
});

els.profileDropdown.addEventListener('click', (e) => e.stopPropagation());
els.notificationsDropdown.addEventListener('click', (e) => e.stopPropagation());

els.clearNotificationsBtn.addEventListener('click', () => {
    state.notifications = [];
    updateNotificationsUI();
});

function addNotification(title, message, isAlert = false) {
    state.notifications.unshift({
        id: Math.random().toString(36).substr(2, 9),
        title,
        message,
        timestamp: new Date().toISOString(),
        unread: true,
        alert: isAlert
    });
    updateNotificationsUI();
}

function updateNotificationsUI() {
    const list = els.notificationsList;
    const countBadge = els.notificationCount;
    list.innerHTML = '';
    
    const unreadCount = state.notifications.filter(n => n.unread).length;
    if (unreadCount > 0) {
        countBadge.textContent = unreadCount;
        countBadge.classList.remove('hidden');
    } else {
        countBadge.classList.add('hidden');
    }
    
    if (state.notifications.length === 0) {
        list.innerHTML = '<div class="notification-empty">No active notifications</div>';
        return;
    }
    
    state.notifications.slice(0, 5).forEach(n => {
        const item = document.createElement('div');
        item.className = `notification-item ${n.unread ? 'unread' : ''}`;
        const timeStr = new Date(n.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        
        item.innerHTML = `
            <div class="notification-item-header">
                <span class="notification-title">${n.title}</span>
                <span class="notification-time">${timeStr}</span>
            </div>
            <div>${n.message}</div>
        `;
        
        item.addEventListener('click', () => {
            n.unread = false;
            updateNotificationsUI();
        });
        
        list.appendChild(item);
    });
}

// Health Check Endpoint
async function checkHealth() {
    try {
        const health = await ApiClient.getHealth();
        if (health.api_status === 'healthy' || health.status === 'healthy') {
            els.healthStatus.textContent = 'Healthy';
            els.statusDot.className = 'status-dot healthy';
            els.errorPanel.classList.add('hidden');
            
            if (els.kpiHealth) {
                els.kpiHealth.classList.remove('skeleton-text');
                els.kpiHealth.textContent = '100% OK';
                els.kpiHealth.style.color = 'var(--color-success)';
                els.kpiHealthDesc.textContent = `API: ${health.api_status || 'OK'} | DB: ${health.database_status || 'OK'}`;
                
                els.kpiLambda.classList.remove('skeleton-text');
                els.kpiLambda.textContent = 'Online';
                
                els.kpiAlarms.classList.remove('skeleton-text');
                const triggerCount = state.alarms.filter(a => a.status === 'ALARM' && a.active).length;
                els.kpiAlarms.textContent = triggerCount > 0 ? `${triggerCount} ALARM` : 'OK';
                els.kpiAlarms.style.color = triggerCount > 0 ? 'var(--color-danger)' : 'var(--color-success)';
            }
        }
    } catch (e) {
        els.healthStatus.textContent = 'Offline';
        els.statusDot.className = 'status-dot offline';
        els.errorPanel.classList.remove('hidden');
        
        if (els.kpiHealth) {
            els.kpiHealth.classList.remove('skeleton-text');
            els.kpiHealth.textContent = 'Degraded';
            els.kpiHealth.style.color = 'var(--color-danger)';
            els.kpiHealthDesc.textContent = "API gateway connectivity failed";
            
            els.kpiLambda.classList.remove('skeleton-text');
            els.kpiLambda.textContent = 'Offline';
            
            els.kpiAlarms.classList.remove('skeleton-text');
            els.kpiAlarms.textContent = 'Degraded';
            els.kpiAlarms.style.color = 'var(--color-danger)';
        }
    }
}

// Fetch logs
async function loadData() {
    Utils.showSkeletons(UI_SKELETON_IDS);
    els.navRefreshBtn.disabled = true;
    els.toolbarRefreshBtn.disabled = true;
    
    // Loading rows skeleton
    els.tableBody.innerHTML = Array(5).fill(Utils.createTableSkeletonRow()).join('');
    els.dashboardTableBody.innerHTML = Array(3).fill(Utils.createTableSkeletonRow()).join('');
    els.emptyState.classList.add('hidden');
    
    try {
        const res = await ApiClient.getLogs(100);
        currentLogs = res.logs || [];
        state.page = 1;
        updateDashboard();
        
        // Push warning/errors to notification list if new
        const criticalLogs = currentLogs.filter(l => l.level === 'CRITICAL' || l.level === 'ERROR').slice(0, 3);
        criticalLogs.forEach(l => {
            const exists = state.notifications.some(n => n.message.includes(l.request_id));
            if (!exists) {
                addNotification(
                    `Critical Event on ${l.service_name}`,
                    `[${l.level}] ${l.message} (Req: ${l.request_id})`,
                    true
                );
            }
        });

        els.lastRefresh.textContent = `Last refresh: ${new Date().toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        })}`;
        els.errorPanel.classList.add('hidden');
    } catch (error) {
        els.errorPanel.classList.remove('hidden');
        els.tableBody.innerHTML = '';
        els.dashboardTableBody.innerHTML = '';
        chartManager.destroyAll();
    } finally {
        Utils.hideSkeletons(UI_SKELETON_IDS);
        els.navRefreshBtn.disabled = false;
        els.toolbarRefreshBtn.disabled = false;
    }
}

// Get Logs filtering client-side
function getFilteredLogs() {
    return currentLogs.filter(log => {
        const matchesService = state.service === 'ALL' || log.service_name === state.service;
        const matchesLevel = state.level === 'ALL' || log.level === state.level;
        
        // Time Filter logic
        let matchesTime = true;
        if (state.timeWindow !== 'ALL') {
            const logTime = new Date(log.timestamp).getTime();
            const now = Date.now();
            if (state.timeWindow === '15m') {
                matchesTime = (now - logTime) <= 15 * 60 * 1000;
            } else if (state.timeWindow === '1h') {
                matchesTime = (now - logTime) <= 60 * 60 * 1000;
            } else if (state.timeWindow === '24h') {
                matchesTime = (now - logTime) <= 24 * 60 * 60 * 1000;
            }
        }
        
        const term = state.search.toLowerCase();
        const matchesSearch = !term || 
            (log.message || '').toLowerCase().includes(term) ||
            (log.request_id || '').toLowerCase().includes(term);
            
        return matchesService && matchesLevel && matchesTime && matchesSearch;
    });
}

function updateDashboard() {
    const filteredLogs = getFilteredLogs();

    // KPI counts
    const counts = { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 };
    filteredLogs.forEach(l => {
        if (counts[l.level] !== undefined) counts[l.level]++;
    });

    els.kpiTotal.textContent = filteredLogs.length;
    els.kpiInfo.textContent = counts.INFO;
    els.kpiWarning.textContent = counts.WARNING;
    els.kpiError.textContent = counts.ERROR;
    els.kpiCritical.textContent = counts.CRITICAL;
    
    if (els.kpiRecentErrors) {
        els.kpiRecentErrors.textContent = counts.ERROR + counts.CRITICAL;
    }
    if (els.kpiAuthFailures) {
        // Count mock access/login logs that contain "auth-service" or authorization issues
        const authFails = filteredLogs.filter(l => l.service_name === 'auth-service' && (l.level === 'ERROR' || l.level === 'WARNING')).length;
        els.kpiAuthFailures.textContent = authFails;
    }
    
    // Render Charts
    chartManager.renderPieChart(els.pieCtx, filteredLogs);
    chartManager.renderBarChart(els.barCtx, filteredLogs);
    chartManager.renderTimelineChart(els.timelineCtx, filteredLogs);

    // Update Results label count
    if (els.resultsCountLabel) {
        els.resultsCountLabel.textContent = `Showing ${filteredLogs.length} matching events`;
    }

    // Render Dashboard Overview Table (Recent 10 logs)
    renderDashboardTable(filteredLogs);

    // Render Log Explorer Tab Table (Paginated)
    renderExplorerTable(filteredLogs);
}

// Mini table on dashboard
function renderDashboardTable(logs) {
    els.dashboardTableBody.innerHTML = '';
    const recent = logs.slice(0, 10);
    
    if (recent.length === 0) {
        els.dashboardTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No logs ingested</td></tr>`;
        return;
    }
    
    recent.forEach(log => {
        const tr = document.createElement('tr');
        const reqId = log.request_id || '-';
        tr.innerHTML = `
            <td>${Utils.formatDate(log.timestamp)}</td>
            <td>${log.service_name || '-'}</td>
            <td>${Utils.createBadge(log.level)}</td>
            <td>${log.message || '-'}</td>
            <td class="td-id">
                <span>${reqId}</span>
                ${reqId !== '-' ? `<button class="copy-btn" onclick="Utils.copyToClipboard('${reqId}')" title="Copy Request ID">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>` : ''}
            </td>
        `;
        els.dashboardTableBody.appendChild(tr);
    });
}

// Full paginated table inside Explorer view
function renderExplorerTable(filteredLogs) {
    els.tableBody.innerHTML = '';
    
    const totalPages = Math.ceil(filteredLogs.length / state.pageSize) || 1;
    if (state.page > totalPages) state.page = totalPages;
    
    els.pageInfo.textContent = `Page ${state.page} of ${totalPages}`;
    els.prevPageBtn.disabled = state.page === 1;
    els.nextPageBtn.disabled = state.page === totalPages;

    if (filteredLogs.length === 0) {
        els.emptyState.classList.remove('hidden');
    } else {
        els.emptyState.classList.add('hidden');
        
        const start = (state.page - 1) * state.pageSize;
        const end = start + state.pageSize;
        const pageLogs = filteredLogs.slice(start, end);
        
        pageLogs.forEach(log => {
            const tr = document.createElement('tr');
            
            const reqId = log.request_id || '-';
            const displayId = Utils.highlightText(reqId, state.search);
            const msg = Utils.highlightText(log.message || '-', state.search);
            
            tr.innerHTML = `
                <td>${Utils.formatDate(log.timestamp)}</td>
                <td>${log.service_name || '-'}</td>
                <td>${Utils.createBadge(log.level)}</td>
                <td>${msg}</td>
                <td class="td-id">
                    ${displayId}
                    ${reqId !== '-' ? `<button class="copy-btn" onclick="Utils.copyToClipboard('${reqId}')" title="Copy Request ID">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>` : ''}
                </td>
            `;
            els.tableBody.appendChild(tr);
        });
    }
}

// Alarms Page Render
function renderAlarms() {
    const countActive = state.alarms.filter(a => a.status === 'ALARM' && a.active).length;
    const countOk = state.alarms.filter(a => a.status === 'OK' && a.active).length;
    
    document.getElementById('alarm-count-active').textContent = countActive;
    document.getElementById('alarm-count-ok').textContent = countOk;
    document.getElementById('alarm-count-total').textContent = state.alarms.length;

    // Transition history render
    const historyBody = els.alarmsHistoryBody;
    historyBody.innerHTML = '';
    
    state.alarmHistory.forEach(h => {
        const tr = document.createElement('tr');
        const badgeClass = h.transition.includes('ALARM') ? 'badge-error' : 'badge-info';
        
        tr.innerHTML = `
            <td>${Utils.formatDate(h.timestamp)}</td>
            <td><strong>${h.name}</strong></td>
            <td><span class="badge ${badgeClass}">${h.transition}</span></td>
            <td>${h.message}</td>
        `;
        historyBody.appendChild(tr);
    });

    // Listen to switch toggles
    const toggles = document.querySelectorAll('.alarm-toggle-checkbox');
    toggles.forEach((t, i) => {
        t.checked = state.alarms[i].active;
        t.onchange = (e) => {
            state.alarms[i].active = e.target.checked;
            addNotification(
                `Alarm Config Updated`,
                `Alarm ${state.alarms[i].name} has been ${state.alarms[i].active ? 'ENABLED' : 'DISABLED'}.`
            );
            renderAlarms();
            checkHealth();
        };
    });
}

// Load Settings configuration
function loadSettingsForm() {
    const refreshEnable = localStorage.getItem('cloudpulse_refresh_enable') !== 'false';
    const refreshInterval = localStorage.getItem('cloudpulse_refresh_rate') || '30000';
    const currentEnv = localStorage.getItem('cloudpulse_env') || 'DEV';
    const currentRegion = localStorage.getItem('cloudpulse_region') || 'ap-south-1';
    const currentEndpoint = localStorage.getItem('cloudpulse_endpoint') || 'http://localhost:3000';

    els.settingsRefreshEnable.checked = refreshEnable;
    els.settingsRefreshInterval.value = refreshInterval;
    els.settingsEnvironment.value = currentEnv;
    els.settingsRegion.value = currentRegion;
    els.settingsEndpoint.value = currentEndpoint;
}

// Console preferences change logic
els.settingsRefreshEnable.addEventListener('change', (e) => {
    localStorage.setItem('cloudpulse_refresh_enable', e.target.checked);
    setupAutoRefresh();
});

els.settingsRefreshInterval.addEventListener('change', (e) => {
    localStorage.setItem('cloudpulse_refresh_rate', e.target.value);
    setupAutoRefresh();
});

// AWS Config Submission
els.awsSettingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const envVal = els.settingsEnvironment.value;
    const regionVal = els.settingsRegion.value.trim();
    const endpointVal = els.settingsEndpoint.value.trim();

    localStorage.setItem('cloudpulse_env', envVal);
    localStorage.setItem('cloudpulse_region', regionVal);
    localStorage.setItem('cloudpulse_endpoint', endpointVal);
    
    // Apply changes immediately
    els.envBadge.textContent = envVal;
    els.regionBadge.textContent = regionVal;
    API_BASE_URL = endpointVal;

    addNotification("Settings Saved", "System configuration overrides applied successfully.");
    alert("Configurations saved!");
});

// Simulate Telemetry Surge (Insert random logs client side)
els.btnSeedLogs.addEventListener('click', () => {
    const services = ['payment-service', 'inventory-service', 'order-service', 'auth-service', 'user-service'];
    const messages = {
        'CRITICAL': [
            'Out of memory exception in JVM heap space.',
            'Database connection pool exhausted. Failed to acquire connection after 30000ms.',
            'Fatal: AWS KMS decryption failed. Unrecoverable credentials error.'
        ],
        'ERROR': [
            'Payment processing timeout from external gateway provider.',
            'Failed to read inventory cache key: "item_inventory_stock_988".',
            'Unauthorized attempt on auth session storage.'
        ],
        'WARNING': [
            'Slow HTTP response: GET /orders took 1280ms (threshold 500ms).',
            'SQS queue backlog exceeds threshold limit of 800 items.',
            'Authorizer credential token is nearing expiry (expires in 120s).'
        ],
        'INFO': [
            'Successfully parsed auth credentials for session token.',
            'Logs ingestion complete. Processed batch of 24 records.',
            'Heartbeat telemetry check completed.'
        ]
    };
    const levels = ['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'INFO'];
    
    const seeded = [];
    for (let i = 0; i < 12; i++) {
        const lv = levels[Math.floor(Math.random() * levels.length)];
        const svc = services[Math.floor(Math.random() * services.length)];
        const msgList = messages[lv];
        const msgText = msgList[Math.floor(Math.random() * msgList.length)];
        
        seeded.push({
            timestamp: new Date(Date.now() - i * 15000).toISOString(),
            service_name: svc,
            level: lv,
            message: msgText,
            request_id: 'seed-' + Math.random().toString(36).substr(2, 9)
        });
    }

    currentLogs = [...seeded, ...currentLogs];
    updateDashboard();

    // Trigger an alarm event if critical/error count increases
    const criticalSurge = seeded.find(s => s.level === 'CRITICAL');
    if (criticalSurge) {
        state.alarms[0].status = 'ALARM';
        state.alarms[0].triggers++;
        state.alarmHistory.unshift({
            timestamp: new Date().toISOString(),
            name: "auth-service-critical-errors",
            transition: "OK → ALARM",
            message: `Telemetry surge: Critical event found - "${criticalSurge.message}"`
        });
        addNotification("ALERT: auth-service-critical-errors", criticalSurge.message, true);
    }

    addNotification("Telemetry Surge Simulated", `Seeded 12 random serverless event logs successfully.`);
    alert("Surge logs injected! Check the Dashboard/Explorer.");
});

// Logs Export
function exportLogs(format) {
    const logs = getFilteredLogs();
    if (logs.length === 0) {
        alert("No logs to export!");
        return;
    }

    let fileContent = '';
    let mimeType = 'text/plain';
    let extension = 'txt';

    if (format === 'csv') {
        mimeType = 'text/csv';
        extension = 'csv';
        const headers = ['Timestamp', 'Service', 'Severity', 'Message', 'Request ID'];
        const rows = logs.map(l => [
            l.timestamp,
            l.service_name || '',
            l.level,
            `"${(l.message || '').replace(/"/g, '""')}"`,
            l.request_id || ''
        ]);
        fileContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (format === 'json') {
        mimeType = 'application/json';
        extension = 'json';
        fileContent = JSON.stringify(logs, null, 2);
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudpulse_logs_export_${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

els.btnExportCsv.addEventListener('click', () => exportLogs('csv'));
els.btnExportJson.addEventListener('click', () => exportLogs('json'));

// Filters listeners
els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    state.page = 1;
    updateDashboard();
});

els.serviceFilter.addEventListener('change', (e) => {
    state.service = e.target.value;
    state.page = 1;
    updateDashboard();
});

els.levelFilter.addEventListener('change', (e) => {
    state.level = e.target.value;
    state.page = 1;
    updateDashboard();
});

els.timeFilter.addEventListener('change', (e) => {
    state.timeWindow = e.target.value;
    state.page = 1;
    updateDashboard();
});

els.clearFiltersBtn.addEventListener('click', () => {
    state.service = 'ALL';
    state.level = 'ALL';
    state.timeWindow = 'ALL';
    state.search = '';
    state.page = 1;
    els.serviceFilter.value = 'ALL';
    els.levelFilter.value = 'ALL';
    els.timeFilter.value = 'ALL';
    els.searchInput.value = '';
    updateDashboard();
});

// Pagination handlers
els.prevPageBtn.addEventListener('click', () => {
    if (state.page > 1) {
        state.page--;
        updateDashboard();
    }
});

els.nextPageBtn.addEventListener('click', () => {
    state.page++;
    updateDashboard();
});

// Sidebar Collapsible Toggle
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const toggleIcon = document.getElementById('toggle-icon');

if (sidebar && sidebarToggle) {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        if (toggleIcon) {
            toggleIcon.innerHTML = `
                <polyline points="13 17 18 12 13 7"/>
                <polyline points="6 17 11 12 6 7"/>
            `;
        }
    }
    
    sidebarToggle.addEventListener('click', () => {
        const collapsed = sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar_collapsed', collapsed);
        
        if (toggleIcon) {
            if (collapsed) {
                toggleIcon.innerHTML = `
                    <polyline points="13 17 18 12 13 7"/>
                    <polyline points="6 17 11 12 6 7"/>
                `;
            } else {
                toggleIcon.innerHTML = `
                    <polyline points="11 17 6 12 11 7"/>
                    <polyline points="18 17 13 12 18 7"/>
                `;
            }
        }
    });
}

// Mobile Toggle Overlay Handler
const mobileToggle = document.getElementById('mobile-toggle');
if (sidebar && mobileToggle) {
    mobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('mobile-open');
    });
    
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target)) {
            sidebar.classList.remove('mobile-open');
        }
    });
}

// Handle Auto refresh setup
function setupAutoRefresh() {
    clearInterval(autoRefreshInterval);
    const refreshEnable = localStorage.getItem('cloudpulse_refresh_enable') !== 'false';
    const refreshRate = parseInt(localStorage.getItem('cloudpulse_refresh_rate') || defaultRefreshRate);

    if (refreshEnable) {
        autoRefreshInterval = setInterval(() => {
            if (!checkAuth()) {
                clearInterval(autoRefreshInterval);
                return;
            }
            checkHealth();
            loadData();
        }, refreshRate);
    }
}

// Check Auth validity
function checkAuth() {
    const token = localStorage.getItem('cloudpulse_jwt');
    const expiry = localStorage.getItem('cloudpulse_jwt_expiry');
    
    if (!token || !expiry || Date.now() >= parseInt(expiry)) {
        localStorage.removeItem('cloudpulse_jwt');
        localStorage.removeItem('cloudpulse_jwt_expiry');
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Logout event
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('cloudpulse_jwt');
        localStorage.removeItem('cloudpulse_jwt_expiry');
        localStorage.removeItem('cloudpulse_username');
        window.location.href = 'login.html';
    });
}

// Global Refresh handler
const handleRefresh = () => { checkHealth(); loadData(); };
els.navRefreshBtn.addEventListener('click', handleRefresh);
els.toolbarRefreshBtn.addEventListener('click', handleRefresh);
els.retryBtn.addEventListener('click', handleRefresh);

// Initializer
function init() {
    if (!checkAuth()) return;
    
    // Setup initial username from localStorage
    const savedUser = localStorage.getItem('cloudpulse_username') || 'Admin';
    els.usernameDisplay.textContent = savedUser;
    els.dropdownUserName.textContent = savedUser;
    els.userAvatar.textContent = savedUser.charAt(0).toUpperCase();

    // Set static header badges
    els.envBadge.textContent = localStorage.getItem('cloudpulse_env') || 'DEV';
    els.regionBadge.textContent = localStorage.getItem('cloudpulse_region') || 'ap-south-1';

    // Clock init
    els.currentTime.textContent = new Date().toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    initTheme();
    checkHealth();
    loadData();
    setupAutoRefresh();
}

document.addEventListener('DOMContentLoaded', init);

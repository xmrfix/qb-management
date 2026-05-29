/* ==========================================================================
           CORE APPLICATION LOGIC (Vanilla JS)
           ========================================================================== */
        
        const NUI_RESOURCE_NAME = window.GetParentResourceName ? window.GetParentResourceName() : 'qb-bossmenu';

        const app = {
            state: {
                job: { name: 'police', label: 'Police Dept', bossName: 'Unknown', balance: 0 },
                employees: [],
                transactions: [],
                nearbyPlayers: [],
                currentPage: 'dashboard',
                selectedEmployeeId: null,
                actionType: null, // 'deposit' or 'withdraw'
                chartFilter: 'week'
            },

            // --- NUI Communication ---
            async fetchNUI(eventName, data = {}) {
                try {
                    const resp = await fetch(`https://${NUI_RESOURCE_NAME}/${eventName}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    return await resp.json();
                } catch (e) {
                    // Fallback for browser testing
                    console.warn(`[NUI Mock] ${eventName} called with:`, data);
                    return { success: true }; 
                }
            },

            // --- Initialization & Event Listeners ---
            init() {
                this.initTheme(); // Initialize saved theme

                // Navigation
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        const target = e.currentTarget.dataset.target;
                        this.navigate(target);
                    });
                });

                // Search
                document.getElementById('search-employee').addEventListener('input', (e) => {
                    this.renderEmployees(e.target.value);
                });

                // Esc to close
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') this.closeDashboard();
                });

                // Theme Toggle
                document.getElementById('theme-toggle').addEventListener('click', () => {
                    this.toggleTheme();
                });

                // Listen for FiveM NUI messages
                window.addEventListener('message', (event) => {
                    const data = event.data;
                    switch (data.action) {
                        case 'open':
                            this.openDashboard(data.data);
                            break;
                        case 'close':
                            this.closeDashboard();
                            break;
                        case 'updateBalance':
                            this.updateBalance(data.balance);
                            break;
                        case 'refreshEmployees':
                            this.state.employees = data.employees;
                            if (this.state.currentPage === 'employees') this.renderEmployees();
                            this.updateStats();
                            break;
                    }
                });

                // Expose modal handlers for HTML inline onclick
                window.app = this;
            },

            // --- Theme Logic ---
            initTheme() {
                const savedTheme = localStorage.getItem('bossMenuTheme');
                if (savedTheme === 'light') {
                    document.body.classList.add('light-mode');
                    document.querySelector('#theme-toggle i').className = 'fa-solid fa-moon';
                }
            },

            toggleTheme() {
                const body = document.body;
                body.classList.toggle('light-mode');
                const isLight = body.classList.contains('light-mode');
                
                // Swap sun/moon icon
                const toggleBtnIcon = document.querySelector('#theme-toggle i');
                toggleBtnIcon.className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
                
                // Persist choice
                localStorage.setItem('bossMenuTheme', isLight ? 'light' : 'dark');
            },

            // --- Core UI Functions ---
            openDashboard(data = null) {
                if (data) {
                    this.state.job = data.job || this.state.job;
                    this.state.employees = data.employees || [];
                    this.state.transactions = data.transactions || [];
                    this.state.nearbyPlayers = data.nearbyPlayers || [];
                    
                    // Update Headers
                    document.getElementById('ui-job-name').innerText = this.state.job.label;
                    document.getElementById('ui-boss-name').innerText = this.state.job.bossName;
                    
                    this.updateBalance(this.state.job.balance);
                    this.updateStats();
                }

                document.body.classList.add('show');
                this.navigate('dashboard');
                
                // Animate Counters
                setTimeout(() => this.animateCounters(), 300);
            },

            closeDashboard() {
                document.body.classList.remove('show');
                setTimeout(() => {
                    this.fetchNUI('closeUI');
                }, 400); // Wait for transition
            },

            navigate(pageId) {
                // Update Nav UI
                document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
                const activeNav = document.querySelector(`.nav-item[data-target="${pageId}"]`);
                if(activeNav) activeNav.classList.add('active');

                // Update Page UI
                document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
                document.getElementById(`page-${pageId}`).classList.add('active');

                this.state.currentPage = pageId;

                // Page Specific logic
                if (pageId === 'employees') this.renderEmployees();
                if (pageId === 'transactions') this.renderTransactions();
                if (pageId === 'recruitment') this.renderRecruitment();
                if (pageId === 'dashboard') {
                    this.renderRecentTransactions();
                    this.animateCounters();
                }
                if (pageId === 'funds') {
                    this.animateCounters();
                }
            },

            setChartFilter(value, text, event) {
                if(event) {
                    event.stopPropagation();
                    const options = event.target.parentElement.querySelectorAll('.dropdown-option');
                    options.forEach(opt => opt.classList.remove('selected'));
                    event.target.classList.add('selected');
                }
                
                this.state.chartFilter = value;
                document.getElementById('chartTimeSelected').innerText = text;
                document.getElementById('chartTimeDropdown').classList.remove('open');
                this.renderCharts();
            },


            updateBalance(amount) {
                this.state.job.balance = amount;
                
                const elements = ['ui-header-balance', 'stat-balance', 'funds-page-balance'];
                elements.forEach(id => {
                    const el = document.getElementById(id);
                    if(el) {
                        el.dataset.target = amount;
                        // re-animate if already open
                        if(document.body.classList.contains('show')) {
                           this.animateValue(el, 0, amount, 1000);
                        }
                    }
                });
            },

            updateStats() {
                const total = this.state.employees.length;
                const active = this.state.employees.filter(e => e.isOnline).length;
                const txToday = this.state.transactions.filter(t => this.isToday(new Date(t.date))).length;

                document.getElementById('stat-total-emp').dataset.target = total;
                document.getElementById('stat-active-emp').dataset.target = active;
                document.getElementById('stat-transactions').dataset.target = txToday;

                // Funds page stats
                let totalInput = 0;
                let totalOutput = 0;
                this.state.transactions.forEach(tx => {
                    if (tx.type === 'deposit') totalInput += tx.amount;
                    if (tx.type === 'withdraw') totalOutput += tx.amount;
                });

                const statInputEl = document.getElementById('stat-total-input');
                const statOutputEl = document.getElementById('stat-total-output');
                if(statInputEl) {
                    statInputEl.dataset.target = totalInput;
                }
                if(statOutputEl) {
                    statOutputEl.dataset.target = totalOutput;
                }

                if (document.getElementById('chart-income')) {
                    this.renderCharts();
                }
            },

            // --- Rendering Functions ---
            renderEmployees(filter = '') {
                const tbody = document.querySelector('#employees-table tbody');
                tbody.innerHTML = '';
                
                const filtered = this.state.employees.filter(e => 
                    e.name.toLowerCase().includes(filter.toLowerCase()) || 
                    e.cid.toLowerCase().includes(filter.toLowerCase())
                );

                if (filtered.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No employees found.</td></tr>`;
                    return;
                }

                filtered.forEach(emp => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>
                            <div class="d-flex align-center">
                                <span class="status-dot ${emp.isOnline ? 'status-online' : 'status-offline'}"></span>
                                ${emp.isOnline ? 'Online' : 'Offline'}
                            </div>
                        </td>
                        <td style="font-weight: 500;">${emp.name}</td>
                        <td style="color: var(--text-secondary);">${emp.cid}</td>
                        <td><span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-size: 12px;">${emp.grade.name} (${emp.grade.level})</span></td>
                        <td>
                            <div class="action-group" style="justify-content: flex-end;">
                                <button class="btn btn-outline btn-icon" onclick="app.viewEmployeeProfile('${emp.cid}')" title="Profile">
                                    <i class="fa-solid fa-id-card"></i>
                                </button>
                                <button class="btn btn-outline btn-icon" style="color: var(--success); border-color: rgba(16, 185, 129, 0.3);" onclick="app.promoteEmployee('${emp.cid}')" title="Promote">
                                    <i class="fa-solid fa-arrow-up"></i>
                                </button>
                                <button class="btn btn-outline btn-icon" style="color: var(--warning); border-color: rgba(245, 158, 11, 0.3);" onclick="app.demoteEmployee('${emp.cid}')" title="Demote">
                                    <i class="fa-solid fa-arrow-down"></i>
                                </button>
                                <button class="btn btn-outline btn-icon" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.3);" onclick="app.promptFireEmployee('${emp.cid}')" title="Fire">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            },

            renderRecentTransactions() {
                const tbody = document.querySelector('#recent-transactions-table tbody');
                tbody.innerHTML = '';
                
                // Get last 5
                const recent = [...this.state.transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
                
                if (recent.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No recent transactions.</td></tr>`;
                    return;
                }

                recent.forEach(tx => {
                    const isDeposit = tx.type === 'deposit';
                    const colorClass = isDeposit ? 'text-success' : 'text-danger';
                    const sign = isDeposit ? '+' : '-';
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="color: var(--text-secondary);">${this.formatDate(tx.date)}</td>
                        <td><span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: capitalize;">${tx.type}</span></td>
                        <td class="${colorClass}" style="font-weight: 600;">${sign}$${tx.amount.toLocaleString()}</td>
                        <td>${tx.description || '-'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            },

            renderTransactions() {
                const tbody = document.querySelector('#full-transactions-table tbody');
                tbody.innerHTML = '';
                
                const sorted = [...this.state.transactions].sort((a,b) => new Date(b.date) - new Date(a.date));

                if (sorted.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No transactions found.</td></tr>`;
                    return;
                }

                sorted.forEach(tx => {
                    const isDeposit = tx.type === 'deposit';
                    const colorClass = isDeposit ? 'text-success' : 'text-danger';
                    const sign = isDeposit ? '+' : '-';
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="color: var(--text-secondary);">${this.formatDateFull(tx.date)}</td>
                        <td><span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: capitalize;">${tx.type}</span></td>
                        <td>${tx.source}</td>
                        <td class="${colorClass}" style="font-weight: 600;">${sign}$${tx.amount.toLocaleString()}</td>
                        <td>${tx.description || '-'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            },

            renderRecruitment() {
                const grid = document.getElementById('recruitment-grid');
                grid.innerHTML = '';

                if (this.state.nearbyPlayers.length === 0) {
                    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg);">No citizens nearby.</div>`;
                    return;
                }

                this.state.nearbyPlayers.forEach(player => {
                    const div = document.createElement('div');
                    div.className = 'player-card';
                    div.innerHTML = `
                        <div class="player-avatar"><i class="fa-solid fa-user"></i></div>
                        <h3 style="margin-bottom: 4px;">${player.name}</h3>
                        <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">ID: ${player.id}</p>
                        <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="app.invitePlayer(${player.id})">
                            <i class="fa-solid fa-envelope"></i> Send Offer
                        </button>
                    `;
                    grid.appendChild(div);
                });
            },

            renderCharts() {
                const incomeContainer = document.getElementById('chart-income');
                const expenseContainer = document.getElementById('chart-expenses');
                if(!incomeContainer || !expenseContainer) return;
                
                incomeContainer.innerHTML = '';
                expenseContainer.innerHTML = '';

                const filter = this.state.chartFilter || 'week';
                
                // Update titles
                const filterText = document.getElementById('chartTimeSelected') ? document.getElementById('chartTimeSelected').innerText : 'Last Week';
                document.getElementById('chart-income-title').innerText = 'Income Trend (' + filterText + ')';
                document.getElementById('chart-expense-title').innerText = 'Expense Trend (' + filterText + ')';

                const now = new Date();
                const chartData = [];

                if (filter === 'hour') {
                    for (let i = 5; i >= 0; i--) {
                        let d = new Date(now.getTime() - (i * 10 * 60 * 1000));
                        chartData.push({ start: new Date(d.getTime() - (10*60*1000)), end: d, label: d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), income: 0, expense: 0 });
                    }
                } else if (filter === 'day') {
                    for (let i = 5; i >= 0; i--) {
                        let d = new Date(now.getTime() - (i * 4 * 60 * 60 * 1000));
                        chartData.push({ start: new Date(d.getTime() - (4*60*60*1000)), end: d, label: d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), income: 0, expense: 0 });
                    }
                } else if (filter === 'week') {
                    for (let i = 6; i >= 0; i--) {
                        let d = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
                        d.setHours(23,59,59,999);
                        chartData.push({ start: new Date(d.getTime() - (24*60*60*1000)), end: d, label: d.toLocaleDateString(undefined, {weekday: 'short'}), income: 0, expense: 0 });
                    }
                } else if (filter === 'month') {
                    for (let i = 3; i >= 0; i--) {
                        let d = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
                        chartData.push({ start: new Date(d.getTime() - (7*24*60*60*1000)), end: d, label: 'W' + (4-i), income: 0, expense: 0 });
                    }
                } else if (filter === 'three_months') {
                    for (let i = 2; i >= 0; i--) {
                        let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        let endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
                        chartData.push({ start: d, end: endOfMonth, label: d.toLocaleDateString(undefined, {month: 'short'}), income: 0, expense: 0 });
                    }
                }

                if (this.state.transactions && this.state.transactions.length > 0) {
                    this.state.transactions.forEach(tx => {
                        const txDate = new Date(tx.date);
                        const bucket = chartData.find(b => txDate > b.start && txDate <= b.end);
                        if (bucket) {
                            if (tx.type === 'deposit') bucket.income += tx.amount;
                            if (tx.type === 'withdraw') bucket.expense += tx.amount;
                        }
                    });
                }

                const maxIncome = Math.max(...chartData.map(d => d.income), 100);
                const maxExpense = Math.max(...chartData.map(d => d.expense), 100);

                chartData.forEach(day => {
                    const incHeight = day.income > 0 ? Math.max(5, (day.income / maxIncome) * 100) : 0;
                    const expHeight = day.expense > 0 ? Math.max(5, (day.expense / maxExpense) * 100) : 0;

                    incomeContainer.innerHTML += `
                        <div class="chart-bar-group">
                            <div class="chart-bar" style="height: ${incHeight}%;" title="$${day.income.toLocaleString()}"></div>
                            <span class="chart-label">${day.label}</span>
                        </div>
                    `;

                    expenseContainer.innerHTML += `
                        <div class="chart-bar-group">
                            <div class="chart-bar expense" style="height: ${expHeight}%;" title="$${day.expense.toLocaleString()}"></div>
                            <span class="chart-label">${day.label}</span>
                        </div>
                    `;
                });
            },

            // --- Actions & Callbacks ---
            
            viewEmployeeProfile(cid) {
                const emp = this.state.employees.find(e => e.cid === cid);
                if(!emp) return;

                const content = document.getElementById('profile-content');
                content.innerHTML = `
                    <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 24px;">
                        <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--bg-hover); display: flex; align-items: center; justify-content: center; font-size: 32px;">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <div>
                            <h2 style="font-size: 24px; margin-bottom: 4px;">${emp.name}</h2>
                            <p style="color: var(--text-secondary);"><span class="status-dot ${emp.isOnline ? 'status-online' : 'status-offline'}"></span> ${emp.isOnline ? 'Online' : 'Offline'}</p>
                        </div>
                    </div>
                    <div style="background: var(--bg-hover); border-radius: var(--radius-md); padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Citizen ID</div>
                            <div style="font-weight: 500;">${emp.cid}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Job Grade</div>
                            <div style="font-weight: 500;">${emp.grade.name} (${emp.grade.level})</div>
                        </div>
                    </div>
                    <div class="d-flex justify-between gap-2">
                        <button class="btn btn-outline" style="flex:1; justify-content:center; color: var(--success); border-color: rgba(16, 185, 129, 0.3);" onclick="app.promoteEmployee('${emp.cid}'); app.closeModal('profileModal');">Promote</button>
                        <button class="btn btn-outline" style="flex:1; justify-content:center; color: var(--warning); border-color: rgba(245, 158, 11, 0.3);" onclick="app.demoteEmployee('${emp.cid}'); app.closeModal('profileModal');">Demote</button>
                        <button class="btn btn-outline" style="flex:1; justify-content:center; color: var(--danger); border-color: rgba(239, 68, 68, 0.3);" onclick="app.promptFireEmployee('${emp.cid}'); app.closeModal('profileModal');">Fire</button>
                    </div>
                `;
                this.openModal('profileModal');
            },

            async promoteEmployee(cid) {
                const resp = await this.fetchNUI('promoteEmployee', { cid: cid });
                if(resp.success) {
                    // In a real scenario, FiveM callback would trigger 'refreshEmployees' NUI message
                }
            },

            async demoteEmployee(cid) {
                const resp = await this.fetchNUI('demoteEmployee', { cid: cid });
            },

            promptFireEmployee(cid) {
                this.state.selectedEmployeeId = cid;
                this.openModal('fireConfirmModal');
                
                document.getElementById('confirmFireBtn').onclick = async () => {
                    this.closeModal('fireConfirmModal');
                    const resp = await this.fetchNUI('fireEmployee', { cid: this.state.selectedEmployeeId });
                    if(resp.success) {
                        // Local state update for mock
                        this.state.employees = this.state.employees.filter(e => e.cid !== this.state.selectedEmployeeId);
                        this.renderEmployees();
                        this.updateStats();
                    }
                };
            },

            openModal(id) {
                if(id === 'depositModal' || id === 'withdrawModal') {
                    this.state.actionType = id === 'depositModal' ? 'deposit' : 'withdraw';
                    document.getElementById('moneyModalTitle').innerText = this.state.actionType === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds';
                    document.getElementById('moneyAmount').value = '';
                    document.getElementById('moneyReason').value = '';
                    id = 'moneyModal'; // Same HTML structure
                    
                    document.getElementById('moneyConfirmBtn').onclick = () => this.handleMoneyAction();
                }
                document.getElementById(id).classList.add('active');
            },

            closeModal(id) {
                document.getElementById(id).classList.remove('active');
            },

            async handleMoneyAction() {
                const amount = parseInt(document.getElementById('moneyAmount').value);
                const reason = document.getElementById('moneyReason').value;

                if(isNaN(amount) || amount <= 0) {
                    return;
                }

                const endpoint = this.state.actionType === 'deposit' ? 'depositFunds' : 'withdrawFunds';
                
                // Mock logic check for withdrawal
                if (this.state.actionType === 'withdraw' && amount > this.state.job.balance) {
                    return;
                }

                this.closeModal('moneyModal');
                
                const resp = await this.fetchNUI(endpoint, { amount, reason });
                if(resp.success) {
                    // Local state mock update
                    const newBalance = this.state.actionType === 'deposit' ? 
                        this.state.job.balance + amount : 
                        this.state.job.balance - amount;
                    
                    this.updateBalance(newBalance);
                    
                    // Add mock tx
                    this.state.transactions.unshift({
                        id: Date.now(), date: new Date().toISOString(), type: this.state.actionType,
                        source: this.state.job.bossName, amount: amount, description: reason
                    });
                    if(this.state.currentPage === 'funds' || this.state.currentPage === 'dashboard') {
                        this.renderRecentTransactions();
                        this.updateStats();
                    }
                }
            },

            async loadNearbyPlayers() {
                const btn = document.querySelector('#page-recruitment .btn-outline');
                btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Scanning...`;
                
                const resp = await this.fetchNUI('getNearbyPlayers');
                
                // Mock response
                if (!resp || !resp.players) {
                    setTimeout(() => {
                        this.state.nearbyPlayers = [
                            { id: 45, name: 'Jimmy Boston' },
                            { id: 12, name: 'Sarah Connor' }
                        ];
                        this.renderRecruitment();
                        btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Refresh List`;
                    }, 800);
                } else {
                     this.state.nearbyPlayers = resp.players;
                     this.renderRecruitment();
                     btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Refresh List`;
                }
            },

            async invitePlayer(id) {
                const resp = await this.fetchNUI('invitePlayer', { id: id });
            },

            // --- Utilities ---
            openStash() {
                document.body.classList.remove('show');
                this.fetchNUI('openStash');
            },

            animateCounters() {
                const counters = document.querySelectorAll('.page-content.active .counter, header .counter');
                counters.forEach(counter => {
                    const target = +counter.dataset.target;
                    counter.innerHTML = target.toLocaleString();
                });
            },

            animateValue(obj, start, end, duration) {
                obj.innerHTML = end.toLocaleString();
            },

            isToday(date) {
                const today = new Date();
                return date.getDate() == today.getDate() &&
                    date.getMonth() == today.getMonth() &&
                    date.getFullYear() == today.getFullYear();
            },

            formatDate(isoString) {
                const d = new Date(isoString);
                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            },

            formatDateFull(isoString) {
                const d = new Date(isoString);
                return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
            }
        };

        // Initialize App on load
        document.addEventListener('DOMContentLoaded', () => {
            app.init();

            // ==============================================================================
            // BROWSER TESTING MOCK DATA 
            // Remove or ignore this block when integrating into FiveM.
            // This allows the dashboard to be fully viewable in a standard web browser.
            // ==============================================================================
            if (!window.invokeNative) {
                console.log("[Dev Mode] Loading mock data for browser viewing...");
                
                const mockEmployees = [
                    { name: 'John Doe', cid: 'CID-1029', grade: { name: 'Chief', level: 5 }, isOnline: true },
                    { name: 'Jane Smith', cid: 'CID-8472', grade: { name: 'Captain', level: 4 }, isOnline: false },
                    { name: 'Bob Johnson', cid: 'CID-3392', grade: { name: 'Lieutenant', level: 3 }, isOnline: true },
                    { name: 'Alice Wong', cid: 'CID-9912', grade: { name: 'Sergeant', level: 2 }, isOnline: true },
                    { name: 'Charlie Brown', cid: 'CID-1120', grade: { name: 'Officer', level: 1 }, isOnline: false }
                ];

                const mockTransactions = [
                    { id: 1, date: new Date().toISOString(), type: 'deposit', source: 'John Doe', amount: 50000, description: 'Seized funds' },
                    { id: 2, date: new Date(Date.now() - 3600000).toISOString(), type: 'withdraw', source: 'Jane Smith', amount: 12000, description: 'Vehicle repair' },
                    { id: 3, date: new Date(Date.now() - 86400000).toISOString(), type: 'deposit', source: 'City Hall', amount: 150000, description: 'Weekly Budget' },
                    { id: 4, date: new Date(Date.now() - 172800000).toISOString(), type: 'withdraw', source: 'System', amount: 45000, description: 'Salary payout' },
                ];

                // Auto-open after 500ms for browser viewing
                setTimeout(() => {
                    app.openDashboard({
                        job: { name: 'police', label: 'Los Santos Police Dept', bossName: 'John Doe', balance: 1458900 },
                        employees: mockEmployees,
                        transactions: mockTransactions,
                        nearbyPlayers: []
                    });
                }, 500);
            }
        });

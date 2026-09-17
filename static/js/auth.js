/**
 * KisanDwar / MandiSetu - Auth Module (index.html)
 * Handles: session state display, auth nav strip, My Bookings modal, Logout
 * Loaded last in index.html so all other modules are ready.
 */

const AuthModule = {
    currentUser: null,

    async init() {
        await this.loadSessionState();
        this.bindEvents();
    },

    async loadSessionState() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            this.currentUser = data;
            this.renderAuthStrip(data);

            // Pre-fill booking form if logged in as farmer
            if (data.role === 'farmer') {
                this.prefillBookingForm(data);
                // Load My Bookings on init so the badge count is ready
            }

            // If admin, auto-switch to officer tab
            if (data.role === 'admin') {
                setTimeout(() => {
                    if (typeof switchTab === 'function') switchTab('officer');
                }, 200);
            }
        } catch (err) {
            console.warn('Auth session check failed:', err);
        }
    },

    renderAuthStrip(user) {
        const strip = document.getElementById('authUserStrip');
        if (!strip) return;

        if (!user || !user.logged_in) {
            strip.innerHTML = `
                <div class="auth-strip">
                    <a href="/" class="auth-strip-login-btn">🔐 Login / Register</a>
                </div>`;
            return;
        }

        const roleIcon = {
            farmer: '👨‍🌾',
            admin: '🏢',
            guest: '👁️'
        }[user.role] || '👤';

        const myBookingsBtn = user.role === 'farmer'
            ? `<button class="auth-strip-action" id="btnOpenMyBookings" title="View your booking history">
                    📋 My Bookings
               </button>`
            : '';

        strip.innerHTML = `
            <div class="auth-strip">
                <span class="auth-strip-name">${roleIcon} ${this.truncateName(user.name)}</span>
                <span class="auth-strip-role-badge auth-role-${user.role}">${user.role.toUpperCase()}</span>
                ${myBookingsBtn}
                <button class="auth-strip-action auth-logout-btn" id="btnLogout" title="Sign out">
                    🚪 Logout
                </button>
            </div>`;

        // Bind the My Bookings button
        const openBtn = document.getElementById('btnOpenMyBookings');
        if (openBtn) openBtn.addEventListener('click', () => this.openMyBookings());
    },

    truncateName(name) {
        if (!name) return 'User';
        const parts = name.trim().split(' ');
        return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
    },

    prefillBookingForm(user) {
        const farmerNameInput = document.getElementById('farmerName');
        const farmerPhoneInput = document.getElementById('farmerPhone');
        const mandiSelect = document.getElementById('selectMandi');

        if (farmerNameInput && user.name && !farmerNameInput.dataset.userModified) {
            farmerNameInput.value = user.name;
        }
        if (farmerPhoneInput && user.phone && !farmerPhoneInput.dataset.userModified) {
            farmerPhoneInput.value = user.phone;
        }
        if (mandiSelect && user.preferred_mandi_id) {
            // Defer until mandis are loaded
            setTimeout(() => {
                if (mandiSelect.querySelector(`option[value="${user.preferred_mandi_id}"]`)) {
                    mandiSelect.value = user.preferred_mandi_id;
                    if (typeof AppState !== 'undefined') AppState.activeMandiId = user.preferred_mandi_id;
                }
            }, 600);
        }

        // Mark inputs so manual edits aren't overwritten
        if (farmerNameInput) farmerNameInput.addEventListener('input', () => { farmerNameInput.dataset.userModified = '1'; });
        if (farmerPhoneInput) farmerPhoneInput.addEventListener('input', () => { farmerPhoneInput.dataset.userModified = '1'; });
    },

    async openMyBookings() {
        const modal = document.getElementById('myBookingsModal');
        const content = document.getElementById('myBookingsContent');
        if (!modal || !content) return;

        modal.classList.add('active');
        content.innerHTML = `
            <div style="text-align:center; padding: 40px; color: #64748b;">
                <div style="font-size:2rem; margin-bottom:10px;">⏳</div>
                <p>Loading your bookings...</p>
            </div>`;

        try {
            const res = await fetch('/api/my-bookings');
            if (res.status === 401) {
                content.innerHTML = `<p style="padding:20px; color:#94a3b8;">Please log in to view your bookings.</p>`;
                return;
            }
            const bookings = await res.json();
            content.innerHTML = this.renderBookingsTable(bookings);
        } catch (err) {
            content.innerHTML = `<p style="padding:20px; color:#ef4444;">Failed to load bookings. Please try again.</p>`;
        }
    },

    renderBookingsTable(bookings) {
        if (!bookings || bookings.length === 0) {
            return `
                <div style="text-align:center; padding:40px; color:#64748b;">
                    <div style="font-size:2.5rem; margin-bottom:12px;">🌾</div>
                    <h4 style="color:#94a3b8; margin-bottom:6px;">No bookings yet</h4>
                    <p style="font-size:0.85rem;">Book your first slot using the Farmer Portal tab!</p>
                </div>`;
        }

        const stageColors = {
            SLOT_BOOKED: '#f59e0b',
            GATE_IN: '#3b82f6',
            WEIGHMENT: '#8b5cf6',
            QUALITY_CHECK: '#06b6d4',
            COMPLETED: '#10b981'
        };

        const stageLabels = {
            SLOT_BOOKED: '1. Slot Booked',
            GATE_IN: '2. Gate In',
            WEIGHMENT: '3. Weighbridge',
            QUALITY_CHECK: '4. Quality Check',
            COMPLETED: '✅ Completed'
        };

        const rows = bookings.map(b => {
            const stageColor = stageColors[b.current_stage] || '#64748b';
            const stageLabel = stageLabels[b.current_stage] || b.current_stage;
            const msp = b.total_msp_amount ? `₹${Number(b.total_msp_amount).toLocaleString('en-IN')}` : '—';
            const utr = b.dbt_reference_utr ? `<code style="font-size:0.7rem;color:#34d399">${b.dbt_reference_utr}</code>` : '—';

            return `
                <tr>
                    <td><strong style="font-family:monospace;color:#34d399">${b.token_number}</strong></td>
                    <td>${b.booking_date}<br><small style="color:#64748b">${b.time_slot}</small></td>
                    <td>${b.mandi_name}</td>
                    <td>${b.crop_name}</td>
                    <td>${b.vehicle_number}</td>
                    <td>
                        <span style="
                            background: ${stageColor}22;
                            color: ${stageColor};
                            border: 1px solid ${stageColor}44;
                            padding: 2px 8px;
                            border-radius: 20px;
                            font-size: 0.72rem;
                            font-weight: 600;
                            white-space: nowrap;
                        ">${stageLabel}</span>
                    </td>
                    <td style="text-align:right">${msp}</td>
                    <td style="font-size:0.75rem">${utr}</td>
                </tr>`;
        }).join('');

        return `
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                    <thead>
                        <tr style="background:rgba(15,23,42,0.5); color:#94a3b8;">
                            <th style="padding:10px 12px; text-align:left; font-weight:600; white-space:nowrap">Token ID</th>
                            <th style="padding:10px 12px; text-align:left; font-weight:600">Date & Slot</th>
                            <th style="padding:10px 12px; text-align:left; font-weight:600">Mandi</th>
                            <th style="padding:10px 12px; text-align:left; font-weight:600">Crop</th>
                            <th style="padding:10px 12px; text-align:left; font-weight:600">Vehicle</th>
                            <th style="padding:10px 12px; text-align:left; font-weight:600">Stage</th>
                            <th style="padding:10px 12px; text-align:right; font-weight:600">MSP Amount</th>
                            <th style="padding:10px 12px; text-align:left; font-weight:600">DBT UTR</th>
                        </tr>
                    </thead>
                    <tbody style="color:#cbd5e1;">
                        ${rows}
                    </tbody>
                </table>
            </div>
            <p style="padding:12px 4px; color:#475569; font-size:0.75rem;">
                📊 Total bookings: <strong style="color:#94a3b8">${bookings.length}</strong>
            </p>`;
    },

    bindEvents() {
        // Close My Bookings modal
        ['btnCloseMyBookings', 'btnDismissMyBookings'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', () => {
                document.getElementById('myBookingsModal')?.classList.remove('active');
            });
        });

        // Close modal on overlay click
        const myBookingsModal = document.getElementById('myBookingsModal');
        if (myBookingsModal) {
            myBookingsModal.addEventListener('click', (e) => {
                if (e.target === myBookingsModal) myBookingsModal.classList.remove('active');
            });
        }

        // Logout button (dynamically added, use event delegation)
        document.addEventListener('click', async (e) => {
            if (e.target.id === 'btnLogout' || e.target.closest('#btnLogout')) {
                try {
                    await fetch('/api/auth/logout', { method: 'POST' });
                } catch (_) {}
                window.location.href = '/';
            }
        });
    }
};

// Initialize after all other modules are set up
document.addEventListener('DOMContentLoaded', () => {
    AuthModule.init();
});

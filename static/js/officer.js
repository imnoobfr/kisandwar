/**
 * KisanDwar / MandiSetu - Mandi Operations Officer Desk Module
 * Live Congestion Gauges, Gate Scanner, Weighbridge & Quality Stations, PFMS DBT Approval
 */

const OfficerModule = {
    currentFilter: 'ALL',
    cachedTokens: [],

    init() {
        this.bindEvents();
        this.loadStats();
        this.loadQueue();
    },

    bindEvents() {
        // Filter tabs
        document.querySelectorAll('.desk-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.desk-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFilter = tab.dataset.filter;
                this.renderQueueTable();
            });
        });

        // Rapid scan bar
        const scanBtn = document.getElementById('btnOfficerScan');
        const scanInput = document.getElementById('officerScanInput');

        if (scanBtn && scanInput) {
            scanBtn.addEventListener('click', () => {
                const tokenNo = scanInput.value.trim().toUpperCase();
                if (!tokenNo) return;
                this.handleRapidProcess(tokenNo);
            });

            scanInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const tokenNo = scanInput.value.trim().toUpperCase();
                    if (!tokenNo) return;
                    this.handleRapidProcess(tokenNo);
                }
            });
        }
    },

    async loadStats() {
        try {
            const res = await fetch(`/api/officer/stats?mandi_id=${AppState.activeMandiId}`);
            if (!res.ok) return;

            const stats = await res.json();

            // Yard capacity
            const yardCapacityFill = document.getElementById('yardCapacityFill');
            const officerCongestionPill = document.getElementById('officerCongestionPill');
            const officerYardCap = document.getElementById('officerYardCap');
            const officerTrucksInside = document.getElementById('officerTrucksInside');
            const officerTrucksWaiting = document.getElementById('officerTrucksWaiting');

            if (yardCapacityFill) yardCapacityFill.style.width = `${stats.congestion_pct}%`;
            if (officerCongestionPill) {
                officerCongestionPill.textContent = `${stats.congestion_pct}% Capacity (${stats.congestion_pct > 80 ? 'Heavy' : stats.congestion_pct > 50 ? 'Moderate' : 'Optimal'})`;
                officerCongestionPill.style.background = stats.congestion_pct > 80 ? '#fee2e2' : stats.congestion_pct > 50 ? '#fef3c7' : '#dcfce7';
                officerCongestionPill.style.color = stats.congestion_pct > 80 ? '#991b1b' : stats.congestion_pct > 50 ? '#92400e' : '#166534';
            }

            if (officerYardCap) officerYardCap.textContent = `${stats.yard_capacity} Trucks`;
            if (officerTrucksInside) officerTrucksInside.textContent = `${stats.trucks_inside}`;
            if (officerTrucksWaiting) officerTrucksWaiting.textContent = `${stats.trucks_waiting}`;

            // KPIs
            const metricTurnaroundMins = document.getElementById('metricTurnaroundMins');
            const metricProcuredQtl = document.getElementById('metricProcuredQtl');
            const metricDisbursedLakhs = document.getElementById('metricDisbursedLakhs');

            if (metricTurnaroundMins) metricTurnaroundMins.textContent = stats.current_avg_wait_minutes;
            if (metricProcuredQtl) metricProcuredQtl.textContent = stats.total_procured_quintals.toLocaleString();
            if (metricDisbursedLakhs) metricDisbursedLakhs.textContent = (stats.total_msp_disbursed_inr / 100000).toFixed(1);

        } catch (err) {
            console.error('Failed to load officer stats:', err);
        }
    },

    async loadQueue() {
        try {
            const res = await fetch(`/api/officer/queue?mandi_id=${AppState.activeMandiId}`);
            if (!res.ok) return;

            this.cachedTokens = await res.json();
            this.updateBadgeCounts();
            this.renderQueueTable();

        } catch (err) {
            console.error('Failed to load officer queue:', err);
        }
    },

    updateBadgeCounts() {
        const counts = {
            ALL: this.cachedTokens.length,
            SLOT_BOOKED: 0,
            GATE_IN: 0,
            WEIGHMENT: 0,
            QUALITY_CHECK: 0,
            COMPLETED: 0
        };

        this.cachedTokens.forEach(t => {
            if (counts[t.current_stage] !== undefined) {
                counts[t.current_stage]++;
            }
        });

        const countAll = document.getElementById('countAll');
        const countBooked = document.getElementById('countBooked');
        const countGate = document.getElementById('countGate');
        const countWeigh = document.getElementById('countWeigh');
        const countQuality = document.getElementById('countQuality');
        const countPaid = document.getElementById('countPaid');

        if (countAll) countAll.textContent = counts.ALL;
        if (countBooked) countBooked.textContent = counts.SLOT_BOOKED;
        if (countGate) countGate.textContent = counts.GATE_IN;
        if (countWeigh) countWeigh.textContent = counts.WEIGHMENT;
        if (countQuality) countQuality.textContent = counts.QUALITY_CHECK;
        if (countPaid) countPaid.textContent = counts.COMPLETED;
    },

    renderQueueTable() {
        const tbody = document.getElementById('officerQueueTableBody');
        if (!tbody) return;

        let filtered = this.cachedTokens;
        if (this.currentFilter !== 'ALL') {
            filtered = this.cachedTokens.filter(t => t.current_stage === this.currentFilter);
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
                        No tokens found in this queue category.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(t => {
            const isTargetToken = (t.token_number === AppState.activeTokenNumber);
            const rowHighlight = isTargetToken ? 'style="background: #f0fdf4;"' : '';

            // Weights display
            let weightStr = `<span style="color:#94a3b8;">Est: ${t.estimated_qty_quintals} Qtl</span>`;
            if (t.net_weight_quintals) {
                weightStr = `<strong>${t.net_weight_quintals} Qtl</strong> <small>(${t.gross_weight_quintals}G - ${t.tare_weight_quintals}T)</small>`;
            }

            // Quality & MSP display
            let qualityStr = `<span style="color:#94a3b8;">Pending Lab</span>`;
            if (t.quality_grade) {
                qualityStr = `<strong class="text-green">${t.quality_grade}</strong> <small>(${t.moisture_content_pct}% Moist.)</small><br><span style="font-weight:700;">₹${(t.total_msp_amount || 0).toLocaleString('en-IN')}</span>`;
            }

            // Action button based on stage
            let actionHtml = '';
            if (t.current_stage === 'SLOT_BOOKED') {
                actionHtml = `<button class="btn-action-stage gate" onclick="OfficerModule.advanceStage('${t.token_number}')">🚚 Gate Entry</button>`;
            } else if (t.current_stage === 'GATE_IN') {
                actionHtml = `<button class="btn-action-stage weigh" onclick="OfficerModule.advanceStage('${t.token_number}')">⚖️ Weighbridge</button>`;
            } else if (t.current_stage === 'WEIGHMENT') {
                actionHtml = `<button class="btn-action-stage quality" onclick="OfficerModule.advanceStage('${t.token_number}')">🧪 Quality Assay</button>`;
            } else if (t.current_stage === 'QUALITY_CHECK') {
                actionHtml = `<button class="btn-action-stage pay" onclick="OfficerModule.advanceStage('${t.token_number}')">💳 Disburse MSP</button>`;
            } else if (t.current_stage === 'COMPLETED') {
                actionHtml = `<button class="btn-action-stage view" onclick="FarmerModule.populateJForm('${t.token_number}'); document.getElementById('jformModal').classList.add('active');">📄 View J-Form</button>`;
            }

            return `
                <tr ${rowHighlight}>
                    <td>
                        <strong style="font-family: var(--font-mono); font-size: 0.9rem;">${t.token_number}</strong>
                        ${isTargetToken ? '<span style="background:#bbf7d0; color:#166534; font-size:0.65rem; padding:1px 5px; border-radius:4px; margin-left:4px;">Demo Focus</span>' : ''}
                    </td>
                    <td>
                        <strong>${t.farmer_name}</strong><br>
                        <small style="color:#64748b;">${t.farmer_phone} • ${t.village}</small>
                    </td>
                    <td>
                        <strong>${t.crop_name}</strong><br>
                        <small style="color:#64748b;">MSP ₹${t.msp_per_quintal.toLocaleString()}/Qtl</small>
                    </td>
                    <td>
                        <span>${t.vehicle_number}</span><br>
                        <small style="color:#64748b;">${t.time_slot}</small>
                    </td>
                    <td>
                        <span class="badge-stage ${t.current_stage}">
                            ${t.current_stage.replace('_', ' ')}
                        </span>
                    </td>
                    <td>${weightStr}</td>
                    <td>${qualityStr}</td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        }).join('');
    },

    async advanceStage(tokenNumber) {
        try {
            const res = await fetch('/api/officer/advance-stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token_number: tokenNumber })
            });

            const data = await res.json();
            if (data.success) {
                showToast(`Token #${tokenNumber} advanced to ${data.stage}!`, '✅');
                
                // Refresh officer view
                await this.loadStats();
                await this.loadQueue();

                // If active token was updated, refresh farmer view & SMS feed
                if (tokenNumber === AppState.activeTokenNumber) {
                    await FarmerModule.loadTokenDetails(tokenNumber);
                    await FarmerModule.pollQueueStatus();
                }
            }
        } catch (err) {
            console.error('Failed to advance stage:', err);
            showToast('Error advancing stage.', '❌');
        }
    },

    async handleRapidProcess(tokenNumber) {
        showToast(`Rapid processing Token #${tokenNumber}...`, '⚡');
        await this.advanceStage(tokenNumber);
        const input = document.getElementById('officerScanInput');
        if (input) input.value = '';
    }
};

/**
 * KisanDwar / MandiSetu - Farmer Module
 * Slot Booking Wizard, Dynamic QR Pass, Live Queue Radar, Lifecycle Tracker & SMS Feed
 */

const FarmerModule = {
    async init() {
        this.bindEvents();
        await this.loadMandisAndCrops();
        await this.loadTokenDetails(AppState.activeTokenNumber);
        this.startQueuePolling();
    },

    bindEvents() {
        // Form field changes for real-time MSP calculation
        const cropSelect = document.getElementById('selectCrop');
        const qtyInput = document.getElementById('estimatedQty');
        const mandiSelect = document.getElementById('selectMandi');
        const dateInput = document.getElementById('bookingDate');

        if (cropSelect) cropSelect.addEventListener('change', () => this.updateMspEstimate());
        if (qtyInput) qtyInput.addEventListener('input', () => this.updateMspEstimate());
        if (mandiSelect) mandiSelect.addEventListener('change', () => {
            AppState.activeMandiId = parseInt(mandiSelect.value);
            this.loadSlots();
        });
        if (dateInput) dateInput.addEventListener('change', () => this.loadSlots());

        // Booking form submission
        const bookingForm = document.getElementById('slotBookingForm');
        if (bookingForm) {
            bookingForm.addEventListener('submit', (e) => this.handleBookingSubmit(e));
        }

        // Modal close buttons
        const btnCloseJForm = document.getElementById('btnCloseJForm');
        const btnDismissJForm = document.getElementById('btnDismissJForm');
        const modal = document.getElementById('jformModal');

        if (btnCloseJForm) btnCloseJForm.addEventListener('click', () => modal.classList.remove('active'));
        if (btnDismissJForm) btnDismissJForm.addEventListener('click', () => modal.classList.remove('active'));

        // View Mode Switcher (Desktop vs Phone App Mockup)
        const btnModeWide = document.getElementById('btnModeWide');
        const btnModePhone = document.getElementById('btnModePhone');
        const farmerLayout = document.getElementById('farmerLayout');

        if (btnModeWide && btnModePhone && farmerLayout) {
            btnModePhone.addEventListener('click', () => {
                farmerLayout.classList.add('mobile-frame-mode');
                btnModePhone.classList.add('active');
                btnModeWide.classList.remove('active');
                showToast('Switched to Smartphone App Frame', '📱');
            });

            btnModeWide.addEventListener('click', () => {
                farmerLayout.classList.remove('mobile-frame-mode');
                btnModeWide.classList.add('active');
                btnModePhone.classList.remove('active');
                showToast('Switched to Full-Screen View', '🖥️');
            });
        }
    },

    async loadMandisAndCrops() {
        try {
            const [mandisRes, cropsRes] = await Promise.all([
                fetch('/api/mandis'),
                fetch('/api/crops')
            ]);

            AppState.mandis = await mandisRes.json();
            AppState.crops = await cropsRes.json();

            // Populate Mandi Select
            const mandiSelect = document.getElementById('selectMandi');
            if (mandiSelect) {
                mandiSelect.innerHTML = AppState.mandis.map(m => `
                    <option value="${m.id}">${m.name} (${m.district}, ${m.state}) - Load: ${m.congestion_pct}%</option>
                `).join('');
                AppState.activeMandiId = AppState.mandis[0]?.id || 1;
            }

            // Populate Crop Select
            const cropSelect = document.getElementById('selectCrop');
            if (cropSelect) {
                cropSelect.innerHTML = AppState.crops.map(c => `
                    <option value="${c.id}" data-msp="${c.msp_per_quintal}">
                        ${c.name_en} (${c.name_hi}) - MSP: ₹${c.msp_per_quintal.toLocaleString()}/Qtl
                    </option>
                `).join('');
            }

            this.updateMspEstimate();
            await this.loadSlots();
        } catch (err) {
            console.error('Failed to load mandis and crops:', err);
        }
    },

    updateMspEstimate() {
        const cropSelect = document.getElementById('selectCrop');
        const qtyInput = document.getElementById('estimatedQty');
        const dispMspRate = document.getElementById('dispMspRate');
        const dispEstWeight = document.getElementById('dispEstWeight');
        const dispEstPayout = document.getElementById('dispEstPayout');

        if (!cropSelect || !qtyInput) return;

        const selectedOption = cropSelect.options[cropSelect.selectedIndex];
        const msp = selectedOption ? parseFloat(selectedOption.dataset.msp || 2275) : 2275;
        const qty = parseFloat(qtyInput.value || 0);
        const total = Math.round(msp * qty);

        if (dispMspRate) dispMspRate.textContent = `₹${msp.toLocaleString('en-IN')} / Qtl`;
        if (dispEstWeight) dispEstWeight.textContent = `${qty.toFixed(1)} Qtl`;
        if (dispEstPayout) dispEstPayout.textContent = `₹${total.toLocaleString('en-IN')}`;
    },

    async loadSlots() {
        const slotsContainer = document.getElementById('slotsContainer');
        if (!slotsContainer) return;

        const dateVal = document.getElementById('bookingDate')?.value || new Date().toISOString().split('T')[0];
        try {
            const res = await fetch(`/api/slots?mandi_id=${AppState.activeMandiId}&date=${dateVal}`);
            const slots = await res.json();

            slotsContainer.innerHTML = slots.map((s, idx) => `
                <div class="slot-card ${idx === 3 ? 'selected' : ''}" data-slot="${s.time_slot}">
                    <span class="slot-time">${s.time_slot}</span>
                    <span class="slot-badge-text" style="color: ${s.color}">${s.badge}</span>
                </div>
            `).join('');

            // Slot card selection handlers
            document.querySelectorAll('.slot-card').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    AppState.selectedSlot = card.dataset.slot;
                });
            });

            // Default selection
            const defaultSel = document.querySelector('.slot-card.selected');
            if (defaultSel) AppState.selectedSlot = defaultSel.dataset.slot;

        } catch (err) {
            console.error('Failed to load slots:', err);
        }
    },

    async handleBookingSubmit(e) {
        e.preventDefault();

        const submitBtn = document.getElementById('btnSubmitBooking');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>⏳ Processing Booking...</span>';
        }

        const payload = {
            name: document.getElementById('farmerName').value,
            phone: document.getElementById('farmerPhone').value,
            aadhaar_last4: document.getElementById('farmerAadhaar').value || '4892',
            vehicle_type: document.getElementById('vehicleType').value,
            vehicle_number: document.getElementById('vehicleNumber').value,
            mandi_id: parseInt(document.getElementById('selectMandi').value),
            crop_id: parseInt(document.getElementById('selectCrop').value),
            estimated_qty_quintals: parseFloat(document.getElementById('estimatedQty').value),
            booking_date: document.getElementById('bookingDate').value,
            time_slot: AppState.selectedSlot || '11:00 AM - 12:00 PM'
        };

        try {
            const res = await fetch('/api/book-slot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                AppState.activeTokenNumber = data.token_number;
                showToast(`E-Token #${data.token_number} generated successfully!`, '🎟️');
                await this.loadTokenDetails(data.token_number);
                await this.pollQueueStatus();

                // Smooth scroll to token pass
                const tokenCard = document.getElementById('tokenPassCard');
                if (tokenCard) tokenCard.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (err) {
            console.error('Booking submission error:', err);
            showToast('Failed to book slot. Please retry.', '❌');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>🎟️</span> <span>Confirm Slot & Generate Digital E-Token</span>';
            }
        }
    },

    async loadTokenDetails(tokenNumber) {
        try {
            const res = await fetch(`/api/tokens/${tokenNumber}`);
            if (!res.ok) return;

            const t = await res.json();
            AppState.activeTokenNumber = t.token_number;

            // Update Pass UI
            const passTokenNumber = document.getElementById('passTokenNumber');
            const passLane = document.getElementById('passLane');
            const passFarmerName = document.getElementById('passFarmerName');
            const passCropName = document.getElementById('passCropName');
            const passSlotTime = document.getElementById('passSlotTime');
            const passVehicleNo = document.getElementById('passVehicleNo');
            const tokenStageBadge = document.getElementById('tokenStageBadge');

            if (passTokenNumber) passTokenNumber.textContent = t.token_number;
            if (passLane) passLane.textContent = t.lane_number || 'Lane-A';
            if (passFarmerName) passFarmerName.textContent = t.farmer_name;
            if (passCropName) passCropName.textContent = `${t.crop_name_en} (${t.crop_name_hi})`;
            if (passSlotTime) passSlotTime.textContent = t.time_slot;
            if (passVehicleNo) passVehicleNo.textContent = t.vehicle_number;

            if (tokenStageBadge) {
                tokenStageBadge.textContent = t.current_stage.replace('_', ' ');
                tokenStageBadge.className = `pass-badge-active ${t.current_stage}`;
            }

            // Render SVG QR Code
            renderSvgQrCode(`KISANDWAR:${t.token_number}:${t.vehicle_number}:${t.farmer_name}`, 'passQrContainer');

            // Render SMS Stream
            this.renderSmsStream(t.sms_history || []);

            // Update Stepper
            this.updateStepper(t.current_stage, t.stage_updated_at);

        } catch (err) {
            console.error('Failed to load token details:', err);
        }
    },

    updateStepper(stage, updatedAt) {
        const stageIndexMap = {
            'SLOT_BOOKED': 1,
            'GATE_IN': 2,
            'WEIGHMENT': 3,
            'QUALITY_CHECK': 4,
            'COMPLETED': 5
        };

        const activeIndex = stageIndexMap[stage] || 1;

        for (let i = 1; i <= 5; i++) {
            const node = document.getElementById(`stepNode${i}`);
            const conn = document.getElementById(`stepConn${i}`);

            if (node) {
                node.classList.remove('active', 'completed');
                if (i < activeIndex) {
                    node.classList.add('completed');
                } else if (i === activeIndex) {
                    node.classList.add('active');
                }
            }

            if (conn) {
                conn.classList.toggle('completed', i < activeIndex);
            }
        }

        // Update timestamps if present
        const timeMap = {
            2: 'timeGateIn',
            3: 'timeWeighment',
            4: 'timeQuality',
            5: 'timePayment'
        };

        if (timeMap[activeIndex] && updatedAt) {
            const el = document.getElementById(timeMap[activeIndex]);
            if (el) el.textContent = updatedAt.split(' ')[1] || 'Done';
        }
    },

    renderSmsStream(smsLogs) {
        const container = document.getElementById('smsStreamBody');
        if (!container) return;

        if (smsLogs.length === 0) {
            container.innerHTML = '<div class="sms-bubble"><span>No notifications received yet.</span></div>';
            return;
        }

        container.innerHTML = smsLogs.map(s => `
            <div class="sms-bubble">
                <p>${s.message_text}</p>
                <span class="sms-time">${s.sent_at.split(' ')[1] || ''} • DELIVERED</span>
            </div>
        `).join('');

        // Auto scroll to bottom of messages
        container.scrollTop = container.scrollHeight;
    },

    async pollQueueStatus() {
        if (!AppState.activeTokenNumber) return;

        try {
            const res = await fetch(`/api/queue-status/${AppState.activeTokenNumber}`);
            if (!res.ok) return;

            const data = await res.json();

            const radarServingToken = document.getElementById('radarServingToken');
            const radarAheadCount = document.getElementById('radarAheadCount');
            const radarWaitMins = document.getElementById('radarWaitMins');
            const radarLastUpdated = document.getElementById('radarLastUpdated');

            if (radarServingToken) radarServingToken.textContent = data.currently_serving;
            if (radarAheadCount) radarAheadCount.textContent = data.tokens_ahead;
            if (radarWaitMins) radarWaitMins.textContent = `~${data.estimated_wait_mins} Min`;
            if (radarLastUpdated) {
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                radarLastUpdated.textContent = `Live: ${timeStr}`;
            }

            // Sync with token details if stage changed
            this.updateStepper(data.stage);

        } catch (err) {
            console.error('Queue poll error:', err);
        }
    },

    startQueuePolling() {
        if (AppState.pollTimer) clearInterval(AppState.pollTimer);
        AppState.pollTimer = setInterval(() => {
            if (AppState.currentTab === 'farmer') {
                this.pollQueueStatus();
            }
        }, 5000);
    },

    async populateJForm(tokenNumber) {
        try {
            const res = await fetch(`/api/tokens/${tokenNumber}`);
            if (!res.ok) return;
            const t = await res.json();

            document.getElementById('jfFarmerName').textContent = t.farmer_name;
            document.getElementById('jfFarmerUid').textContent = `${t.farmer_id} (Aadhaar: XX${t.aadhaar_last4})`;
            document.getElementById('jfMandi').textContent = t.mandi_name;
            document.getElementById('jfDate').textContent = t.booking_date;
            document.getElementById('jfCrop').textContent = `${t.crop_name_en} (${t.quality_grade || 'Grade-A'})`;
            document.getElementById('jfVehicle').textContent = t.vehicle_number;

            const gross = t.gross_weight_quintals || (t.estimated_qty_quintals + 45.0);
            const tare = t.tare_weight_quintals || 45.0;
            const net = t.net_weight_quintals || t.estimated_qty_quintals;
            const msp = t.msp_per_quintal || 2275;
            const total = t.total_msp_amount || Math.round(net * msp);

            document.getElementById('jfGross').textContent = `${gross.toFixed(1)} Qtl`;
            document.getElementById('jfTare').textContent = `${tare.toFixed(1)} Qtl`;
            document.getElementById('jfNet').textContent = `${net.toFixed(1)} Qtl`;
            document.getElementById('jfMoisture').textContent = `${t.moisture_content_pct || 11.4}%`;
            document.getElementById('jfMsp').textContent = `₹${msp.toLocaleString('en-IN')}`;
            document.getElementById('jfTotal').textContent = `₹${total.toLocaleString('en-IN')}`;

            document.getElementById('jfBank').textContent = `${t.bank_name || 'State Bank of India'} (A/c: XX${t.bank_account ? t.bank_account.slice(-4) : '1094'})`;
            document.getElementById('jfUtr').textContent = t.dbt_reference_utr || 'PFMS-DBT-2026090510294';

        } catch (err) {
            console.error('Populate J-Form error:', err);
        }
    }
};

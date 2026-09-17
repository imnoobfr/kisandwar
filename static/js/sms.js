/**
 * KisanDwar / MandiSetu - Offline Feature-Phone SMS / IVR Module
 * Handles simulated keypad interaction and GSM SMS gateway booking for non-smartphone farmers.
 */

const SmsModule = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Retro SMS Send Button
        const btnSendRetroSms = document.getElementById('btnSendRetroSms');
        if (btnSendRetroSms) {
            btnSendRetroSms.addEventListener('click', () => this.handleRetroSmsSend());
        }

        // Retro SMS Keypad simulation clicks
        document.querySelectorAll('.key').forEach(key => {
            key.addEventListener('click', () => {
                const char = key.innerText.trim().charAt(0);
                const input = document.getElementById('retroSmsInput');
                if (input && char) {
                    input.value += char;
                }
            });
        });
    },

    async handleRetroSmsSend() {
        const input = document.getElementById('retroSmsInput');
        const text = input ? input.value.trim() : 'BOOK WHEAT 40 KHANNA';
        if (!text) return;

        const appThread = document.querySelector('.retro-thread');
        if (!appThread) return;

        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Add outgoing bubble
        const outBubble = document.createElement('div');
        outBubble.className = 'retro-msg outgoing';
        outBubble.innerHTML = `<span class="text">${text}</span><span class="t-stamp">${timeNow}</span>`;
        appThread.appendChild(outBubble);

        showToast('Transmitting SMS over GSM Gateway...', '📡');

        try {
            const res = await fetch('/api/offline-sms-book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sms_text: text,
                    sender_phone: '9876543210'
                })
            });

            const data = await res.json();
            if (data.success) {
                setTimeout(() => {
                    const inBubble = document.createElement('div');
                    inBubble.className = 'retro-msg incoming';
                    inBubble.innerHTML = `<span class="text">${data.reply_sms}</span><span class="t-stamp">${timeNow}</span>`;
                    appThread.appendChild(inBubble);
                    showToast(`SMS Booking Confirmed: Token #${data.token_number}`, '📱');

                    // If officer table is active, refresh it
                    OfficerModule.loadQueue();
                    OfficerModule.loadStats();
                }, 800);
            }
        } catch (err) {
            console.error('Retro SMS Error:', err);
            showToast('SMS transmission failed. Please retry.', '❌');
        }
    }
};

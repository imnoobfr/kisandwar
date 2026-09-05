/**
 * KisanDwar / MandiSetu - Core App Module
 * State Management, Multilingual Engine, SVG QR Generator, UI Routing
 */

const AppState = {
    currentTab: 'farmer',
    currentLang: 'en',
    activeTokenNumber: 'MND-KHN-105',
    activeMandiId: 1,
    selectedSlot: '11:00 AM - 12:00 PM',
    mandis: [],
    crops: [],
    pollTimer: null
};

// Multilingual Translations Dictionary (EN, HI, PA)
const I18N = {
    en: {
        app_title: "KisanDwar",
        app_subtitle: "Smart Queue & Transparent Procurement System | SIH Problem #SIH26032",
        nav_farmer: "Farmer Portal",
        nav_officer: "Mandi Operations Desk",
        nav_sms: "Offline SMS / IVR",
        booking_card_title: "Book Procurement Slot & E-Token",
        booking_card_desc: "Pre-book your arrival window to bypass road queues and guarantee priority weighment.",
        farmer_info_title: "1. Farmer & Vehicle Details",
        farmer_name_label: "Farmer Full Name *",
        farmer_phone_label: "Mobile Number (For SMS Updates) *",
        aadhaar_label: "Aadhaar (Last 4 digits)",
        vehicle_type_label: "Vehicle Type",
        vehicle_num_label: "Vehicle Reg. Number *",
        crop_mandi_title: "2. Crop & Center Selection",
        select_mandi_label: "Select Procurement Center (Mandi) *",
        select_crop_label: "Crop to Procure *",
        estimated_qty_label: "Estimated Quantity (Quintals) *",
        date_label: "Preferred Date *",
        govt_msp_rate: "Govt. MSP Rate",
        est_weight: "Est. Weight",
        est_dbt_payout: "Estimated DBT Payout",
        select_slot_title: "3. Choose Intelligent Time Slot (Paced Traffic)",
        btn_generate_token: "Confirm Slot & Generate Digital E-Token",
        token_id_label: "E-TOKEN NUMBER",
        assigned_lane: "Dedicated Lane:",
        scan_at_gate: "Scan this QR at Mandi Inward Gate",
        crop_name: "Crop",
        allocated_slot: "Allocated Slot",
        print_pass: "Print / Download Pass",
        view_jform: "View Mandi J-Form",
        queue_radar_title: "Live Mandi Queue Radar",
        currently_serving: "At Weighbridge Now",
        vehicles_ahead: "Vehicles Ahead of You",
        estimated_wait: "Estimated Wait Time",
        step_slot_booked: "Slot Booked",
        step_gate_in: "Gate Inward",
        step_weighment: "Weighbridge",
        step_quality: "Quality Assay",
        step_payment: "DBT Payment",
        kpi_yard_title: "Yard Congestion & Traffic Flow",
        avg_turnaround: "Average Turnaround Time",
        procured_today: "Procured Today",
        msp_disbursed: "MSP Disbursed via PFMS DBT"
    },
    hi: {
        app_title: "किसान द्वार",
        app_subtitle: "स्मार्ट मंडी कतार एवं पारदर्शी खरीद प्रणाली | एसआईएच समस्या #SIH26032",
        nav_farmer: "किसान पोर्टल",
        nav_officer: "मंडी संचालन डेस्क",
        nav_sms: "ऑफ़लाइन एसएमएस / आईवीआर",
        booking_card_title: "उपज विक्रय हेतु स्लॉट और ई-टोकन बुक करें",
        booking_card_desc: "सड़क पर लंबी कतारों से बचने और प्राथमिकता तौल के लिए समय पूर्व बुक करें।",
        farmer_info_title: "1. किसान और वाहन का विवरण",
        farmer_name_label: "किसान का पूरा नाम *",
        farmer_phone_label: "मोबाइल नंबर (एसएमएस अलर्ट हेतु) *",
        aadhaar_label: "आधार (अंतिम 4 अंक)",
        vehicle_type_label: "वाहन का प्रकार",
        vehicle_num_label: "वाहन पंजीकरण संख्या *",
        crop_mandi_title: "2. फसल और मंडी चयन",
        select_mandi_label: "खरीद केंद्र (मंडी) चुनें *",
        select_crop_label: "फसल चुनें *",
        estimated_qty_label: "अनुमानित मात्रा (क्विंटल) *",
        date_label: "पसंदीदा तारीख *",
        govt_msp_rate: "सरकारी एमएसपी दर",
        est_weight: "अनुमानित वजन",
        est_dbt_payout: "अनुमानित डीबीटी भुगतान",
        select_slot_title: "3. समय स्लॉट चुनें (ट्रैफिक नियंत्रित)",
        btn_generate_token: "स्लॉट बुक करें और ई-टोकन प्राप्त करें",
        token_id_label: "ई-टोकन संख्या",
        assigned_lane: "निर्धारित लेन:",
        scan_at_gate: "मंडी प्रवेश द्वार पर यह क्यूआर स्कैन कराएं",
        crop_name: "फसल",
        allocated_slot: "आवंटित समय",
        print_pass: "पास प्रिंट / डाउनलोड करें",
        view_jform: "मंडी जे-फार्म देखें",
        queue_radar_title: "लाइव मंडी कतार रडार",
        currently_serving: "वर्तमान तौल पर टोकन",
        vehicles_ahead: "आपसे आगे कुल वाहन",
        estimated_wait: "अनुमानित प्रतीक्षा समय",
        step_slot_booked: "स्लॉट बुक",
        step_gate_in: "गेट प्रवेश",
        step_weighment: "धर्मकांटा तौल",
        step_quality: "गुणवत्ता परीक्षण",
        step_payment: "डीबीटी भुगतान",
        kpi_yard_title: "मंडी यार्ड कंजेशन एवं ट्रैफिक",
        avg_turnaround: "औसत निपटान समय",
        procured_today: "आज कुल खरीद",
        msp_disbursed: "पीएफएमएस डीबीटी द्वारा जारी राशि"
    },
    pa: {
        app_title: "ਕਿਸਾਨ ਦੁਆਰ",
        app_subtitle: "ਸਮਾਰਟ ਮੰਡੀ ਲਾਈਨ ਪ੍ਰਬੰਧਨ ਅਤੇ ਖਰੀਦ ਪ੍ਰਣਾਲੀ | SIH #SIH26032",
        nav_farmer: "ਕਿਸਾਨ ਪੋਰਟਲ",
        nav_officer: "ਮੰਡੀ ਅਧਿਕਾਰੀ ਡੈਸਕ",
        nav_sms: "ਆਫਲਾਈਨ ਐਸਐਮਐਸ",
        booking_card_title: "ਫਸਲ ਵੇਚਣ ਲਈ ਸਲਾਟ ਅਤੇ ਈ-ਟੋਕਨ ਬੁੱਕ ਕਰੋ",
        booking_card_desc: "ਲੰਬੀਆਂ ਲਾਈਨਾਂ ਤੋਂ ਬਚਣ ਅਤੇ ਪਹਿਲ ਦੇ ਆਧਾਰ ਤੇ ਕੰਡੇ ਲਈ ਸਮਾਂ ਪਹਿਲਾਂ ਬੁੱਕ ਕਰੋ।",
        farmer_info_title: "1. ਕਿਸਾਨ ਅਤੇ ਵਾਹਨ ਵੇਰਵਾ",
        farmer_name_label: "ਕਿਸਾਨ ਦਾ ਪੂਰਾ ਨਾਮ *",
        farmer_phone_label: "ਮੋਬਾਈਲ ਨੰਬਰ (ਐਸਐਮਐਸ ਲਈ) *",
        aadhaar_label: "ਆਧਾਰ (ਆਖਰੀ 4 ਅੰਕ)",
        vehicle_type_label: "ਵਾਹਨ ਦੀ ਕਿਸਮ",
        vehicle_num_label: "ਵਾਹਨ ਨੰਬਰ *",
        crop_mandi_title: "2. ਫਸਲ ਅਤੇ ਮੰਡੀ ਚੋਣ",
        select_mandi_label: "ਖਰੀਦ ਕੇਂਦਰ (ਮੰਡੀ) ਚੁਣੋ *",
        select_crop_label: "ਫਸਲ ਚੁਣੋ *",
        estimated_qty_label: "ਅੰਦਾਜ਼ਨ ਮਾਤਰਾ (ਕੁਇੰਟਲ) *",
        date_label: "ਮਿਤੀ *",
        govt_msp_rate: "ਸਰਕਾਰੀ ਐਮਐਸਪੀ ਰੇਟ",
        est_weight: "ਅੰਦਾਜ਼ਨ ਭਾਰ",
        est_dbt_payout: "ਅੰਦਾਜ਼ਨ ਡੀਬੀਟੀ ਭੁਗਤਾਨ",
        select_slot_title: "3. ਸਮਾਂ ਸਲਾਟ ਚੁਣੋ",
        btn_generate_token: "ਸਲਾਟ ਪੱਕਾ ਕਰੋ ਅਤੇ ਈ-ਟੋਕਨ ਲਵੋ",
        token_id_label: "ਈ-ਟੋਕਨ ਨੰਬਰ",
        assigned_lane: "ਅਲਾਟ ਕੀਤੀ ਲੇਨ:",
        scan_at_gate: "ਮੰਡੀ ਗੇਟ ਤੇ ਇਹ ਕਿਊਆਰ ਸਕੈਨ ਕਰਵਾਓ",
        crop_name: "ਫਸਲ",
        allocated_slot: "ਅਲਾਟ ਕੀਤਾ ਸਮਾਂ",
        print_pass: "ਪਾਸ ਪ੍ਰਿੰਟ ਕਰੋ",
        view_jform: "ਮੰਡੀ ਜੇ-ਫਾਰਮ ਵੇਖੋ",
        queue_radar_title: "ਲਾਈਵ ਮੰਡੀ ਲਾਈਨ ਰਾਡਾਰ",
        currently_serving: "ਕੰਡੇ ਤੇ ਮੌਜੂਦਾ ਟੋਕਨ",
        vehicles_ahead: "ਤੁਹਾਡੇ ਅੱਗੇ ਕੁੱਲ ਟਰਾਲੀਆਂ",
        estimated_wait: "ਅੰਦਾਜ਼ਨ ਇੰਤਜ਼ਾਰ ਸਮਾਂ",
        step_slot_booked: "ਸਲਾਟ ਬੁੱਕ",
        step_gate_in: "ਗੇਟ ਐਂਟਰੀ",
        step_weighment: "ਕੰਡਾ ਤੋਲ",
        step_quality: "ਕੁਆਲਿਟੀ ਪਰਖ",
        step_payment: "ਡੀਬੀਟੀ ਖਾਤੇ ਵਿੱਚ",
        kpi_yard_title: "ਮੰਡੀ ਯਾਰਡ ਭੀੜ ਅਤੇ ਟ੍ਰੈਫਿਕ",
        avg_turnaround: "ਔਸਤ ਸਮਾਂ",
        procured_today: "ਅੱਜ ਕੁੱਲ ਖਰੀਦ",
        msp_disbursed: "ਖਾਤਿਆਂ ਵਿੱਚ ਪਾਇਆ ਗਿਆ ਐਮਐਸਪੀ"
    }
};

// SVG QR Code Generator (Zero external dependencies)
function renderSvgQrCode(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Deterministic pseudo-random matrix based on data string
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash) + data.charCodeAt(i);
        hash |= 0;
    }

    const size = 21; // 21x21 QR matrix
    const moduleSize = 6;
    const padding = 8;
    const totalDim = size * moduleSize + (padding * 2);

    let rects = '';
    
    // Draw QR Finder patterns (Top-left, Top-right, Bottom-left)
    function drawFinder(r0, c0) {
        // Outer 7x7 black
        rects += `<rect x="${padding + c0 * moduleSize}" y="${padding + r0 * moduleSize}" width="${7 * moduleSize}" height="${7 * moduleSize}" fill="#0f172a"/>`;
        // Inner 5x5 white
        rects += `<rect x="${padding + (c0 + 1) * moduleSize}" y="${padding + (r0 + 1) * moduleSize}" width="${5 * moduleSize}" height="${5 * moduleSize}" fill="#ffffff"/>`;
        // Center 3x3 black
        rects += `<rect x="${padding + (c0 + 2) * moduleSize}" y="${padding + (r0 + 2) * moduleSize}" width="${3 * moduleSize}" height="${3 * moduleSize}" fill="#0f172a"/>`;
    }

    drawFinder(0, 0);
    drawFinder(0, 14);
    drawFinder(14, 0);

    // Fill pseudo data modules
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            // Skip finder zones
            const inFinderTL = (r < 8 && c < 8);
            const inFinderTR = (r < 8 && c >= 13);
            const inFinderBL = (r >= 13 && c < 8);
            if (inFinderTL || inFinderTR || inFinderBL) continue;

            const bit = Math.abs(Math.sin(hash * (r * size + c + 1))) > 0.48;
            if (bit) {
                rects += `<rect x="${padding + c * moduleSize}" y="${padding + r * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="#0f172a"/>`;
            }
        }
    }

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="100%" height="100%">
            <rect width="100%" height="100%" fill="#ffffff" rx="8"/>
            ${rects}
        </svg>
    `;

    container.innerHTML = svg;
}

// Toast System
function showToast(message, icon = '🌾') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Language Switcher
function setLanguage(lang) {
    if (!I18N[lang]) return;
    AppState.currentLang = lang;

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    const dict = I18N[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.textContent = dict[key];
        }
    });

    showToast(`Language set to ${lang.toUpperCase()}`, '🌐');
}

// Tab Switching
function switchTab(tabId) {
    AppState.currentTab = tabId;

    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });

    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const targetPanel = document.getElementById(
        tabId === 'farmer' ? 'viewFarmer' :
        tabId === 'officer' ? 'viewOfficer' : 'viewSms'
    );

    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    if (tabId === 'officer') {
        OfficerModule.loadStats();
        OfficerModule.loadQueue();
    } else if (tabId === 'farmer') {
        FarmerModule.pollQueueStatus();
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Tab event bindings
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });

    // Reset Demo Button
    document.getElementById('btnResetDemo').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/reset-demo', { method: 'POST' });
            const data = await res.json();
            showToast('Demo Database Reset to Initial State!', '🔄');
            FarmerModule.loadMandisAndCrops();
            FarmerModule.loadTokenDetails(AppState.activeTokenNumber);
            OfficerModule.loadStats();
            OfficerModule.loadQueue();
        } catch (err) {
            console.error('Reset error:', err);
        }
    });

    // Initialize default date in booking form
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // Initialize modules
    FarmerModule.init();
    OfficerModule.init();
    SmsModule.init();
});

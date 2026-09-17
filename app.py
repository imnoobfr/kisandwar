"""
KisanDwar / MandiSetu - Smart Indian Mandi Queue & Procurement System
Flask Backend for SIH 2026 Problem Statement SIH26032
"""

import os
import random
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db, init_db, seed_db, seed_admin_user

app = Flask(__name__)

# Secret key for session encryption — override via SECRET_KEY env var in production
app.secret_key = os.environ.get('SECRET_KEY', 'kisandwar-sih2026-secret-xK9pQr')

# Ensure DB exists and seed data
init_db()
seed_db()
seed_admin_user()

# ==========================================
# AUTH ROUTES
# ==========================================

@app.route('/')
def index():
    """Root: show login portal if not authenticated, else show main app."""
    if session.get('user_id') or session.get('is_guest') or session.get('is_admin'):
        return render_template('index.html')
    return render_template('login.html')

@app.route('/app')
def main_app():
    """Direct link to main app (sets guest session if not logged in)."""
    if not (session.get('user_id') or session.get('is_guest') or session.get('is_admin')):
        session['is_guest'] = True
        session['user_name'] = 'Guest'
        session['user_role'] = 'guest'
    return render_template('index.html')

@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    """Register a new farmer account."""
    data = request.json or {}

    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    password = data.get('password', '').strip()
    state = data.get('state', '').strip()
    district = data.get('district', '').strip()
    preferred_mandi_id = data.get('preferred_mandi_id', 1)

    # Validation
    if not name:
        return jsonify({'error': 'Full name is required'}), 400
    if not phone or len(phone) != 10 or not phone.isdigit():
        return jsonify({'error': 'Enter a valid 10-digit mobile number'}), 400
    if not password or len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if not state:
        return jsonify({'error': 'State is required'}), 400
    if not district:
        return jsonify({'error': 'District is required'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Check if phone already registered (with password)
    cursor.execute('SELECT id, is_registered FROM farmers WHERE phone = ?', (phone,))
    existing = cursor.fetchone()

    if existing and existing['is_registered'] == 1:
        conn.close()
        return jsonify({'error': 'This mobile number is already registered. Please login.'}), 409

    pw_hash = generate_password_hash(password)
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    if existing:
        # Upgrade existing guest/auto-created farmer to registered
        farmer_id = existing['id']
        cursor.execute('''
            UPDATE farmers
            SET name = ?, state = ?, district = ?,
                password_hash = ?, preferred_mandi_id = ?, is_registered = 1
            WHERE id = ?
        ''', (name, state, district, pw_hash, preferred_mandi_id, farmer_id))
    else:
        farmer_uid = f'FARM-{random.randint(10000, 99999)}'
        cursor.execute('''
            INSERT INTO farmers (farmer_uid, name, phone, state, district,
                                  password_hash, preferred_mandi_id, is_registered)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ''', (farmer_uid, name, phone, state, district, pw_hash, preferred_mandi_id))
        farmer_id = cursor.lastrowid

    conn.commit()

    # Fetch farmer details for session
    cursor.execute('SELECT * FROM farmers WHERE id = ?', (farmer_id,))
    farmer = dict(cursor.fetchone())
    conn.close()

    # Set session
    session.clear()
    session['user_id'] = farmer_id
    session['user_name'] = name
    session['user_phone'] = phone
    session['user_role'] = 'farmer'
    session['preferred_mandi_id'] = preferred_mandi_id
    session['is_guest'] = False

    return jsonify({
        'success': True,
        'message': f'Welcome to KisanDwar, {name}! Account created successfully.',
        'user': {
            'id': farmer_id,
            'name': name,
            'phone': phone,
            'state': state,
            'district': district,
            'role': 'farmer'
        }
    })

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Farmer login with phone + password."""
    data = request.json or {}

    phone = data.get('phone', '').strip()
    password = data.get('password', '').strip()

    if not phone or not password:
        return jsonify({'error': 'Mobile number and password are required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM farmers WHERE phone = ? AND is_registered = 1', (phone,))
    farmer = cursor.fetchone()
    conn.close()

    if not farmer:
        return jsonify({'error': 'No registered account found for this mobile number'}), 401

    if not check_password_hash(farmer['password_hash'], password):
        return jsonify({'error': 'Incorrect password. Please try again.'}), 401

    # Set session
    session.clear()
    session['user_id'] = farmer['id']
    session['user_name'] = farmer['name']
    session['user_phone'] = farmer['phone']
    session['user_role'] = 'farmer'
    session['preferred_mandi_id'] = farmer['preferred_mandi_id'] or 1
    session['is_guest'] = False

    return jsonify({
        'success': True,
        'message': f'Welcome back, {farmer["name"]}!',
        'user': {
            'id': farmer['id'],
            'name': farmer['name'],
            'phone': farmer['phone'],
            'state': farmer['state'] or '',
            'district': farmer['district'] or '',
            'preferred_mandi_id': farmer['preferred_mandi_id'],
            'role': 'farmer'
        }
    })

@app.route('/api/auth/admin-login', methods=['POST'])
def auth_admin_login():
    """Mandi Admin login."""
    data = request.json or {}

    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM admin_users WHERE username = ?', (username,))
    admin = cursor.fetchone()
    conn.close()

    if not admin:
        return jsonify({'error': 'Invalid admin credentials'}), 401

    if not check_password_hash(admin['password_hash'], password):
        return jsonify({'error': 'Invalid admin credentials'}), 401

    # Set session
    session.clear()
    session['is_admin'] = True
    session['admin_id'] = admin['id']
    session['user_name'] = admin['display_name']
    session['user_role'] = 'admin'
    session['admin_mandi_id'] = admin['mandi_id']
    session['is_guest'] = False

    return jsonify({
        'success': True,
        'message': f'Welcome, {admin["display_name"]}! Mandi Operations Desk is ready.',
        'user': {
            'name': admin['display_name'],
            'role': 'admin',
            'mandi_id': admin['mandi_id']
        }
    })

@app.route('/api/auth/guest', methods=['POST'])
def auth_guest():
    """Set a guest/demo session. No credentials required."""
    session.clear()
    session['is_guest'] = True
    session['user_name'] = 'Guest'
    session['user_role'] = 'guest'

    return jsonify({
        'success': True,
        'message': 'Guest session started. You can explore all KisanDwar features!',
        'user': {
            'name': 'Guest',
            'role': 'guest'
        }
    })

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    """Clear session and redirect to login."""
    session.clear()
    return jsonify({'success': True, 'redirect': '/'})

@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    """Return current session info for the frontend."""
    if session.get('is_admin'):
        return jsonify({
            'logged_in': True,
            'role': 'admin',
            'name': session.get('user_name', 'Admin'),
            'mandi_id': session.get('admin_mandi_id', 1)
        })
    elif session.get('user_id'):
        return jsonify({
            'logged_in': True,
            'role': 'farmer',
            'name': session.get('user_name', ''),
            'phone': session.get('user_phone', ''),
            'preferred_mandi_id': session.get('preferred_mandi_id', 1),
            'user_id': session.get('user_id')
        })
    elif session.get('is_guest'):
        return jsonify({
            'logged_in': True,
            'role': 'guest',
            'name': 'Guest'
        })
    else:
        return jsonify({'logged_in': False, 'role': None})

@app.route('/api/my-bookings', methods=['GET'])
def my_bookings():
    """Return all bookings for the currently logged-in farmer."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in as a farmer'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT t.token_number, t.booking_date, t.time_slot, t.lane_number,
               t.vehicle_number, t.current_stage, t.estimated_qty_quintals,
               t.net_weight_quintals, t.quality_grade, t.total_msp_amount,
               t.dbt_reference_utr, t.created_at,
               c.name_en as crop_name, m.name as mandi_name
        FROM tokens t
        JOIN crops c ON t.crop_id = c.id
        JOIN mandis m ON t.mandi_id = m.id
        WHERE t.farmer_id = ?
        ORDER BY t.id DESC
    ''', (user_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)

# ==========================================
# PUBLIC / FARMER APIS
# ==========================================

@app.route('/api/mandis', methods=['GET'])
def get_mandis():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, code, name, district, state, daily_capacity,
               current_trucks_in_yard, max_yard_capacity, avg_processing_time_mins
        FROM mandis WHERE status = 'ACTIVE'
    ''')
    mandis = []
    for row in cursor.fetchall():
        m = dict(row)
        # Calculate real-time congestion
        cursor.execute('''
            SELECT COUNT(*) FROM tokens 
            WHERE mandi_id = ? AND current_stage IN ('GATE_IN', 'WEIGHMENT', 'QUALITY_CHECK')
        ''', (m['id'],))
        active_inside = cursor.fetchone()[0]
        
        cursor.execute('''
            SELECT COUNT(*) FROM tokens 
            WHERE mandi_id = ? AND current_stage = 'SLOT_BOOKED'
        ''', (m['id'],))
        waiting_outside = cursor.fetchone()[0]

        total_load = active_inside + waiting_outside
        congestion_pct = min(100, int((active_inside / max(1, m['max_yard_capacity'])) * 100))
        
        if congestion_pct < 50:
            congestion_level = 'LOW'
            congestion_color = '#10b981' # emerald
        elif congestion_pct < 80:
            congestion_level = 'MODERATE'
            congestion_color = '#f59e0b' # amber
        else:
            congestion_level = 'HIGH'
            congestion_color = '#ef4444' # red

        m['active_inside'] = active_inside
        m['waiting_outside'] = waiting_outside
        m['congestion_pct'] = congestion_pct
        m['congestion_level'] = congestion_level
        m['congestion_color'] = congestion_color
        mandis.append(m)

    conn.close()
    return jsonify(mandis)

@app.route('/api/crops', methods=['GET'])
def get_crops():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, code, name_en, name_hi, name_pa, category, msp_per_quintal, moisture_standard_max, measuring_unit
        FROM crops ORDER BY name_en ASC
    ''')
    crops = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(crops)

@app.route('/api/slots', methods=['GET'])
def get_slots():
    mandi_id = request.args.get('mandi_id', 1, type=int)
    booking_date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))

    standard_slots = [
        '08:00 AM - 09:00 AM',
        '09:00 AM - 10:00 AM',
        '10:00 AM - 11:00 AM',
        '11:00 AM - 12:00 PM',
        '12:00 PM - 01:00 PM',
        '01:00 PM - 02:00 PM',
        '02:00 PM - 03:00 PM',
        '03:00 PM - 04:00 PM',
        '04:00 PM - 05:00 PM'
    ]

    conn = get_db()
    cursor = conn.cursor()

    slot_data = []
    max_slot_capacity = 8 # max 8 vehicles per hourly slot for smooth traffic

    for s in standard_slots:
        cursor.execute('''
            SELECT COUNT(*) FROM tokens 
            WHERE mandi_id = ? AND booking_date = ? AND time_slot = ?
        ''', (mandi_id, booking_date, s))
        booked_count = cursor.fetchone()[0]

        occupancy_pct = int((booked_count / max_slot_capacity) * 100)
        if occupancy_pct < 50:
            status = 'AVAILABLE'
            badge = 'Low Traffic 🟢'
            color = '#10b981'
        elif occupancy_pct < 85:
            status = 'FAST_FILLING'
            badge = 'Moderate Traffic 🟡'
            color = '#f59e0b'
        else:
            status = 'BUSY'
            badge = 'High Traffic 🔴'
            color = '#ef4444'

        slot_data.append({
            'time_slot': s,
            'booked': booked_count,
            'capacity': max_slot_capacity,
            'available': max(0, max_slot_capacity - booked_count),
            'occupancy_pct': occupancy_pct,
            'status': status,
            'badge': badge,
            'color': color
        })

    conn.close()
    return jsonify(slot_data)

@app.route('/api/book-slot', methods=['POST'])
def book_slot():
    data = request.json or {}

    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    aadhaar_last4 = data.get('aadhaar_last4', '0000').strip()
    village = data.get('village', 'Demo Village').strip()
    district = data.get('district', 'Ludhiana').strip()
    state = data.get('state', 'Punjab').strip()
    bank_account = data.get('bank_account', '30982711094').strip()
    bank_ifsc = data.get('bank_ifsc', 'SBIN0001248').strip()
    bank_name = data.get('bank_name', 'State Bank of India').strip()

    mandi_id = int(data.get('mandi_id', 1))
    crop_id = int(data.get('crop_id', 1))
    booking_date = data.get('booking_date', datetime.now().strftime('%Y-%m-%d'))
    time_slot = data.get('time_slot', '11:00 AM - 12:00 PM')
    vehicle_type = data.get('vehicle_type', 'Tractor Trolley')
    vehicle_number = data.get('vehicle_number', 'PB-10-DEMO-2026').upper().strip()
    estimated_qty = float(data.get('estimated_qty_quintals', 50.0))

    if not name or not phone:
        return jsonify({'error': 'Name and phone are required'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Prefer logged-in farmer; fall back to phone lookup / create
    session_user_id = session.get('user_id')
    if session_user_id:
        farmer_id = session_user_id
        # Sync name/phone from session
        name = session.get('user_name', name)
        phone = session.get('user_phone', phone)
    else:
        cursor.execute('SELECT id FROM farmers WHERE phone = ?', (phone,))
        farmer_row = cursor.fetchone()
        if farmer_row:
            farmer_id = farmer_row['id']
        else:
            cursor.execute('''
                INSERT INTO farmers (farmer_uid, name, phone, aadhaar_last4, village, district, state, bank_account, bank_ifsc, bank_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (f'FARM-{random.randint(1000, 9999)}', name, phone, aadhaar_last4, village, district, state, bank_account, bank_ifsc, bank_name))
            farmer_id = cursor.lastrowid

    # Get Mandi code
    cursor.execute('SELECT code, name FROM mandis WHERE id = ?', (mandi_id,))
    mandi = cursor.fetchone()
    mandi_code = mandi['code'] if mandi else 'MND-KHN'
    mandi_name = mandi['name'] if mandi else 'Khanna Mandi'

    # Get Crop name
    cursor.execute('SELECT name_en, msp_per_quintal FROM crops WHERE id = ?', (crop_id,))
    crop = cursor.fetchone()
    crop_name = crop['name_en'] if crop else 'Wheat'
    crop_msp = crop['msp_per_quintal'] if crop else 2275.0

    # Generate sequential token number
    cursor.execute('SELECT COUNT(*) FROM tokens')
    total_tokens = cursor.fetchone()[0]
    token_number = f"{mandi_code}-{100 + total_tokens + 1}"
    lane_number = random.choice(['Lane-A', 'Lane-B', 'Lane-C'])

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        INSERT INTO tokens (
            token_number, farmer_id, mandi_id, crop_id, booking_date, time_slot,
            lane_number, vehicle_type, vehicle_number, estimated_qty_quintals,
            current_stage, stage_updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SLOT_BOOKED', ?, ?)
    ''', (token_number, farmer_id, mandi_id, crop_id, booking_date, time_slot, lane_number, vehicle_type, vehicle_number, estimated_qty, now, now))

    # Send confirmation SMS
    sms_text = (
        f"KisanDwar: e-Token #{token_number} confirmed for {name}. Mandi: {mandi_name}, "
        f"Slot: {time_slot}, Lane: {lane_number}. Carry QR pass on phone. Toll-Free: 1800-180-1551"
    )
    cursor.execute('''
        INSERT INTO sms_logs (token_number, recipient_phone, message_text, channel, sent_at)
        VALUES (?, ?, ?, 'SMS_GATEWAY', ?)
    ''', (token_number, phone, sms_text, now))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'token_number': token_number,
        'mandi_name': mandi_name,
        'crop_name': crop_name,
        'time_slot': time_slot,
        'lane_number': lane_number,
        'sms_sent': sms_text
    })

@app.route('/api/tokens/<token_number>', methods=['GET'])
def get_token_details(token_number):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT t.*, 
               f.name as farmer_name, f.phone as farmer_phone, f.aadhaar_last4, f.village, f.district as farmer_district,
               f.bank_account, f.bank_ifsc, f.bank_name,
               m.name as mandi_name, m.district as mandi_district, m.avg_processing_time_mins,
               c.name_en as crop_name_en, c.name_hi as crop_name_hi, c.name_pa as crop_name_pa,
               c.msp_per_quintal, c.moisture_standard_max
        FROM tokens t
        JOIN farmers f ON t.farmer_id = f.id
        JOIN mandis m ON t.mandi_id = m.id
        JOIN crops c ON t.crop_id = c.id
        WHERE t.token_number = ?
    ''', (token_number,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({'error': 'Token not found'}), 404

    token_data = dict(row)

    # Get SMS logs
    cursor.execute('''
        SELECT message_text, sent_at, channel, status
        FROM sms_logs WHERE token_number = ?
        ORDER BY id ASC
    ''', (token_number,))
    token_data['sms_history'] = [dict(s) for s in cursor.fetchall()]

    conn.close()
    return jsonify(token_data)

@app.route('/api/queue-status/<token_number>', methods=['GET'])
def get_queue_status(token_number):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT t.*, m.name as mandi_name, m.avg_processing_time_mins
        FROM tokens t
        JOIN mandis m ON t.mandi_id = m.id
        WHERE t.token_number = ?
    ''', (token_number,))
    token = cursor.fetchone()
    if not token:
        conn.close()
        return jsonify({'error': 'Token not found'}), 404

    mandi_id = token['mandi_id']
    stage = token['current_stage']
    avg_mins = token['avg_processing_time_mins'] or 20

    # Count how many tokens are currently ahead in the queue
    cursor.execute('''
        SELECT COUNT(*) FROM tokens
        WHERE mandi_id = ? AND booking_date = ? 
          AND current_stage IN ('GATE_IN', 'WEIGHMENT', 'QUALITY_CHECK')
          AND id < ?
    ''', (mandi_id, token['booking_date'], token['id']))
    in_process_ahead = cursor.fetchone()[0]

    cursor.execute('''
        SELECT COUNT(*) FROM tokens
        WHERE mandi_id = ? AND booking_date = ? 
          AND current_stage = 'SLOT_BOOKED'
          AND id < ?
    ''', (mandi_id, token['booking_date'], token['id']))
    waiting_ahead = cursor.fetchone()[0]

    total_ahead = in_process_ahead + waiting_ahead

    # Which token is currently being served at gate / weighbridge?
    cursor.execute('''
        SELECT token_number FROM tokens
        WHERE mandi_id = ? AND current_stage IN ('GATE_IN', 'WEIGHMENT')
        ORDER BY id DESC LIMIT 1
    ''')
    active_row = cursor.fetchone()
    currently_serving = active_row['token_number'] if active_row else 'MND-KHN-103'

    est_wait_mins = max(0, total_ahead * avg_mins) if stage == 'SLOT_BOOKED' else 0

    conn.close()
    return jsonify({
        'token_number': token_number,
        'stage': stage,
        'currently_serving': currently_serving,
        'tokens_ahead': total_ahead,
        'estimated_wait_mins': est_wait_mins,
        'lane': token['lane_number'],
        'time_slot': token['time_slot']
    })

# ==========================================
# MANDI OFFICER / APMC CONTROL DESK APIS
# ==========================================

@app.route('/api/officer/queue', methods=['GET'])
def get_officer_queue():
    mandi_id = request.args.get('mandi_id', 1, type=int)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT t.*, 
               f.name as farmer_name, f.phone as farmer_phone, f.village,
               c.name_en as crop_name, c.msp_per_quintal
        FROM tokens t
        JOIN farmers f ON t.farmer_id = f.id
        JOIN crops c ON t.crop_id = c.id
        WHERE t.mandi_id = ?
        ORDER BY t.id DESC
    ''', (mandi_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/officer/advance-stage', methods=['POST'])
def advance_stage():
    data = request.json or {}
    token_number = data.get('token_number')
    target_stage = data.get('target_stage') # optional override
    
    # Custom payload data from officer actions
    gross_weight = data.get('gross_weight')
    tare_weight = data.get('tare_weight')
    moisture = data.get('moisture')
    foreign_matter = data.get('foreign_matter')

    if not token_number:
        return jsonify({'error': 'Token number required'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT t.*, f.name as farmer_name, f.phone as farmer_phone, f.bank_account, f.bank_ifsc,
               c.msp_per_quintal, c.name_en as crop_name, m.name as mandi_name
        FROM tokens t
        JOIN farmers f ON t.farmer_id = f.id
        JOIN crops c ON t.crop_id = c.id
        JOIN mandis m ON t.mandi_id = m.id
        WHERE t.token_number = ?
    ''', (token_number,))
    token = cursor.fetchone()

    if not token:
        conn.close()
        return jsonify({'error': 'Token not found'}), 404

    current_stage = token['current_stage']
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    next_stage = target_stage
    sms_msg = None

    if not next_stage:
        if current_stage == 'SLOT_BOOKED':
            next_stage = 'GATE_IN'
        elif current_stage == 'GATE_IN':
            next_stage = 'WEIGHMENT'
        elif current_stage == 'WEIGHMENT':
            next_stage = 'QUALITY_CHECK'
        elif current_stage == 'QUALITY_CHECK':
            next_stage = 'COMPLETED'
        else:
            next_stage = current_stage

    # Execute stage-specific logic
    if next_stage == 'GATE_IN':
        cursor.execute('''
            UPDATE tokens SET current_stage = 'GATE_IN', stage_updated_at = ? WHERE token_number = ?
        ''', (now, token_number))
        sms_msg = f"KisanDwar: Vehicle {token['vehicle_number']} entered Gate #1 at {token['mandi_name']}. Please proceed to Weighbridge Lane 1."

    elif next_stage == 'WEIGHMENT':
        g_wt = float(gross_weight) if gross_weight else (token['estimated_qty_quintals'] + 45.0)
        t_wt = float(tare_weight) if tare_weight else 45.0
        n_wt = round(g_wt - t_wt, 2)

        cursor.execute('''
            UPDATE tokens 
            SET current_stage = 'WEIGHMENT', gross_weight_quintals = ?, tare_weight_quintals = ?, 
                net_weight_quintals = ?, stage_updated_at = ?
            WHERE token_number = ?
        ''', (g_wt, t_wt, n_wt, now, token_number))
        sms_msg = f"KisanDwar Weighbridge: Gross={g_wt} Qtl, Tare={t_wt} Qtl. Verified Net Weight={n_wt} Quintals. Proceed to Quality Lab."

    elif next_stage == 'QUALITY_CHECK':
        # Default realistic moisture & grading
        m_pct = float(moisture) if moisture is not None else 11.4
        fm_pct = float(foreign_matter) if foreign_matter is not None else 0.5
        grade = 'Grade-A' if m_pct <= 12.0 else 'Grade-B'
        
        # Calculate MSP
        net_wt = token['net_weight_quintals'] or token['estimated_qty_quintals']
        msp_rate = token['msp_per_quintal']
        total_msp = round(net_wt * msp_rate, 2)

        cursor.execute('''
            UPDATE tokens 
            SET current_stage = 'QUALITY_CHECK', moisture_content_pct = ?, foreign_matter_pct = ?,
                quality_grade = ?, total_msp_amount = ?, stage_updated_at = ?
            WHERE token_number = ?
        ''', (m_pct, fm_pct, grade, total_msp, now, token_number))
        sms_msg = f"KisanDwar Quality: Grade {grade} confirmed (Moisture: {m_pct}%). Total MSP Payable: Rs. {total_msp:,.2f}. Pending DBT transfer."

    elif next_stage == 'COMPLETED':
        net_wt = token['net_weight_quintals'] or token['estimated_qty_quintals']
        msp_rate = token['msp_per_quintal']
        total_msp = token['total_msp_amount'] or round(net_wt * msp_rate, 2)
        utr_number = f"PFMS-DBT-{datetime.now().strftime('%Y%m%d%H%M')}{random.randint(100, 999)}"

        cursor.execute('''
            UPDATE tokens 
            SET current_stage = 'COMPLETED', total_msp_amount = ?, dbt_reference_utr = ?, stage_updated_at = ?
            WHERE token_number = ?
        ''', (total_msp, utr_number, now, token_number))
        sms_msg = (
            f"KisanDwar DBT SUCCESS! Rs. {total_msp:,.2f} disbursed to {token['farmer_name']} "
            f"(A/c: XX{token['bank_account'][-4:] if token['bank_account'] else '0000'}) via UTR: {utr_number}. J-Form receipt generated."
        )

    # Save SMS log
    if sms_msg:
        cursor.execute('''
            INSERT INTO sms_logs (token_number, recipient_phone, message_text, channel, sent_at)
            VALUES (?, ?, ?, 'SMS_GATEWAY', ?)
        ''', (token_number, token['farmer_phone'], sms_msg, now))

    conn.commit()

    # Re-fetch updated token
    cursor.execute('SELECT * FROM tokens WHERE token_number = ?', (token_number,))
    updated_token = dict(cursor.fetchone())
    conn.close()

    return jsonify({
        'success': True,
        'stage': next_stage,
        'sms_sent': sms_msg,
        'token': updated_token
    })

@app.route('/api/officer/stats', methods=['GET'])
def get_officer_stats():
    mandi_id = request.args.get('mandi_id', 1, type=int)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM mandis WHERE id = ?', (mandi_id,))
    mandi = dict(cursor.fetchone())

    # Count today's tokens by stage
    cursor.execute('''
        SELECT current_stage, COUNT(*) as cnt 
        FROM tokens WHERE mandi_id = ?
        GROUP BY current_stage
    ''', (mandi_id,))
    stage_counts = {row['current_stage']: row['cnt'] for row in cursor.fetchall()}

    # Total quantity procured today (quintals)
    cursor.execute('''
        SELECT SUM(net_weight_quintals) FROM tokens
        WHERE mandi_id = ? AND current_stage IN ('QUALITY_CHECK', 'COMPLETED')
    ''', (mandi_id,))
    procured_qtl = cursor.fetchone()[0] or 110.0

    # Total MSP disbursed today (INR)
    cursor.execute('''
        SELECT SUM(total_msp_amount) FROM tokens
        WHERE mandi_id = ? AND current_stage = 'COMPLETED'
    ''', (mandi_id,))
    disbursed_inr = cursor.fetchone()[0] or 147875.0

    # Waiting trucks (booked but outside)
    booked_count = stage_counts.get('SLOT_BOOKED', 0)
    inside_count = stage_counts.get('GATE_IN', 0) + stage_counts.get('WEIGHMENT', 0) + stage_counts.get('QUALITY_CHECK', 0)
    completed_count = stage_counts.get('COMPLETED', 0)

    # Congestion rate
    congestion_pct = min(100, int((inside_count / max(1, mandi['max_yard_capacity'])) * 100))

    conn.close()
    return jsonify({
        'mandi_name': mandi['name'],
        'yard_capacity': mandi['max_yard_capacity'],
        'trucks_inside': inside_count,
        'trucks_waiting': booked_count,
        'trucks_completed': completed_count,
        'congestion_pct': congestion_pct,
        'total_procured_quintals': round(procured_qtl, 1),
        'total_msp_disbursed_inr': round(disbursed_inr, 2),
        'historic_avg_wait_hours': 16.5,
        'current_avg_wait_minutes': 38,
        'time_reduction_pct': 96
    })

# ==========================================
# OFFLINE / FEATURE-PHONE SMS BOOKING SIMULATOR
# ==========================================

@app.route('/api/offline-sms-book', methods=['POST'])
def offline_sms_book():
    """
    Simulates a non-smartphone farmer sending a simple SMS to 92123-KISAN:
    e.g. "BOOK WHEAT 40 KHANNA" from phone 9876543210
    """
    data = request.json or {}
    raw_message = data.get('sms_text', '').strip().upper()
    sender_phone = data.get('sender_phone', '9876543210').strip()

    if not raw_message:
        return jsonify({'error': 'Empty SMS text'}), 400

    parts = raw_message.split()
    # Expecting format: BOOK <CROP> <QTY> <MANDI>
    crop_keyword = 'WHEAT'
    qty = 40.0
    mandi_keyword = 'KHANNA'

    for p in parts:
        if p in ['WHEAT', 'KANAK', 'GEHU', 'PADDY', 'DHAN', 'MUSTARD', 'SARSON']:
            crop_keyword = p
        elif p.replace('.', '', 1).isdigit():
            qty = float(p)
        elif p in ['KHANNA', 'KARNAL', 'BARNALA', 'UJJAIN']:
            mandi_keyword = p

    # Map to DB
    crop_code = 'WHEAT'
    if 'PADDY' in crop_keyword or 'DHAN' in crop_keyword:
        crop_code = 'PADDY_COMM'
    elif 'MUSTARD' in crop_keyword or 'SARSON' in crop_keyword:
        crop_code = 'MUSTARD'

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name_en FROM crops WHERE code = ?", (crop_code,))
    crop_row = cursor.fetchone()
    crop_id = crop_row['id'] if crop_row else 1
    crop_name = crop_row['name_en'] if crop_row else 'Wheat'

    cursor.execute("SELECT id, code, name FROM mandis WHERE name LIKE ?", (f'%{mandi_keyword}%',))
    mandi_row = cursor.fetchone()
    mandi_id = mandi_row['id'] if mandi_row else 1
    mandi_code = mandi_row['code'] if mandi_row else 'MND-KHN'
    mandi_name = mandi_row['name'] if mandi_row else 'Khanna Mandi'

    # Check or create farmer
    cursor.execute("SELECT id, name FROM farmers WHERE phone = ?", (sender_phone,))
    farmer = cursor.fetchone()
    if farmer:
        farmer_id = farmer['id']
        farmer_name = farmer['name']
    else:
        cursor.execute('''
            INSERT INTO farmers (farmer_uid, name, phone, aadhaar_last4, village, district, state)
            VALUES (?, ?, ?, '1122', 'Gram Seva', 'Ludhiana', 'Punjab')
        ''', (f'FARM-{random.randint(1000, 9999)}', 'Kisan Brother', sender_phone))
        farmer_id = cursor.lastrowid
        farmer_name = 'Kisan Brother'

    cursor.execute('SELECT COUNT(*) FROM tokens')
    total_tokens = cursor.fetchone()[0]
    token_number = f"{mandi_code}-{100 + total_tokens + 1}"
    today = datetime.now().strftime('%Y-%m-%d')
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        INSERT INTO tokens (
            token_number, farmer_id, mandi_id, crop_id, booking_date, time_slot,
            lane_number, vehicle_type, vehicle_number, estimated_qty_quintals,
            current_stage, stage_updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, '02:00 PM - 03:00 PM', 'Lane-C', 'Tractor Trolley', 'PB-10-SMS-88', ?, 'SLOT_BOOKED', ?, ?)
    ''', (token_number, farmer_id, mandi_id, crop_id, today, qty, now, now))

    reply_sms = (
        f"KisanDwar: Token #{token_number} Booked via SMS! Date: {today} [02:00 PM - 03:00 PM]. "
        f"Center: {mandi_name}. Crop: {crop_name}, Qty: {qty} Qtl. Show this SMS at Gate."
    )
    cursor.execute('''
        INSERT INTO sms_logs (token_number, recipient_phone, message_text, channel, sent_at)
        VALUES (?, ?, ?, 'SMS_INCOMING_REPLY', ?)
    ''', (token_number, sender_phone, reply_sms, now))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'token_number': token_number,
        'parsed_crop': crop_keyword,
        'parsed_qty': qty,
        'parsed_mandi': mandi_name,
        'reply_sms': reply_sms
    })

# ==========================================
# DEMO RESET API (FOR PITCH RESTARTS)
# ==========================================

@app.route('/api/reset-demo', methods=['POST'])
def reset_demo():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DROP TABLE IF EXISTS tokens')
    cursor.execute('DROP TABLE IF EXISTS sms_logs')
    cursor.execute('DROP TABLE IF EXISTS farmers')
    cursor.execute('DROP TABLE IF EXISTS crops')
    cursor.execute('DROP TABLE IF EXISTS mandis')
    # Keep admin_users intact across resets
    conn.commit()
    conn.close()

    init_db()
    seed_db()
    seed_admin_user()
    return jsonify({'success': True, 'message': 'Demo database re-seeded successfully!'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("=" * 60)
    print("  KisanDwar / MandiSetu - SIH Round 1 Prototype Server")
    print(f"  Serving on: http://0.0.0.0:{port}")
    print("  Auth: Farmer Register/Login, Mandi Admin Login, Guest")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=True)

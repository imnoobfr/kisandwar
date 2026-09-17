"""
KisanDwar / MandiSetu Database Layer
SQLite schema & pre-seeded realistic Indian Mandi data for SIH Round 1 Presentation
"""

import sqlite3
import os
import json
from datetime import datetime
from werkzeug.security import generate_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), 'mandi_queue.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Mandis / Procurement Centers
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mandis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            name TEXT,
            district TEXT,
            state TEXT,
            daily_capacity INTEGER,
            current_trucks_in_yard INTEGER,
            max_yard_capacity INTEGER,
            avg_processing_time_mins INTEGER,
            status TEXT DEFAULT 'ACTIVE'
        )
    ''')

    # Crops with MSP (Minimum Support Price)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS crops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            name_en TEXT,
            name_hi TEXT,
            name_pa TEXT,
            category TEXT,
            msp_per_quintal REAL,
            moisture_standard_max REAL,
            measuring_unit TEXT DEFAULT 'Quintal'
        )
    ''')

    # Farmers
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS farmers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farmer_uid TEXT UNIQUE,
            name TEXT,
            phone TEXT,
            aadhaar_last4 TEXT,
            village TEXT,
            district TEXT,
            state TEXT,
            bank_account TEXT,
            bank_ifsc TEXT,
            bank_name TEXT
        )
    ''')

    # --- Non-destructive migration: add auth columns to farmers if missing ---
    existing_cols = [row[1] for row in cursor.execute("PRAGMA table_info(farmers)").fetchall()]

    if 'password_hash' not in existing_cols:
        cursor.execute("ALTER TABLE farmers ADD COLUMN password_hash TEXT DEFAULT NULL")

    if 'preferred_mandi_id' not in existing_cols:
        cursor.execute("ALTER TABLE farmers ADD COLUMN preferred_mandi_id INTEGER DEFAULT NULL")

    if 'is_registered' not in existing_cols:
        cursor.execute("ALTER TABLE farmers ADD COLUMN is_registered INTEGER DEFAULT 0")

    # Procurement Tokens / Slot Bookings
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_number TEXT UNIQUE,
            farmer_id INTEGER,
            mandi_id INTEGER,
            crop_id INTEGER,
            booking_date TEXT,
            time_slot TEXT,
            lane_number TEXT,
            vehicle_type TEXT,
            vehicle_number TEXT,
            estimated_qty_quintals REAL,
            gross_weight_quintals REAL DEFAULT NULL,
            tare_weight_quintals REAL DEFAULT NULL,
            net_weight_quintals REAL DEFAULT NULL,
            moisture_content_pct REAL DEFAULT NULL,
            foreign_matter_pct REAL DEFAULT NULL,
            quality_grade TEXT DEFAULT NULL,
            total_msp_amount REAL DEFAULT NULL,
            dbt_reference_utr TEXT DEFAULT NULL,
            current_stage TEXT DEFAULT 'SLOT_BOOKED',
            stage_updated_at TEXT,
            created_at TEXT,
            FOREIGN KEY(farmer_id) REFERENCES farmers(id),
            FOREIGN KEY(mandi_id) REFERENCES mandis(id),
            FOREIGN KEY(crop_id) REFERENCES crops(id)
        )
    ''')

    # Mock SMS Notification Logs
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sms_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_number TEXT,
            recipient_phone TEXT,
            message_text TEXT,
            channel TEXT DEFAULT 'SMS_GATEWAY',
            sent_at TEXT,
            status TEXT DEFAULT 'DELIVERED'
        )
    ''')

    # Mandi Admin Users (for admin login)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT,
            display_name TEXT,
            role TEXT DEFAULT 'mandi_admin',
            mandi_id INTEGER DEFAULT 1
        )
    ''')

    conn.commit()
    conn.close()

def seed_admin_user():
    """Seed the default Mandi Admin account. Runs once."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM admin_users")
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO admin_users (username, password_hash, display_name, role, mandi_id)
            VALUES (?, ?, ?, 'mandi_admin', 1)
        ''', (
            'admin',
            generate_password_hash('mandi@2026'),
            'Mandi Inspector (Khanna)'
        ))
        conn.commit()
    conn.close()

def seed_db():
    conn = get_db()
    cursor = conn.cursor()

    # Check if already seeded
    cursor.execute("SELECT COUNT(*) FROM mandis")
    if cursor.fetchone()[0] > 0:
        conn.close()
        return

    # Seed Mandis
    mandis = [
        ('MND-KHN', "Khanna Grain Market (Asia's Largest)", 'Ludhiana', 'Punjab', 450, 48, 70, 20),
        ('MND-KRN', 'Karnal APMC Sub-Yard', 'Karnal', 'Haryana', 320, 26, 45, 18),
        ('MND-BRN', 'Barnala Food Grain Center', 'Barnala', 'Punjab', 280, 22, 40, 22),
        ('MND-UJN', 'Ujjain Krishi Upaj Mandi', 'Ujjain', 'Madhya Pradesh', 380, 31, 55, 25)
    ]
    cursor.executemany('''
        INSERT INTO mandis (code, name, district, state, daily_capacity, current_trucks_in_yard, max_yard_capacity, avg_processing_time_mins)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', mandis)

    # Seed Crops with standard Government MSP (2025-26 Season)
    crops = [
        ('WHEAT', 'Wheat (Kanak)', 'गेहूं', 'ਕਣਕ', 'Rabi', 2275.0, 12.0),
        ('PADDY_COMM', 'Paddy (Common / Dhan)', 'धान (सामान्य)', 'ਝੋਨਾ (ਆਮ)', 'Kharif', 2183.0, 14.0),
        ('PADDY_GRDA', 'Paddy (Grade A / Basmati)', 'धान (ग्रेड-ए)', 'ਝੋਨਾ (ਗ੍ਰੇਡ-ਏ)', 'Kharif', 2203.0, 14.0),
        ('MUSTARD', 'Mustard / Rapeseed (Sarson)', 'सरसों', 'ਸਰ੍ਹੋਂ', 'Rabi', 5650.0, 8.0),
        ('GRAM', 'Bengal Gram / Chana', 'चना', 'ਛੋਲੇ', 'Rabi', 5440.0, 10.0),
        ('COTTON', 'Cotton (Medium Staple)', 'कपास (नरमा)', 'ਕਪਾਹ', 'Kharif', 6620.0, 8.5)
    ]
    cursor.executemany('''
        INSERT INTO crops (code, name_en, name_hi, name_pa, category, msp_per_quintal, moisture_standard_max)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', crops)

    # Seed Farmers
    farmers = [
        ('FARM-001', 'Ramesh Kumar Patel', '9876543210', '4892', 'Amloh Road', 'Ludhiana', 'Punjab', '30982711094', 'SBIN0001248', 'State Bank of India'),
        ('FARM-002', 'Gurpreet Singh Dhillon', '9812345678', '9012', 'Bhadson', 'Patiala', 'Punjab', '50100482910', 'PUNB0249100', 'Punjab National Bank'),
        ('FARM-003', 'Baldev Ram Sharma', '9416023456', '3318', 'Gharaunda', 'Karnal', 'Haryana', '11029482019', 'HDFC0000412', 'HDFC Bank'),
        ('FARM-004', 'Suresh Chandra Meena', '9926012345', '7144', 'Tarana', 'Ujjain', 'Madhya Pradesh', '60291039481', 'BARB0UJJAIN', 'Bank of Baroda'),
        ('FARM-005', 'Harinder Kaur', '9878901234', '5521', 'Mehal Kalan', 'Barnala', 'Punjab', '40192837461', 'SBIN0005512', 'State Bank of India')
    ]
    cursor.executemany('''
        INSERT INTO farmers (farmer_uid, name, phone, aadhaar_last4, village, district, state, bank_account, bank_ifsc, bank_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', farmers)

    today = datetime.now().strftime('%Y-%m-%d')
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    tokens = [
        (
            'MND-KHN-101', 2, 1, 1, today, '08:00 AM - 09:00 AM', 'Lane-A',
            'Tractor Trolley', 'PB-10-DF-4821', 65.0, 112.5, 47.5, 65.0,
            11.2, 0.4, 'Grade-A', 147875.0, 'PFMS-DBT-2026090510294',
            'COMPLETED', now, now
        ),
        (
            'MND-KHN-102', 3, 1, 1, today, '09:00 AM - 10:00 AM', 'Lane-A',
            'Tractor Trolley', 'HR-05-AB-7712', 45.0, 89.2, 44.2, 45.0,
            11.8, 0.6, 'Grade-A', 102375.0, None,
            'QUALITY_CHECK', now, now
        ),
        (
            'MND-KHN-103', 4, 1, 1, today, '10:00 AM - 11:00 AM', 'Lane-B',
            'Mini Truck (Bolero Maxi)', 'MP-13-GA-1904', 35.0, 68.4, 33.4, 35.0,
            None, None, None, None, None,
            'WEIGHMENT', now, now
        ),
        (
            'MND-KHN-104', 5, 1, 1, today, '10:30 AM - 11:30 AM', 'Lane-B',
            'Tractor Trolley', 'PB-19-K-8820', 50.0, None, None, None,
            None, None, None, None, None,
            'GATE_IN', now, now
        ),
        (
            'MND-KHN-105', 1, 1, 1, today, '11:00 AM - 12:00 PM', 'Lane-A',
            'Tractor Trolley', 'PB-10-CR-2291', 50.0, None, None, None,
            None, None, None, None, None,
            'SLOT_BOOKED', now, now
        ),
        (
            'MND-KHN-106', 2, 1, 4, today, '01:00 PM - 02:00 PM', 'Lane-C',
            'Tractor Trolley', 'PB-10-DF-4821', 30.0, None, None, None,
            None, None, None, None, None,
            'SLOT_BOOKED', now, now
        )
    ]

    cursor.executemany('''
        INSERT INTO tokens (
            token_number, farmer_id, mandi_id, crop_id, booking_date, time_slot, lane_number,
            vehicle_type, vehicle_number, estimated_qty_quintals, gross_weight_quintals,
            tare_weight_quintals, net_weight_quintals, moisture_content_pct, foreign_matter_pct,
            quality_grade, total_msp_amount, dbt_reference_utr, current_stage, stage_updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', tokens)

    sms_logs = [
        ('MND-KHN-101', '9812345678', 'KisanDwar: Token #MND-KHN-101 confirmed for Khanna Mandi on ' + today + ' [08:00 AM - 09:00 AM]. Report at Gate 1.', 'SMS_GATEWAY', now),
        ('MND-KHN-101', '9812345678', 'KisanDwar: Vehicle PB-10-DF-4821 verified at Gate Inward. Proceed to Weighbridge #1.', 'SMS_GATEWAY', now),
        ('MND-KHN-101', '9812345678', 'KisanDwar: Net Weight 65.0 Qtl recorded. Quality Grade: Grade-A (Moisture 11.2%).', 'SMS_GATEWAY', now),
        ('MND-KHN-101', '9812345678', 'KisanDwar SUCCESS: MSP Payment of Rs. 1,47,875 has been credited to your Bank A/c via DBT UTR: PFMS-DBT-2026090510294. J-Form available.', 'SMS_GATEWAY', now),
        ('MND-KHN-105', '9876543210', 'KisanDwar: Token #MND-KHN-105 confirmed for Ramesh Kumar Patel at Khanna Mandi for ' + today + ' [11:00 AM - 12:00 PM]. Current Queue: 2 vehicles ahead.', 'SMS_GATEWAY', now)
    ]

    cursor.executemany('''
        INSERT INTO sms_logs (token_number, recipient_phone, message_text, channel, sent_at)
        VALUES (?, ?, ?, ?, ?)
    ''', sms_logs)

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    seed_db()
    seed_admin_user()
    print("Database initialized and seeded successfully.")

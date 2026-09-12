export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================================================
    // BASIC HEADERS
    // =========================================================
    const jsonHeaders = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: jsonHeaders
      });
    }

    // =========================================================
    // API TEST
    // =========================================================
    if (url.pathname === "/api/test") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Rural Health Connect backend is working"
        }),
        { headers: jsonHeaders }
      );
    }

    // =========================================================
    // PATIENT REGISTRATION
    // =========================================================
    if (url.pathname === "/api/patients" && request.method === "POST") {
      try {
        const data = await request.json();

        if (!data.name) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Patient name is required"
            }),
            { status: 400, headers: jsonHeaders }
          );
        }

        const result = await env.DB.prepare(
          `INSERT INTO patients
          (name, age, gender, village, phone)
          VALUES (?, ?, ?, ?, ?)`
        )
          .bind(
            data.name,
            data.age || null,
            data.gender || null,
            data.village || null,
            data.phone || null
          )
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: "Patient registered successfully",
            patient_id: result.meta.last_row_id
          }),
          {
            status: 201,
            headers: jsonHeaders
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to register patient"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // SEARCH PATIENT
    // =========================================================
    if (url.pathname === "/api/patients" && request.method === "GET") {
      try {
        const id = url.searchParams.get("id");
        const name = url.searchParams.get("name");

        let result;

        if (id) {
          result = await env.DB.prepare(
            `SELECT * FROM patients WHERE id = ?`
          )
            .bind(id)
            .all();
        } else if (name) {
          result = await env.DB.prepare(
            `SELECT * FROM patients
             WHERE name LIKE ?
             ORDER BY id DESC`
          )
            .bind(`%${name}%`)
            .all();
        } else {
          result = await env.DB.prepare(
            `SELECT * FROM patients ORDER BY id DESC LIMIT 50`
          ).all();
        }

        return new Response(
          JSON.stringify({
            success: true,
            patients: result.results
          }),
          { headers: jsonHeaders }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to search patients"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // GET FULL PATIENT MEDICAL RECORD
    // =========================================================
    if (
      url.pathname === "/api/patient-record" &&
      request.method === "GET"
    ) {
      try {
        const patientId = url.searchParams.get("patient_id");

        if (!patientId) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Patient ID is required"
            }),
            { status: 400, headers: jsonHeaders }
          );
        }

        const patient = await env.DB.prepare(
          `SELECT * FROM patients WHERE id = ?`
        )
          .bind(patientId)
          .first();

        const records = await env.DB.prepare(
          `SELECT * FROM medical_records
           WHERE patient_id = ?
           ORDER BY created_at DESC`
        )
          .bind(patientId)
          .all();

        const appointments = await env.DB.prepare(
          `SELECT * FROM appointments
           WHERE patient_id = ?
           ORDER BY appointment_date DESC, appointment_time DESC`
        )
          .bind(patientId)
          .all();

        const referrals = await env.DB.prepare(
          `SELECT * FROM referrals
           WHERE patient_id = ?
           ORDER BY referral_date DESC`
        )
          .bind(patientId)
          .all();

        const followups = await env.DB.prepare(
          `SELECT * FROM follow_ups
           WHERE patient_id = ?
           ORDER BY follow_up_date DESC`
        )
          .bind(patientId)
          .all();

        return new Response(
          JSON.stringify({
            success: true,
            patient,
            medical_records: records.results,
            appointments: appointments.results,
            referrals: referrals.results,
            follow_ups: followups.results
          }),
          { headers: jsonHeaders }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to load patient record"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // ADD MEDICAL RECORD
    // =========================================================
    if (
      url.pathname === "/api/medical-records" &&
      request.method === "POST"
    ) {
      try {
        const data = await request.json();

        if (!data.patient_id || !data.notes) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Patient ID and medical notes are required"
            }),
            {
              status: 400,
              headers: jsonHeaders
            }
          );
        }

        const result = await env.DB.prepare(
          `INSERT INTO medical_records
          (patient_id, recorded_by, record_type, notes)
          VALUES (?, ?, ?, ?)`
        )
          .bind(
            data.patient_id,
            data.recorded_by || "Health Worker",
            data.record_type || "General",
            data.notes
          )
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: "Medical record added successfully",
            record_id: result.meta.last_row_id
          }),
          {
            status: 201,
            headers: jsonHeaders
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to add medical record"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // CREATE APPOINTMENT
    // =========================================================
    if (
      url.pathname === "/api/appointments" &&
      request.method === "POST"
    ) {
      try {
        const data = await request.json();

        if (
          !data.patient_id ||
          !data.appointment_date ||
          !data.appointment_time
        ) {
          return new Response(
            JSON.stringify({
              success: false,
              message:
                "Patient ID, appointment date and time are required"
            }),
            {
              status: 400,
              headers: jsonHeaders
            }
          );
        }

        const result = await env.DB.prepare(
          `INSERT INTO appointments
          (patient_id, doctor_name, appointment_date,
           appointment_time, reason)
          VALUES (?, ?, ?, ?, ?)`
        )
          .bind(
            data.patient_id,
            data.doctor_name || null,
            data.appointment_date,
            data.appointment_time,
            data.reason || null
          )
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: "Appointment booked successfully",
            appointment_id: result.meta.last_row_id
          }),
          {
            status: 201,
            headers: jsonHeaders
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to book appointment"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // GET APPOINTMENTS / QUEUE
    // =========================================================
    if (
      url.pathname === "/api/appointments" &&
      request.method === "GET"
    ) {
      try {
        const date = url.searchParams.get("date");

        let result;

        if (date) {
          result = await env.DB.prepare(
            `SELECT
              appointments.*,
              patients.name AS patient_name
             FROM appointments
             LEFT JOIN patients
             ON appointments.patient_id = patients.id
             WHERE appointment_date = ?
             ORDER BY appointment_time ASC`
          )
            .bind(date)
            .all();
        } else {
          result = await env.DB.prepare(
            `SELECT
              appointments.*,
              patients.name AS patient_name
             FROM appointments
             LEFT JOIN patients
             ON appointments.patient_id = patients.id
             ORDER BY appointment_date DESC,
                      appointment_time ASC
             LIMIT 100`
          ).all();
        }

        return new Response(
          JSON.stringify({
            success: true,
            appointments: result.results
          }),
          { headers: jsonHeaders }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to load appointments"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // UPDATE APPOINTMENT STATUS
    // =========================================================
    if (
      url.pathname === "/api/appointments/status" &&
      request.method === "POST"
    ) {
      try {
        const data = await request.json();

        if (!data.id || !data.status) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Appointment ID and status are required"
            }),
            {
              status: 400,
              headers: jsonHeaders
            }
          );
        }

        await env.DB.prepare(
          `UPDATE appointments
           SET status = ?
           WHERE id = ?`
        )
          .bind(data.status, data.id)
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: "Appointment status updated"
          }),
          { headers: jsonHeaders }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to update appointment"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // CREATE REFERRAL
    // =========================================================
    if (
      url.pathname === "/api/referrals" &&
      request.method === "POST"
    ) {
      try {
        const data = await request.json();

        if (
          !data.patient_id ||
          !data.from_facility ||
          !data.to_facility ||
          !data.reason
        ) {
          return new Response(
            JSON.stringify({
              success: false,
              message:
                "Patient ID, from facility, to facility and reason are required"
            }),
            {
              status: 400,
              headers: jsonHeaders
            }
          );
        }

        const result = await env.DB.prepare(
          `INSERT INTO referrals
          (patient_id, from_facility, to_facility, reason)
          VALUES (?, ?, ?, ?)`
        )
          .bind(
            data.patient_id,
            data.from_facility,
            data.to_facility,
            data.reason
          )
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: "Referral created successfully",
            referral_id: result.meta.last_row_id
          }),
          {
            status: 201,
            headers: jsonHeaders
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to create referral"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // GET REFERRALS
    // =========================================================
    if (
      url.pathname === "/api/referrals" &&
      request.method === "GET"
    ) {
      try {
        const result = await env.DB.prepare(
          `SELECT
            referrals.*,
            patients.name AS patient_name
           FROM referrals
           LEFT JOIN patients
           ON referrals.patient_id = patients.id
           ORDER BY referral_date DESC`
        ).all();

        return new Response(
          JSON.stringify({
            success: true,
            referrals: result.results
          }),
          { headers: jsonHeaders }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to load referrals"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // UPDATE REFERRAL STATUS
    // =========================================================
    if (
      url.pathname === "/api/referrals/status" &&
      request.method === "POST"
    ) {
      try {
        const data = await request.json();

        if (!data.id || !data.status) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Referral ID and status are required"
            }),
            {
              status: 400,
              headers: jsonHeaders
            }
          );
        }

        await env.DB.prepare(
          `UPDATE referrals
           SET status = ?,
               completed_at =
               CASE
                 WHEN ? = 'completed'
                 THEN CURRENT_TIMESTAMP
                 ELSE completed_at
               END
           WHERE id = ?`
        )
          .bind(data.status, data.status, data.id)
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: "Referral status updated"
          }),
          { headers: jsonHeaders }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to update referral"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // CREATE FOLLOW-UP
    // =========================================================
    if (
      url.pathname === "/api/follow-ups" &&
      request.method === "POST"
    ) {
      try {
        const data = await request.json();

        if (!data.patient_id || !data.follow_up_date) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Patient ID and follow-up date are required"
            }),
            {
              status: 400,
              headers: jsonHeaders
            }
          );
        }

        const result = await env.DB.prepare(
          `INSERT INTO follow_ups
          (patient_id, follow_up_date, purpose, notes)
          VALUES (?, ?, ?, ?)`
        )
          .bind(
            data.patient_id,
            data.follow_up_date,
            data.purpose || null,
            data.notes || null
          )
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: "Follow-up created successfully",
            follow_up_id: result.meta.last_row_id
          }),
          {
            status: 201,
            headers: jsonHeaders
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to create follow-up"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // GET FOLLOW-UPS
    // =========================================================
    if (
      url.pathname === "/api/follow-ups" &&
      request.method === "GET"
    ) {
      try {
        const patientId = url.searchParams.get("patient_id");

        let result;

        if (patientId) {
          result = await env.DB.prepare(
            `SELECT
              follow_ups.*,
              patients.name AS patient_name
             FROM follow_ups
             LEFT JOIN patients
             ON follow_ups.patient_id = patients.id
             WHERE follow_ups.patient_id = ?
             ORDER BY follow_up_date DESC`
          )
            .bind(patientId)
            .all();
        } else {
          result = await env.DB.prepare(
            `SELECT
              follow_ups.*,
              patients.name AS patient_name
             FROM follow_ups
             LEFT JOIN patients
             ON follow_ups.patient_id = patients.id
             ORDER BY follow_up_date DESC
             LIMIT 100`
          ).all();
        }

        return new Response(
          JSON.stringify({
            success: true,
            follow_ups: result.results
          }),
          { headers: jsonHeaders }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to load follow-ups"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // DASHBOARD STATISTICS
    // =========================================================
    if (
      url.pathname === "/api/dashboard" &&
      request.method === "GET"
    ) {
      try {
        const patients = await env.DB.prepare(
          `SELECT COUNT(*) AS count FROM patients`
        ).first();

        const appointments = await env.DB.prepare(
          `SELECT COUNT(*) AS count FROM appointments`
        ).first();

        const referrals = await env.DB.prepare(
          `SELECT COUNT(*) AS count FROM referrals`
        ).first();

        const pendingReferrals = await env.DB.prepare(
          `SELECT COUNT(*) AS count
           FROM referrals
           WHERE status = 'pending'`
        ).first();

        const records = await env.DB.prepare(
          `SELECT COUNT(*) AS count FROM medical_records`
        ).first();

        return new Response(
          JSON.stringify({
            success: true,
            statistics: {
              patients: patients.count,
              appointments: appointments.count,
              referrals: referrals.count,
              pending_referrals: pendingReferrals.count,
              medical_records: records.count
            }
          }),
          { headers: jsonHeaders }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to load dashboard"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }
    }

    // =========================================================
    // FRONTEND
    // =========================================================

    const html = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Rural Health Connect</title>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  background: #f4f7fb;
  color: #1f2937;
  line-height: 1.5;
}

header {
  background: linear-gradient(135deg, #0f766e, #0e7490);
  color: white;
  padding: 24px 18px;
}

.header-inner {
  max-width: 1200px;
  margin: auto;
}

.logo {
  font-size: 28px;
  font-weight: 800;
}

.tagline {
  margin-top: 5px;
  opacity: .9;
}

nav {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

nav button {
  border: none;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(255,255,255,.15);
  color: white;
  cursor: pointer;
  font-weight: 600;
}

nav button:hover {
  background: rgba(255,255,255,.28);
}

.container {
  width: min(1200px, 94%);
  margin: 25px auto 60px;
}

.hero {
  background: white;
  border-radius: 18px;
  padding: 30px;
  margin-bottom: 25px;
  box-shadow: 0 5px 20px rgba(0,0,0,.07);
}

.hero h1 {
  color: #0f766e;
  margin-bottom: 10px;
}

.hero p {
  color: #64748b;
}

.stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 15px;
  margin: 20px 0;
}

.stat {
  background: white;
  padding: 20px;
  border-radius: 14px;
  box-shadow: 0 4px 15px rgba(0,0,0,.06);
}

.stat-number {
  font-size: 30px;
  font-weight: 800;
  color: #0f766e;
}

.stat-label {
  color: #64748b;
  font-size: 14px;
}

.section {
  background: white;
  border-radius: 16px;
  padding: 25px;
  margin-bottom: 25px;
  box-shadow: 0 4px 15px rgba(0,0,0,.06);
}

.section h2 {
  color: #0f766e;
  margin-bottom: 18px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  font-weight: 700;
  margin-bottom: 6px;
}

input,
select,
textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  font-size: 15px;
}

textarea {
  min-height: 100px;
  resize: vertical;
}

.btn {
  border: none;
  border-radius: 9px;
  padding: 12px 18px;
  cursor: pointer;
  background: #0f766e;
  color: white;
  font-weight: 700;
}

.btn:hover {
  opacity: .9;
}

.btn-secondary {
  background: #0e7490;
}

.btn-danger {
  background: #dc2626;
}

.btn-success {
  background: #15803d;
}

.message {
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
  display: none;
}

.success {
  display: block;
  background: #dcfce7;
  color: #166534;
}

.error {
  display: block;
  background: #fee2e2;
  color: #991b1b;
}

.patient-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 18px;
  border-radius: 12px;
  margin-top: 15px;
}

.patient-card h3 {
  color: #0f766e;
  margin-bottom: 8px;
}

.record {
  border-left: 4px solid #0f766e;
  background: #f8fafc;
  padding: 14px;
  margin: 10px 0;
  border-radius: 8px;
}

.table-wrapper {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

th,
td {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}

th {
  background: #f1f5f9;
}

.badge {
  display: inline-block;
  padding: 5px 9px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
}

.pending {
  background: #fef3c7;
  color: #92400e;
}

.completed {
  background: #dcfce7;
  color: #166534;
}

.emergency {
  background: #fee2e2;
  color: #991b1b;
}

.info-box {
  background: #ecfeff;
  border-left: 4px solid #0891b2;
  padding: 15px;
  margin: 15px 0;
  border-radius: 8px;
}

footer {
  background: #0f172a;
  color: white;
  text-align: center;
  padding: 25px;
  margin-top: 40px;
}

@media (max-width: 900px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .stats {
    grid-template-columns: 1fr;
  }

  .hero,
  .section {
    padding: 18px;
  }

  .logo {
    font-size: 23px;
  }
}
</style>
</head>

<body>

<header>
  <div class="header-inner">
    <div class="logo">🏥 Rural Health Connect</div>
    <div class="tagline">
      Integrated Healthcare Access & Quality Support Platform
    </div>

    <nav>
      <button onclick="scrollToSection('dashboard')">Dashboard</button>
      <button onclick="scrollToSection('patient')">Patient</button>
      <button onclick="scrollToSection('records')">Records</button>
      <button onclick="scrollToSection('appointment')">Appointment</button>
      <button onclick="scrollToSection('referral')">Referral</button>
      <button onclick="scrollToSection('followup')">Follow-up</button>
    </nav>
  </div>
</header>

<div class="container">

  <!-- HERO -->
  <section class="hero">
    <h1>Healthcare for Rural & Underserved Communities</h1>
    <p>
      Connecting patients, frontline health workers and doctors while
      improving continuity of care, referrals, diagnostics and follow-up.
    </p>

    <div class="info-box">
      <strong>Important:</strong>
      This platform supports trained healthcare workers and doctors.
      It does not replace professional medical diagnosis or treatment.
    </div>
  </section>

  <!-- DASHBOARD -->
  <section class="section" id="dashboard">
    <h2>📊 Healthcare Dashboard</h2>

    <div class="stats">
      <div class="stat">
        <div class="stat-number" id="statPatients">0</div>
        <div class="stat-label">Patients</div>
      </div>

      <div class="stat">
        <div class="stat-number" id="statAppointments">0</div>
        <div class="stat-label">Appointments</div>
      </div>

      <div class="stat">
        <div class="stat-number" id="statReferrals">0</div>
        <div class="stat-label">Referrals</div>
      </div>

      <div class="stat">
        <div class="stat-number" id="statPending">0</div>
        <div class="stat-label">Pending Referrals</div>
      </div>

      <div class="stat">
        <div class="stat-number" id="statRecords">0</div>
        <div class="stat-label">Medical Records</div>
      </div>
    </div>

    <button class="btn" onclick="loadDashboard()">
      Refresh Dashboard
    </button>
  </section>

  <!-- PATIENT -->
  <section class="section" id="patient">
    <h2>👤 Patient Registration</h2>

    <div class="grid">

      <div class="form-group">
        <label>Patient Name *</label>
        <input id="patientName" placeholder="Enter full name">
      </div>

      <div class="form-group">
        <label>Age</label>
        <input id="patientAge" type="number" min="0" max="120">
      </div>

      <div class="form-group">
        <label>Gender</label>
        <select id="patientGender">
          <option value="">Select</option>
          <option>Female</option>
          <option>Male</option>
          <option>Other</option>
        </select>
      </div>

      <div class="form-group">
        <label>Village</label>
        <input id="patientVillage" placeholder="Village / Area">
      </div>

      <div class="form-group">
        <label>Phone</label>
        <input id="patientPhone" placeholder="Phone number">
      </div>

    </div>

    <button class="btn" onclick="registerPatient()">
      Register Patient
    </button>

    <div id="patientMessage" class="message"></div>
  </section>

  <!-- SEARCH -->
  <section class="section">
    <h2>🔎 Patient Search</h2>

    <div class="grid">

      <div class="form-group">
        <label>Patient ID</label>
        <input id="searchPatientId" type="number">
      </div>

      <div class="form-group">
        <label>Patient Name</label>
        <input id="searchPatientName">
      </div>

    </div>

    <button class="btn btn-secondary" onclick="searchPatient()">
      Search Patient
    </button>

    <div id="patientResults"></div>
  </section>

  <!-- RECORDS -->
  <section class="section" id="records">
    <h2>📋 Complete Medical Record</h2>

    <div class="form-group">
      <label>Patient ID *</label>
      <input id="recordPatientId" type="number"
             placeholder="Enter patient ID">
    </div>

    <button class="btn" onclick="loadPatientRecord()">
      View Full Medical Report
    </button>

    <div id="fullRecord"></div>
  </section>

  <!-- ADD MEDICAL RECORD -->
  <section class="section">
    <h2>📝 Add Medical Record</h2>

    <div class="grid">

      <div class="form-group">
        <label>Patient ID *</label>
        <input id="medicalPatientId" type="number">
      </div>

      <div class="form-group">
        <label>Recorded By</label>
        <input id="recordedBy"
               placeholder="Doctor / Health Worker">
      </div>

      <div class="form-group">
        <label>Record Type</label>
        <select id="recordType">
          <option>General</option>
          <option>Consultation</option>
          <option>Diagnosis</option>
          <option>Laboratory</option>
          <option>Medication</option>
          <option>Follow-up</option>
          <option>Emergency</option>
        </select>
      </div>

    </div>

    <div class="form-group">
      <label>Medical Notes *</label>
      <textarea id="medicalNotes"
        placeholder="Enter medical information..."></textarea>
    </div>

    <button class="btn" onclick="addMedicalRecord()">
      Save Medical Record
    </button>

    <div id="medicalMessage" class="message"></div>
  </section>

  <!-- APPOINTMENT -->
  <section class="section" id="appointment">
    <h2>📅 Appointment Booking</h2>

    <div class="grid">

      <div class="form-group">
        <label>Patient ID *</label>
        <input id="appointmentPatientId" type="number">
      </div>

      <div class="form-group">
        <label>Doctor Name</label>
        <input id="doctorName"
               placeholder="Doctor name">
      </div>

      <div class="form-group">
        <label>Appointment Date *</label>
        <input id="appointmentDate" type="date">
      </div>

      <div class="form-group">
        <label>Appointment Time *</label>
        <input id="appointmentTime" type="time">
      </div>

    </div>

    <div class="form-group">
      <label>Reason</label>
      <textarea id="appointmentReason"
        placeholder="Reason for consultation"></textarea>
    </div>

    <button class="btn" onclick="bookAppointment()">
      Book Appointment
    </button>

    <div id="appointmentMessage" class="message"></div>
  </section>

  <!-- QUEUE -->
  <section class="section">
    <h2>🧾 Appointment Queue</h2>

    <div class="form-group">
      <label>Select Date</label>
      <input id="queueDate" type="date">
    </div>

    <button class="btn btn-secondary" onclick="loadQueue()">
      Load Queue
    </button>

    <div id="queueResults"></div>
  </section>

  <!-- REFERRAL -->
  <section class="section" id="referral">
    <h2>🔄 Referral Tracking</h2>

    <div class="grid">

      <div class="form-group">
        <label>Patient ID *</label>
        <input id="referralPatientId" type="number">
      </div>

      <div class="form-group">
        <label>From Facility *</label>
        <input id="fromFacility"
               placeholder="PHC / Health Centre">
      </div>

      <div class="form-group">
        <label>To Facility *</label>
        <input id="toFacility"
               placeholder="District Hospital">
      </div>

    </div>

    <div class="form-group">
      <label>Referral Reason *</label>
      <textarea id="referralReason"
        placeholder="Reason for referral"></textarea>
    </div>

    <button class="btn" onclick="createReferral()">
      Create Referral
    </button>

    <div id="referralMessage" class="message"></div>

    <hr style="margin:25px 0;border:none;border-top:1px solid #e2e8f0">

    <button class="btn btn-secondary" onclick="loadReferrals()">
      View Referral Tracking
    </button>

    <div id="referralResults"></div>
  </section>

  <!-- FOLLOW UP -->
  <section class="section" id="followup">
    <h2>🔔 High-Risk / Follow-up Management</h2>

    <div class="grid">

      <div class="form-group">
        <label>Patient ID *</label>
        <input id="followPatientId" type="number">
      </div>

      <div class="form-group">
        <label>Follow-up Date *</label>
        <input id="followDate" type="date">
      </div>

    </div>

    <div class="form-group">
      <label>Purpose</label>
      <input id="followPurpose"
             placeholder="Chronic care / maternal / child / general">
    </div>

    <div class="form-group">
      <label>Notes</label>
      <textarea id="followNotes"></textarea>
    </div>

    <button class="btn" onclick="createFollowUp()">
      Schedule Follow-up
    </button>

    <div id="followMessage" class="message"></div>

    <hr style="margin:25px 0;border:none;border-top:1px solid #e2e8f0">

    <button class="btn btn-secondary" onclick="loadFollowUps()">
      View Follow-ups
    </button>

    <div id="followResults"></div>
  </section>

  <!-- EMERGENCY -->
  <section class="section">
    <h2>🚨 Emergency Escalation</h2>

    <div class="info-box">
      <strong>Emergency Support:</strong>
      If a patient appears seriously unwell, the health worker should
      immediately follow the local emergency protocol and arrange
      appropriate medical care or emergency transport.
    </div>

    <button class="btn btn-danger"
      onclick="alert('Emergency escalation: Contact local emergency medical services and the nearest appropriate healthcare facility.')">
      🚨 Emergency Escalation
    </button>
  </section>

  <!-- ABOUT -->
  <section class="section">
    <h2>🌐 Rural Health Connect</h2>

    <p>
      A digital platform designed to strengthen healthcare access in
      rural and underserved communities through patient records,
      appointments, referrals, follow-up and facility coordination.
    </p>

    <div class="grid" style="margin-top:18px">

      <div class="info-box">
        <strong>Multilingual:</strong><br>
        Marathi • Hindi • English
      </div>

      <div class="info-box">
        <strong>Low Connectivity:</strong><br>
        Designed with lightweight web interfaces for low-bandwidth environments.
      </div>

      <div class="info-box">
        <strong>Continuity of Care:</strong><br>
        Longitudinal patient information and referral tracking.
      </div>

      <div class="info-box">
        <strong>Public Health Support:</strong><br>
        Supports frontline workers and healthcare facilities.
      </div>

    </div>
  </section>

</div>

<footer>
  <strong>Rural Health Connect</strong><br>
  SIH Healthcare Accessibility Solution<br>
  Maharashtra
</footer>

<script>

const API = window.location.origin;

// =========================================================
// HELPERS
// =========================================================

function scrollToSection(id) {
  document.getElementById(id).scrollIntoView({
    behavior: "smooth"
  });
}

function showMessage(elementId, message, success = true) {
  const el = document.getElementById(elementId);

  el.className = "message " + (success ? "success" : "error");
  el.textContent = message;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =========================================================
// DASHBOARD
// =========================================================

async function loadDashboard() {
  try {
    const response = await fetch(API + "/api/dashboard");
    const data = await response.json();

    if (!data.success) return;

    document.getElementById("statPatients").textContent =
      data.statistics.patients;

    document.getElementById("statAppointments").textContent =
      data.statistics.appointments;

    document.getElementById("statReferrals").textContent =
      data.statistics.referrals;

    document.getElementById("statPending").textContent =
      data.statistics.pending_referrals;

    document.getElementById("statRecords").textContent =
      data.statistics.medical_records;

  } catch (error) {
    console.error(error);
  }
}

// =========================================================
// REGISTER PATIENT
// =========================================================

async function registerPatient() {

  const data = {
    name: document.getElementById("patientName").value.trim(),
    age: document.getElementById("patientAge").value,
    gender: document.getElementById("patientGender").value,
    village: document.getElementById("patientVillage").value.trim(),
    phone: document.getElementById("patientPhone").value.trim()
  };

  if (!data.name) {
    showMessage(
      "patientMessage",
      "Please enter patient name",
      false
    );
    return;
  }

  try {

    const response = await fetch(API + "/api/patients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {

      showMessage(
        "patientMessage",
        "Patient registered successfully. Patient ID: " +
        result.patient_id
      );

      document.getElementById("patientName").value = "";
      document.getElementById("patientAge").value = "";
      document.getElementById("patientGender").value = "";
      document.getElementById("patientVillage").value = "";
      document.getElementById("patientPhone").value = "";

      loadDashboard();

    } else {
      showMessage(
        "patientMessage",
        result.message || "Registration failed",
        false
      );
    }

  } catch (error) {
    showMessage(
      "patientMessage",
      "Server error. Please try again.",
      false
    );
  }
}

// =========================================================
// SEARCH PATIENT
// =========================================================

async function searchPatient() {

  const id = document.getElementById("searchPatientId").value.trim();
  const name = document.getElementById("searchPatientName").value.trim();

  if (!id && !name) {
    document.getElementById("patientResults").innerHTML =
      '<div class="message error">Enter Patient ID or Name</div>';
    return;
  }

  try {

    let url = API + "/api/patients?";

    if (id) {
      url += "id=" + encodeURIComponent(id);
    } else {
      url += "name=" + encodeURIComponent(name);
    }

    const response = await fetch(url);
    const data = await response.json();

    const container = document.getElementById("patientResults");

    if (!data.success || data.patients.length === 0) {
      container.innerHTML =
        '<div class="message error">No patient found</div>';
      return;
    }

   container.innerHTML = data.patients.map(patient =>
  '<div class="patient-card">' +
    '<h3>' + escapeHtml(patient.name) + '</h3>' +

    '<p><strong>Patient ID:</strong> ' +
      escapeHtml(patient.id) +
    '</p>' +

    '<p><strong>Age:</strong> ' +
      escapeHtml(patient.age || "N/A") +
    '</p>' +

    '<p><strong>Gender:</strong> ' +
      escapeHtml(patient.gender || "N/A") +
    '</p>' +

    '<p><strong>Village:</strong> ' +
      escapeHtml(patient.village || "N/A") +
    '</p>' +

    '<p><strong>Phone:</strong> ' +
      escapeHtml(patient.phone || "N/A") +
    '</p>' +

    '<br>' +

    '<button class="btn" onclick="openPatientRecord(' +
      patient.id +
    ')">View Full Medical Report</button>' +

  '</div>'
).join("");
  } catch (error) {

    document.getElementById("patientResults").innerHTML =
      '<div class="message error">Unable to search patient</div>';
  }
}

function openPatientRecord(id) {

  document.getElementById("recordPatientId").value = id;

  loadPatientRecord();

  scrollToSection("records");
}

// =========================================================
// FULL PATIENT RECORD
// =========================================================

async function loadPatientRecord() {

  const patientId =
    document.getElementById("recordPatientId").value.trim();

  if (!patientId) {
    document.getElementById("fullRecord").innerHTML =
      '<div class="message error">Enter Patient ID</div>';
    return;
  }

  try {

    const response = await fetch(
      API + "/api/patient-record?patient_id=" +
      encodeURIComponent(patientId)
    );

    const data = await response.json();

    if (!data.success || !data.patient) {
      document.getElementById("fullRecord").innerHTML =
        '<div class="message error">Patient not found</div>';
      return;
    }

    const patient = data.patient;

    let html = `
      <div class="patient-card">

        <h3>👤 ${escapeHtml(patient.name)}</h3>

        <p><strong>Patient ID:</strong>
          ${escapeHtml(patient.id)}
        </p>

        <p><strong>Age:</strong>
          ${escapeHtml(patient.age || "N/A")}
        </p>

        <p><strong>Gender:</strong>
          ${escapeHtml(patient.gender || "N/A")}
        </p>

        <p><strong>Village:</strong>
          ${escapeHtml(patient.village || "N/A")}
        </p>

        <p><strong>Phone:</strong>
          ${escapeHtml(patient.phone || "N/A")}
        </p>

      </div>

      <h3 style="margin-top:25px;color:#0f766e">
        📋 Medical Records
      </h3>
    `;

    if (data.medical_records.length === 0) {

      html += `
        <div class="info-box">
          No medical records available.
        </div>
      `;

    } else {

      html += data.medical_records.map(record => `
        <div class="record">

          <strong>
            ${escapeHtml(record.record_type || "General")}
          </strong>

          <p>${escapeHtml(record.notes)}</p>

          <small>
            Recorded by:
            ${escapeHtml(record.recorded_by || "N/A")}
            |
            ${escapeHtml(record.created_at || "")}
          </small>

        </div>
      `).join("");
    }

    html += `
      <h3 style="margin-top:25px;color:#0f766e">
        📅 Appointments
      </h3>
    `;

    if (data.appointments.length === 0) {

      html += `
        <div class="info-box">
          No appointments available.
        </div>
      `;

    } else {

      html += `
        <div class="table-wrapper">
        <table>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Doctor</th>
            <th>Status</th>
            <th>Reason</th>
          </tr>

          ${data.appointments.map(a => `
            <tr>
              <td>${escapeHtml(a.appointment_date)}</td>
              <td>${escapeHtml(a.appointment_time)}</td>
              <td>${escapeHtml(a.doctor_name || "N/A")}</td>
              <td>${escapeHtml(a.status)}</td>
              <td>${escapeHtml(a.reason || "N/A")}</td>
            </tr>
          `).join("")}

        </table>
        </div>
      `;
    }

    html += `
      <h3 style="margin-top:25px;color:#0f766e">
        🔄 Referrals
      </h3>
    `;

    if (data.referrals.length === 0) {

      html += `
        <div class="info-box">
          No referrals available.
        </div>
      `;

    } else {

      html += data.referrals.map(r => `
        <div class="record">

          <strong>
            ${escapeHtml(r.from_facility)}
            →
            ${escapeHtml(r.to_facility)}
          </strong>

          <p>${escapeHtml(r.reason)}</p>

          <span class="badge ${
            r.status === "completed"
              ? "completed"
              : "pending"
          }">
            ${escapeHtml(r.status)}
          </span>

        </div>
      `).join("");
    }

    html += `
      <h3 style="margin-top:25px;color:#0f766e">
        🔔 Follow-ups
      </h3>
    `;

    if (data.follow_ups.length === 0) {

      html += `
        <div class="info-box">
          No follow-ups available.
        </div>
      `;

    } else {

      html += data.follow_ups.map(f => `
        <div class="record">

          <strong>
            ${escapeHtml(f.follow_up_date)}
          </strong>

          <p>
            ${escapeHtml(f.purpose || "General follow-up")}
          </p>

          <small>
            ${escapeHtml(f.notes || "")}
          </small>

        </div>
      `).join("");
    }

    document.getElementById("fullRecord").innerHTML = html;

  } catch (error) {

    document.getElementById("fullRecord").innerHTML =
      '<div class="message error">Unable to load medical report</div>';
  }
}

// =========================================================
// ADD MEDICAL RECORD
// =========================================================

async function addMedicalRecord() {

  const data = {
    patient_id:
      document.getElementById("medicalPatientId").value,
    recorded_by:
      document.getElementById("recordedBy").value.trim(),
    record_type:
      document.getElementById("recordType").value,
    notes:
      document.getElementById("medicalNotes").value.trim()
  };

  if (!data.patient_id || !data.notes) {

    showMessage(
      "medicalMessage",
      "Patient ID and medical notes are required",
      false
    );

    return;
  }

  try {

    const response = await fetch(
      API + "/api/medical-records",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }
    );

    const result = await response.json();

    if (result.success) {

      showMessage(
        "medicalMessage",
        "Medical record saved successfully"
      );

      document.getElementById("medicalNotes").value = "";

      loadDashboard();

    } else {

      showMessage(
        "medicalMessage",
        result.message || "Unable to save record",
        false
      );
    }

  } catch (error) {

    showMessage(
      "medicalMessage",
      "Server error",
      false
    );
  }
}

// =========================================================
// BOOK APPOINTMENT
// =========================================================

async function bookAppointment() {

  const data = {
    patient_id:
      document.getElementById("appointmentPatientId").value,

    doctor_name:
      document.getElementById("doctorName").value.trim(),

    appointment_date:
      document.getElementById("appointmentDate").value,

    appointment_time:
      document.getElementById("appointmentTime").value,

    reason:
      document.getElementById("appointmentReason").value.trim()
  };

  if (
    !data.patient_id ||
    !data.appointment_date ||
    !data.appointment_time
  ) {

    showMessage(
      "appointmentMessage",
      "Patient ID, date and time are required",
      false
    );

    return;
  }

  try {

    const response = await fetch(
      API + "/api/appointments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }
    );

    const result = await response.json();

    if (result.success) {

      showMessage(
        "appointmentMessage",
        "Appointment booked successfully. ID: " +
        result.appointment_id
      );

      document.getElementById("appointmentReason").value = "";

      loadDashboard();

    } else {

      showMessage(
        "appointmentMessage",
        result.message || "Booking failed",
        false
      );
    }

  } catch (error) {

    showMessage(
      "appointmentMessage",
      "Server error",
      false
    );
  }
}

// =========================================================
// QUEUE
// =========================================================

async function loadQueue() {

  const date =
    document.getElementById("queueDate").value;

  try {

    let url = API + "/api/appointments";

    if (date) {
      url += "?date=" + encodeURIComponent(date);
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
      throw new Error();
    }

    const container =
      document.getElementById("queueResults");

    if (data.appointments.length === 0) {

      container.innerHTML =
        '<div class="info-box">No appointments found.</div>';

      return;
    }

    container.innerHTML = `
      <div class="table-wrapper">
      <table>

        <tr>
          <th>Patient</th>
          <th>Doctor</th>
          <th>Date</th>
          <th>Time</th>
          <th>Reason</th>
          <th>Status</th>
        </tr>

        ${data.appointments.map(a => `
          <tr>

            <td>
              ${escapeHtml(a.patient_name || "Unknown")}
              <br>
              <small>ID: ${escapeHtml(a.patient_id)}</small>
            </td>

            <td>
              ${escapeHtml(a.doctor_name || "Not assigned")}
            </td>

            <td>
              ${escapeHtml(a.appointment_date)}
            </td>

            <td>
              ${escapeHtml(a.appointment_time)}
            </td>

            <td>
              ${escapeHtml(a.reason || "N/A")}
            </td>

            <td>
              <span class="badge ${
                a.status === "completed"
                  ? "completed"
                  : "pending"
              }">
                ${escapeHtml(a.status)}
              </span>

              <br><br>

              <button class="btn btn-success"
                onclick="updateAppointmentStatus(${a.id}, 'completed')">
                Complete
              </button>
            </td>

          </tr>
        `).join("")}

      </table>
      </div>
    `;

  } catch (error) {

    document.getElementById("queueResults").innerHTML =
      '<div class="message error">Unable to load queue</div>';
  }
}

async function updateAppointmentStatus(id, status) {

  try {

    const response = await fetch(
      API + "/api/appointments/status",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id,
          status
        })
      }
    );

    const result = await response.json();

    if (result.success) {
      loadQueue();
      loadDashboard();
    }

  } catch (error) {
    alert("Unable to update appointment");
  }
}

// =========================================================
// REFERRAL
// =========================================================

async function createReferral() {

  const data = {
    patient_id:
      document.getElementById("referralPatientId").value,

    from_facility:
      document.getElementById("fromFacility").value.trim(),

    to_facility:
      document.getElementById("toFacility").value.trim(),

    reason:
      document.getElementById("referralReason").value.trim()
  };

  if (
    !data.patient_id ||
    !data.from_facility ||
    !data.to_facility ||
    !data.reason
  ) {

    showMessage(
      "referralMessage",
      "Please fill all referral fields",
      false
    );

    return;
  }

  try {

    const response = await fetch(
      API + "/api/referrals",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }
    );

    const result = await response.json();

    if (result.success) {

      showMessage(
        "referralMessage",
        "Referral created successfully. ID: " +
        result.referral_id
      );

      document.getElementById("referralReason").value = "";

      loadReferrals();
      loadDashboard();

    } else {

      showMessage(
        "referralMessage",
        result.message || "Referral failed",
        false
      );
    }

  } catch (error) {

    showMessage(
      "referralMessage",
      "Server error",
      false
    );
  }
}

async function loadReferrals() {

  try {

    const response =
      await fetch(API + "/api/referrals");

    const data = await response.json();

    if (!data.success) return;

    const container =
      document.getElementById("referralResults");

    if (data.referrals.length === 0) {

      container.innerHTML =
        '<div class="info-box">No referrals available.</div>';

      return;
    }

    container.innerHTML = `
      <div class="table-wrapper">
      <table>

        <tr>
          <th>Patient</th>
          <th>From</th>
          <th>To</th>
          <th>Reason</th>
          <th>Status</th>
        </tr>

        ${data.referrals.map(r => `
          <tr>

            <td>
              ${escapeHtml(r.patient_name || "Unknown")}
              <br>
              <small>ID: ${escapeHtml(r.patient_id)}</small>
            </td>

            <td>${escapeHtml(r.from_facility)}</td>

            <td>${escapeHtml(r.to_facility)}</td>

            <td>${escapeHtml(r.reason)}</td>

            <td>

              <span class="badge ${
                r.status === "completed"
                  ? "completed"
                  : "pending"
              }">
                ${escapeHtml(r.status)}
              </span>

              <br><br>

              ${
                r.status !== "completed"
                  ? `
                    <button class="btn btn-success"
                      onclick="updateReferralStatus(${r.id})">
                      Mark Completed
                    </button>
                  `
                  : ""
              }

            </td>

          </tr>
        `).join("")}

      </table>
      </div>
    `;

  } catch (error) {

    document.getElementById("referralResults").innerHTML =
      '<div class="message error">Unable to load referrals</div>';
  }
}

async function updateReferralStatus(id) {

  try {

    const response = await fetch(
      API + "/api/referrals/status",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id,
          status: "completed"
        })
      }
    );

    const result = await response.json();

    if (result.success) {
      loadReferrals();
      loadDashboard();
    }

  } catch (error) {

    alert("Unable to update referral");
  }
}

// =========================================================
// FOLLOW-UP
// =========================================================

async function createFollowUp() {

  const data = {
    patient_id:
      document.getElementById("followPatientId").value,

    follow_up_date:
      document.getElementById("followDate").value,

    purpose:
      document.getElementById("followPurpose").value.trim(),

    notes:
      document.getElementById("followNotes").value.trim()
  };

  if (!data.patient_id || !data.follow_up_date) {

    showMessage(
      "followMessage",
      "Patient ID and follow-up date are required",
      false
    );

    return;
  }

  try {

    const response = await fetch(
      API + "/api/follow-ups",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }
    );

    const result = await response.json();

    if (result.success) {

      showMessage(
        "followMessage",
        "Follow-up scheduled successfully"
      );

      document.getElementById("followPurpose").value = "";
      document.getElementById("followNotes").value = "";

      loadFollowUps();

    } else {

      showMessage(
        "followMessage",
        result.message || "Unable to schedule follow-up",
        false
      );
    }

  } catch (error) {

    showMessage(
      "followMessage",
      "Server error",
      false
    );
  }
}

async function loadFollowUps() {

  try {

    const response =
      await fetch(API + "/api/follow-ups");

    const data = await response.json();

    if (!data.success) return;

    const container =
      document.getElementById("followResults");

    if (data.follow_ups.length === 0) {

      container.innerHTML =
        '<div class="info-box">No follow-ups available.</div>';

      return;
    }

    container.innerHTML = `
      <div class="table-wrapper">
      <table>

        <tr>
          <th>Patient</th>
          <th>Date</th>
          <th>Purpose</th>
          <th>Notes</th>
          <th>Status</th>
        </tr>

        ${data.follow_ups.map(f => `
          <tr>

            <td>
              ${escapeHtml(f.patient_name || "Unknown")}
              <br>
              <small>ID: ${escapeHtml(f.patient_id)}</small>
            </td>

            <td>${escapeHtml(f.follow_up_date)}</td>

            <td>${escapeHtml(f.purpose || "General")}</td>

            <td>${escapeHtml(f.notes || "N/A")}</td>

            <td>
              <span class="badge pending">
                ${escapeHtml(f.status)}
              </span>
            </td>

          </tr>
        `).join("")}

      </table>
      </div>
    `;

  } catch (error) {

    document.getElementById("followResults").innerHTML =
      '<div class="message error">Unable to load follow-ups</div>';
  }
}

// =========================================================
// INITIAL LOAD
// =========================================================

window.addEventListener("load", () => {

  loadDashboard();

  const today =
    new Date().toISOString().split("T")[0];

  document.getElementById("queueDate").value = today;

  document.getElementById("appointmentDate").value = today;

});

</script>

</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html;charset=UTF-8"
      }
    });
  }
};

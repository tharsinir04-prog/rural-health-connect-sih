export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(page(), {
        headers: { "content-type": "text/html;charset=UTF-8" }
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return await api(request, env, url);
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function api(request, env, url) {
  const path = url.pathname;

  try {
    if (request.method === "GET" && path === "/api/test") {
      return json({
        success: true,
        message: "Rural Health Connect backend is working"
      });
    }

    if (request.method === "POST" && path === "/api/patients") {
      const body = await request.json();

      if (!body.name || !body.name.trim()) {
        return json({ success: false, error: "Patient name is required" }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO patients (name, age, gender, village, phone) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(
          body.name.trim(),
          body.age || null,
          body.gender || null,
          body.village || null,
          body.phone || null
        )
        .run();

      return json({
        success: true,
        patient_id: result.meta.last_row_id
      });
    }

    if (request.method === "GET" && path === "/api/patients") {
      const search = url.searchParams.get("search") || "";

      const result = await env.DB.prepare(
        "SELECT * FROM patients WHERE name LIKE ? OR village LIKE ? ORDER BY id DESC LIMIT 50"
      )
        .bind("%" + search + "%", "%" + search + "%")
        .all();

      return json({
        success: true,
        patients: result.results || []
      });
    }

    if (request.method === "GET" && path.startsWith("/api/patients/")) {
      const id = path.split("/").pop();

      const patient = await env.DB.prepare(
        "SELECT * FROM patients WHERE id = ?"
      )
        .bind(id)
        .first();

      if (!patient) {
        return json({ success: false, error: "Patient not found" }, 404);
      }

      const records = await env.DB.prepare(
        "SELECT * FROM medical_records WHERE patient_id = ? ORDER BY id DESC"
      )
        .bind(id)
        .all();

      const appointments = await env.DB.prepare(
        "SELECT * FROM appointments WHERE patient_id = ? ORDER BY id DESC"
      )
        .bind(id)
        .all();

      const referrals = await env.DB.prepare(
        "SELECT * FROM referrals WHERE patient_id = ? ORDER BY id DESC"
      )
        .bind(id)
        .all();

      const followups = await env.DB.prepare(
        "SELECT * FROM follow_ups WHERE patient_id = ? ORDER BY id DESC"
      )
        .bind(id)
        .all();

      return json({
        success: true,
        patient: patient,
        records: records.results || [],
        appointments: appointments.results || [],
        referrals: referrals.results || [],
        followups: followups.results || []
      });
    }

    if (request.method === "POST" && path === "/api/records") {
      const body = await request.json();

      const result = await env.DB.prepare(
        "INSERT INTO medical_records (patient_id, recorded_by, record_type, notes) VALUES (?, ?, ?, ?)"
      )
        .bind(
          body.patient_id,
          body.recorded_by || "Health Worker",
          body.record_type || "General",
          body.notes || ""
        )
        .run();

      return json({
        success: true,
        record_id: result.meta.last_row_id
      });
    }

    if (request.method === "POST" && path === "/api/appointments") {
      const body = await request.json();

      const result = await env.DB.prepare(
        "INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time, reason) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(
          body.patient_id,
          body.doctor_name || "",
          body.appointment_date,
          body.appointment_time,
          body.reason || ""
        )
        .run();

      return json({
        success: true,
        appointment_id: result.meta.last_row_id
      });
    }

    if (request.method === "GET" && path === "/api/appointments") {
      const result = await env.DB.prepare(
        "SELECT appointments.*, patients.name AS patient_name FROM appointments LEFT JOIN patients ON appointments.patient_id = patients.id ORDER BY appointment_date DESC, appointment_time DESC"
      ).all();

      return json({
        success: true,
        appointments: result.results || []
      });
    }

    if (request.method === "POST" && path === "/api/referrals") {
      const body = await request.json();

      const result = await env.DB.prepare(
        "INSERT INTO referrals (patient_id, from_facility, to_facility, reason) VALUES (?, ?, ?, ?)"
      )
        .bind(
          body.patient_id,
          body.from_facility || "",
          body.to_facility || "",
          body.reason || ""
        )
        .run();

      return json({
        success: true,
        referral_id: result.meta.last_row_id
      });
    }

    if (request.method === "GET" && path === "/api/referrals") {
      const result = await env.DB.prepare(
        "SELECT referrals.*, patients.name AS patient_name FROM referrals LEFT JOIN patients ON referrals.patient_id = patients.id ORDER BY referral_date DESC"
      ).all();

      return json({
        success: true,
        referrals: result.results || []
      });
    }

    if (request.method === "POST" && path === "/api/followups") {
      const body = await request.json();

      const result = await env.DB.prepare(
        "INSERT INTO follow_ups (patient_id, follow_up_date, purpose, notes) VALUES (?, ?, ?, ?)"
      )
        .bind(
          body.patient_id,
          body.follow_up_date,
          body.purpose || "",
          body.notes || ""
        )
        .run();

      return json({
        success: true,
        followup_id: result.meta.last_row_id
      });
    }

    if (request.method === "GET" && path === "/api/dashboard") {
      const patients = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM patients"
      ).first();

      const appointments = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM appointments"
      ).first();

      const referrals = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM referrals"
      ).first();

      const followups = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM follow_ups"
      ).first();

      return json({
        success: true,
        patients: patients.count || 0,
        appointments: appointments.count || 0,
        referrals: referrals.count || 0,
        followups: followups.count || 0
      });
    }

    return json({ success: false, error: "API route not found" }, 404);

  } catch (error) {
    return json({
      success: false,
      error: error.message
    }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      "content-type": "application/json;charset=UTF-8"
    }
  });
}
function page() {
  return `
<!DOCTYPE html>
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
  color: #172033;
  line-height: 1.5;
}

header {
  background: #ffffff;
  border-bottom: 1px solid #e5e9f2;
  position: sticky;
  top: 0;
  z-index: 100;
}

.navbar {
  max-width: 1200px;
  margin: auto;
  padding: 15px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 800;
  color: #1769aa;
}

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #1769aa;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.nav-links {
  display: flex;
  gap: 22px;
  align-items: center;
}

.nav-links a {
  text-decoration: none;
  color: #435066;
  font-weight: 600;
  cursor: pointer;
}

.nav-links a:hover {
  color: #1769aa;
}

.lang-btn {
  border: 1px solid #1769aa;
  color: #1769aa;
  background: white;
  border-radius: 8px;
  padding: 8px 13px;
  cursor: pointer;
  font-weight: 700;
}

.hero {
  background: linear-gradient(135deg, #1769aa, #2b8bc6);
  color: white;
  padding: 70px 20px;
}

.hero-inner {
  max-width: 1200px;
  margin: auto;
  display: grid;
  grid-template-columns: 1.3fr 0.7fr;
  gap: 40px;
  align-items: center;
}

.hero h1 {
  font-size: 48px;
  line-height: 1.1;
  margin-bottom: 20px;
}

.hero p {
  font-size: 18px;
  max-width: 700px;
  opacity: 0.95;
  margin-bottom: 28px;
}

.hero-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn {
  border: none;
  border-radius: 10px;
  padding: 12px 18px;
  cursor: pointer;
  font-weight: 700;
  font-size: 15px;
}

.btn-primary {
  background: white;
  color: #1769aa;
}

.btn-secondary {
  background: rgba(255,255,255,0.15);
  color: white;
  border: 1px solid rgba(255,255,255,0.5);
}

.hero-card {
  background: white;
  color: #172033;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.15);
}

.hero-card h3 {
  color: #1769aa;
  margin-bottom: 14px;
}

.hero-card-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #edf0f5;
}

.hero-card-item:last-child {
  border-bottom: none;
}

.section {
  max-width: 1200px;
  margin: auto;
  padding: 60px 20px;
}

.section-title {
  text-align: center;
  margin-bottom: 35px;
}

.section-title h2 {
  font-size: 32px;
  margin-bottom: 8px;
}

.section-title p {
  color: #68758a;
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.card {
  background: white;
  border: 1px solid #e5e9f2;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 25px rgba(28,48,80,0.05);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #eaf5ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 15px;
}

.card h3 {
  margin-bottom: 8px;
}

.card p {
  color: #68758a;
}

.portal {
  background: #eef5fb;
  padding: 60px 20px;
}

.portal-inner {
  max-width: 1200px;
  margin: auto;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 25px;
}

.stat {
  background: white;
  border-radius: 14px;
  padding: 20px;
  border: 1px solid #e3eaf3;
}

.stat-number {
  font-size: 30px;
  font-weight: 800;
  color: #1769aa;
}

.stat-label {
  color: #68758a;
  font-size: 14px;
}

.tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.tab {
  border: 1px solid #d5dce7;
  background: white;
  padding: 10px 15px;
  border-radius: 9px;
  cursor: pointer;
  font-weight: 700;
}

.tab.active {
  background: #1769aa;
  color: white;
  border-color: #1769aa;
}

.panel {
  display: none;
  background: white;
  border-radius: 16px;
  padding: 25px;
  border: 1px solid #e1e7ef;
}

.panel.active {
  display: block;
}

.panel h2 {
  margin-bottom: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field.full {
  grid-column: 1 / -1;
}

.field label {
  font-weight: 700;
  font-size: 14px;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid #ccd5e2;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
}

.field textarea {
  min-height: 100px;
  resize: vertical;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: #1769aa;
}

.action-row {
  margin-top: 18px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.blue {
  background: #1769aa;
  color: white;
}

.green {
  background: #218739;
  color: white;
}

.orange {
  background: #e48718;
  color: white;
}

.red {
  background: #c62828;
  color: white;
}

.message {
  margin-top: 15px;
  padding: 12px;
  border-radius: 8px;
  display: none;
}

.message.show {
  display: block;
}

.success {
  background: #e8f7ec;
  color: #176b2c;
}

.error {
  background: #fdecec;
  color: #a11b1b;
}

.search-box {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.search-box input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ccd5e2;
  border-radius: 8px;
}

.patient-list,
.record-list {
  display: grid;
  gap: 12px;
}

.patient-card,
.item {
  border: 1px solid #e0e6ef;
  border-radius: 10px;
  padding: 15px;
  background: #fafcff;
}

.patient-card {
  cursor: pointer;
}

.patient-card:hover {
  border-color: #1769aa;
  background: #f2f8fd;
}

.patient-name {
  font-weight: 800;
  color: #1769aa;
  font-size: 17px;
}

.small {
  color: #68758a;
  font-size: 14px;
}

.record-section {
  margin-top: 25px;
}

.record-section h3 {
  margin-bottom: 12px;
  color: #1769aa;
}

.empty {
  color: #7a8699;
  padding: 15px 0;
}

.emergency-box {
  border: 2px solid #e04a4a;
  background: #fff5f5;
  border-radius: 14px;
  padding: 22px;
}

.emergency-box h2 {
  color: #b51f1f;
}

footer {
  background: #172033;
  color: white;
  padding: 35px 20px;
  text-align: center;
}

footer p {
  opacity: 0.8;
}

@media (max-width: 850px) {
  .hero-inner {
    grid-template-columns: 1fr;
  }

  .hero h1 {
    font-size: 36px;
  }

  .cards {
    grid-template-columns: 1fr;
  }

  .stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .field.full {
    grid-column: auto;
  }

  .nav-links {
    display: none;
  }
}

@media (max-width: 500px) {
  .stats {
    grid-template-columns: 1fr;
  }

  .hero {
    padding: 50px 15px;
  }

  .section,
  .portal {
    padding: 45px 15px;
  }
}
</style>
</head>

<body>

<header>
  <div class="navbar">
    <div class="logo">
      <div class="logo-icon">+</div>
      <span>Rural Health Connect</span>
    </div>

    <nav class="nav-links">
      <a id="homeLink">Home</a>
      <a id="servicesLink">Services</a>
      <a id="portalLink">Patient Portal</a>
      <a id="aboutLink">About</a>
    </nav>

    <button class="lang-btn" id="languageBtn">मराठी / English</button>
  </div>
</header>

<section class="hero" id="home">
  <div class="hero-inner">

    <div>
      <h1>Healthcare access, closer to home.</h1>

      <p>
        Rural Health Connect helps communities access healthcare services,
        maintain continuous medical records, coordinate referrals,
        manage appointments and support frontline healthcare workers.
      </p>

      <div class="hero-buttons">
        <button class="btn btn-primary" id="portalButton">
          Open Patient Portal
        </button>

        <button class="btn btn-secondary" id="servicesButton">
          Explore Services
        </button>
      </div>
    </div>

    <div class="hero-card">
      <h3>Connected Care</h3>

      <div class="hero-card-item">
        <span>👨‍⚕️</span>
        <div>
          <strong>Doctor Support</strong>
          <div class="small">Assisted teleconsultation and continuity of care</div>
        </div>
      </div>

      <div class="hero-card-item">
        <span>📋</span>
        <div>
          <strong>Digital Records</strong>
          <div class="small">Longitudinal patient information</div>
        </div>
      </div>

      <div class="hero-card-item">
        <span>🔄</span>
        <div>
          <strong>Referral Tracking</strong>
          <div class="small">Track patients between healthcare facilities</div>
        </div>
      </div>

      <div class="hero-card-item">
        <span>📱</span>
        <div>
          <strong>Low Connectivity</strong>
          <div class="small">Designed for rural and underserved areas</div>
        </div>
      </div>
    </div>

  </div>
</section>

<section class="section" id="services">
  <div class="section-title">
    <h2>Healthcare Services</h2>
    <p>One connected platform for rural healthcare support.</p>
  </div>

  <div class="cards">

    <div class="card">
      <div class="card-icon">🩺</div>
      <h3>Digital Triage</h3>
      <p>
        Support healthcare workers in identifying priority cases
        and escalating emergencies to appropriate medical teams.
      </p>
    </div>

    <div class="card">
      <div class="card-icon">📅</div>
      <h3>Appointments</h3>
      <p>
        Organize consultations and help reduce unnecessary waiting
        and travel for patients.
      </p>
    </div>

    <div class="card">
      <div class="card-icon">🏥</div>
      <h3>Referral Tracking</h3>
      <p>
        Track referrals between sub-centres, PHCs, rural hospitals
        and district hospitals.
      </p>
    </div>

    <div class="card">
      <div class="card-icon">🧾</div>
      <h3>Medical Records</h3>
      <p>
        Maintain patient medical information so authorized healthcare
        teams can understand previous care.
      </p>
    </div>

    <div class="card">
      <div class="card-icon">💊</div>
      <h3>Medicine Visibility</h3>
      <p>
        Support visibility of medicine availability and healthcare
        service requirements.
      </p>
    </div>

    <div class="card">
      <div class="card-icon">❤️</div>
      <h3>Follow-up Care</h3>
      <p>
        Help healthcare workers track high-risk, maternal, child
        and chronic-care follow-ups.
      </p>
    </div>

  </div>
</section>

<section class="portal" id="portal">

  <div class="portal-inner">

    <div class="section-title">
      <h2>Healthcare Portal</h2>
      <p>Patient, healthcare worker and doctor support tools.</p>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-number" id="patientCount">0</div>
        <div class="stat-label">Registered Patients</div>
      </div>

      <div class="stat">
        <div class="stat-number" id="appointmentCount">0</div>
        <div class="stat-label">Appointments</div>
      </div>

      <div class="stat">
        <div class="stat-number" id="referralCount">0</div>
        <div class="stat-label">Referrals</div>
      </div>

      <div class="stat">
        <div class="stat-number" id="followupCount">0</div>
        <div class="stat-label">Follow-ups</div>
      </div>
    </div>

    <div class="tabs">

      <button class="tab active" data-panel="registerPanel">
        Patient Registration
      </button>

      <button class="tab" data-panel="searchPanel">
        Patient Records
      </button>

      <button class="tab" data-panel="appointmentPanel">
        Appointments
      </button>

      <button class="tab" data-panel="referralPanel">
        Referrals
      </button>

      <button class="tab" data-panel="followupPanel">
        Follow-up
      </button>

      <button class="tab" data-panel="emergencyPanel">
        Emergency
      </button>

    </div>

    <div class="panel active" id="registerPanel">

      <h2>Register Patient</h2>

      <form id="patientForm">

        <div class="form-grid">

          <div class="field">
            <label>Patient Name *</label>
            <input id="patientName" required placeholder="Enter full name">
          </div>

          <div class="field">
            <label>Age</label>
            <input id="patientAge" type="number" min="0" max="120">
          </div>

          <div class="field">
            <label>Gender</label>
            <select id="patientGender">
              <option value="">Select</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
          </div>

          <div class="field">
            <label>Village</label>
            <input id="patientVillage" placeholder="Village / Area">
          </div>

          <div class="field">
            <label>Phone</label>
            <input id="patientPhone" type="tel" placeholder="Phone number">
          </div>

        </div>

        <div class="action-row">
          <button class="btn blue" type="submit">
            Register Patient
          </button>
        </div>

      </form>

      <div class="message" id="patientMessage"></div>

    </div>

    <div class="panel" id="searchPanel">

      <h2>Search Patient</h2>

      <div class="search-box">
        <input id="patientSearch" placeholder="Search by patient name or village">
        <button class="btn blue" id="searchPatientButton">
          Search
        </button>
      </div>

      <div class="patient-list" id="patientList">
        <div class="empty">Search for a patient to view records.</div>
      </div>

      <div id="patientRecord"></div>

    </div>

    <div class="panel" id="appointmentPanel">

      <h2>Book Appointment</h2>

      <form id="appointmentForm">

        <div class="form-grid">

          <div class="field">
            <label>Patient ID *</label>
            <input id="appointmentPatientId" required>
          </div>

          <div class="field">
            <label>Doctor Name</label>
            <input id="doctorName" placeholder="Doctor name">
          </div>

          <div class="field">
            <label>Date *</label>
            <input id="appointmentDate" type="date" required>
          </div>

          <div class="field">
            <label>Time *</label>
            <input id="appointmentTime" type="time" required>
          </div>

          <div class="field full">
            <label>Reason</label>
            <textarea id="appointmentReason" placeholder="Reason for consultation"></textarea>
          </div>

        </div>

        <div class="action-row">
          <button class="btn blue" type="submit">
            Book Appointment
          </button>
        </div>

      </form>

      <div class="message" id="appointmentMessage"></div>

      <div class="record-section">
        <h3>Recent Appointments</h3>
        <div class="record-list" id="appointmentList"></div>
      </div>

    </div>

    <div class="panel" id="referralPanel">

      <h2>Create Referral</h2>

      <form id="referralForm">

        <div class="form-grid">

          <div class="field">
            <label>Patient ID *</label>
            <input id="referralPatientId" required>
          </div>

          <div class="field">
            <label>From Facility</label>
            <input id="fromFacility" placeholder="Current facility">
          </div>

          <div class="field">
            <label>To Facility</label>
            <input id="toFacility" placeholder="Referral facility">
          </div>

          <div class="field full">
            <label>Reason</label>
            <textarea id="referralReason" placeholder="Reason for referral"></textarea>
          </div>

        </div>

        <div class="action-row">
          <button class="btn blue" type="submit">
            Create Referral
          </button>
        </div>

      </form>

      <div class="message" id="referralMessage"></div>

      <div class="record-section">
        <h3>Recent Referrals</h3>
        <div class="record-list" id="referralList"></div>
      </div>

    </div>

    <div class="panel" id="followupPanel">

      <h2>Follow-up Care</h2>

      <form id="followupForm">

        <div class="form-grid">

          <div class="field">
            <label>Patient ID *</label>
            <input id="followupPatientId" required>
          </div>

          <div class="field">
            <label>Follow-up Date *</label>
            <input id="followupDate" type="date" required>
          </div>

          <div class="field full">
            <label>Purpose</label>
            <input id="followupPurpose" placeholder="Follow-up purpose">
          </div>

          <div class="field full">
            <label>Notes</label>
            <textarea id="followupNotes" placeholder="Follow-up notes"></textarea>
          </div>

        </div>

        <div class="action-row">
          <button class="btn blue" type="submit">
            Schedule Follow-up
          </button>
        </div>

      </form>

      <div class="message" id="followupMessage"></div>

      <div class="record-section">
        <h3>Follow-up Records</h3>
        <div class="record-list" id="followupList"></div>
      </div>

    </div>

    <div class="panel" id="emergencyPanel">

      <div class="emergency-box">

        <h2>🚨 Emergency Escalation</h2>

        <p style="margin-top:10px;">
          If a patient has a serious or rapidly worsening condition,
          immediately contact the appropriate emergency medical service
          or trained healthcare professional.
        </p>

        <div class="action-row">

          <button class="btn red" id="emergencyButton">
            Escalate Emergency
          </button>

        </div>

        <div class="message" id="emergencyMessage"></div>

      </div>

    </div>

  </div>

</section>

<footer id="about">
  <p><strong>Rural Health Connect</strong></p>
  <p>
    Integrated healthcare access and quality support platform
    for rural communities.
  </p>
  <p style="margin-top:10px;">
    Built for Smart India Hackathon
  </p>
</footer>

<script>

const $ = function(id) {
  return document.getElementById(id);
};

function showMessage(id, text, success) {
  const box = $(id);

  if (!box) return;

  box.textContent = text;
  box.className = "message show " + (success ? "success" : "error");
}

async function requestApi(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}

function openPortal() {
  $("portal").scrollIntoView({
    behavior: "smooth"
  });
}

function openServices() {
  $("services").scrollIntoView({
    behavior: "smooth"
  });
}

function openHome() {
  $("home").scrollIntoView({
    behavior: "smooth"
  });
}

function openAbout() {
  $("about").scrollIntoView({
    behavior: "smooth"
  });
}

function activatePanel(panelId) {
  const panels = document.querySelectorAll(".panel");
  const tabs = document.querySelectorAll(".tab");

  panels.forEach(function(panel) {
    panel.classList.remove("active");
  });

  tabs.forEach(function(tab) {
    tab.classList.remove("active");
  });

  const panel = $(panelId);

  if (panel) {
    panel.classList.add("active");
  }

  tabs.forEach(function(tab) {
    if (tab.getAttribute("data-panel") === panelId) {
      tab.classList.add("active");
    }
  });
}

async function loadDashboard() {
  try {
    const data = await requestApi("/api/dashboard");

    $("patientCount").textContent = data.patients;
    $("appointmentCount").textContent = data.appointments;
    $("referralCount").textContent = data.referrals;
    $("followupCount").textContent = data.followups;
  } catch (error) {
    console.log(error);
  }
}

async function registerPatient(event) {
  event.preventDefault();

  const body = {
    name: $("patientName").value,
    age: $("patientAge").value,
    gender: $("patientGender").value,
    village: $("patientVillage").value,
    phone: $("patientPhone").value
  };

  try {
    const data = await requestApi("/api/patients", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    showMessage(
      "patientMessage",
      "Patient registered successfully. Patient ID: " + data.patient_id,
      true
    );

    $("patientForm").reset();
    loadDashboard();

  } catch (error) {
    showMessage(
      "patientMessage",
      error.message,
      false
    );
  }
}

async function searchPatients() {
  const search = $("patientSearch").value.trim();

  try {
    const data = await requestApi(
      "/api/patients?search=" + encodeURIComponent(search)
    );

    const list = $("patientList");
    list.innerHTML = "";

    if (!data.patients || data.patients.length === 0) {
      list.innerHTML = '<div class="empty">No patients found.</div>';
      return;
    }

    data.patients.forEach(function(patient) {
      const card = document.createElement("div");

      card.className = "patient-card";

      card.innerHTML =
        '<div class="patient-name">' +
        escapeHtml(patient.name) +
        "</div>" +
        '<div class="small">Patient ID: ' +
        escapeHtml(String(patient.id)) +
        "</div>" +
        '<div class="small">Age: ' +
        escapeHtml(String(patient.age || "-")) +
        " | Gender: " +
        escapeHtml(patient.gender || "-") +
        "</div>" +
        '<div class="small">Village: ' +
        escapeHtml(patient.village || "-") +
        "</div>";

      card.addEventListener("click", function() {
        loadPatientRecord(patient.id);
      });

      list.appendChild(card);
    });

  } catch (error) {
    $("patientList").innerHTML =
      '<div class="empty">' +
      escapeHtml(error.message) +
      "</div>";
  }
}

async function loadPatientRecord(patientId) {
  try {
    const data = await requestApi(
      "/api/patients/" + encodeURIComponent(patientId)
    );

    let html =
      '<div class="record-section">' +
      "<h3>Patient Medical Report</h3>" +
      '<div class="item">' +
      "<strong>" +
      escapeHtml(data.patient.name) +
      "</strong><br>" +
      "Patient ID: " +
      escapeHtml(String(data.patient.id)) +
      "<br>" +
      "Age: " +
      escapeHtml(String(data.patient.age || "-")) +
      "<br>" +
      "Gender: " +
      escapeHtml(data.patient.gender || "-") +
      "<br>" +
      "Village: " +
      escapeHtml(data.patient.village || "-") +
      "<br>" +
      "Phone: " +
      escapeHtml(data.patient.phone || "-") +
      "</div>" +
      "</div>";

    html += '<div class="record-section"><h3>Medical Records</h3>';

    if (data.records.length === 0) {
      html += '<div class="empty">No medical records yet.</div>';
    } else {
      data.records.forEach(function(record) {
        html +=
          '<div class="item">' +
          "<strong>" +
          escapeHtml(record.record_type || "General") +
          "</strong><br>" +
          escapeHtml(record.notes || "") +
          '<div class="small">Recorded by: ' +
          escapeHtml(record.recorded_by || "-") +
          "</div>" +
          "</div>";
      });
    }

    html += "</div>";

    html += '<div class="record-section"><h3>Appointments</h3>';

    if (data.appointments.length === 0) {
      html += '<div class="empty">No appointments.</div>';
    } else {
      data.appointments.forEach(function(item) {
        html +=
          '<div class="item">' +
          "Doctor: " +
          escapeHtml(item.doctor_name || "-") +
          "<br>" +
          "Date: " +
          escapeHtml(item.appointment_date) +
          "<br>" +
          "Time: " +
          escapeHtml(item.appointment_time) +
          "<br>" +
          "Status: " +
          escapeHtml(item.status || "pending") +
          "<br>" +
          "Reason: " +
          escapeHtml(item.reason || "-") +
          "</div>";
      });
    }

    html += "</div>";

    html += '<div class="record-section"><h3>Referrals</h3>';

    if (data.referrals.length === 0) {
      html += '<div class="empty">No referrals.</div>';
    } else {
      data.referrals.forEach(function(item) {
        html +=
          '<div class="item">' +
          "From: " +
          escapeHtml(item.from_facility || "-") +
          "<br>" +
          "To: " +
          escapeHtml(item.to_facility || "-") +
          "<br>" +
          "Reason: " +
          escapeHtml(item.reason || "-") +
          "<br>" +
          "Status: " +
          escapeHtml(item.status || "pending") +
          "</div>";
      });
    }

    html += "</div>";

    html += '<div class="record-section"><h3>Follow-up</h3>';

    if (data.followups.length === 0) {
      html += '<div class="empty">No follow-up records.</div>';
    } else {
      data.followups.forEach(function(item) {
        html +=
          '<div class="item">' +
          "Date: " +
          escapeHtml(item.follow_up_date) +
          "<br>" +
          "Purpose: " +
          escapeHtml(item.purpose || "-") +
          "<br>" +
          "Status: " +
          escapeHtml(item.status || "pending") +
          "<br>" +
          "Notes: " +
          escapeHtml(item.notes || "-") +
          "</div>";
      });
    }

    html += "</div>";

    $("patientRecord").innerHTML = html;

  } catch (error) {
    $("patientRecord").innerHTML =
      '<div class="message show error">' +
      escapeHtml(error.message) +
      "</div>";
  }
}

async function addMedicalRecord() {
  const patientId = prompt("Enter Patient ID:");

  if (!patientId) return;

  const notes = prompt("Enter medical record notes:");

  if (!notes) return;

  try {
    await requestApi("/api/records", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        patient_id: patientId,
        recorded_by: "Health Worker",
        record_type: "General",
        notes: notes
      })
    });

    alert("Medical record added successfully.");
    loadPatientRecord(patientId);

  } catch (error) {
    alert(error.message);
  }
}

async function bookAppointment(event) {
  event.preventDefault();

  try {
    const data = await requestApi("/api/appointments", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        patient_id: $("appointmentPatientId").value,
        doctor_name: $("doctorName").value,
        appointment_date: $("appointmentDate").value,
        appointment_time: $("appointmentTime").value,
        reason: $("appointmentReason").value
      })
    });

    showMessage(
      "appointmentMessage",
      "Appointment booked successfully. ID: " + data.appointment_id,
      true
    );

    $("appointmentForm").reset();
    loadDashboard();
    loadAppointments();

  } catch (error) {
    showMessage(
      "appointmentMessage",
      error.message,
      false
    );
  }
}

async function loadAppointments() {
  try {
    const data = await requestApi("/api/appointments");
    const list = $("appointmentList");

    list.innerHTML = "";

    if (data.appointments.length === 0) {
      list.innerHTML =
        '<div class="empty">No appointments available.</div>';
      return;
    }

    data.appointments.forEach(function(item) {
      const div = document.createElement("div");

      div.className = "item";

      div.innerHTML =
        "<strong>" +
        escapeHtml(item.patient_name || "Patient") +
        "</strong><br>" +
        "Doctor: " +
        escapeHtml(item.doctor_name || "-") +
        "<br>" +
        "Date: " +
        escapeHtml(item.appointment_date) +
        "<br>" +
        "Time: " +
        escapeHtml(item.appointment_time) +
        "<br>" +
        "Status: " +
        escapeHtml(item.status || "pending");

      list.appendChild(div);
    });

  } catch (error) {
    console.log(error);
  }
}

async function createReferral(event) {
  event.preventDefault();

  try {
    const data = await requestApi("/api/referrals", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        patient_id: $("referralPatientId").value,
        from_facility: $("fromFacility").value,
        to_facility: $("toFacility").value,
        reason: $("referralReason").value
      })
    });

    showMessage(
      "referralMessage",
      "Referral created successfully. ID: " + data.referral_id,
      true
    );

    $("referralForm").reset();
    loadDashboard();
    loadReferrals();

  } catch (error) {
    showMessage(
      "referralMessage",
      error.message,
      false
    );
  }
}

async function loadReferrals() {
  try {
    const data = await requestApi("/api/referrals");
    const list = $("referralList");

    list.innerHTML = "";

    if (data.referrals.length === 0) {
      list.innerHTML =
        '<div class="empty">No referrals available.</div>';
      return;
    }

    data.referrals.forEach(function(item) {
      const div = document.createElement("div");

      div.className = "item";

      div.innerHTML =
        "<strong>" +
        escapeHtml(item.patient_name || "Patient") +
        "</strong><br>" +
        "From: " +
        escapeHtml(item.from_facility || "-") +
        "<br>" +
        "To: " +
        escapeHtml(item.to_facility || "-") +
        "<br>" +
        "Reason: " +
        escapeHtml(item.reason || "-") +
        "<br>" +
        "Status: " +
        escapeHtml(item.status || "pending");

      list.appendChild(div);
    });

  } catch (error) {
    console.log(error);
  }
}

async function createFollowup(event) {
  event.preventDefault();

  try {
    const data = await requestApi("/api/followups", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        patient_id: $("followupPatientId").value,
        follow_up_date: $("followupDate").value,
        purpose: $("followupPurpose").value,
        notes: $("followupNotes").value
      })
    });

    showMessage(
      "followupMessage",
      "Follow-up scheduled successfully. ID: " + data.followup_id,
      true
    );

    $("followupForm").reset();
    loadDashboard();
    loadFollowups();

  } catch (error) {
    showMessage(
      "followupMessage",
      error.message,
      false
    );
  }
}

async function loadFollowups() {
  try {
    const search = await requestApi("/api/patients?search=");

    const list = $("followupList");

    list.innerHTML = "";

    if (!search.patients || search.patients.length === 0) {
      list.innerHTML =
        '<div class="empty">No patients available for follow-up.</div>';
      return;
    }

    list.innerHTML =
      '<div class="empty">Follow-up records are available inside each patient medical report.</div>';

  } catch (error) {
    console.log(error);
  }
}

function emergencyEscalation() {
  showMessage(
    "emergencyMessage",
    "Emergency escalation initiated. Please contact the nearest emergency medical service or trained healthcare professional immediately.",
    true
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", function() {

  $("portalButton").addEventListener("click", openPortal);
  $("servicesButton").addEventListener("click", openServices);

  $("homeLink").addEventListener("click", openHome);
  $("servicesLink").addEventListener("click", openServices);
  $("portalLink").addEventListener("click", openPortal);
  $("aboutLink").addEventListener("click", openAbout);

  document.querySelectorAll(".tab").forEach(function(tab) {
    tab.addEventListener("click", function() {
      activatePanel(tab.getAttribute("data-panel"));
    });
  });

  $("patientForm").addEventListener("submit", registerPatient);
  $("searchPatientButton").addEventListener("click", searchPatients);
  $("patientSearch").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      searchPatients();
    }
  });

  $("appointmentForm").addEventListener("submit", bookAppointment);
  $("referralForm").addEventListener("submit", createReferral);
  $("followupForm").addEventListener("submit", createFollowup);
  $("emergencyButton").addEventListener("click", emergencyEscalation);

  loadDashboard();
  loadAppointments();
  loadReferrals();
  loadFollowups();

});

`;
}

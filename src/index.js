const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

/* =========================
   BACKEND / API
========================= */

async function api(request, env, url) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS
    });
  }

  try {

    /* API TEST */
    if (url.pathname === "/api/test") {
      return json({
        success: true,
        message: "Rural Health Connect backend is working"
      });
    }

    /* DASHBOARD */
    if (url.pathname === "/api/dashboard") {

      const patients = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM patients"
      ).first();

      const appointments = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM appointments WHERE status != 'completed' AND status != 'cancelled'"
      ).first();

      const referrals = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM referrals WHERE status != 'completed'"
      ).first();

      const followups = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM follow_ups WHERE status != 'completed'"
      ).first();

      return json({
        success: true,
        patients: Number(patients?.count || 0),
        appointments: Number(appointments?.count || 0),
        referrals: Number(referrals?.count || 0),
        followups: Number(followups?.count || 0)
      });
    }

    /* REGISTER PATIENT */
    if (url.pathname === "/api/patients" && request.method === "POST") {

      const data = await body(request);

      if (!String(data.name || "").trim()) {
        return json({
          success: false,
          message: "Patient name is required"
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO patients (name, age, gender, village, phone) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        String(data.name).trim(),
        data.age ? Number(data.age) : null,
        data.gender || null,
        data.village || null,
        data.phone || null
      ).run();

      return json({
        success: true,
        message: "Patient registered successfully",
        patient_id: result.meta.last_row_id
      }, 201);
    }

    /* SEARCH PATIENT */
    if (url.pathname === "/api/patients" && request.method === "GET") {

      const id = url.searchParams.get("id");
      const name = url.searchParams.get("name");

      let result;

      if (id) {
        result = await env.DB.prepare(
          "SELECT * FROM patients WHERE id = ?"
        ).bind(id).all();
      } else if (name) {
        result = await env.DB.prepare(
          "SELECT * FROM patients WHERE name LIKE ? ORDER BY id DESC"
        ).bind("%" + name + "%").all();
      } else {
        result = await env.DB.prepare(
          "SELECT * FROM patients ORDER BY id DESC LIMIT 100"
        ).all();
      }

      return json({
        success: true,
        patients: result.results || []
      });
    }

    /* FULL PATIENT RECORD */
    if (url.pathname === "/api/patient-record") {

      const id = url.searchParams.get("patient_id");

      if (!id) {
        return json({
          success: false,
          message: "Patient ID required"
        }, 400);
      }

      const patient = await env.DB.prepare(
        "SELECT * FROM patients WHERE id = ?"
      ).bind(id).first();

      if (!patient) {
        return json({
          success: false,
          message: "Patient not found"
        }, 404);
      }

      const records = await env.DB.prepare(
        "SELECT * FROM medical_records WHERE patient_id = ? ORDER BY id DESC"
      ).bind(id).all();

      const appointments = await env.DB.prepare(
        "SELECT * FROM appointments WHERE patient_id = ? ORDER BY id DESC"
      ).bind(id).all();

      const referrals = await env.DB.prepare(
        "SELECT * FROM referrals WHERE patient_id = ? ORDER BY id DESC"
      ).bind(id).all();

      const followups = await env.DB.prepare(
        "SELECT * FROM follow_ups WHERE patient_id = ? ORDER BY id DESC"
      ).bind(id).all();

      return json({
        success: true,
        patient: patient,
        records: records.results || [],
        appointments: appointments.results || [],
        referrals: referrals.results || [],
        followups: followups.results || []
      });
    }

    /* ADD MEDICAL RECORD */
    if (url.pathname === "/api/medical-records" && request.method === "POST") {

      const data = await body(request);

      if (!data.patient_id || !String(data.notes || "").trim()) {
        return json({
          success: false,
          message: "Patient ID and medical notes are required"
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO medical_records (patient_id, recorded_by, record_type, notes) VALUES (?, ?, ?, ?)"
      ).bind(
        data.patient_id,
        data.recorded_by || "Health Worker",
        data.record_type || "Clinical Note",
        data.notes
      ).run();

      return json({
        success: true,
        message: "Medical record saved",
        record_id: result.meta.last_row_id
      }, 201);
    }

    /* APPOINTMENT CREATE */
    if (url.pathname === "/api/appointments" && request.method === "POST") {

      const data = await body(request);

      if (
        !data.patient_id ||
        !data.appointment_date ||
        !data.appointment_time
      ) {
        return json({
          success: false,
          message: "Patient, date and time are required"
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time, status, reason) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(
        data.patient_id,
        data.doctor_name || "Doctor",
        data.appointment_date,
        data.appointment_time,
        "pending",
        data.reason || ""
      ).run();

      return json({
        success: true,
        message: "Appointment booked successfully",
        appointment_id: result.meta.last_row_id
      }, 201);
    }

    /* APPOINTMENT LIST */
    if (url.pathname === "/api/appointments" && request.method === "GET") {

      const result = await env.DB.prepare(
        "SELECT appointments.*, patients.name AS patient_name FROM appointments LEFT JOIN patients ON patients.id = appointments.patient_id ORDER BY appointment_date ASC, appointment_time ASC"
      ).all();

      return json({
        success: true,
        appointments: result.results || []
      });
    }

    /* APPOINTMENT STATUS */
    if (url.pathname === "/api/appointments/status" && request.method === "POST") {

      const data = await body(request);

      await env.DB.prepare(
        "UPDATE appointments SET status = ? WHERE id = ?"
      ).bind(
        data.status,
        data.id
      ).run();

      return json({
        success: true,
        message: "Appointment status updated"
      });
    }

    /* REFERRAL CREATE */
    if (url.pathname === "/api/referrals" && request.method === "POST") {

      const data = await body(request);

      if (
        !data.patient_id ||
        !data.from_facility ||
        !data.to_facility ||
        !data.reason
      ) {
        return json({
          success: false,
          message: "All referral fields are required"
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO referrals (patient_id, from_facility, to_facility, reason, status) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        data.patient_id,
        data.from_facility,
        data.to_facility,
        data.reason,
        "pending"
      ).run();

      return json({
        success: true,
        message: "Referral created successfully",
        referral_id: result.meta.last_row_id
      }, 201);
    }

    /* REFERRAL LIST */
    if (url.pathname === "/api/referrals" && request.method === "GET") {

      const result = await env.DB.prepare(
        "SELECT referrals.*, patients.name AS patient_name FROM referrals LEFT JOIN patients ON patients.id = referrals.patient_id ORDER BY referral_date DESC"
      ).all();

      return json({
        success: true,
        referrals: result.results || []
      });
    }

    /* REFERRAL STATUS */
    if (url.pathname === "/api/referrals/status" && request.method === "POST") {

      const data = await body(request);

      if (data.status === "completed") {

        await env.DB.prepare(
          "UPDATE referrals SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(
          data.status,
          data.id
        ).run();

      } else {

        await env.DB.prepare(
          "UPDATE referrals SET status = ? WHERE id = ?"
        ).bind(
          data.status,
          data.id
        ).run();
      }

      return json({
        success: true,
        message: "Referral updated"
      });
    }

    /* FOLLOW-UP CREATE */
    if (url.pathname === "/api/follow-ups" && request.method === "POST") {

      const data = await body(request);

      if (
        !data.patient_id ||
        !data.follow_up_date ||
        !data.purpose
      ) {
        return json({
          success: false,
          message: "Patient, date and purpose are required"
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO follow_ups (patient_id, follow_up_date, purpose, status, notes) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        data.patient_id,
        data.follow_up_date,
        data.purpose,
        "pending",
        data.notes || ""
      ).run();

      return json({
        success: true,
        message: "Follow-up scheduled successfully",
        followup_id: result.meta.last_row_id
      }, 201);
    }

    /* FOLLOW-UP LIST */
    if (url.pathname === "/api/follow-ups" && request.method === "GET") {

      const result = await env.DB.prepare(
        "SELECT follow_ups.*, patients.name AS patient_name FROM follow_ups LEFT JOIN patients ON patients.id = follow_ups.patient_id ORDER BY follow_up_date ASC"
      ).all();

      return json({
        success: true,
        followups: result.results || []
      });
    }

    return json({
      success: false,
      message: "API endpoint not found"
    }, 404);

  } catch (error) {

    console.error(error);

    return json({
      success: false,
      message: error.message || "Backend error"
    }, 500);
  }
}


/* =========================
   FRONTEND
========================= */

function page() {

  return `<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>Rural Health Connect</title>

<style>

*{
  box-sizing:border-box;
}

body{
  margin:0;
  font-family:Arial,Helvetica,sans-serif;
  background:#f5f8fc;
  color:#172033;
}

.topbar{
  background:#ffffff;
  border-bottom:1px solid #e5eaf1;
  padding:14px 5%;
  display:flex;
  align-items:center;
  justify-content:space-between;
  position:sticky;
  top:0;
  z-index:20;
}

.logo{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:20px;
  font-weight:800;
  color:#1167b1;
}

.logoIcon{
  width:40px;
  height:40px;
  border-radius:12px;
  background:#1167b1;
  color:white;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:21px;
}

.nav{
  display:flex;
  gap:22px;
}

.nav button{
  background:none;
  border:0;
  font-size:14px;
  cursor:pointer;
  color:#536174;
}

.nav button:hover{
  color:#1167b1;
}

.langBtn{
  border:1px solid #d7e0eb;
  background:white;
  padding:8px 12px;
  border-radius:8px;
  cursor:pointer;
}

.hero{
  padding:70px 5%;
  background:linear-gradient(120deg,#eaf5ff,#ffffff);
}

.heroInner{
  max-width:1150px;
  margin:auto;
  display:grid;
  grid-template-columns:1.3fr .7fr;
  gap:40px;
  align-items:center;
}

.badge{
  display:inline-block;
  padding:7px 12px;
  background:#dceeff;
  color:#1167b1;
  border-radius:20px;
  font-size:13px;
  font-weight:bold;
}

.hero h1{
  font-size:46px;
  line-height:1.1;
  margin:18px 0;
}

.hero h1 span{
  color:#1167b1;
}

.hero p{
  color:#59687a;
  font-size:17px;
  line-height:1.7;
  max-width:650px;
}

.heroButtons{
  display:flex;
  gap:12px;
  margin-top:25px;
  flex-wrap:wrap;
}

.primary{
  background:#1167b1;
  color:white;
  border:0;
  padding:13px 20px;
  border-radius:9px;
  cursor:pointer;
  font-weight:bold;
}

.secondary{
  background:white;
  color:#1167b1;
  border:1px solid #cbd9e8;
  padding:13px 20px;
  border-radius:9px;
  cursor:pointer;
  font-weight:bold;
}

.heroCard{
  background:white;
  padding:28px;
  border-radius:20px;
  box-shadow:0 15px 40px rgba(23,64,100,.10);
}

.heroCard h3{
  margin-top:0;
}

.heroItem{
  display:flex;
  gap:12px;
  padding:14px 0;
  border-bottom:1px solid #edf0f5;
}

.heroItem:last-child{
  border-bottom:0;
}

.icon{
  width:38px;
  height:38px;
  border-radius:10px;
  background:#e9f4ff;
  display:flex;
  align-items:center;
  justify-content:center;
}

.container{
  max-width:1150px;
  margin:auto;
  padding:45px 5%;
}

.sectionTitle{
  text-align:center;
  margin-bottom:30px;
}

.sectionTitle h2{
  font-size:30px;
  margin-bottom:8px;
}

.sectionTitle p{
  color:#69778a;
}

.services{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:18px;
}

.service{
  background:white;
  padding:25px;
  border-radius:15px;
  border:1px solid #e7edf4;
  transition:.2s;
}

.service:hover{
  transform:translateY(-3px);
  box-shadow:0 10px 25px rgba(0,0,0,.06);
}

.serviceIcon{
  font-size:28px;
  margin-bottom:15px;
}

.service h3{
  margin:8px 0;
}

.service p{
  color:#69778a;
  line-height:1.6;
  font-size:14px;
}

.app{
  display:none;
  background:#f5f8fc;
  min-height:700px;
  padding:35px 5%;
}

.app.active{
  display:block;
}

.appHeader{
  max-width:1150px;
  margin:auto;
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:25px;
}

.appHeader h2{
  margin:0;
}

.dashboard{
  max-width:1150px;
  margin:auto;
}

.stats{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:15px;
  margin-bottom:20px;
}

.stat{
  background:white;
  border-radius:14px;
  padding:20px;
  border:1px solid #e5ebf2;
}

.statNumber{
  font-size:30px;
  font-weight:bold;
  color:#1167b1;
  margin-top:8px;
}

.statLabel{
  color:#718096;
  font-size:13px;
}

.tabs{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  margin-bottom:20px;
}

.tab{
  border:1px solid #dbe4ee;
  background:white;
  padding:10px 14px;
  border-radius:8px;
  cursor:pointer;
}

.tab.active{
  background:#1167b1;
  color:white;
  border-color:#1167b1;
}

.panel{
  background:white;
  padding:25px;
  border-radius:15px;
  border:1px solid #e5ebf2;
  margin-bottom:18px;
}

.panel h3{
  margin-top:0;
}

.formGrid{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:15px;
}

.field label{
  display:block;
  font-size:13px;
  font-weight:bold;
  margin-bottom:6px;
  color:#536174;
}

input,select,textarea{
  width:100%;
  padding:12px;
  border:1px solid #ccd7e3;
  border-radius:8px;
  font-family:inherit;
  font-size:14px;
}

textarea{
  min-height:100px;
  resize:vertical;
}

.full{
  grid-column:1/-1;
}

.message{
  padding:12px;
  border-radius:8px;
  margin-top:15px;
  display:none;
}

.message.show{
  display:block;
}

.success{
  background:#e9f8ef;
  color:#176b3a;
}

.error{
  background:#fff0f0;
  color:#a52222;
}

.patient{
  border:1px solid #e2e8f0;
  padding:16px;
  border-radius:10px;
  margin-top:10px;
}

.patient h4{
  margin:0 0 8px;
}

.item{
  border-left:4px solid #1167b1;
  background:#f8fafc;
  padding:14px;
  margin:10px 0;
  border-radius:6px;
}

.pill{
  display:inline-block;
  padding:4px 9px;
  border-radius:15px;
  background:#e8f2fb;
  color:#1167b1;
  font-size:12px;
}

.emergency{
  background:#fff4f3;
  border:1px solid #ffd5d1;
  padding:20px;
  border-radius:12px;
}

.emergency h3{
  color:#b42318;
}

.footer{
  background:#10243a;
  color:#dce5ee;
  padding:35px 5%;
  text-align:center;
}

.footer p{
  color:#aebdcb;
  font-size:13px;
}

.mobileMenu{
  display:none;
}

@media(max-width:800px){

  .nav{
    display:none;
  }

  .mobileMenu{
    display:block;
  }

  .heroInner{
    grid-template-columns:1fr;
  }

  .hero h1{
    font-size:35px;
  }

  .services{
    grid-template-columns:1fr;
  }

  .stats{
    grid-template-columns:repeat(2,1fr);
  }

  .formGrid{
    grid-template-columns:1fr;
  }

}

@media(max-width:500px){

  .topbar{
    padding:12px 4%;
  }

  .logo{
    font-size:16px;
  }

  .hero{
    padding:45px 5%;
  }

  .stats{
    grid-template-columns:1fr 1fr;
  }

  .statNumber{
    font-size:24px;
  }

}

</style>

</head>

<body>


<!-- TOP NAVIGATION -->

<header class="topbar">

<div class="logo">

<div class="logoIcon">+</div>

Rural Health Connect

</div>

<nav class="nav">

<button onclick="goHome()">Home</button>

<button onclick="scrollServices()">Services</button>

<button onclick="openApp()">Patient Portal</button>

<button onclick="showAbout()">About</button>

</nav>

<button class="langBtn"
onclick="toggleLanguage()"
id="languageButton">
मराठी
</button>

</header>


<!-- HERO -->

<section class="hero" id="home">

<div class="heroInner">

<div>

<span class="badge">
Maharashtra Rural Healthcare Initiative
</span>

<h1>
Healthcare access,
<span>closer to home.</span>
</h1>

<p id="heroText">
A connected digital healthcare platform that helps
rural communities access patients, doctors,
medical records, referrals, appointments and
follow-up care through one simple system.
</p>

<div class="heroButtons">

<button class="primary"
onclick="openApp()">
Open Healthcare Portal
</button>

<button class="secondary"
onclick="scrollServices()">
Explore Services
</button>

</div>

</div>


<div class="heroCard">

<h3>Connected Care</h3>

<div class="heroItem">

<div class="icon">👨‍⚕️</div>

<div>
<b>Assisted Teleconsultation</b>
<br>
<small>Connect patients with healthcare professionals.</small>
</div>

</div>

<div class="heroItem">

<div class="icon">📋</div>

<div>
<b>Digital Health Records</b>
<br>
<small>Keep patient information available across facilities.</small>
</div>

</div>

<div class="heroItem">

<div class="icon">🔄</div>

<div>
<b>Referral Tracking</b>
<br>
<small>Track referrals from local facilities to hospitals.</small>
</div>

</div>

<div class="heroItem">

<div class="icon">❤️</div>

<div>
<b>Follow-up Support</b>
<br>
<small>Support chronic and high-risk patient follow-up.</small>
</div>

</div>

</div>

</div>

</section>


<!-- SERVICES -->

<section class="container" id="services">

<div class="sectionTitle">

<h2>Connected Care Services</h2>

<p>
Designed for patients, frontline health workers,
doctors and healthcare facilities.
</p>

</div>


<div class="services">

<div class="service">

<div class="serviceIcon">🩺</div>

<h3>Digital Triage</h3>

<p>
Help frontline workers organize patient information
and identify cases that need timely professional attention.
</p>

</div>


<div class="service">

<div class="serviceIcon">📅</div>

<h3>Appointments & Queue</h3>

<p>
Book consultations and manage patient queues
to reduce unnecessary waiting time.
</p>

</div>


<div class="service">

<div class="serviceIcon">📋</div>

<h3>Longitudinal Records</h3>

<p>
Maintain a connected patient history including
medical notes, appointments, referrals and follow-ups.
</p>

</div>


<div class="service">

<div class="serviceIcon">🔄</div>

<h3>Referral Tracking</h3>

<p>
Track referrals between sub-centres, PHCs,
rural hospitals and district hospitals.
</p>

</div>


<div class="service">

<div class="serviceIcon">💊</div>

<h3>Medicine Visibility</h3>

<p>
Provide facility-level visibility for medicine
and healthcare resource availability.
</p>

</div>


<div class="service">

<div class="serviceIcon">❤️</div>

<h3>High-risk Follow-up</h3>

<p>
Support regular follow-up for chronic,
maternal, child and high-risk patients.
</p>

</div>

</div>

</section>


<!-- APPLICATION -->

<section class="app" id="app">

<div class="appHeader">

<div>

<h2>Healthcare Portal</h2>

<span style="color:#718096;font-size:13px">
Patient & Facility Management
</span>

</div>

<button class="secondary"
onclick="goHome()">
← Back to Home
</button>

</div>


<div class="dashboard">


<!-- STATISTICS -->

<div class="stats">

<div class="stat">

<div class="statLabel">Registered Patients</div>

<div class="statNumber"
id="totalPatients">
-
</div>

</div>

<div class="stat">

<div class="statLabel">Open Appointments</div>

<div class="statNumber"
id="totalAppointments">
-
</div>

</div>

<div class="stat">

<div class="statLabel">Active Referrals</div>

<div class="statNumber"
id="totalReferrals">
-
</div>

</div>

<div class="stat">

<div class="statLabel">Follow-ups</div>

<div class="statNumber"
id="totalFollowups">
-
</div>

</div>

</div>


<!-- TABS -->

<div class="tabs">

<button class="tab active"
onclick="tab('dashboard',this)">
Dashboard
</button>

<button class="tab"
onclick="tab('patients',this)">
Patients
</button>

<button class="tab"
onclick="tab('records',this)">
Medical Records
</button>

<button class="tab"
onclick="tab('appointments',this)">
Appointments
</button>

<button class="tab"
onclick="tab('referrals',this)">
Referrals
</button>

<button class="tab"
onclick="tab('followups',this)">
Follow-up
</button>

<button class="tab"
onclick="tab('emergency',this)">
Emergency
</button>

</div>


<!-- DASHBOARD TAB -->

<div id="dashboard"
class="tabContent">

<div class="panel">

<h3>Healthcare Access Dashboard</h3>

<p>
Welcome to Rural Health Connect.
Use this portal to register patients,
manage records, appointments, referrals
and follow-up care.
</p>

<div id="backendStatus"
class="message">
Connecting to backend...
</div>

</div>

</div>


<!-- PATIENT TAB -->

<div id="patients"
class="tabContent"
style="display:none">

<div class="panel">

<h3>Patient Registration</h3>

<div class="formGrid">

<div class="field">

<label>Patient Name *</label>

<input id="patientName"
placeholder="Enter full name">

</div>

<div class="field">

<label>Age</label>

<input id="patientAge"
type="number"
placeholder="Age">

</div>

<div class="field">

<label>Gender</label>

<select id="patientGender">

<option value="">Select gender</option>
<option>Female</option>
<option>Male</option>
<option>Other</option>

</select>

</div>

<div class="field">

<label>Village</label>

<input id="patientVillage"
placeholder="Village / Area">

</div>

<div class="field">

<label>Phone</label>

<input id="patientPhone"
placeholder="Phone number">

</div>

</div>

<button class="primary"
style="margin-top:18px"
onclick="registerPatient()">
Register Patient
</button>

<div id="patientMessage"
class="message">
</div>

</div>


<div class="panel">

<h3>Search Patient</h3>

<div class="formGrid">

<div class="field">

<label>Patient ID</label>

<input id="searchPatientId"
placeholder="Example: 12">

</div>

<div class="field">

<label>Patient Name</label>

<input id="searchPatientName"
placeholder="Search by name">

</div>

</div>

<button class="primary"
style="margin-top:18px"
onclick="searchPatient()">
Search Patient
</button>

<div id="patientResults"></div>

</div>

</div>


<!-- RECORDS -->

<div id="records"
class="tabContent"
style="display:none">

<div class="panel">

<h3>Full Medical Report</h3>

<p style="color:#718096">
Enter the Patient ID to view the complete
available medical history.
</p>

<div class="field">

<label>Patient ID *</label>

<input id="recordPatientId"
placeholder="Patient ID">

</div>

<button class="primary"
style="margin-top:15px"
onclick="loadRecord()">
View Medical Report
</button>

<div id="medicalReport"
style="margin-top:20px">
</div>

</div>


<div class="panel">

<h3>Add Medical Record</h3>

<div class="formGrid">

<div class="field">

<label>Patient ID *</label>

<input id="medicalPatientId">

</div>

<div class="field">

<label>Recorded By</label>

<input id="recordedBy"
value="Health Worker">

</div>

<div class="field">

<label>Record Type</label>

<select id="recordType">

<option>Clinical Note</option>
<option>Consultation</option>
<option>Diagnosis Note</option>
<option>Lab Note</option>
<option>Follow-up Note</option>

</select>

</div>

<div class="field full">

<label>Medical Notes *</label>

<textarea id="medicalNotes"
placeholder="Enter relevant medical information"></textarea>

</div>

</div>

<button class="primary"
style="margin-top:15px"
onclick="addRecord()">
Save Medical Record
</button>

<div id="recordMessage"
class="message">
</div>

</div>

</div>


<!-- APPOINTMENTS -->

<div id="appointments"
class="tabContent"
style="display:none">

<div class="panel">

<h3>Appointment Booking</h3>

<div class="formGrid">

<div class="field">

<label>Patient ID *</label>

<input id="appointmentPatientId">

</div>

<div class="field">

<label>Doctor</label>

<input id="doctorName"
placeholder="Doctor name">

</div>

<div class="field">

<label>Date *</label>

<input id="appointmentDate"
type="date">

</div>

<div class="field">

<label>Time *</label>

<input id="appointmentTime"
type="time">

</div>

<div class="field full">

<label>Reason</label>

<textarea id="appointmentReason"
placeholder="Reason for consultation"></textarea>

</div>

</div>

<button class="primary"
style="margin-top:15px"
onclick="bookAppointment()">
Book Appointment
</button>

<div id="appointmentMessage"
class="message">
</div>

</div>


<div class="panel">

<h3>Appointment Queue</h3>

<button class="secondary"
onclick="loadAppointments()">
Refresh Queue
</button>

<div id="appointmentList"></div>

</div>

</div>


<!-- REFERRALS -->

<div id="referrals"
class="tabContent"
style="display:none">

<div class="panel">

<h3>Create Referral</h3>

<div class="formGrid">

<div class="field">

<label>Patient ID *</label>

<input id="referralPatientId">

</div>

<div class="field">

<label>From Facility *</label>

<input id="fromFacility"
placeholder="PHC / Sub-centre">

</div>

<div class="field">

<label>To Facility *</label>

<input id="toFacility"
placeholder="Rural / District Hospital">

</div>

<div class="field full">

<label>Referral Reason *</label>

<textarea id="referralReason"></textarea>

</div>

</div>

<button class="primary"
style="margin-top:15px"
onclick="createReferral()">
Create Referral
</button>

<div id="referralMessage"
class="message">
</div>

</div>


<div class="panel">

<h3>Referral Tracking</h3>

<button class="secondary"
onclick="loadReferrals()">
Refresh Referrals
</button>

<div id="referralList"></div>

</div>

</div>


<!-- FOLLOW UPS -->

<div id="followups"
class="tabContent"
style="display:none">

<div class="panel">

<h3>High-risk & Chronic Follow-up</h3>

<div class="formGrid">

<div class="field">

<label>Patient ID *</label>

<input id="followPatientId">

</div>

<div class="field">

<label>Follow-up Date *</label>

<input id="followDate"
type="date">

</div>

<div class="field">

<label>Purpose *</label>

<select id="followPurpose">

<option>Chronic Disease</option>
<option>Maternal Health</option>
<option>Child Health</option>
<option>Diabetes</option>
<option>Hypertension</option>
<option>High-risk Patient</option>
<option>General Follow-up</option>

</select>

</div>

<div class="field full">

<label>Notes</label>

<textarea id="followNotes"></textarea>

</div>

</div>

<button class="primary"
style="margin-top:15px"
onclick="createFollowup()">
Schedule Follow-up
</button>

<div id="followMessage"
class="message">
</div>

</div>


<div class="panel">

<h3>Follow-up List</h3>

<button class="secondary"
onclick="loadFollowups()">
Refresh
</button>

<div id="followList"></div>

</div>

</div>


<!-- EMERGENCY -->

<div id="emergency"
class="tabContent"
style="display:none">

<div class="panel">

<div class="emergency">

<h3>🚨 Emergency Escalation</h3>

<p>
If a patient has a serious or life-threatening
condition, do not rely on this software for diagnosis.
Immediately contact emergency medical services
or take the patient to the nearest appropriate hospital.
</p>

<button class="primary"
onclick="emergencyAlert()">
Emergency Guidance
</button>

</div>

</div>

</div>


</div>

</section>


<!-- FOOTER -->

<footer class="footer">

<h3>Rural Health Connect</h3>

<p>
Integrated healthcare access and quality support
for rural and underserved communities.
</p>

<p>
SIH Prototype • Maharashtra Rural Healthcare
</p>

</footer>


<script>

var API = window.location.origin;


/* =========================
   COMMON FUNCTIONS
========================= */

function esc(value){

  return String(value == null ? "" : value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

}


function showMessage(id,text,type){

  var el = document.getElementById(id);

  el.className = "message show " + (type || "success");

  el.textContent = text;

}


async function getAPI(path){

  var response = await fetch(API + path);

  var data = await response.json();

  if(!response.ok || !data.success){

    throw new Error(data.message || "Request failed");

  }

  return data;

}


async function postAPI(path,data){

  var response = await fetch(API + path,{

    method:"POST",

    headers:{
      "Content-Type":"application/json"
    },

    body:JSON.stringify(data)

  });

  var result = await response.json();

  if(!response.ok || !result.success){

    throw new Error(result.message || "Request failed");

  }

  return result;

}


/* =========================
   HOME
========================= */

function goHome(){

  document.getElementById("app").classList.remove("active");

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });

}


function scrollServices(){

  document.getElementById("services")
    .scrollIntoView({
      behavior:"smooth"
    });

}


function openApp(){

  document.getElementById("app")
    .classList.add("active");

  document.getElementById("app")
    .scrollIntoView({
      behavior:"smooth"
    });

  loadDashboard();

}


function showAbout(){

  alert(
    "Rural Health Connect is an SIH prototype designed to strengthen healthcare access, continuity and referral support for rural communities."
  );

}


/* =========================
   TABS
========================= */

function tab(id,button){

  document.querySelectorAll(".tabContent")
    .forEach(function(el){

      el.style.display = "none";

    });

  document.getElementById(id)
    .style.display = "block";

  document.querySelectorAll(".tab")
    .forEach(function(el){

      el.classList.remove("active");

    });

  button.classList.add("active");


  if(id === "appointments"){
    loadAppointments();
  }

  if(id === "referrals"){
    loadReferrals();
  }

  if(id === "followups"){
    loadFollowups();
  }

}


/* =========================
   DASHBOARD
========================= */

async function loadDashboard(){

  try{

    var data = await getAPI("/api/dashboard");

    document.getElementById("totalPatients")
      .textContent = data.patients;

    document.getElementById("totalAppointments")
      .textContent = data.appointments;

    document.getElementById("totalReferrals")
      .textContent = data.referrals;

    document.getElementById("totalFollowups")
      .textContent = data.followups;

    showMessage(
      "backendStatus",
      "✓ Backend connected successfully with Cloudflare D1.",
      "success"
    );

  }catch(error){

    showMessage(
      "backendStatus",
      "Backend connection error: " + error.message,
      "error"
    );

  }

}


/* =========================
   PATIENT
========================= */

async function registerPatient(){

  try{

    var result = await postAPI(
      "/api/patients",
      {
        name:document.getElementById("patientName").value,
        age:document.getElementById("patientAge").value,
        gender:document.getElementById("patientGender").value,
        village:document.getElementById("patientVillage").value,
        phone:document.getElementById("patientPhone").value
      }
    );

    showMessage(
      "patientMessage",
      "Patient registered successfully. Patient ID: " +
      result.patient_id,
      "success"
    );

    document.getElementById("recordPatientId").value =
      result.patient_id;

    document.getElementById("medicalPatientId").value =
      result.patient_id;

    document.getElementById("appointmentPatientId").value =
      result.patient_id;

    document.getElementById("referralPatientId").value =
      result.patient_id;

    document.getElementById("followPatientId").value =
      result.patient_id;

    loadDashboard();

  }catch(error){

    showMessage(
      "patientMessage",
      error.message,
      "error"
    );

  }

}


async function searchPatient(){

  var id =
    document.getElementById("searchPatientId")
      .value.trim();

  var name =
    document.getElementById("searchPatientName")
      .value.trim();

  if(!id && !name){

    showMessage(
      "patientResults",
      "Enter Patient ID or patient name.",
      "error"
    );

    return;
  }

  try{

    var query = id
      ? "?id=" + encodeURIComponent(id)
      : "?name=" + encodeURIComponent(name);

    var data = await getAPI(
      "/api/patients" + query
    );

    var html = "";

    if(!data.patients.length){

      html =
        '<div class="message show error">' +
        "No patient found." +
        "</div>";

    }else{

      data.patients.forEach(function(p){

        html +=
          '<div class="patient">' +

          "<h4>" +
          esc(p.name) +
          "</h4>" +

          "<p><b>Patient ID:</b> " +
          esc(p.id) +
          "</p>" +

          "<p><b>Age:</b> " +
          esc(p.age || "N/A") +
          " &nbsp; <b>Gender:</b> " +
          esc(p.gender || "N/A") +
          "</p>" +

          "<p><b>Village:</b> " +
          esc(p.village || "N/A") +
          "</p>" +

          '<button class="primary" onclick="selectPatient(' +
          Number(p.id) +
          ')">' +

          "View Medical Report" +

          "</button>" +

          "</div>";

      });

    }

    document.getElementById("patientResults")
      .innerHTML = html;

  }catch(error){

    document.getElementById("patientResults")
      .innerHTML =
        '<div class="message show error">' +
        esc(error.message) +
        "</div>";

  }

}


function selectPatient(id){

  document.getElementById("recordPatientId").value = id;

  document.getElementById("medicalPatientId").value = id;

  document.querySelectorAll(".tab")
    .forEach(function(el){

      el.classList.remove("active");

    });

  document.querySelectorAll(".tab")[2]
    .classList.add("active");

  tab(
    "records",
    document.querySelectorAll(".tab")[2]
  );

  loadRecord();

}


/* =========================
   MEDICAL RECORD
========================= */

async function loadRecord(){

  var id =
    document.getElementById("recordPatientId")
      .value.trim();

  if(!id){

    document.getElementById("medicalReport")
      .innerHTML =
        '<div class="message show error">' +
        "Enter Patient ID." +
        "</div>";

    return;
  }

  try{

    var data = await getAPI(
      "/api/patient-record?patient_id=" +
      encodeURIComponent(id)
    );

    var p = data.patient;

    var html =
      '<div class="patient">' +

      "<h3>" +
      esc(p.name) +
      "</h3>" +

      "<p><b>Patient ID:</b> " +
      esc(p.id) +
      "</p>" +

      "<p><b>Age:</b> " +
      esc(p.age || "N/A") +
      " &nbsp; <b>Gender:</b> " +
      esc(p.gender || "N/A") +
      "</p>" +

      "<p><b>Village:</b> " +
      esc(p.village || "N/A") +
      "</p>" +

      "<h4>Medical Records</h4>";

    if(data.records.length){

      data.records.forEach(function(r){

        html +=
          '<div class="item">' +

          "<b>" +
          esc(r.record_type) +
          "</b>" +

          "<p>" +
          esc(r.notes) +
          "</p>" +

          '<small>' +
          esc(r.recorded_by) +
          " • " +
          esc(r.created_at) +
          "</small>" +

          "</div>";

      });

    }else{

      html +=
        "<p>No medical records available.</p>";

    }


    html += "<h4>Appointments</h4>";

    if(data.appointments.length){

      data.appointments.forEach(function(a){

        html +=
          '<div class="item">' +

          esc(a.appointment_date) +
          " • " +
          esc(a.appointment_time) +

          " • " +

          esc(a.doctor_name || "Doctor") +

          ' <span class="pill">' +

          esc(a.status) +

          "</span>" +

          "</div>";

      });

    }else{

      html +=
        "<p>No appointments.</p>";

    }


    html += "<h4>Referrals</h4>";

    if(data.referrals.length){

      data.referrals.forEach(function(r){

        html +=
          '<div class="item">' +

          esc(r.from_facility) +
          " → " +
          esc(r.to_facility) +

          ' <span class="pill">' +

          esc(r.status) +

          "</span>" +

          "<p>" +
          esc(r.reason) +
          "</p>" +

          "</div>";

      });

    }else{

      html +=
        "<p>No referrals.</p>";

    }


    html += "<h4>Follow-ups</h4>";

    if(data.followups.length){

      data.followups.forEach(function(f){

        html +=
          '<div class="item">' +

          esc(f.follow_up_date) +
          " • " +
          esc(f.purpose) +

          ' <span class="pill">' +

          esc(f.status) +

          "</span>" +

          "</div>";

      });

    }else{

      html +=
        "<p>No follow-ups.</p>";

    }

    html += "</div>";

    document.getElementById("medicalReport")
      .innerHTML = html;

  }catch(error){

    document.getElementById("medicalReport")
      .innerHTML =
        '<div class="message show error">' +
        esc(error.message) +
        "</div>";

  }

}


async function addRecord(){

  try{

    var result = await postAPI(
      "/api/medical-records",
      {
        patient_id:
          document.getElementById("medicalPatientId").value,

        recorded_by:
          document.getElementById("recordedBy").value,

        record_type:
          document.getElementById("recordType").value,

        notes:
          document.getElementById("medicalNotes").value
      }
    );

    showMessage(
      "recordMessage",
      result.message,
      "success"
    );

    document.getElementById("medicalNotes")
      .value = "";

    loadRecord();

  }catch(error){

    showMessage(
      "recordMessage",
      error.message,
      "error"
    );

  }

}


/* =========================
   APPOINTMENTS
========================= */

async function bookAppointment(){

  try{

    var result = await postAPI(
      "/api/appointments",
      {
        patient_id:
          document.getElementById("appointmentPatientId").value,

        doctor_name:
          document.getElementById("doctorName").value,

        appointment_date:
          document.getElementById("appointmentDate").value,

        appointment_time:
          document.getElementById("appointmentTime").value,

        reason:
          document.getElementById("appointmentReason").value
      }
    );

    showMessage(
      "appointmentMessage",
      result.message,
      "success"
    );

    loadAppointments();

    loadDashboard();

  }catch(error){

    showMessage(
      "appointmentMessage",
      error.message,
      "error"
    );

  }

}


async function loadAppointments(){

  try{

    var data =
      await getAPI("/api/appointments");

    var html = "";

    if(!data.appointments.length){

      html =
        "<p>No appointments available.</p>";

    }else{

      data.appointments.forEach(function(a){

        html +=
          '<div class="item">' +

          "<b>" +
          esc(a.patient_name || "Patient") +
          "</b>" +

          "<br>" +

          esc(a.appointment_date) +
          " • " +
          esc(a.appointment_time) +

          "<br>" +

          "Doctor: " +
          esc(a.doctor_name || "Not assigned") +

          ' <span class="pill">' +
          esc(a.status) +
          "</span>" +

          "<br><br>" +

          '<button class="secondary" onclick="appointmentStatus(' +
          Number(a.id) +
      ',&quot;completed&quot;)">' +
          "Complete" +

          "</button>" +

          "</div>";

      });

    }

    document.getElementById("appointmentList")
      .innerHTML = html;

  }catch(error){

    document.getElementById("appointmentList")
      .textContent = error.message;

  }

}


async function appointmentStatus(id,status){

  try{

    await postAPI(
      "/api/appointments/status",
      {
        id:id,
        status:status
      }
    );

    loadAppointments();

    loadDashboard();

  }catch(error){

    alert(error.message);

  }

}


/* =========================
   REFERRALS
========================= */

async function createReferral(){

  try{

    var result = await postAPI(
      "/api/referrals",
      {
        patient_id:
          document.getElementById("referralPatientId").value,

        from_facility:
          document.getElementById("fromFacility").value,

        to_facility:
          document.getElementById("toFacility").value,

        reason:
          document.getElementById("referralReason").value
      }
    );

    showMessage(
      "referralMessage",
      result.message,
      "success"
    );

    loadReferrals();

    loadDashboard();

  }catch(error){

    showMessage(
      "referralMessage",
      error.message,
      "error"
    );

  }

}


async function loadReferrals(){

  try{

    var data =
      await getAPI("/api/referrals");

    var html = "";

    if(!data.referrals.length){

      html =
        "<p>No referrals available.</p>";

    }else{

      data.referrals.forEach(function(r){

        html +=
          '<div class="item">' +

          "<b>" +
          esc(r.patient_name || "Patient") +
          "</b>" +

          "<br>" +

          esc(r.from_facility) +
          " → " +
          esc(r.to_facility) +

          "<br>" +

          esc(r.reason) +

          "<br><br>" +

          '<span class="pill">' +
          esc(r.status) +
          "</span>" +

          "<br><br>" +

          '<button class="secondary" onclick="completeReferral(' +
          Number(r.id) +
          ')">' +

          "Mark Completed" +

          "</button>" +

          "</div>";

      });

    }

    document.getElementById("referralList")
      .innerHTML = html;

  }catch(error){

    document.getElementById("referralList")
      .textContent = error.message;

  }

}


async function completeReferral(id){

  try{

    await postAPI(
      "/api/referrals/status",
      {
        id:id,
        status:"completed"
      }
    );

    loadReferrals();

    loadDashboard();

  }catch(error){

    alert(error.message);

  }

}


/* =========================
   FOLLOW-UP
========================= */

async function createFollowup(){

  try{

    var result = await postAPI(
      "/api/follow-ups",
      {
        patient_id:
          document.getElementById("followPatientId").value,

        follow_up_date:
          document.getElementById("followDate").value,

        purpose:
          document.getElementById("followPurpose").value,

        notes:
          document.getElementById("followNotes").value
      }
    );

    showMessage(
      "followMessage",
      result.message,
      "success"
    );

    loadFollowups();

    loadDashboard();

  }catch(error){

    showMessage(
      "followMessage",
      error.message,
      "error"
    );

  }

}


async function loadFollowups(){

  try{

    var data =
      await getAPI("/api/follow-ups");

    var html = "";

    if(!data.followups.length){

      html =
        "<p>No follow-ups available.</p>";

    }else{

      data.followups.forEach(function(f){

        html +=
          '<div class="item">' +

          "<b>" +
          esc(f.patient_name || "Patient") +
          "</b>" +

          "<br>" +

          "Date: " +
          esc(f.follow_up_date) +

          "<br>" +

          "Purpose: " +
          esc(f.purpose) +

          "<br>" +

          '<span class="pill">' +
          esc(f.status) +
          "</span>" +

          "</div>";

      });

    }

    document.getElementById("followList")
      .innerHTML = html;

  }catch(error){

    document.getElementById("followList")
      .textContent = error.message;

  }

}


/* =========================
   EMERGENCY
========================= */

function emergencyAlert(){

  alert(
    "EMERGENCY ESCALATION\n\n" +
    "Please contact local emergency medical services " +
    "or immediately take the patient to the nearest " +
    "appropriate hospital.\n\n" +
    "This software does not diagnose emergencies."
  );

}


/* =========================
   LANGUAGE
========================= */

var marathi = false;

function toggleLanguage(){

  marathi = !marathi;

  if(marathi){

    document.getElementById("languageButton")
      .textContent = "English";

    document.getElementById("heroText")
      .textContent =
      "ग्रामीण समुदायांसाठी रुग्ण, डॉक्टर, वैद्यकीय नोंदी, रेफरल, अपॉइंटमेंट आणि फॉलो-अप सेवा एकत्र जोडणारे डिजिटल आरोग्य व्यासपीठ.";

  }else{

    document.getElementById("languageButton")
      .textContent = "मराठी";

    document.getElementById("heroText")
      .textContent =
      "A connected digital healthcare platform that helps rural communities access patients, doctors, medical records, referrals, appointments and follow-up care through one simple system.";

  }

}


/* START */

loadDashboard();

</script>

</body>
</html>`;
}


/* =========================
   CLOUDFLARE WORKER
========================= */

export default {

  async fetch(request, env){

    const url = new URL(request.url);

    if(url.pathname.startsWith("/api/")){

      return api(request, env, url);

    }

    return new Response(
      page(),
      {
        headers:{
          "Content-Type":
            "text/html; charset=UTF-8"
        }
      }
    );

  }

};

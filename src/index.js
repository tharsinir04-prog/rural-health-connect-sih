const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function api(request, env, url) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    if (url.pathname === "/api/test" && request.method === "GET") {
      return json({
        success: true,
        message: "Rural Health Connect API is working"
      });
    }

    if (url.pathname === "/api/dashboard" && request.method === "GET") {
      const patients = await env.DB
        .prepare("SELECT COUNT(*) AS count FROM patients")
        .first();

      const appointments = await env.DB
        .prepare("SELECT COUNT(*) AS count FROM appointments WHERE status != 'completed' AND status != 'cancelled'")
        .first();

      const referrals = await env.DB
        .prepare("SELECT COUNT(*) AS count FROM referrals WHERE status != 'completed'")
        .first();

      const followups = await env.DB
        .prepare("SELECT COUNT(*) AS count FROM follow_ups WHERE status != 'completed'")
        .first();

      return json({
        success: true,
        patients: Number(patients?.count || 0),
        appointments: Number(appointments?.count || 0),
        referrals: Number(referrals?.count || 0),
        follow_ups: Number(followups?.count || 0)
      });
    }

    if (url.pathname === "/api/patients" && request.method === "POST") {
      const d = await readJson(request);

      if (!d || !String(d.name || "").trim()) {
        return json({
          success: false,
          message: "Patient name is required."
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO patients (name, age, gender, village, phone) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        String(d.name).trim(),
        d.age === "" || d.age == null ? null : Number(d.age),
        d.gender || null,
        d.village || null,
        d.phone || null
      ).run();

      return json({
        success: true,
        message: "Patient registered successfully.",
        patient_id: result.meta.last_row_id
      }, 201);
    }

    if (url.pathname === "/api/patients" && request.method === "GET") {
      const id = url.searchParams.get("id");
      const name = url.searchParams.get("name");

      let result;

      if (id) {
        result = await env.DB
          .prepare("SELECT * FROM patients WHERE id = ?")
          .bind(id)
          .all();
      } else if (name) {
        result = await env.DB
          .prepare("SELECT * FROM patients WHERE name LIKE ? ORDER BY id DESC")
          .bind("%" + name + "%")
          .all();
      } else {
        result = await env.DB
          .prepare("SELECT * FROM patients ORDER BY id DESC LIMIT 100")
          .all();
      }

      return json({
        success: true,
        patients: result.results || []
      });
    }

    if (url.pathname === "/api/patient-record" && request.method === "GET") {
      const patientId = url.searchParams.get("patient_id");

      if (!patientId) {
        return json({
          success: false,
          message: "Patient ID is required."
        }, 400);
      }

      const patient = await env.DB
        .prepare("SELECT * FROM patients WHERE id = ?")
        .bind(patientId)
        .first();

      if (!patient) {
        return json({
          success: false,
          message: "Patient not found."
        }, 404);
      }

      const records = await env.DB
        .prepare("SELECT * FROM medical_records WHERE patient_id = ? ORDER BY id DESC")
        .bind(patientId)
        .all();

      const appointments = await env.DB
        .prepare("SELECT * FROM appointments WHERE patient_id = ? ORDER BY id DESC")
        .bind(patientId)
        .all();

      const referrals = await env.DB
        .prepare("SELECT * FROM referrals WHERE patient_id = ? ORDER BY id DESC")
        .bind(patientId)
        .all();

      const followups = await env.DB
        .prepare("SELECT * FROM follow_ups WHERE patient_id = ? ORDER BY id DESC")
        .bind(patientId)
        .all();

      return json({
        success: true,
        patient,
        records: records.results || [],
        appointments: appointments.results || [],
        referrals: referrals.results || [],
        follow_ups: followups.results || []
      });
    }

    if (url.pathname === "/api/medical-records" && request.method === "POST") {
      const d = await readJson(request);

      if (!d || !d.patient_id || !String(d.notes || "").trim()) {
        return json({
          success: false,
          message: "Patient ID and notes are required."
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO medical_records (patient_id, recorded_by, record_type, notes) VALUES (?, ?, ?, ?)"
      ).bind(
        d.patient_id,
        d.recorded_by || "Health Worker",
        d.record_type || "Clinical Note",
        String(d.notes).trim()
      ).run();

      return json({
        success: true,
        message: "Medical record added successfully.",
        record_id: result.meta.last_row_id
      }, 201);
    }

    if (url.pathname === "/api/appointments" && request.method === "POST") {
      const d = await readJson(request);

      if (!d || !d.patient_id || !d.appointment_date || !d.appointment_time) {
        return json({
          success: false,
          message: "Patient ID, date and time are required."
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time, reason) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        d.patient_id,
        d.doctor_name || null,
        d.appointment_date,
        d.appointment_time,
        d.reason || null
      ).run();

      return json({
        success: true,
        message: "Appointment booked successfully.",
        appointment_id: result.meta.last_row_id
      }, 201);
    }

    if (url.pathname === "/api/appointments" && request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT appointments.*, patients.name AS patient_name FROM appointments LEFT JOIN patients ON patients.id = appointments.patient_id ORDER BY appointment_date ASC, appointment_time ASC, appointments.id DESC LIMIT 100"
      ).all();

      return json({
        success: true,
        appointments: result.results || []
      });
    }

    if (url.pathname === "/api/appointments/status" && request.method === "POST") {
      const d = await readJson(request);

      if (!d || !d.id || !d.status) {
        return json({
          success: false,
          message: "Appointment ID and status are required."
        }, 400);
      }

      await env.DB
        .prepare("UPDATE appointments SET status = ? WHERE id = ?")
        .bind(d.status, d.id)
        .run();

      return json({
        success: true,
        message: "Appointment status updated."
      });
    }

    if (url.pathname === "/api/referrals" && request.method === "POST") {
      const d = await readJson(request);

      if (!d || !d.patient_id || !d.from_facility || !d.to_facility || !d.reason) {
        return json({
          success: false,
          message: "Patient ID, facilities and reason are required."
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO referrals (patient_id, from_facility, to_facility, reason) VALUES (?, ?, ?, ?)"
      ).bind(
        d.patient_id,
        d.from_facility,
        d.to_facility,
        d.reason
      ).run();

      return json({
        success: true,
        message: "Referral created successfully.",
        referral_id: result.meta.last_row_id
      }, 201);
    }

    if (url.pathname === "/api/referrals" && request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT referrals.*, patients.name AS patient_name FROM referrals LEFT JOIN patients ON patients.id = referrals.patient_id ORDER BY referral_date DESC LIMIT 100"
      ).all();

      return json({
        success: true,
        referrals: result.results || []
      });
    }

    if (url.pathname === "/api/referrals/status" && request.method === "POST") {
      const d = await readJson(request);

      if (!d || !d.id || !d.status) {
        return json({
          success: false,
          message: "Referral ID and status are required."
        }, 400);
      }

      if (d.status === "completed") {
        await env.DB.prepare(
          "UPDATE referrals SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(d.status, d.id).run();
      } else {
        await env.DB.prepare(
          "UPDATE referrals SET status = ? WHERE id = ?"
        ).bind(d.status, d.id).run();
      }

      return json({
        success: true,
        message: "Referral status updated."
      });
    }

    if (url.pathname === "/api/follow-ups" && request.method === "POST") {
      const d = await readJson(request);

      if (!d || !d.patient_id || !d.follow_up_date || !d.purpose) {
        return json({
          success: false,
          message: "Patient ID, date and purpose are required."
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO follow_ups (patient_id, follow_up_date, purpose, status, notes) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        d.patient_id,
        d.follow_up_date,
        d.purpose,
        "pending",
        d.notes || null
      ).run();

      return json({
        success: true,
        message: "Follow-up scheduled successfully.",
        follow_up_id: result.meta.last_row_id
      }, 201);
    }

    if (url.pathname === "/api/follow-ups" && request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT follow_ups.*, patients.name AS patient_name FROM follow_ups LEFT JOIN patients ON patients.id = follow_ups.patient_id ORDER BY follow_up_date ASC LIMIT 100"
      ).all();

      return json({
        success: true,
        follow_ups: result.results || []
      });
    }

    return json({
      success: false,
      message: "API endpoint not found."
    }, 404);

  } catch (error) {
    console.error(error);

    return json({
      success: false,
      message: error.message || "Server error."
    }, 500);
  }
}

function page() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>Rural Health Connect</title>

<style>

*{
  box-sizing:border-box;
}

body{
  margin:0;
  font-family:Arial,sans-serif;
  background:#f4f7fb;
  color:#172033;
}

header{
  background:linear-gradient(135deg,#0757a5,#0879c9);
  color:white;
  padding:24px;
}

.header{
  max-width:1180px;
  margin:auto;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:15px;
}

.logo{
  font-size:28px;
  font-weight:800;
}

.tagline{
  margin-top:5px;
  opacity:.9;
}

.lang{
  border:0;
  background:white;
  color:#0757a5;
  padding:10px 14px;
  border-radius:10px;
  font-weight:bold;
  cursor:pointer;
}

.wrap{
  max-width:1180px;
  margin:auto;
  padding:22px;
}

.hero{
  background:linear-gradient(135deg,#eaf5ff,#ffffff);
  border:1px solid #d7e7f6;
  border-radius:18px;
  padding:25px;
  margin-bottom:18px;
}

.hero h1{
  margin:0 0 8px;
  font-size:32px;
}

.notice{
  background:#fff7d6;
  border-left:5px solid #e3a400;
  padding:14px 16px;
  border-radius:12px;
  margin-bottom:18px;
}

.stats{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:14px;
  margin-bottom:20px;
}

.card{
  background:white;
  border:1px solid #e4eaf2;
  border-radius:16px;
  padding:20px;
  box-shadow:0 4px 18px rgba(20,33,61,.06);
}

.stat{
  font-size:32px;
  font-weight:800;
  margin-top:7px;
}

.muted{
  color:#68768a;
  font-size:14px;
}

.tabs{
  display:flex;
  flex-wrap:wrap;
  gap:9px;
  margin-bottom:18px;
}

.tab{
  border:0;
  background:#e6eef8;
  color:#17365d;
  padding:12px 16px;
  border-radius:10px;
  font-weight:700;
  cursor:pointer;
}

.tab:hover{
  background:#d4e4f5;
}

.tab.active{
  background:#075fae;
  color:white;
}

.tab.emergency{
  background:#c62828;
  color:white;
}

.section{
  display:none;
}

.section.active{
  display:block;
}

.grid{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:16px;
}

.formgrid{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:14px;
}

label{
  display:block;
  font-size:14px;
  font-weight:700;
  margin:12px 0 6px;
}

input,
select,
textarea{
  width:100%;
  padding:12px;
  border:1px solid #cfd8e5;
  border-radius:10px;
  font:inherit;
  background:white;
}

textarea{
  min-height:110px;
  resize:vertical;
}

.primary{
  border:0;
  background:#075fae;
  color:white;
  padding:12px 18px;
  border-radius:10px;
  font-weight:700;
  cursor:pointer;
  margin-top:14px;
}

.primary:hover{
  background:#064d8d;
}

.secondary{
  border:0;
  background:#e8eef6;
  padding:9px 12px;
  border-radius:9px;
  cursor:pointer;
  font-weight:700;
}

.secondary:hover{
  background:#d8e2ef;
}

.msg{
  margin-top:12px;
  padding:11px;
  border-radius:9px;
  display:none;
}

.msg.show{
  display:block;
}

.msg.success{
  background:#e8f7ee;
  color:#176b35;
}

.msg.error{
  background:#ffe9e9;
  color:#a11;
}

.item{
  border:1px solid #e0e7f0;
  border-radius:12px;
  padding:14px;
  margin-top:10px;
  background:#fbfcfe;
}

.pill{
  display:inline-block;
  background:#e8eef7;
  padding:4px 9px;
  border-radius:999px;
  font-size:12px;
}

.actions{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:12px;
  margin-top:18px;
}

.action{
  background:white;
  border:1px solid #dce7f2;
  border-radius:14px;
  padding:18px;
  text-align:left;
  cursor:pointer;
  font-weight:700;
}

.action:hover{
  border-color:#075fae;
  transform:translateY(-1px);
}

.action span{
  display:block;
  color:#65748b;
  font-size:13px;
  font-weight:400;
  margin-top:5px;
}

footer{
  text-align:center;
  color:#718096;
  padding:25px;
  font-size:13px;
}

@media(max-width:800px){

  .stats{
    grid-template-columns:repeat(2,1fr);
  }

  .grid,
  .formgrid{
    grid-template-columns:1fr;
  }

  .actions{
    grid-template-columns:1fr;
  }

  .header{
    align-items:flex-start;
  }

}

@media(max-width:500px){

  .stats{
    grid-template-columns:1fr;
  }

  .wrap{
    padding:14px;
  }

  .hero h1{
    font-size:25px;
  }

}

</style>
</head>

<body>

<header>

<div class="header">

<div>

<div class="logo">
♥ Rural Health Connect
</div>

<div class="tagline" id="tagline">
Integrated healthcare access & quality support for rural communities
</div>

</div>

<button class="lang" id="langBtn">
मराठी / English
</button>

</div>

</header>


<main class="wrap">

<div class="hero">

<h1 id="welcome">
Healthcare access, closer to home.
</h1>

<p id="intro">
One connected platform for patients, frontline health workers and doctors — supporting registration, medical records, appointments, referrals and follow-up care.
</p>

</div>


<div class="notice">

<b>Demo / SIH Prototype:</b>

This platform supports patients, frontline health workers and doctors.
It does not replace professional medical judgement or emergency services.

</div>


<div class="stats">

<div class="card">

<div class="muted">
Total Patients
</div>

<div class="stat" id="sPatients">
0
</div>

</div>


<div class="card">

<div class="muted">
Open Appointments
</div>

<div class="stat" id="sAppointments">
0
</div>

</div>


<div class="card">

<div class="muted">
Open Referrals
</div>

<div class="stat" id="sReferrals">
0
</div>

</div>


<div class="card">

<div class="muted">
Follow-ups
</div>

<div class="stat" id="sFollowups">
0
</div>

</div>

</div>


<div class="tabs">

<button class="tab active" data-tab="home">
Dashboard
</button>

<button class="tab" data-tab="patient">
Patient
</button>

<button class="tab" data-tab="record">
Medical Report
</button>

<button class="tab" data-tab="appointment">
Appointments
</button>

<button class="tab" data-tab="referral">
Referrals
</button>

<button class="tab" data-tab="followup">
Follow-up
</button>

<button class="tab emergency" id="emergencyBtn">
Emergency
</button>

</div>


<section id="home" class="section active">

<div class="card">

<h2>
Connected Healthcare Dashboard
</h2>

<p>
Manage the complete care journey from registration to follow-up.
</p>


<div class="actions">

<button class="action" data-go="patient">

👤 Register / Search Patient

<span>
Create or find a patient record
</span>

</button>


<button class="action" data-go="record">

📄 Medical Report

<span>
View the full longitudinal report
</span>

</button>


<button class="action" data-go="appointment">

📅 Appointments

<span>
Book and manage consultations
</span>

</button>


<button class="action" data-go="referral">

↔ Referrals

<span>
Track referral progress
</span>

</button>


<button class="action" data-go="followup">

⏰ Follow-up

<span>
Schedule continuing care
</span>

</button>


<button class="action" id="apiTestBtn">

✓ System Check

<span>
Test Worker + D1 connection
</span>

</button>

</div>


<div id="homeMsg" class="msg">
</div>

</div>

</section>


<section id="patient" class="section">

<div class="grid">


<div class="card">

<h2>
Register Patient
</h2>

<div class="formgrid">

<div>

<label>
Patient name *
</label>

<input id="pName">

</div>


<div>

<label>
Age
</label>

<input id="pAge" type="number" min="0" max="120">

</div>


<div>

<label>
Gender
</label>

<select id="pGender">

<option value="">
Select
</option>

<option>
Female
</option>

<option>
Male
</option>

<option>
Other
</option>

</select>

</div>


<div>

<label>
Village
</label>

<input id="pVillage">

</div>


<div>

<label>
Phone
</label>

<input id="pPhone">

</div>

</div>


<button class="primary" id="registerBtn">
Register Patient
</button>

<div id="patientMsg" class="msg">
</div>

</div>


<div class="card">

<h2>
Search Patient
</h2>

<div class="formgrid">

<div>

<label>
Patient ID
</label>

<input id="searchId">

</div>


<div>

<label>
Patient name
</label>

<input id="searchName">

</div>

</div>


<button class="primary" id="searchBtn">
Search Patient
</button>

<div id="patientResults">
</div>

</div>

</div>

</section>


<section id="record" class="section">

<div class="grid">


<div class="card">

<h2>
Full Medical Report
</h2>

<label>
Patient ID *
</label>

<input id="recordPatientId">

<button class="primary" id="viewRecordBtn">
View Full Report
</button>

<div id="fullRecord">
</div>

</div>


<div class="card">

<h2>
Add Medical Record
</h2>

<label>
Patient ID *
</label>

<input id="mPatientId">


<label>
Recorded by
</label>

<input id="mRecordedBy" value="Health Worker">


<label>
Record type
</label>

<input id="mType" value="Clinical Note">


<label>
Notes *
</label>

<textarea id="mNotes"></textarea>


<button class="primary" id="addRecordBtn">
Add Medical Record
</button>

<div id="recordMsg" class="msg">
</div>

</div>

</div>

</section>


<section id="appointment" class="section">

<div class="grid">


<div class="card">

<h2>
Book Appointment
</h2>

<label>
Patient ID *
</label>

<input id="aPatientId">


<label>
Doctor
</label>

<input id="aDoctor" placeholder="Doctor name">


<label>
Date *
</label>

<input id="aDate" type="date">


<label>
Time *
</label>

<input id="aTime" type="time">


<label>
Reason
</label>

<textarea id="aReason"></textarea>


<button class="primary" id="bookBtn">
Book Appointment
</button>

<div id="appointmentMsg" class="msg">
</div>

</div>


<div class="card">

<h2>
Appointments / Queue
</h2>

<button class="secondary" id="refreshAppointments">
Refresh
</button>

<div id="appointmentList">
</div>

</div>

</div>

</section>


<section id="referral" class="section">

<div class="grid">


<div class="card">

<h2>
Create Referral
</h2>

<label>
Patient ID *
</label>

<input id="rPatientId">


<label>
From facility *
</label>

<input id="rFrom" placeholder="Sub-centre / PHC">


<label>
To facility *
</label>

<input id="rTo" placeholder="Rural / District Hospital">


<label>
Reason *
</label>

<textarea id="rReason"></textarea>


<button class="primary" id="createReferralBtn">
Create Referral
</button>

<div id="referralMsg" class="msg">
</div>

</div>


<div class="card">

<h2>
Referral Tracking
</h2>

<button class="secondary" id="refreshReferrals">
Refresh
</button>

<div id="referralList">
</div>

</div>

</div>

</section>


<section id="followup" class="section">

<div class="grid">


<div class="card">

<h2>
Schedule Follow-up
</h2>

<label>
Patient ID *
</label>

<input id="fPatientId">


<label>
Follow-up date *
</label>

<input id="fDate" type="date">


<label>
Purpose *
</label>

<input id="fPurpose" placeholder="BP / diabetes / maternal / child">


<label>
Notes
</label>

<textarea id="fNotes"></textarea>


<button class="primary" id="createFollowupBtn">
Schedule Follow-up
</button>

<div id="followupMsg" class="msg">
</div>

</div>


<div class="card">

<h2>
Follow-up List
</h2>

<button class="secondary" id="refreshFollowups">
Refresh
</button>

<div id="followupList">
</div>

</div>

</div>

</section>


<footer>
Rural Health Connect • SIH Prototype • Supporting rural healthcare access and continuity
</footer>

</main>


<script>

(function(){

"use strict";

var API = window.location.origin;


function get(id){
  return document.getElementById(id);
}


function escapeHtml(value){

  return String(value == null ? "" : value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

}


function showMessage(id,text,type){

  var element = get(id);

  element.textContent = text;

  element.className = "msg show " + (type || "");

}


async function getJson(path){

  var response = await fetch(API + path);

  var data = await response.json();

  if(!response.ok || !data.success){
    throw new Error(data.message || "Request failed");
  }

  return data;

}


async function postJson(path,data){

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


function showTab(name){

  document.querySelectorAll(".section").forEach(function(section){
    section.classList.remove("active");
  });

  var selected = get(name);

  if(selected){
    selected.classList.add("active");
  }

  document.querySelectorAll(".tab").forEach(function(button){

    button.classList.toggle(
      "active",
      button.getAttribute("data-tab") === name
    );

  });


  if(name === "appointment"){
    loadAppointments();
  }

  if(name === "referral"){
    loadReferrals();
  }

  if(name === "followup"){
    loadFollowups();
  }

}


function fillPatientId(id){

  [
    "recordPatientId",
    "mPatientId",
    "aPatientId",
    "rPatientId",
    "fPatientId"
  ].forEach(function(field){

    if(get(field)){
      get(field).value = id;
    }

  });

}


async function loadDashboard(){

  try{

    var data = await getJson("/api/dashboard");

    get("sPatients").textContent = data.patients;
    get("sAppointments").textContent = data.appointments;
    get("sReferrals").textContent = data.referrals;
    get("sFollowups").textContent = data.follow_ups;

  }catch(error){

    get("sPatients").textContent = "!";
    get("sAppointments").textContent = "!";
    get("sReferrals").textContent = "!";
    get("sFollowups").textContent = "!";

    showMessage(
      "homeMsg",
      error.message,
      "error"
    );

  }

}


async function registerPatient(){

  try{

    var data = await postJson(
      "/api/patients",
      {
        name:get("pName").value,
        age:get("pAge").value,
        gender:get("pGender").value,
        village:get("pVillage").value,
        phone:get("pPhone").value
      }
    );

    fillPatientId(data.patient_id);

    showMessage(
      "patientMsg",
      data.message + " Patient ID: " + data.patient_id,
      "success"
    );

    loadDashboard();

  }catch(error){

    showMessage(
      "patientMsg",
      error.message,
      "error"
    );

  }

}


async function searchPatients(){

  var id = get("searchId").value.trim();
  var name = get("searchName").value.trim();

  if(!id && !name){

    showMessage(
      "patientResults",
      "Enter Patient ID or name.",
      "error"
    );

    return;

  }


  try{

    var query = id
      ? "id=" + encodeURIComponent(id)
      : "name=" + encodeURIComponent(name);

    var data = await getJson(
      "/api/patients?" + query
    );


    if(!data.patients.length){

      showMessage(
        "patientResults",
        "No patient found.",
        "error"
      );

      return;

    }


    get("patientResults").innerHTML =
      data.patients.map(function(patient){

        return `
          <div class="item">

            <h3>
              ${escapeHtml(patient.name)}
            </h3>

            <div>
              <b>ID:</b>
              ${escapeHtml(patient.id)}
            </div>

            <div>
              <b>Age:</b>
              ${escapeHtml(patient.age || "N/A")}
            </div>

            <div>
              <b>Gender:</b>
              ${escapeHtml(patient.gender || "N/A")}
            </div>

            <div>
              <b>Village:</b>
              ${escapeHtml(patient.village || "N/A")}
            </div>

            <div>
              <b>Phone:</b>
              ${escapeHtml(patient.phone || "N/A")}
            </div>

            <button
              class="primary view-patient"
              data-id="${escapeHtml(patient.id)}"
            >
              View Full Report
            </button>

          </div>
        `;

      }).join("");


    document
      .querySelectorAll(".view-patient")
      .forEach(function(button){

        button.addEventListener(
          "click",
          function(){

            var patientId =
              this.getAttribute("data-id");

            fillPatientId(patientId);

            showTab("record");

            loadRecord();

          }
        );

      });


  }catch(error){

    showMessage(
      "patientResults",
      error.message,
      "error"
    );

  }

}


async function loadRecord(){

  var patientId =
    get("recordPatientId").value.trim();

  if(!patientId){

    showMessage(
      "fullRecord",
      "Enter Patient ID.",
      "error"
    );

    return;

  }


  try{

    var data =
      await getJson(
        "/api/patient-record?patient_id=" +
        encodeURIComponent(patientId)
      );


    var patient = data.patient;


    var html = `
      <div class="item">

        <h2>
          ${escapeHtml(patient.name)}
        </h2>

        <p>
          <b>Patient ID:</b>
          ${escapeHtml(patient.id)}
          |
          <b>Age:</b>
          ${escapeHtml(patient.age || "N/A")}
          |
          <b>Gender:</b>
          ${escapeHtml(patient.gender || "N/A")}
        </p>

        <p>
          <b>Village:</b>
          ${escapeHtml(patient.village || "N/A")}
          |
          <b>Phone:</b>
          ${escapeHtml(patient.phone || "N/A")}
        </p>

        <h3>
          Medical Records
        </h3>
    `;


    if(data.records.length){

      data.records.forEach(function(record){

        html += `
          <div class="item">

            <b>
              ${escapeHtml(
                record.record_type || "Record"
              )}
            </b>

            <div>
              ${escapeHtml(record.notes)}
            </div>

            <div class="muted">
              ${escapeHtml(
                record.recorded_by || ""
              )}
              |
              ${escapeHtml(
                record.created_at || ""
              )}
            </div>

          </div>
        `;

      });

    }else{

      html += `
        <div class="muted">
          No medical records yet.
        </div>
      `;

    }


    html += `
      <h3>
        Appointments
      </h3>
    `;


    if(data.appointments.length){

      data.appointments.forEach(function(item){

        html += `
          <div class="item">

            ${escapeHtml(item.appointment_date)}
            ${escapeHtml(item.appointment_time)}

            |
            ${escapeHtml(
              item.doctor_name || "Doctor not assigned"
            )}

            |
            <span class="pill">
              ${escapeHtml(item.status)}
            </span>

          </div>
        `;

      });

    }else{

      html += `
        <div class="muted">
          No appointments.
        </div>
      `;

    }


    html += `
      <h3>
        Referrals
      </h3>
    `;


    if(data.referrals.length){

      data.referrals.forEach(function(item){

        html += `
          <div class="item">

            ${escapeHtml(item.from_facility)}

            →

            ${escapeHtml(item.to_facility)}

            |

            <span class="pill">
              ${escapeHtml(item.status)}
            </span>

            <div>
              ${escapeHtml(item.reason)}
            </div>

          </div>
        `;

      });

    }else{

      html += `
        <div class="muted">
          No referrals.
        </div>
      `;

    }


    html += `
      <h3>
        Follow-ups
      </h3>
    `;


    if(data.follow_ups.length){

      data.follow_ups.forEach(function(item){

        html += `
          <div class="item">

            ${escapeHtml(item.follow_up_date)}

            |

            ${escapeHtml(item.purpose)}

            |

            <span class="pill">
              ${escapeHtml(item.status)}
            </span>

            <div>
              ${escapeHtml(item.notes || "")}
            </div>

          </div>
        `;

      });

    }else{

      html += `
        <div class="muted">
          No follow-ups.
        </div>
      `;

    }


    html += `
      </div>
    `;


    get("fullRecord").innerHTML = html;


  }catch(error){

    showMessage(
      "fullRecord",
      error.message,
      "error"
    );

  }

}


async function addMedicalRecord(){

  try{

    var data = await postJson(
      "/api/medical-records",
      {
        patient_id:get("mPatientId").value,
        recorded_by:get("mRecordedBy").value,
        record_type:get("mType").value,
        notes:get("mNotes").value
      }
    );


    showMessage(
      "recordMsg",
      data.message,
      "success"
    );

    get("mNotes").value = "";

    loadRecord();

  }catch(error){

    showMessage(
      "recordMsg",
      error.message,
      "error"
    );

  }

}


async function bookAppointment(){

  try{

    var data = await postJson(
      "/api/appointments",
      {
        patient_id:get("aPatientId").value,
        doctor_name:get("aDoctor").value,
        appointment_date:get("aDate").value,
        appointment_time:get("aTime").value,
        reason:get("aReason").value
      }
    );


    showMessage(
      "appointmentMsg",
      data.message,
      "success"
    );

    loadAppointments();
    loadDashboard();

  }catch(error){

    showMessage(
      "appointmentMsg",
      error.message,
      "error"
    );

  }

}


async function loadAppointments(){

  try{

    var data =
      await getJson("/api/appointments");


    if(!data.appointments.length){

      get("appointmentList").innerHTML =
        '<div class="muted">No appointments.</div>';

      return;

    }


    get("appointmentList").innerHTML =
      data.appointments.map(function(item){

        return `
          <div class="item">

            <b>
              #${escapeHtml(item.id)}
              ${escapeHtml(
                item.patient_name ||
                ("Patient " + item.patient_id)
              )}
            </b>

            <div>
              ${escapeHtml(item.appointment_date)}
              ${escapeHtml(item.appointment_time)}
            </div>

            <div>
              Doctor:
              ${escapeHtml(
                item.doctor_name || "Unassigned"
              )}
            </div>

            <div>
              <span class="pill">
                ${escapeHtml(item.status)}
              </span>
            </div>

            <button
              class="secondary complete-appointment"
              data-id="${escapeHtml(item.id)}"
            >
              Complete
            </button>

            <button
              class="secondary cancel-appointment"
              data-id="${escapeHtml(item.id)}"
            >
              Cancel
            </button>

          </div>
        `;

      }).join("");


    document
      .querySelectorAll(".complete-appointment")
      .forEach(function(button){

        button.addEventListener(
          "click",
          function(){

            updateAppointment(
              this.getAttribute("data-id"),
              "completed"
            );

          }
        );

      });


    document
      .querySelectorAll(".cancel-appointment")
      .forEach(function(button){

        button.addEventListener(
          "click",
          function(){

            updateAppointment(
              this.getAttribute("data-id"),
              "cancelled"
            );

          }
        );

      });


  }catch(error){

    get("appointmentList").textContent =
      error.message;

  }

}


async function updateAppointment(id,status){

  try{

    await postJson(
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


async function createReferral(){

  try{

    var data = await postJson(
      "/api/referrals",
      {
        patient_id:get("rPatientId").value,
        from_facility:get("rFrom").value,
        to_facility:get("rTo").value,
        reason:get("rReason").value
      }
    );


    showMessage(
      "referralMsg",
      data.message,
      "success"
    );

    loadReferrals();
    loadDashboard();

  }catch(error){

    showMessage(
      "referralMsg",
      error.message,
      "error"
    );

  }

}


async function loadReferrals(){

  try{

    var data =
      await getJson("/api/referrals");


    if(!data.referrals.length){

      get("referralList").innerHTML =
        '<div class="muted">No referrals.</div>';

      return;

    }


    get("referralList").innerHTML =
      data.referrals.map(function(item){

        return `
          <div class="item">

            <b>
              #${escapeHtml(item.id)}
              ${escapeHtml(
                item.patient_name ||
                ("Patient " + item.patient_id)
              )}
            </b>

            <div>
              ${escapeHtml(item.from_facility)}
              →
              ${escapeHtml(item.to_facility)}
            </div>

            <div>
              ${escapeHtml(item.reason)}
            </div>

            <span class="pill">
              ${escapeHtml(item.status)}
            </span>

            ${
              item.status !== "completed"
              ? `
                <button
                  class="secondary complete-referral"
                  data-id="${escapeHtml(item.id)}"
                >
                  Mark Completed
                </button>
              `
              : ""
            }

          </div>
        `;

      }).join("");


    document
      .querySelectorAll(".complete-referral")
      .forEach(function(button){

        button.addEventListener(
          "click",
          function(){

            updateReferral(
              this.getAttribute("data-id")
            );

          }
        );

      });


  }catch(error){

    get("referralList").textContent =
      error.message;

  }

}


async function updateReferral(id){

  try{

    await postJson(
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


async function createFollowup(){

  try{

    var data = await postJson(
      "/api/follow-ups",
      {
        patient_id:get("fPatientId").value,
        follow_up_date:get("fDate").value,
        purpose:get("fPurpose").value,
        notes:get("fNotes").value
      }
    );


    showMessage(
      "followupMsg",
      data.message,
      "success"
    );

    loadFollowups();
    loadDashboard();

  }catch(error){

    showMessage(
      "followupMsg",
      error.message,
      "error"
    );

  }

}


async function loadFollowups(){

  try{

    var data =
      await getJson("/api/follow-ups");


    if(!data.follow_ups.length){

      get("followupList").innerHTML =
        '<div class="muted">No follow-ups.</div>';

      return;

    }


    get("followupList").innerHTML =
      data.follow_ups.map(function(item){

        return `
          <div class="item">

            <b>
              #${escapeHtml(item.id)}
              ${escapeHtml(
                item.patient_name ||
                ("Patient " + item.patient_id)
              )}
            </b>

            <div>
              Date:
              ${escapeHtml(item.follow_up_date)}
            </div>

            <div>
              Purpose:
              ${escapeHtml(item.purpose)}
            </div>

            <span class="pill">
              ${escapeHtml(item.status)}
            </span>

            <div>
              ${escapeHtml(item.notes || "")}
            </div>

          </div>
        `;

      }).join("");


  }catch(error){

    get("followupList").textContent =
      error.message;

  }

}


function emergency(){

  alert(
    "Emergency escalation: Please contact local emergency medical services or go to the nearest hospital immediately. This prototype does not diagnose emergencies."
  );

}


function toggleLanguage(){

  var button = get("langBtn");

  var isMarathi =
    button.getAttribute("data-marathi") === "1";


  if(!isMarathi){

    button.setAttribute(
      "data-marathi",
      "1"
    );

    get("welcome").textContent =
      "घराच्या जवळ आरोग्यसेवा.";

    get("tagline").textContent =
      "ग्रामीण समुदायांसाठी एकात्मिक आरोग्यसेवा प्रवेश आणि गुणवत्ता सहाय्य मंच";

    get("intro").textContent =
      "रुग्ण, आरोग्य कर्मचारी आणि डॉक्टर यांना जोडणारे एकच व्यासपीठ.";

  }else{

    button.setAttribute(
      "data-marathi",
      "0"
    );

    get("welcome").textContent =
      "Healthcare access, closer to home.";

    get("tagline").textContent =
      "Integrated healthcare access & quality support for rural communities";

    get("intro").textContent =
      "One connected platform for patients, frontline health workers and doctors — supporting registration, medical records, appointments, referrals and follow-up care.";

  }

}


document.addEventListener(
  "DOMContentLoaded",
  function(){

    document
      .querySelectorAll(".tab[data-tab]")
      .forEach(function(button){

        button.addEventListener(
          "click",
          function(){

            showTab(
              this.getAttribute("data-tab")
            );

          }
        );

      });


    document
      .querySelectorAll("[data-go]")
      .forEach(function(button){

        button.addEventListener(
          "click",
          function(){

            showTab(
              this.getAttribute("data-go")
            );

          }
        );

      });


    get("registerBtn")
      .addEventListener(
        "click",
        registerPatient
      );


    get("searchBtn")
      .addEventListener(
        "click",
        searchPatients
      );


    get("viewRecordBtn")
      .addEventListener(
        "click",
        loadRecord
      );


    get("addRecordBtn")
      .addEventListener(
        "click",
        addMedicalRecord
      );


    get("bookBtn")
      .addEventListener(
        "click",
        bookAppointment
      );


    get("refreshAppointments")
      .addEventListener(
        "click",
        loadAppointments
      );


    get("createReferralBtn")
      .addEventListener(
        "click",
        createReferral
      );


    get("refreshReferrals")
      .addEventListener(
        "click",
        loadReferrals
      );


    get("createFollowupBtn")
      .addEventListener(
        "click",
        createFollowup
      );


    get("refreshFollowups")
      .addEventListener(
        "click",
        loadFollowups
      );


    get("emergencyBtn")
      .addEventListener(
        "click",
        emergency
      );


    get("langBtn")
      .addEventListener(
        "click",
        toggleLanguage
      );


    get("apiTestBtn")
      .addEventListener(
        "click",
        async function(){

          try{

            var data =
              await getJson("/api/test");

            showMessage(
              "homeMsg",
              data.message,
              "success"
            );

          }catch(error){

            showMessage(
              "homeMsg",
              error.message,
              "error"
            );

          }

        }
      );


    loadDashboard();

  }
);

})();

</script>

</body>
</html>`;
}


export default {

  async fetch(request, env) {

    const url =
      new URL(request.url);

    if(
      url.pathname.startsWith("/api/")
    ){

      return api(
        request,
        env,
        url
      );

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

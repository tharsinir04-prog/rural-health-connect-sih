const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=UTF-8" }
  });
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function api(request, env, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    if (url.pathname === "/api/test" && request.method === "GET") {
      return json({ success: true, message: "Rural Health Connect API is working" });
    }

    if (url.pathname === "/api/patients" && request.method === "POST") {
      const data = await readJson(request);
      if (!data || !String(data.name || "").trim()) {
        return json({ success: false, message: "Patient name is required" }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO patients (name, age, gender, village, phone) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        String(data.name).trim(),
        data.age === "" || data.age == null ? null : Number(data.age),
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

    if (url.pathname === "/api/patients" && request.method === "GET") {
      const id = url.searchParams.get("id");
      const name = url.searchParams.get("name");
      let result;

      if (id) {
        result = await env.DB.prepare(
          "SELECT * FROM patients WHERE id = ? ORDER BY id DESC"
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

      return json({ success: true, patients: result.results || [] });
    }

    if (url.pathname === "/api/patient-record" && request.method === "GET") {
      const patientId = url.searchParams.get("patient_id");

      if (!patientId) {
        return json({ success: false, message: "Patient ID is required" }, 400);
      }

      const patient = await env.DB.prepare(
        "SELECT * FROM patients WHERE id = ?"
      ).bind(patientId).first();

      if (!patient) {
        return json({ success: false, message: "Patient not found" }, 404);
      }

      const records = await env.DB.prepare(
        "SELECT * FROM medical_records WHERE patient_id = ? ORDER BY id DESC"
      ).bind(patientId).all();

      const appointments = await env.DB.prepare(
        "SELECT * FROM appointments WHERE patient_id = ? ORDER BY id DESC"
      ).bind(patientId).all();

      const referrals = await env.DB.prepare(
        "SELECT * FROM referrals WHERE patient_id = ? ORDER BY id DESC"
      ).bind(patientId).all();

      const followUps = await env.DB.prepare(
        "SELECT * FROM follow_ups WHERE patient_id = ? ORDER BY id DESC"
      ).bind(patientId).all();

      return json({
        success: true,
        patient,
        records: records.results || [],
        appointments: appointments.results || [],
        referrals: referrals.results || [],
        follow_ups: followUps.results || []
      });
    }

    if (url.pathname === "/api/medical-records" && request.method === "POST") {
      const data = await readJson(request);

      if (!data || !data.patient_id || !String(data.notes || "").trim()) {
        return json({
          success: false,
          message: "Patient ID and notes are required"
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO medical_records (patient_id, recorded_by, record_type, notes) VALUES (?, ?, ?, ?)"
      ).bind(
        data.patient_id,
        data.recorded_by || "Health Worker",
        data.record_type || "Clinical Note",
        String(data.notes).trim()
      ).run();

      return json({
        success: true,
        message: "Medical record added",
        record_id: result.meta.last_row_id
      }, 201);
    }

    if (url.pathname === "/api/appointments" && request.method === "POST") {
      const data = await readJson(request);

      if (!data || !data.patient_id || !data.appointment_date || !data.appointment_time) {
        return json({
          success: false,
          message: "Patient ID, date and time are required"
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time, reason) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        data.patient_id,
        data.doctor_name || null,
        data.appointment_date,
        data.appointment_time,
        data.reason || null
      ).run();

      return json({
        success: true,
        message: "Appointment booked successfully",
        appointment_id: result.meta.last_row_id
      }, 201);
    }

    if (url.pathname === "/api/appointments" && request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT appointments.*, patients.name AS patient_name FROM appointments LEFT JOIN patients ON patients.id = appointments.patient_id ORDER BY appointment_date ASC, appointment_time ASC, id DESC LIMIT 100"
      ).all();

      return json({
        success: true,
        appointments: result.results || []
      });
    }

    if (url.pathname === "/api/appointments/status" && request.method === "POST") {
      const data = await readJson(request);

      if (!data || !data.id || !data.status) {
        return json({
          success: false,
          message: "Appointment ID and status are required"
        }, 400);
      }

      await env.DB.prepare(
        "UPDATE appointments SET status = ? WHERE id = ?"
      ).bind(data.status, data.id).run();

      return json({
        success: true,
        message: "Appointment status updated"
      });
    }

    if (url.pathname === "/api/referrals" && request.method === "POST") {
      const data = await readJson(request);

      if (
        !data ||
        !data.patient_id ||
        !data.from_facility ||
        !data.to_facility ||
        !data.reason
      ) {
        return json({
          success: false,
          message: "Patient ID, from facility, to facility and reason are required"
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO referrals (patient_id, from_facility, to_facility, reason) VALUES (?, ?, ?, ?)"
      ).bind(
        data.patient_id,
        data.from_facility,
        data.to_facility,
        data.reason
      ).run();

      return json({
        success: true,
        message: "Referral created successfully",
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
      const data = await readJson(request);

      if (!data || !data.id || !data.status) {
        return json({
          success: false,
          message: "Referral ID and status are required"
        }, 400);
      }

      if (data.status === "completed") {
        await env.DB.prepare(
          "UPDATE referrals SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(data.status, data.id).run();
      } else {
        await env.DB.prepare(
          "UPDATE referrals SET status = ? WHERE id = ?"
        ).bind(data.status, data.id).run();
      }

      return json({
        success: true,
        message: "Referral status updated"
      });
    }

    if (url.pathname === "/api/follow-ups" && request.method === "POST") {
      const data = await readJson(request);

      if (!data || !data.patient_id || !data.follow_up_date || !data.purpose) {
        return json({
          success: false,
          message: "Patient ID, date and purpose are required"
        }, 400);
      }

      const result = await env.DB.prepare(
        "INSERT INTO follow_ups (patient_id, follow_up_date, purpose, status, notes) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        data.patient_id,
        data.follow_up_date,
        data.purpose,
        data.status || "pending",
        data.notes || null
      ).run();

      return json({
        success: true,
        message: "Follow-up created",
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

    if (url.pathname === "/api/dashboard" && request.method === "GET") {
      const p = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM patients"
      ).first();

      const a = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM appointments WHERE status != 'completed'"
      ).first();

      const r = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM referrals WHERE status != 'completed'"
      ).first();

      const f = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM follow_ups WHERE status != 'completed'"
      ).first();

      return json({
        success: true,
        patients: Number(p?.count || 0),
        appointments: Number(a?.count || 0),
        referrals: Number(r?.count || 0),
        follow_ups: Number(f?.count || 0)
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
      message: "Server error. Please check Cloudflare logs."
    }, 500);
  }
}

function page() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rural Health Connect</title>

<style>
*{box-sizing:border-box}

body{
  margin:0;
  font-family:Arial,sans-serif;
  background:#f4f7fb;
  color:#172033
}

header{
  background:#0b5cab;
  color:#fff;
  padding:20px
}

header h1{
  margin:0 0 6px
}

header p{
  margin:0;
  opacity:.9
}

.wrap{
  max-width:1100px;
  margin:auto;
  padding:18px
}

.grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(210px,1fr));
  gap:14px
}

.card,.panel{
  background:#fff;
  border-radius:14px;
  padding:18px;
  box-shadow:0 3px 14px rgba(0,0,0,.07);
  margin-bottom:16px
}

.stat{
  font-size:30px;
  font-weight:700
}

.tabs{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-bottom:16px
}

.tabs button{
  border:0;
  padding:11px 14px;
  border-radius:10px;
  background:#e5eef9;
  cursor:pointer
}

.tabs button.active{
  background:#0b5cab;
  color:#fff
}

.section{
  display:none
}

.section.active{
  display:block
}

.formgrid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
  gap:12px
}

label{
  font-weight:600;
  font-size:14px;
  display:block;
  margin-bottom:5px
}

input,select,textarea{
  width:100%;
  padding:11px;
  border:1px solid #ccd5e0;
  border-radius:9px;
  font:inherit
}

textarea{
  min-height:100px
}

button.primary{
  background:#0b5cab;
  color:white;
  border:0;
  border-radius:9px;
  padding:11px 16px;
  cursor:pointer;
  margin-top:10px
}

.message{
  padding:11px;
  border-radius:9px;
  margin-top:12px;
  background:#edf5ff
}

.error{
  background:#ffecec;
  color:#a11
}

.success{
  background:#eaf8ef;
  color:#176b35
}

.patient-card,.item{
  border:1px solid #dde4ee;
  border-radius:11px;
  padding:14px;
  margin:10px 0
}

.danger{
  background:#b42318!important
}

.muted{
  color:#65748b;
  font-size:13px
}

.pill{
  display:inline-block;
  padding:4px 8px;
  border-radius:999px;
  background:#e8eef7;
  font-size:12px
}

.notice{
  background:#fff7d6;
  border-left:5px solid #e5a900;
  padding:12px;
  border-radius:8px
}

.lang{
  float:right;
  background:#fff;
  color:#0b5cab;
  border:0;
  padding:7px 10px;
  border-radius:8px
}

.smallbtn{
  padding:7px 9px;
  border:0;
  border-radius:7px;
  cursor:pointer;
  margin:3px;
  background:#e9eef5
}

.smallbtn.ok{
  background:#dff4e5
}

.smallbtn.warn{
  background:#fff0d5
}
</style>
</head>

<body>

<header>
<button class="lang" onclick="toggleLang()">मराठी / English</button>
<h1>Rural Health Connect</h1>
<p id="subtitle">
Integrated healthcare access & quality support platform for rural communities
</p>
</header>

<div class="wrap">

<div class="notice">
<b>Demo / SIH Prototype:</b>
This platform supports patients, frontline health workers and doctors.
It does not replace professional medical judgement or emergency services.
</div>

<div class="grid" id="stats">

<div class="card">
<div class="muted">Patients</div>
<div class="stat" id="sPatients">-</div>
</div>

<div class="card">
<div class="muted">Open appointments</div>
<div class="stat" id="sAppointments">-</div>
</div>

<div class="card">
<div class="muted">Open referrals</div>
<div class="stat" id="sReferrals">-</div>
</div>

<div class="card">
<div class="muted">Follow-ups</div>
<div class="stat" id="sFollowups">-</div>
</div>

</div>

<div class="tabs">

<button class="active" onclick="showTab('home',this)">
Dashboard
</button>

<button onclick="showTab('patient',this)">
Patient
</button>

<button onclick="showTab('record',this)">
Medical Report
</button>

<button onclick="showTab('appointment',this)">
Appointments
</button>

<button onclick="showTab('referral',this)">
Referrals
</button>

<button onclick="showTab('followup',this)">
Follow-up
</button>

<button class="danger" onclick="emergency()">
Emergency
</button>

</div>

<section id="home" class="section active">

<div class="panel">

<h2>Healthcare Access Dashboard</h2>

<p>
One connected workflow for registration, longitudinal records,
appointments, referrals and follow-up.
</p>

<div id="healthMessage" class="muted">
Loading dashboard...
</div>

</div>

</section>

<section id="patient" class="section">

<div class="panel">

<h2>Patient Registration</h2>

<div class="formgrid">

<div>
<label>Patient name *</label>
<input id="pName">
</div>

<div>
<label>Age</label>
<input id="pAge" type="number" min="0" max="120">
</div>

<div>
<label>Gender</label>
<select id="pGender">
<option value="">Select</option>
<option>Female</option>
<option>Male</option>
<option>Other</option>
</select>
</div>

<div>
<label>Village</label>
<input id="pVillage">
</div>

<div>
<label>Phone</label>
<input id="pPhone" inputmode="tel">
</div>

</div>

<button class="primary" onclick="registerPatient()">
Register Patient
</button>

<div id="patientMsg"></div>

</div>

<div class="panel">

<h2>Search Patient</h2>

<div class="formgrid">

<div>
<label>Patient ID</label>
<input id="searchId">
</div>

<div>
<label>Patient name</label>
<input id="searchName">
</div>

</div>

<button class="primary" onclick="searchPatients()">
Search
</button>

<div id="patientResults"></div>

</div>

</section>

<section id="record" class="section">

<div class="panel">

<h2>Full Medical Report</h2>

<label>Patient ID *</label>

<input id="recordPatientId">

<button class="primary" onclick="loadRecord()">
View Full Report
</button>

<div id="fullRecord"></div>

</div>

<div class="panel">

<h2>Add Medical Record</h2>

<div class="formgrid">

<div>
<label>Patient ID *</label>
<input id="mPatientId">
</div>

<div>
<label>Recorded by</label>
<input id="mRecordedBy" value="Health Worker">
</div>

<div>
<label>Record type</label>
<input id="mType" value="Clinical Note">
</div>

</div>

<label>Notes *</label>

<textarea id="mNotes"></textarea>

<button class="primary" onclick="addMedicalRecord()">
Add Record
</button>

<div id="recordMsg"></div>

</div>

</section>

<section id="appointment" class="section">

<div class="panel">

<h2>Appointment & Queue</h2>

<div class="formgrid">

<div>
<label>Patient ID *</label>
<input id="aPatientId">
</div>

<div>
<label>Doctor</label>
<input id="aDoctor">
</div>

<div>
<label>Date *</label>
<input id="aDate" type="date">
</div>

<div>
<label>Time *</label>
<input id="aTime" type="time">
</div>

</div>

<label>Reason</label>

<textarea id="aReason"></textarea>

<button class="primary" onclick="bookAppointment()">
Book Appointment
</button>

<div id="appointmentMsg"></div>

</div>

<div class="panel">

<h2>Current Queue / Appointments</h2>

<button class="primary" onclick="loadAppointments()">
Refresh
</button>

<div id="appointmentList"></div>

</div>

</section>

<section id="referral" class="section">

<div class="panel">

<h2>Referral Tracking</h2>

<div class="formgrid">

<div>
<label>Patient ID *</label>
<input id="rPatientId">
</div>

<div>
<label>From facility *</label>
<input id="rFrom" placeholder="Sub-centre / PHC">
</div>

<div>
<label>To facility *</label>
<input id="rTo" placeholder="Rural / District Hospital">
</div>

</div>

<label>Reason *</label>

<textarea id="rReason"></textarea>

<button class="primary" onclick="createReferral()">
Create Referral
</button>

<div id="referralMsg"></div>

</div>

<div class="panel">

<h2>Referral Status</h2>

<button class="primary" onclick="loadReferrals()">
Refresh
</button>

<div id="referralList"></div>

</div>

</section>

<section id="followup" class="section">

<div class="panel">

<h2>High-risk / Chronic Follow-up</h2>

<div class="formgrid">

<div>
<label>Patient ID *</label>
<input id="fPatientId">
</div>

<div>
<label>Follow-up date *</label>
<input id="fDate" type="date">
</div>

<div>
<label>Purpose *</label>
<input id="fPurpose" placeholder="BP / diabetes / maternal / child">
</div>

</div>

<label>Notes</label>

<textarea id="fNotes"></textarea>

<button class="primary" onclick="createFollowup()">
Schedule Follow-up
</button>

<div id="followupMsg"></div>

</div>

<div class="panel">

<h2>Follow-up List</h2>

<button class="primary" onclick="loadFollowups()">
Refresh
</button>

<div id="followupList"></div>

</div>

</section>

</div>

<script>

var API = window.location.origin;

function msg(id,text,type){
  var el=document.getElementById(id);
  el.className='message '+(type||'');
  el.textContent=text;
}

function showTab(id,btn){

  document.querySelectorAll('.section').forEach(function(x){
    x.classList.remove('active');
  });

  document.getElementById(id).classList.add('active');

  document.querySelectorAll('.tabs button').forEach(function(x){
    x.classList.remove('active');
  });

  if(btn)btn.classList.add('active');

  if(id==='appointment')loadAppointments();
  if(id==='referral')loadReferrals();
  if(id==='followup')loadFollowups();
}

async function getJson(url){

  var r=await fetch(url);
  var d=await r.json();

  if(!r.ok||!d.success)
    throw new Error(d.message||'Request failed');

  return d;
}

async function postJson(path,data){

  var r=await fetch(API+path,{
    method:'POST',
    headers:{
      'Content-Type':'application/json'
    },
    body:JSON.stringify(data)
  });

  var d=await r.json();

  if(!r.ok||!d.success)
    throw new Error(d.message||'Request failed');

  return d;
}

async function loadDashboard(){

  try{

    var d=await getJson(API+'/api/dashboard');

    document.getElementById('sPatients').textContent=d.patients;
    document.getElementById('sAppointments').textContent=d.appointments;
    document.getElementById('sReferrals').textContent=d.referrals;
    document.getElementById('sFollowups').textContent=d.follow_ups;

    document.getElementById('healthMessage').textContent=
      'Connected to Cloudflare Worker + D1 database.';

  }catch(e){

    document.getElementById('healthMessage').textContent=e.message;

  }
}

async function registerPatient(){

  try{

    var d=await postJson('/api/patients',{

      name:document.getElementById('pName').value,

      age:document.getElementById('pAge').value,

      gender:document.getElementById('pGender').value,

      village:document.getElementById('pVillage').value,

      phone:document.getElementById('pPhone').value

    });

    msg(
      'patientMsg',
      d.message+' Patient ID: '+d.patient_id,
      'success'
    );

    document.getElementById('recordPatientId').value=d.patient_id;
    document.getElementById('mPatientId').value=d.patient_id;
    document.getElementById('aPatientId').value=d.patient_id;
    document.getElementById('rPatientId').value=d.patient_id;
    document.getElementById('fPatientId').value=d.patient_id;

    loadDashboard();

  }catch(e){

    msg('patientMsg',e.message,'error');

  }
}

async function searchPatients(){

  var id=document.getElementById('searchId').value.trim();

  var name=document.getElementById('searchName').value.trim();

  if(!id&&!name){

    msg(
      'patientResults',
      'Enter Patient ID or name.',
      'error'
    );

    return;
  }

  try{

    var q=id
      ?'id='+encodeURIComponent(id)
      :'name='+encodeURIComponent(name);

    var d=await getJson(API+'/api/patients?'+q);

    if(!d.patients.length){

      msg(
        'patientResults',
        'No patient found.',
        'error'
      );

      return;
    }

    document.getElementById('patientResults').innerHTML=

      d.patients.map(function(p){

        return '<div class="patient-card">'+

          '<h3>'+escapeHtml(p.name)+'</h3>'+

          '<p><b>Patient ID:</b> '+
          escapeHtml(p.id)+'</p>'+

          '<p><b>Age:</b> '+
          escapeHtml(p.age||'N/A')+'</p>'+

          '<p><b>Gender:</b> '+
          escapeHtml(p.gender||'N/A')+'</p>'+

          '<p><b>Village:</b> '+
          escapeHtml(p.village||'N/A')+'</p>'+

          '<p><b>Phone:</b> '+
          escapeHtml(p.phone||'N/A')+'</p>'+

          '<button class="primary" onclick="selectPatient('+
          Number(p.id)+')">View Full Medical Report</button>'+

          '</div>';

      }).join('');

  }catch(e){

    msg(
      'patientResults',
      e.message,
      'error'
    );

  }
}

function selectPatient(id){

  document.getElementById('recordPatientId').value=id;

  document.getElementById('mPatientId').value=id;

  showTab(
    'record',
    document.querySelectorAll('.tabs button')[2]
  );

  loadRecord();
}

function escapeHtml(v){

  return String(v==null?'':v)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');

}

async function loadRecord(){

  var id=document.getElementById(
    'recordPatientId'
  ).value.trim();

  if(!id){

    msg(
      'fullRecord',
      'Enter Patient ID.',
      'error'
    );

    return;
  }

  try{

    var d=await getJson(
      API+'/api/patient-record?patient_id='+
      encodeURIComponent(id)
    );

    var p=d.patient;

    var html=

      '<div class="patient-card">'+

      '<h2>'+escapeHtml(p.name)+'</h2>'+

      '<p><b>ID:</b> '+
      escapeHtml(p.id)+
      ' | <b>Age:</b> '+
      escapeHtml(p.age||'N/A')+
      ' | <b>Gender:</b> '+
      escapeHtml(p.gender||'N/A')+
      '</p>'+

      '<p><b>Village:</b> '+
      escapeHtml(p.village||'N/A')+
      ' | <b>Phone:</b> '+
      escapeHtml(p.phone||'N/A')+
      '</p>'+

      '<h3>Medical Records</h3>'+

      (d.records.length

        ?d.records.map(function(x){

          return '<div class="item">'+

            '<b>'+
            escapeHtml(x.record_type||'Record')+
            '</b>'+

            '<div>'+
            escapeHtml(x.notes)+
            '</div>'+

            '<div class="muted">'+
            escapeHtml(x.recorded_by||'')+
            ' · '+
            escapeHtml(x.created_at||'')+
            '</div>'+

            '</div>';

        }).join('')

        :'<p class="muted">No medical records.</p>'

      )+

      '<h3>Appointments</h3>'+

      (d.appointments.length

        ?d.appointments.map(function(x){

          return '<div class="item">'+

            escapeHtml(x.appointment_date)+
            ' '+
            escapeHtml(x.appointment_time)+
            ' · '+
            escapeHtml(
              x.doctor_name||'Doctor not assigned'
            )+
            ' · <span class="pill">'+
            escapeHtml(x.status)+
            '</span>'+

            '</div>';

        }).join('')

        :'<p class="muted">No appointments.</p>'

      )+

      '<h3>Referrals</h3>'+

      (d.referrals.length

        ?d.referrals.map(function(x){

          return '<div class="item">'+

            escapeHtml(x.from_facility)+
            ' → '+
            escapeHtml(x.to_facility)+
            ' · <span class="pill">'+
            escapeHtml(x.status)+
            '</span>'+

            '<div>'+
            escapeHtml(x.reason)+
            '</div>'+

            '</div>';

        }).join('')

        :'<p class="muted">No referrals.</p>'

      )+

      '<h3>Follow-ups</h3>'+

      (d.follow_ups.length

        ?d.follow_ups.map(function(x){

          return '<div class="item">'+

            escapeHtml(x.follow_up_date)+
            ' · '+
            escapeHtml(x.purpose)+
            ' · <span class="pill">'+
            escapeHtml(x.status)+
            '</span>'+

            '</div>';

        }).join('')

        :'<p class="muted">No follow-ups.</p>'

      )+

      '</div>';

    document.getElementById(
      'fullRecord'
    ).innerHTML=html;

  }catch(e){

    msg(
      'fullRecord',
      e.message,
      'error'
    );

  }
}

async function addMedicalRecord(){

  try{

    var d=await postJson(
      '/api/medical-records',
      {
        patient_id:
          document.getElementById('mPatientId').value,

        recorded_by:
          document.getElementById('mRecordedBy').value,

        record_type:
          document.getElementById('mType').value,

        notes:
          document.getElementById('mNotes').value
      }
    );

    msg(
      'recordMsg',
      d.message,
      'success'
    );

    document.getElementById('mNotes').value='';

    loadRecord();

  }catch(e){

    msg(
      'recordMsg',
      e.message,
      'error'
    );

  }
}

async function bookAppointment(){

  try{

    var d=await postJson(
      '/api/appointments',
      {
        patient_id:
          document.getElementById('aPatientId').value,

        doctor_name:
          document.getElementById('aDoctor').value,

        appointment_date:
          document.getElementById('aDate').value,

        appointment_time:
          document.getElementById('aTime').value,

        reason:
          document.getElementById('aReason').value
      }
    );

    msg(
      'appointmentMsg',
      d.message,
      'success'
    );

    loadAppointments();
    loadDashboard();

  }catch(e){

    msg(
      'appointmentMsg',
      e.message,
      'error'
    );

  }
}

async function loadAppointments(){

  try{

    var d=await getJson(
      API+'/api/appointments'
    );

    document.getElementById(
      'appointmentList'
    ).innerHTML=

      d.appointments.length

      ?

      d.appointments.map(function(x){

        return '<div class="item">'+

          '<b>#'+
          escapeHtml(x.id)+
          ' '+
          escapeHtml(
            x.patient_name||
            ('Patient '+x.patient_id)
          )+
          '</b>'+

          '<br>'+

          escapeHtml(x.appointment_date)+
          ' '+
          escapeHtml(x.appointment_time)+
          ' · '+
          escapeHtml(
            x.doctor_name||'Unassigned'
          )+
          ' · <span class="pill">'+
          escapeHtml(x.status)+
          '</span>'+

          '<br>'+

          '<span class="muted">'+
          escapeHtml(x.reason||'')+
          '</span>'+

          '<br>'+

          '<button class="smallbtn ok" '+
          'onclick="appointmentStatus('+
          x.id+
          ',\'completed\')">Complete</button>'+

          '<button class="smallbtn warn" '+
          'onclick="appointmentStatus('+
          x.id+
          ',\'cancelled\')">Cancel</button>'+

          '</div>';

      }).join('')

      :

      '<p class="muted">No appointments.</p>';

  }catch(e){

    document.getElementById(
      'appointmentList'
    ).textContent=e.message;

  }
}

async function appointmentStatus(id,status){

  try{

    await postJson(
      '/api/appointments/status',
      {
        id:id,
        status:status
      }
    );

    loadAppointments();
    loadDashboard();

  }catch(e){

    alert(e.message);

  }
}

async function createReferral(){

  try{

    var d=await postJson(
      '/api/referrals',
      {
        patient_id:
          document.getElementById('rPatientId').value,

        from_facility:
          document.getElementById('rFrom').value,

        to_facility:
          document.getElementById('rTo').value,

        reason:
          document.getElementById('rReason').value
      }
    );

    msg(
      'referralMsg',
      d.message,
      'success'
    );

    loadReferrals();
    loadDashboard();

  }catch(e){

    msg(
      'referralMsg',
      e.message,
      'error'
    );

  }
}

async function loadReferrals(){

  try{

    var d=await getJson(
      API+'/api/referrals'
    );

    document.getElementById(
      'referralList'
    ).innerHTML=

      d.referrals.length

      ?

      d.referrals.map(function(x){

        return '<div class="item">'+

          '<b>#'+
          escapeHtml(x.id)+
          ' '+
          escapeHtml(
            x.patient_name||
            ('Patient '+x.patient_id)
          )+
          '</b>'+

          '<br>'+

          escapeHtml(x.from_facility)+
          ' → '+
          escapeHtml(x.to_facility)+

          '<br>'+

          escapeHtml(x.reason)+

          '<br>'+

          '<span class="pill">'+
          escapeHtml(x.status)+
          '</span>'+

          '<br>'+

          '<button class="smallbtn ok" '+
          'onclick="referralStatus('+
          x.id+
          ',\'completed\')">Mark Completed</button>'+

          '</div>';

      }).join('')

      :

      '<p class="muted">No referrals.</p>';

  }catch(e){

    document.getElementById(
      'referralList'
    ).textContent=e.message;

  }
}

async function referralStatus(id,status){

  try{

    await postJson(
      '/api/referrals/status',
      {
        id:id,
        status:status
      }
    );

    loadReferrals();
    loadDashboard();

  }catch(e){

    alert(e.message);

  }
}

async function createFollowup(){

  try{

    var d=await postJson(
      '/api/follow-ups',
      {
        patient_id:
          document.getElementById('fPatientId').value,

        follow_up_date:
          document.getElementById('fDate').value,

        purpose:
          document.getElementById('fPurpose').value,

        notes:
          document.getElementById('fNotes').value
      }
    );

    msg(
      'followupMsg',
      d.message,
      'success'
    );

    loadFollowups();
    loadDashboard();

  }catch(e){

    msg(
      'followupMsg',
      e.message,
      'error'
    );

  }
}

async function loadFollowups(){

  try{

    var d=await getJson(
      API+'/api/follow-ups'
    );

    document.getElementById(
      'followupList'
    ).innerHTML=

      d.follow_ups.length

      ?

      d.follow_ups.map(function(x){

        return '<div class="item">'+

          '<b>#'+
          escapeHtml(x.id)+
          ' '+
          escapeHtml(
            x.patient_name||
            ('Patient '+x.patient_id)
          )+
          '</b>'+

          '<br>'+

          escapeHtml(x.follow_up_date)+
          ' · '+
          escapeHtml(x.purpose)+
          ' · <span class="pill">'+
          escapeHtml(x.status)+
          '</span>'+

          '<br>'+

          escapeHtml(x.notes||'')+

          '</div>';

      }).join('')

      :

      '<p class="muted">No follow-ups.</p>';

  }catch(e){

    document.getElementById(
      'followupList'
    ).textContent=e.message;

  }
}

function emergency(){

  alert(
    'Emergency escalation: Please contact local emergency medical services or go to the nearest hospital immediately. This prototype does not diagnose emergencies.'
  );

}

function toggleLang(){

  var s=document.getElementById('subtitle');

  if(
    s.textContent.indexOf('Integrated')===0
  ){

    s.textContent=
      'ग्रामीण समुदायों के लिए एकीकृत स्वास्थ्य सेवा पहुंच और गुणवत्ता सहायता मंच';

  }else{

    s.textContent=
      'Integrated healthcare access & quality support platform for rural communities';

  }

}

loadDashboard();

</script>

</body>
</html>`;
}

export default {

  async fetch(request, env) {

    const url=new URL(request.url);

    if(url.pathname.startsWith("/api/"))
      return api(request,env,url);

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Backend test API
    if (url.pathname === "/api/test") {
  return new Response(
    JSON.stringify({  success: true,
      message: "Rural Health Connect backend is working"
    })    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
        // Patient registration API
        // Get patient by ID
    if (url.pathname === "/api/medical-records" && request.method === "POST") {
  try {
    const data = await request.json();

    if (!data.patient_id || !data.recorded_by || !data.record_type || !data.notes) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Patient ID, recorded by, record type and notes are required"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
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
        data.recorded_by,
        data.record_type,
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
        headers: {
          "Content-Type": "application/json"
        }
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
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}
   if (url.pathname === "/api/appointments" && request.method === "GET") {
  try {
    const appointments = await env.DB.prepare(
      `SELECT
        appointments.*,
        patients.name AS patient_name
      FROM appointments
      LEFT JOIN patients
        ON appointments.patient_id = patients.id
      ORDER BY appointment_date ASC, appointment_time ASC`
    ).all();

    return new Response(
      JSON.stringify({
        success: true,
        appointments: appointments.results
      }),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Unable to retrieve appointments"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
} 
    if (url.pathname === "/api/appointments" && request.method === "POST") {
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
          message: "Patient ID, appointment date and time are required"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const result = await env.DB.prepare(
      `INSERT INTO appointments
      (patient_id, doctor_name, appointment_date, appointment_time, reason)
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
        headers: {
          "Content-Type": "application/json"
        }
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
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}
    if (url.pathname === "/api/patients" && request.method === "GET") {
      const patientId = url.searchParams.get("id");

      if (!patientId) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Patient ID is required"
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }

      try {
        const patient = await env.DB.prepare(
          "SELECT * FROM patients WHERE id = ?"
        )
          .bind(patientId)
          .first();

        if (!patient) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Patient not found"
            }),
            {
              status: 404,
              headers: {
                "Content-Type": "application/json"
              }
            }
          );
        }

        const records = await env.DB.prepare(
          "SELECT * FROM medical_records WHERE patient_id = ? ORDER BY created_at DESC"
        )
          .bind(patientId)
          .all();

        return new Response(
          JSON.stringify({
            success: true,
            patient: patient,
            medical_records: records.results
          }),
          {
            headers: {
              "Content-Type": "application/json"
            }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unable to retrieve patient record"
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }
    }
    if (url.pathname === "/api/patients" && request.method === "POST") {
      try {
        const data = await request.json();

        if (!data.name || !data.age || !data.gender || !data.village) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Name, age, gender and village are required"
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json"
              }
            }
          );
        }

        const result = await env.DB.prepare(
          `INSERT INTO patients
          (name, age, gender, village, phone)
          VALUES (?, ?, ?, ?, ?)`
        )
          .bind(
            data.name,
            data.age,
            data.gender,
            data.village,
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
            headers: {
              "Content-Type": "application/json"
            }
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
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }
    }
    if (url.pathname === "/api/test") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Rural Health Connect backend is working"
        }),
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // Main website
    const html = String.raw`
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
      background: #f5f9ff;
      color: #172033;
      line-height: 1.6;
    }

    nav {
      height: 72px;
      background: white;
      border-bottom: 1px solid #e3ebf5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 7%;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 20px;
      font-weight: 700;
      color: #0756a8;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      background: #0756a8;
      color: white;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-size: 20px;
    }

    .links {
      display: flex;
      gap: 28px;
      align-items: center;
    }

    .links a {
      text-decoration: none;
      color: #46566d;
      font-size: 14px;
      font-weight: 600;
    }

    .links a:hover {
      color: #0756a8;
    }

    .language {
      border: 1px solid #d7e2ef;
      padding: 9px 14px;
      border-radius: 8px;
      background: white;
      color: #34445a;
      font-weight: 600;
    }

    .hero {
      min-height: 600px;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 50px;
      align-items: center;
      padding: 75px 7%;
      background: linear-gradient(135deg, #eef6ff, #ffffff);
    }

    .badge {
      display: inline-block;
      padding: 8px 13px;
      background: #e3f0ff;
      color: #0756a8;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 20px;
    }

    h1 {
      font-size: 50px;
      line-height: 1.12;
      max-width: 650px;
      color: #102a43;
      margin-bottom: 22px;
    }

    .hero p {
      font-size: 18px;
      color: #5c6b7d;
      max-width: 600px;
      margin-bottom: 32px;
    }

    .buttons {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }

    .btn {
      padding: 13px 22px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      border: none;
    }

    .primary {
      background: #0756a8;
      color: white;
    }

    .primary:hover {
      background: #064987;
    }

    .secondary {
      background: white;
      color: #0756a8;
      border: 1px solid #bfd1e6;
    }

    .hero-card {
      background: white;
      border: 1px solid #dce7f3;
      border-radius: 18px;
      padding: 30px;
      box-shadow: 0 15px 40px rgba(20, 70, 120, 0.10);
    }

    .hero-card h3 {
      color: #12395e;
      margin-bottom: 22px;
      font-size: 21px;
    }

    .care-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 0;
      border-bottom: 1px solid #edf2f7;
    }

    .care-item:last-child {
      border-bottom: none;
    }

    .care-icon {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: #eaf4ff;
      color: #0756a8;
      display: grid;
      place-items: center;
      font-weight: 700;
    }

    .care-item strong {
      display: block;
      color: #20364f;
      font-size: 15px;
    }

    .care-item span {
      color: #738196;
      font-size: 13px;
    }

    .section {
      padding: 75px 7%;
    }

    .section-title {
      text-align: center;
      max-width: 700px;
      margin: auto;
    }

    .section-title h2 {
      font-size: 34px;
      color: #102a43;
      margin-bottom: 12px;
    }

    .section-title p {
      color: #68778a;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 22px;
      margin-top: 45px;
    }

    .card {
      background: white;
      border: 1px solid #dfe8f2;
      border-radius: 14px;
      padding: 27px;
      transition: 0.2s;
    }

    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 30px rgba(25, 70, 110, 0.09);
    }

    .card-icon {
      width: 46px;
      height: 46px;
      background: #e9f4ff;
      color: #0756a8;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-weight: 700;
      margin-bottom: 18px;
    }

    .card h3 {
      margin-bottom: 9px;
      color: #20364f;
    }

    .card p {
      color: #718096;
      font-size: 14px;
    }

    .stats {
      background: #0756a8;
      color: white;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      padding: 45px 7%;
      text-align: center;
    }

    .stat strong {
      display: block;
      font-size: 28px;
      margin-bottom: 4px;
    }

    .stat span {
      font-size: 13px;
      opacity: 0.9;
    }

    .cta {
      margin: 0 7% 70px;
      padding: 45px;
      border-radius: 16px;
      background: #102f50;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 30px;
    }

    .cta h2 {
      margin-bottom: 8px;
    }

    .cta p {
      color: #cbd8e6;
    }

    footer {
      background: #0b1f33;
      color: #b9c8d8;
      padding: 28px 7%;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
    }
    .modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(10, 35, 60, 0.55);
      z-index: 100;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-box {
      width: 100%;
      max-width: 500px;
      background: white;
      border-radius: 16px;
      padding: 30px;
      position: relative;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
    }

    .modal-box h2 {
      color: #102a43;
      margin-bottom: 6px;
    }

    .modal-subtitle {
      color: #718096;
      font-size: 14px;
      margin-bottom: 22px;
    }

    .close-btn {
      position: absolute;
      top: 14px;
      right: 16px;
      border: none;
      background: transparent;
      font-size: 28px;
      color: #68778a;
      cursor: pointer;
    }

    .modal-box label {
      display: block;
      margin: 14px 0 6px;
      color: #34495e;
      font-size: 13px;
      font-weight: 700;
    }

    .modal-box input,
    .modal-box select {
      width: 100%;
      padding: 12px;
      border: 1px solid #d5e0eb;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
    }

    .modal-box input:focus,
    .modal-box select:focus {
      border-color: #0756a8;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }

    .submit-btn {
      width: 100%;
      margin-top: 22px;
      padding: 13px;
      border: none;
      border-radius: 8px;
      background: #0756a8;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }

    .submit-btn:hover {
      background: #064987;
    }

    #formMessage {
      margin-top: 14px;
      text-align: center;
      font-size: 14px;
      font-weight: 600;
    }
    .record-search {
  display: flex;
  gap: 12px;
  max-width: 700px;
  margin: 0 auto 30px;
}

.record-search input {
  flex: 1;
  padding: 13px 15px;
  border: 1px solid #d5e0eb;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.record-search input:focus {
  border-color: #0756a8;
}

.patient-result-card {
  max-width: 700px;
  margin: 0 auto;
  background: #ffffff;
  padding: 25px;
  border-radius: 14px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
  border: 1px solid #e1e8ef;
}

.patient-result-card h3 {
  color: #0756a8;
  margin-bottom: 15px;
}

.patient-result-card h4 {
  color: #102a43;
  margin-top: 18px;
}

.patient-result-card p {
  color: #52606d;
  margin: 8px 0;
}

.patient-result-card hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 18px 0;
}

@media (max-width: 600px) {
  .record-search {
    flex-direction: column;
  }

  .record-search button {
    width: 100%;
  }
}
    @media (max-width: 850px) {
      .links a {
        display: none;
      }

      .hero {
        grid-template-columns: 1fr;
        padding-top: 55px;
      }

      h1 {
        font-size: 39px;
      }

      .cards {
        grid-template-columns: 1fr;
      }

      .stats {
        grid-template-columns: repeat(2, 1fr);
      }

      .cta {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    @media (max-width: 500px) {
      nav {
        padding: 0 5%;
      }

      .hero,
      .section {
        padding-left: 5%;
        padding-right: 5%;
      }

      h1 {
        font-size: 34px;
      }

      .stats {
        padding-left: 5%;
        padding-right: 5%;
      }

      .cta {
        margin-left: 5%;
        margin-right: 5%;
      }

      footer {
        flex-direction: column;
        gap: 8px;
      }
    }
  </style>
</head>

<body>

  <nav>
    <div class="logo">
      <div class="logo-icon">+</div>
      Rural Health Connect
    </div>

    <div class="links">
      <a href="#home">Home</a>
      <a href="#services">Services</a>
      <a href="#how">How It Works</a>
      <a href="#facilities">Facilities</a>
      <a href="#records">Patient Records</a>
      <a href="#about">About</a>
      <button class="language">मराठी ▾</button>
    </div>
  </nav>

  <main>

    <section class="hero" id="home">
      <div>
        <span class="badge">Digital Healthcare Access Platform</span>

        <h1>Healthcare access, closer to home.</h1>

        <p>
          Connected care for rural communities across Maharashtra,
          helping patients, health workers and doctors coordinate care
          with less travel and better continuity.
        </p>

        <div class="buttons">
          <button class="btn primary" onclick="openPatientForm()">Book Consultation</button>
          <a href="#facilities" class="btn secondary">Find a Facility</a>
        </div>
      </div>

      <div class="hero-card">
        <h3>Connected Care Services</h3>

        <div class="care-item">
          <div class="care-icon">01</div>
          <div>
            <strong>Teleconsultation</strong>
            <span>Connect with healthcare professionals</span>
          </div>
        </div>

        <div class="care-item">
          <div class="care-icon">02</div>
          <div>
            <strong>Digital Records</strong>
            <span>Maintain accessible patient information</span>
          </div>
        </div>

        <div class="care-item">
          <div class="care-icon">03</div>
          <div>
            <strong>Referral Tracking</strong>
            <span>Follow referrals across facilities</span>
          </div>
        </div>

        <div class="care-item">
          <div class="care-icon">04</div>
          <div>
            <strong>Follow-up Support</strong>
            <span>Improve continuity of care</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="services">
      <div class="section-title">
        <h2>Healthcare services in one connected platform</h2>
        <p>
          Designed to support rural patients and frontline healthcare teams
          while strengthening the existing public healthcare system.
        </p>
      </div>

      <div class="cards">

        <div class="card">
          <div class="card-icon">TC</div>
          <h3>Teleconsultation</h3>
          <p>
            Support assisted consultations between patients,
            frontline workers and doctors.
          </p>
        </div>

        <div class="card">
          <div class="card-icon">AR</div>
          <h3>Appointments</h3>
          <p>
            Manage consultation requests, appointment schedules
            and waiting queues efficiently.
          </p>
        </div>

        <div class="card">
          <div class="card-icon">RF</div>
          <h3>Referral Management</h3>
          <p>
            Track referrals from local facilities to higher-level
            healthcare centres.
          </p>
        </div>

        <div class="card">
          <div class="card-icon">DR</div>
          <h3>Digital Records</h3>
          <p>
            Maintain longitudinal medical information to improve
            continuity between facilities.
          </p>
        </div>

        <div class="card">
          <div class="card-icon">DX</div>
          <h3>Diagnostics</h3>
          <p>
            Coordinate diagnostic services and improve visibility
            of available facilities.
          </p>
        </div>

        <div class="card">
          <div class="card-icon">FU</div>
          <h3>Follow-up Care</h3>
          <p>
            Support maternal, child and chronic-care follow-ups
            with timely reminders.
          </p>
        </div>

      </div>
    </section>

    <section class="stats">
      <div class="stat">
        <strong>24/7</strong>
        <span>Digital access</span>
      </div>

      <div class="stat">
        <strong>3+</strong>
        <span>Language support</span>
      </div>

      <div class="stat">
        <strong>Low</strong>
        <span>Connectivity friendly</span>
      </div>

      <div class="stat">
        <strong>1</strong>
        <span>Connected care platform</span>
      </div>
    </section>

    <section class="section" id="how">
    <section class="section" id="records">
  <div class="section-title">
    <h2>Patient Records</h2>
    <p>
      Securely access a patient's healthcare information using their
      patient ID.
    </p>
  </div>

  <div class="record-search">
    <input
      type="number"
      id="searchPatientId"
      placeholder="Enter Patient ID"
    >

    <button class="btn primary" onclick="searchPatient()">
      Search Patient
    </button>
  </div>

  <div id="patientResult"></div>
</section>
      <div class="section-title">
        <h2>How Rural Health Connect works</h2>
        <p>
          A simple workflow connecting communities with the right
          healthcare support.
        </p>
      </div>

      <div class="cards">

        <div class="card">
          <div class="card-icon">1</div>
          <h3>Register</h3>
          <p>
            Patient information is securely recorded by the patient
            or trained frontline worker.
          </p>
        </div>

        <div class="card">
          <div class="card-icon">2</div>
          <h3>Connect</h3>
          <p>
            The health worker coordinates appointments,
            consultation and diagnostic support.
          </p>
        </div>

        <div class="card">
          <div class="card-icon">3</div>
          <h3>Continue Care</h3>
          <p>
            Referrals and follow-ups are tracked so patients
            receive continued support.
          </p>
        </div>

      </div>
    </section>

    <section class="cta" id="about">
      <div>
        <h2>Building a more connected rural healthcare system.</h2>
        <p>
          Technology that supports healthcare workers,
          improves coordination and brings care closer to communities.
        </p>
      </div>

      <a href="#services" class="btn primary">Explore Services</a>
    </section>

  </main>

  <footer id="facilities">
    <span>© 2026 Rural Health Connect</span>
    <span>Built for accessible and connected rural healthcare</span>
  </footer>
  <!-- Appointment Booking Section -->
<section class="section" id="appointments">
  <div class="section-title">
    <h2>Book Appointment</h2>
    <p>Schedule a consultation with a healthcare professional.</p>
  </div>

  <div class="record-form-card">
    <form id="appointmentForm">

      <label>Patient ID</label>
      <input
        type="number"
        id="appointmentPatientId"
        placeholder="Enter Patient ID"
        required
      >

      <label>Doctor Name</label>
      <input
        type="text"
        id="appointmentDoctor"
        placeholder="Enter doctor name"
      >

      <label>Appointment Date</label>
      <input
        type="date"
        id="appointmentDate"
        required
      >

      <label>Appointment Time</label>
      <input
        type="time"
        id="appointmentTime"
        required
      >

      <label>Reason for Consultation</label>
      <textarea
        id="appointmentReason"
        placeholder="Enter reason for consultation"
        rows="4"
      ></textarea>

      <button type="submit" class="submit-btn">
        Book Appointment
      </button>

      <div id="appointmentMessage"></div>

    </form>
  </div>
</section>
  <!-- Add Medical Record Section -->
  <!-- Queue Management Section -->
<section class="section" id="queue">
  <div class="section-title">
    <h2>Appointment Queue</h2>
    <p>View scheduled patients and their current consultation status.</p>
  </div>

  <div class="queue-actions">
    <button class="btn primary" onclick="loadQueue()">
      Refresh Queue
    </button>
  </div>

  <div id="queueResult">
    <p>Click "Refresh Queue" to load appointments.</p>
  </div>
</section>
<section class="section" id="add-record">
  <div class="section-title">
    <h2>Add Medical Record</h2>
    <p>Healthcare workers can securely add a patient's medical record.</p>
  </div>

  <div class="record-form-card">
    <form id="medicalRecordForm">

      <label>Patient ID</label>
      <input
        type="number"
        id="recordPatientId"
        placeholder="Enter Patient ID"
        required
      >

      <label>Recorded By</label>
      <input
        type="text"
        id="recordedBy"
        placeholder="Doctor / Health Worker name"
        required
      >

      <label>Record Type</label>
      <select id="recordType" required>
        <option value="">Select record type</option>
        <option value="Consultation">Consultation</option>
        <option value="Diagnosis">Diagnosis</option>
        <option value="Lab Report">Lab Report</option>
        <option value="Prescription">Prescription</option>
        <option value="Follow-up">Follow-up</option>
      </select>

      <label>Medical Notes</label>
      <textarea
        id="recordNotes"
        placeholder="Enter medical notes"
        rows="5"
        required
      ></textarea>

      <button type="submit" class="submit-btn">
        Add Medical Record
      </button>

      <div id="recordMessage"></div>

    </form>
  </div>
</section>
<!-- Patient Registration Modal -->
<div id="patientModal" class="modal">
  <div class="modal-box">
    <button class="close-btn" onclick="closePatientForm()">×</button>

    <h2>Patient Registration</h2>
    <p class="modal-subtitle">
      Enter patient details to begin connected healthcare support.
    </p>

    <form id="patientForm">

      <label>Patient Name</label>
      <input
        type="text"
        id="patientName"
        placeholder="Enter full name"
        required
      >

      <div class="form-row">
        <div>
          <label>Age</label>
          <input
            type="number"
            id="patientAge"
            placeholder="Age"
            min="1"
            max="120"
            required
          >
        </div>

        <div>
          <label>Gender</label>
          <select id="patientGender" required>
            <option value="">Select gender</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <label>Village</label>
      <input
        type="text"
        id="patientVillage"
        placeholder="Enter village"
        required
      >

      <label>Phone Number</label>
      <input
        type="tel"
        id="patientPhone"
        placeholder="Enter phone number"
        maxlength="10"
      >

      <button type="submit" class="submit-btn">
        Register Patient
      </button>

      <div id="formMessage"></div>

    </form>
  </div>
</div>
<script>
  function openPatientForm() {
    document.getElementById("patientModal").style.display = "flex";
  }

  function closePatientForm() {
    document.getElementById("patientModal").style.display = "none";
  }

  document.getElementById("patientForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const message = document.getElementById("formMessage");

    const patient = {
      name: document.getElementById("patientName").value.trim(),
      age: document.getElementById("patientAge").value,
      gender: document.getElementById("patientGender").value,
      village: document.getElementById("patientVillage").value.trim(),
      phone: document.getElementById("patientPhone").value.trim()
    };

    message.textContent = "Registering patient...";

    try {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(patient)
      });

      const result = await response.json();

      if (result.success) {
        message.textContent =
          "Patient registered successfully. ID: " + result.patient_id;

        document.getElementById("patientForm").reset();
      } else {
        message.textContent = result.message || "Registration failed.";
      }

    } catch (error) {
      message.textContent =
        "Unable to connect to the healthcare server.";
    }
  });

  window.addEventListener("click", function(event) {
    const modal = document.getElementById("patientModal");

    if (event.target === modal) {
      closePatientForm();
    }
  });
async function searchPatient() {
  const patientId = document.getElementById("searchPatientId").value;
  const resultBox = document.getElementById("patientResult");

  if (!patientId) {
    resultBox.innerHTML = "<p>Please enter a Patient ID.</p>";
    return;
  }

  resultBox.innerHTML = "<p>Searching patient record...</p>";

  try {
    const response = await fetch(
      "/api/patients?id=" + encodeURIComponent(patientId)
    );

    const data = await response.json();

    if (!data.success) {
      resultBox.innerHTML = "<p>Patient record not found.</p>";
      return;
    }

    const patient = data.patient;

    resultBox.innerHTML =
      '<div class="patient-result-card">' +
      "<h3>" + patient.name + "</h3>" +
      "<p><strong>Patient ID:</strong> " + patient.id + "</p>" +
      "<p><strong>Age:</strong> " + patient.age + "</p>" +
      "<p><strong>Gender:</strong> " + patient.gender + "</p>" +
      "<p><strong>Village:</strong> " + patient.village + "</p>" +
      "<p><strong>Phone:</strong> " + (patient.phone || "Not provided") + "</p>" +
      "<hr>" +
      "<h4>Medical Records</h4>" +
     "<p><strong>Total Records:</strong> " +
data.medical_records.length +
"</p>" +

data.medical_records.map(function(record) {
  return (
    '<div class="medical-record-item">' +
    "<p><strong>Record Type:</strong> " +
    record.record_type +
    "</p>" +

    "<p><strong>Recorded By:</strong> " +
    record.recorded_by +
    "</p>" +

    "<p><strong>Medical Notes:</strong> " +
    record.notes +
    "</p>" +

    "<p><strong>Date:</strong> " +
    record.created_at +
    "</p>" +

    "</div>"
  );
}).join("")
      "</div>";
  } catch (error) {
    resultBox.innerHTML =
      "<p>Unable to connect to the healthcare server.</p>";
  }
}
document.getElementById("medicalRecordForm").addEventListener("submit", async function(event) {
  event.preventDefault();

  const message = document.getElementById("recordMessage");

  const record = {
    patient_id: document.getElementById("recordPatientId").value,
    recorded_by: document.getElementById("recordedBy").value.trim(),
    record_type: document.getElementById("recordType").value,
    notes: document.getElementById("recordNotes").value.trim()
  };

  message.textContent = "Saving medical record...";

  try {
    const response = await fetch("/api/medical-records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(record)
    });

    const result = await response.json();

    if (result.success) {
      message.textContent =
        "Medical record added successfully. Record ID: " + result.record_id;

      document.getElementById("medicalRecordForm").reset();
    } else {
      message.textContent =
        result.message || "Unable to add medical record.";
    }

  } catch (error) {
    message.textContent =
      "Unable to connect to the healthcare server.";
  }
});
document.getElementById("appointmentForm").addEventListener("submit", async function(event) {
  event.preventDefault();

  const message = document.getElementById("appointmentMessage");

  const appointment = {
    patient_id: document.getElementById("appointmentPatientId").value,
    doctor_name: document.getElementById("appointmentDoctor").value.trim(),
    appointment_date: document.getElementById("appointmentDate").value,
    appointment_time: document.getElementById("appointmentTime").value,
    reason: document.getElementById("appointmentReason").value.trim()
  };

  message.textContent = "Booking appointment...";

  try {
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(appointment)
    });

    const result = await response.json();

    if (result.success) {
      message.textContent =
        "Appointment booked successfully. Appointment ID: " +
        result.appointment_id;

      document.getElementById("appointmentForm").reset();
    } else {
      message.textContent =
        result.message || "Unable to book appointment.";
    }

  } catch (error) {
    message.textContent =
      "Unable to connect to the healthcare server.";
  }
});
async function loadQueue() {
  const queueResult = document.getElementById("queueResult");

  queueResult.innerHTML = "<p>Loading appointment queue...</p>";

  try {
    const response = await fetch("/api/appointments");
    const data = await response.json();

    if (!data.success || data.appointments.length === 0) {
      queueResult.innerHTML =
        "<p>No appointments found.</p>";
      return;
    }

    let html =
      '<div class="queue-list">';

    data.appointments.forEach(function(appointment, index) {
      html +=
        '<div class="queue-card">' +
        "<h3>Queue #" + (index + 1) + "</h3>" +
        "<p><strong>Patient:</strong> " +
        (appointment.patient_name || "Unknown") +
        "</p>" +
        "<p><strong>Patient ID:</strong> " +
        appointment.patient_id +
        "</p>" +
        "<p><strong>Doctor:</strong> " +
        (appointment.doctor_name || "Not assigned") +
        "</p>" +
        "<p><strong>Date:</strong> " +
        appointment.appointment_date +
        "</p>" +
        "<p><strong>Time:</strong> " +
        appointment.appointment_time +
        "</p>" +
        "<p><strong>Status:</strong> " +
        appointment.status +
        "</p>" +
        "</div>";
    });

    html += "</div>";

    queueResult.innerHTML = html;

  } catch (error) {
    queueResult.innerHTML =
      "<p>Unable to load appointment queue.</p>";
  }
}
</script>
</body>
</html>
`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=UTF-8"
      }
    });
  }
};

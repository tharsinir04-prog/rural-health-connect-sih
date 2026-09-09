export default {
  async fetch(request) { 
    const url = new URL(request.url);

if (url.pathname === "/api/test") {
  return new Response(
    JSON.stringify({
      success: true,
      message: "Rural Health Connect backend is working 🚀"
    }),
    {
      headers: {
        "content-type": "application/json"
      }
    }
  );
}
    return new Response(`
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
      font-family: Arial, sans-serif;
      background: #f4f8f7;
      color: #173b35;
    }

    .header {
      background: #087f5b;
      color: white;
      padding: 28px 20px;
      text-align: center;
    }

    .header h1 {
      font-size: 30px;
      margin-bottom: 8px;
    }

    .header p {
      font-size: 16px;
    }

    .language {
      margin-top: 20px;
      width: 100%;
      max-width: 400px;
      padding: 12px;
      border-radius: 8px;
      border: none;
      font-size: 16px;
    }

    .container {
      max-width: 1100px;
      margin: 30px auto;
      padding: 0 20px;
    }

    .welcome {
      text-align: center;
      margin-bottom: 30px;
    }

    .welcome h2 {
      margin-bottom: 10px;
      font-size: 25px;
    }

    .welcome p {
      color: #55716b;
      line-height: 1.6;
    }

    .roles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
    }

    .role-card {
      background: white;
      padding: 25px;
      border-radius: 15px;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
    }

    .role-icon {
      font-size: 42px;
      margin-bottom: 15px;
    }

    .role-card h3 {
      margin-bottom: 10px;
    }

    .role-card p {
      color: #657c76;
      line-height: 1.5;
      margin-bottom: 18px;
    }

    .button {
      background: #087f5b;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
    }

    .button:hover {
      background: #066b4d;
    }

    .features {
      margin-top: 40px;
      background: white;
      padding: 25px;
      border-radius: 15px;
    }

    .features h2 {
      text-align: center;
      margin-bottom: 20px;
    }

    .feature-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .feature {
      background: #edf7f4;
      padding: 15px;
      border-radius: 8px;
    }

    footer {
      margin-top: 40px;
      background: #173b35;
      color: white;
      text-align: center;
      padding: 20px;
      line-height: 1.6;
    }

    @media (max-width: 600px) {
      .header h1 {
        font-size: 24px;
      }

      .container {
        padding: 0 14px;
      }
    }
  </style>
</head>

<body>

  <header class="header">
    <h1>🏥 Rural Health Connect</h1>
    <p>Accessible Healthcare for Rural Communities in Maharashtra</p>

    <select class="language">
      <option>English</option>
      <option>मराठी</option>
      <option>हिंदी</option>
    </select>
  </header>

  <main class="container">

    <section class="welcome">
      <h2>Welcome to Rural Health Connect</h2>
      <p>
        Connecting patients, frontline health workers, doctors and
        healthcare facilities through one integrated platform.
      </p>
    </section>

    <section class="roles">

      <div class="role-card">
        <div class="role-icon">👨‍👩‍👧</div>
        <h3>Patient</h3>
        <p>
          Access consultations, appointments, health records,
          referrals and follow-up services.
        </p>
        <button class="button">Patient Portal</button>
      </div>

      <div class="role-card">
        <div class="role-icon">🧑‍⚕️</div>
        <h3>Health Worker</h3>
        <p>
          Register patients, record basic information,
          support triage and track referrals.
        </p>
        <button class="button">Health Worker</button>
      </div>

      <div class="role-card">
        <div class="role-icon">👨‍⚕️</div>
        <h3>Doctor</h3>
        <p>
          Manage consultations, review patient records,
          referrals and follow-up care.
        </p>
        <button class="button">Doctor Portal</button>
      </div>

      <div class="role-card">
        <div class="role-icon">🏥</div>
        <h3>Admin</h3>
        <p>
          Monitor facilities, referrals, medicine availability
          and healthcare quality indicators.
        </p>
        <button class="button">Admin Dashboard</button>
      </div>

    </section>

    <section class="features">

      <h2>Core Services</h2>

      <div class="feature-list">
        <div class="feature">🩺 Digital Triage</div>
        <div class="feature">📱 Teleconsultation</div>
        <div class="feature">📅 Appointment Management</div>
        <div class="feature">🔄 Referral Tracking</div>
        <div class="feature">📋 Digital Health Records</div>
        <div class="feature">🧪 Diagnostic Coordination</div>
        <div class="feature">💊 Medicine Availability</div>
        <div class="feature">🔔 Follow-up Alerts</div>
        <div class="feature">🚨 Emergency Escalation</div>
        <div class="feature">📊 Facility Dashboard</div>
      </div>

    </section>

  </main>

  <footer>
    <p>Rural Health Connect — SIH Maharashtra</p>
    <p>Strengthening public healthcare through better access and continuity.</p>
  </footer>

</body>
</html>
`, {
      headers: {
        "content-type": "text/html; charset=UTF-8"
      }
    });
  }
};

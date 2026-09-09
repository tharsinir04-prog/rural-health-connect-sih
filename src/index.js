export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Backend test endpoint
    if (url.pathname === "/api/test") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Rural Health Connect backend is working"
        }),
        {
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    // Professional healthcare frontend
    return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Rural Health Connect - Connected healthcare access for rural communities in Maharashtra">
  <title>Rural Health Connect | Healthcare Access</title>

  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :root {
      --blue-900: #0b2149;
      --blue-800: #123b73;
      --blue-700: #1557a6;
      --blue-600: #1769c2;
      --blue-100: #eaf3ff;
      --blue-50: #f5f9ff;
      --text: #172033;
      --muted: #667085;
      --border: #e4e9f0;
      --white: #ffffff;
      --shadow: 0 12px 35px rgba(16, 42, 78, 0.08);
    }

    body {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system,
        BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background: #ffffff;
      line-height: 1.6;
    }

    a {
      text-decoration: none;
      color: inherit;
    }

    button {
      font: inherit;
    }

    /* NAVBAR */

    .navbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255,255,255,0.96);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(12px);
    }

    .nav-container {
      max-width: 1180px;
      margin: auto;
      min-height: 74px;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 30px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 750;
      color: var(--blue-900);
      white-space: nowrap;
    }

    .brand-mark {
      width: 42px;
      height: 42px;
      border-radius: 11px;
      background: var(--blue-700);
      color: white;
      display: grid;
      place-items: center;
      font-size: 21px;
      font-weight: 800;
      box-shadow: 0 7px 18px rgba(23,105,194,.2);
    }

    .brand-text {
      font-size: 16px;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 28px;
      color: #4d5b70;
      font-size: 14px;
      font-weight: 550;
    }

    .nav-links a:hover {
      color: var(--blue-600);
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .language {
      border: 1px solid var(--border);
      background: white;
      border-radius: 9px;
      padding: 9px 12px;
      color: #46546a;
      cursor: pointer;
    }

    .nav-button {
      border: 0;
      background: var(--blue-700);
      color: white;
      padding: 10px 17px;
      border-radius: 9px;
      font-weight: 650;
      cursor: pointer;
      transition: .2s;
    }

    .nav-button:hover {
      background: var(--blue-800);
      transform: translateY(-1px);
    }

    /* HERO */

    .hero {
      background:
        radial-gradient(circle at 80% 20%, #eaf3ff 0, transparent 34%),
        linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
      border-bottom: 1px solid #edf1f6;
    }

    .hero-container {
      max-width: 1180px;
      margin: auto;
      min-height: 540px;
      padding: 82px 24px 70px;
      display: grid;
      grid-template-columns: 1.12fr .88fr;
      align-items: center;
      gap: 70px;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--blue-700);
      background: var(--blue-100);
      border: 1px solid #d8e9ff;
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .02em;
      margin-bottom: 20px;
    }

    .hero h1 {
      font-size: clamp(38px, 5vw, 58px);
      line-height: 1.08;
      letter-spacing: -0.045em;
      color: var(--blue-900);
      max-width: 680px;
      margin-bottom: 22px;
    }

    .hero h1 span {
      color: var(--blue-600);
    }

    .hero-description {
      max-width: 620px;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.75;
      margin-bottom: 32px;
    }

    .hero-buttons {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .primary-button,
    .secondary-button {
      min-height: 46px;
      padding: 0 19px;
      border-radius: 9px;
      font-weight: 650;
      cursor: pointer;
      transition: .2s;
    }

    .primary-button {
      border: 1px solid var(--blue-700);
      background: var(--blue-700);
      color: white;
      box-shadow: 0 8px 20px rgba(21,87,166,.18);
    }

    .primary-button:hover {
      background: var(--blue-800);
      transform: translateY(-1px);
    }

    .secondary-button {
      border: 1px solid #cfd8e5;
      background: white;
      color: var(--blue-800);
    }

    .secondary-button:hover {
      border-color: var(--blue-600);
      background: var(--blue-50);
    }

    /* HERO PANEL */

    .hero-panel {
      background: white;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 26px;
      box-shadow: var(--shadow);
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .panel-title {
      font-weight: 750;
      color: var(--blue-900);
    }

    .live {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #347056;
      font-size: 12px;
      font-weight: 650;
    }

    .live-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #3c9b68;
    }

    .service-list {
      padding-top: 18px;
      display: grid;
      gap: 12px;
    }

    .service-row {
      display: flex;
      align-items: center;
      gap: 13px;
      padding: 14px;
      border: 1px solid #edf0f4;
      border-radius: 11px;
      background: #fbfcfe;
    }

    .service-icon {
      width: 38px;
      height: 38px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      background: var(--blue-100);
      color: var(--blue-700);
      font-size: 17px;
    }

    .service-info strong {
      display: block;
      font-size: 13px;
      color: #26354b;
    }

    .service-info small {
      color: #7a8698;
      font-size: 11px;
    }

    /* TRUST BAR */

    .trust-bar {
      max-width: 1180px;
      margin: auto;
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(4,1fr);
      gap: 14px;
    }

    .trust-item {
      padding: 17px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: white;
    }

    .trust-item strong {
      display: block;
      color: var(--blue-900);
      font-size: 14px;
      margin-bottom: 3px;
    }

    .trust-item span {
      color: var(--muted);
      font-size: 12px;
    }

    /* SERVICES */

    .section {
      padding: 82px 24px;
    }

    .section-container {
      max-width: 1180px;
      margin: auto;
    }

    .section-heading {
      max-width: 650px;
      margin-bottom: 38px;
    }

    .section-label {
      color: var(--blue-600);
      font-size: 12px;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 9px;
    }

    .section-heading h2 {
      color: var(--blue-900);
      font-size: 34px;
      letter-spacing: -.025em;
      margin-bottom: 10px;
    }

    .section-heading p {
      color: var(--muted);
      font-size: 15px;
    }

    .service-grid {
      display: grid;
      grid-template-columns: repeat(3,1fr);
      gap: 18px;
    }

    .feature-card {
      padding: 25px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: white;
      transition: .2s;
    }

    .feature-card:hover {
      transform: translateY(-3px);
      border-color: #c7dbf5;
      box-shadow: var(--shadow);
    }

    .feature-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: var(--blue-100);
      color: var(--blue-700);
      display: grid;
      place-items: center;
      margin-bottom: 18px;
      font-size: 20px;
    }

    .feature-card h3 {
      font-size: 16px;
      color: var(--blue-900);
      margin-bottom: 8px;
    }

    .feature-card p {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.65;
    }

    /* ACCESS */

    .access-section {
      background: var(--blue-50);
      border-top: 1px solid #e6effa;
      border-bottom: 1px solid #e6effa;
    }

    .access-grid {
      display: grid;
      grid-template-columns: repeat(4,1fr);
      gap: 16px;
    }

    .role-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 23px;
    }

    .role-number {
      color: var(--blue-600);
      font-size: 12px;
      font-weight: 750;
      margin-bottom: 15px;
    }

    .role-card h3 {
      color: var(--blue-900);
      font-size: 16px;
      margin-bottom: 8px;
    }

    .role-card p {
      color: var(--muted);
      font-size: 12

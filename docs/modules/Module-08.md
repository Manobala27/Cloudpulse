# Module 8 – CloudPulse Analytics Dashboard

## Objective
Build a professional, responsive, and standalone frontend dashboard to visualize CloudPulse telemetry using pure HTML, CSS, and Vanilla JavaScript.

## Architecture
- **Frontend Stack:** HTML5, CSS3, Vanilla ES6 JavaScript
- **Charting:** Chart.js via CDN
- **Backend Connection:** Interfaces directly with the API Gateway endpoints exposed in Module 7 (`/health`, `/logs`, `/logs/service`, `/logs/level`).

## Folder Structure
```text
dashboard/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── api.js
│   ├── dashboard.js
│   ├── charts.js
│   └── utils.js
```

## Features
- **Dark Mode UI:** Glassmorphism styling, soft shadows, and color-coded severity badges.
- **Auto-Refresh:** Polls the APIs every 30 seconds to maintain real-time awareness.
- **KPI Cards:** Summarizes total, INFO, WARNING, ERROR, and CRITICAL log events dynamically.
- **Interactive Charts:** 
  - Pie chart for Log Levels.
  - Bar chart for Service-level aggregation.
  - Timeline chart tracking log chronologies.
- **Smart Filtering:** Supports remote filtering via service dropdown and severity buttons, coupled with fast client-side text search.
- **Resilience:** Implements skeleton loading states, empty states, and offline retry banners to degrade gracefully during API outages.

## How to Run Locally
1. Ensure the SAM backend is deployed and note your API Gateway URL.
2. Edit `dashboard/js/api.js` and set `API_BASE_URL` to your production AWS API Gateway endpoint.
3. Serve the `dashboard/` directory using any local web server. 
   - *Example via Python:*
     ```bash
     cd dashboard
     python -m http.server 8000
     ```
4. Open `http://localhost:8000` in your browser.

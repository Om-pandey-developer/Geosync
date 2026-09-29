import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:/Users/Lenovo/.gemini/antigravity-ide/brain/0cacc185-39ac-4595-b160-1410e781b452';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('Launching Edge browser at:', EDGE_PATH);
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1440,900',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  const stepsTaken = [];

  const captureStep = async (stepNum, name, label) => {
    const filename = `step_${String(stepNum).padStart(2, '0')}_${name}.png`;
    const fullPath = path.join(ARTIFACT_DIR, filename);
    await page.screenshot({ path: fullPath, fullPage: false });
    console.log(`[Captured Step ${stepNum}] ${name} -> ${filename}`);
    stepsTaken.push({ stepNum, name, label: label || name, filename, fullPath });
  };

  try {
    // Step 1: Login Page
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3000/login?role=patwari', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(1000);
    await captureStep(1, 'login_portal', 'Patwari Authentication Portal');

    // Pre-set Patwari Auth in localStorage
    await page.evaluate(() => {
      localStorage.setItem('geosync_auth_role', 'patwari');
      localStorage.setItem('geosync_auth_profile', JSON.stringify({
        role: 'patwari',
        name: 'Ramesh Kumar Sharma',
        officerId: 'PAT-UP-LKO-442',
        designation: 'Halqa Patwari (Lekhpal)',
        jurisdiction: 'Halqa Mohanlalganj-12, Lucknow',
        department: 'Directorate of Land Records & Cadastral Survey, U.P.',
        badgeNumber: 'UP-REV-LK442',
        clearanceLevel: 'Level-1 Field Surveyor & Vertex Calibration Authority',
        token: 'GEOSYNC-PAT-442-AUTH-TOKEN-2026'
      }));
    });

    // Step 2: Patwari Workspace Initial State
    console.log('Step 2: Loading Patwari GIS Workspace...');
    await page.goto('http://localhost:3000/patwari', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000); // Allow Leaflet tiles and GeoJSON polygons to render
    await captureStep(2, 'patwari_gis_workspace', 'Patwari GIS Workspace with 1974 Cloth Cadastre & Drone Raster');

    // Step 3: Open Halqa Parcel Roster
    console.log('Step 3: Opening Halqa Parcel Roster...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const rosterBtn = btns.find(b => b.textContent.includes('Parcel Roster') || b.title?.includes('Roster'));
      if (rosterBtn) rosterBtn.click();
    });
    await delay(1200);
    await captureStep(3, 'halqa_parcel_roster_opened', 'Halqa Mohanlalganj Roster (18 Parcels)');

    // Step 4: Select Khasra 102
    console.log('Step 4: Selecting Khasra 102 (Sita Devi)...');
    await page.evaluate(() => {
      const strongs = Array.from(document.querySelectorAll('strong'));
      const k102 = strongs.find(s => s.textContent.trim() === 'Khasra 102');
      if (k102) {
        const itemContainer = k102.closest('div[style*="border-radius"]') || k102;
        itemContainer.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        k102.click();
      }
    });
    await delay(1800);
    await captureStep(4, 'khasra102_dossier_active', 'Khasra 102 Selected & Dossier Opened');

    // Step 5: Open Cadastral Tools Menu
    console.log('Step 5: Opening Cadastral Tools Menu...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const profileBtn = btns.find(b => b.textContent.includes('Ramesh Kumar Sharma') || b.textContent.includes('PATWARI'));
      if (profileBtn) profileBtn.click();
    });
    await delay(1000);
    await captureStep(5, 'cadastral_tools_menu', 'Cadastral Tools Menu Suite');

    // Step 6: Execute Align (ORB)
    console.log('Step 6: Executing Align (ORB)...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const orbBtn = btns.find(b => b.textContent.includes('Align (ORB)'));
      if (orbBtn) orbBtn.click();
    });
    await delay(1800); // Allow toast to display
    await captureStep(6, 'orb_ransac_alignment', 'ORB Feature Alignment & RANSAC Homography Executed');

    // Step 7: Open Tools Menu & Click GEOSAM
    console.log('Step 7: Executing GEOSAM...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const profileBtn = btns.find(b => b.textContent.includes('Ramesh Kumar Sharma') || b.textContent.includes('PATWARI'));
      if (profileBtn) profileBtn.click();
    });
    await delay(800);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const samBtn = btns.find(b => b.textContent.includes('GEOSAM'));
      if (samBtn) samBtn.click();
    });
    await delay(2000);
    await captureStep(7, 'geosam_ai_delineation', 'GeoSAM AI Zero-Shot Boundary Delineation (<10ms)');

    // Step 8: Manual Corner Drag Handle (HITL)
    console.log('Step 8: Testing Manual Corner Drag Mode...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cornerBtn = btns.find(b => b.textContent.includes('Manual Corner Drag Handle'));
      if (cornerBtn) cornerBtn.click();
    });
    await delay(1200);
    await captureStep(8, 'corner_drag_calibration_hud', 'HITL Manual Corner Drag Calibration Active');

    // Step 9: Lock / Exit Corner Drag
    console.log('Step 9: Locking Calibrated Boundary...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const lockBtn = btns.find(b => b.textContent.includes('Lock Boundary') || b.textContent.includes('Exit Corner Drag'));
      if (lockBtn) lockBtn.click();
    });
    await delay(1000);
    await captureStep(9, 'calibrated_boundary_locked', 'Calibrated Cadastral Geometry Locked');

    // Step 10: 4-5 Clean & ULPIN
    console.log('Step 10: Running Clean & ULPIN...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const profileBtn = btns.find(b => b.textContent.includes('Ramesh Kumar Sharma') || b.textContent.includes('PATWARI'));
      if (profileBtn) profileBtn.click();
    });
    await delay(800);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cleanBtn = btns.find(b => b.textContent.includes('4-5 Clean & ULPIN'));
      if (cleanBtn) cleanBtn.click();
    });
    await delay(2200);
    await captureStep(10, 'postgis_cleanup_ulpin_assigned', 'PostGIS Overlap Removal & Base-14 ULPIN Assigned');

    // Step 11: Curtain Swipe
    console.log('Step 11: Testing Curtain Swipe...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const profileBtn = btns.find(b => b.textContent.includes('Ramesh Kumar Sharma') || b.textContent.includes('PATWARI'));
      if (profileBtn) profileBtn.click();
    });
    await delay(800);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const swipeBtn = btns.find(b => b.textContent.includes('Curtain Swipe'));
      if (swipeBtn) swipeBtn.click();
    });
    await delay(1800);
    await captureStep(11, 'curtain_swipe_split_view', 'Curtain Swipe Verification: 1974 Cloth Map vs Drone Orthomosaic');

    // Turn off curtain swipe
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const profileBtn = btns.find(b => b.textContent.includes('Ramesh Kumar Sharma') || b.textContent.includes('PATWARI'));
      if (profileBtn) profileBtn.click();
    });
    await delay(600);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const swipeBtn = btns.find(b => b.textContent.includes('Curtain Swipe: ON'));
      if (swipeBtn) swipeBtn.click();
    });
    await delay(1000);

    // Step 12: Send to Tehsildar
    console.log('Step 12: Transmitting to Tehsildar for HITL Approval...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sendBtn = btns.find(b => b.textContent.includes('Send to Tehsildar'));
      if (sendBtn) sendBtn.click();
    });
    await delay(2000);
    await captureStep(12, 'transmitted_to_magistrate_queue', 'Transmitted to Magistrate Judicial Docket');

    // Step 13: Switch to Tehsildar Portal
    console.log('Step 13: Switching to Tehsildar role and opening chamber...');
    await page.evaluate(() => {
      localStorage.setItem('geosync_auth_role', 'tehsildar');
      localStorage.setItem('geosync_auth_profile', JSON.stringify({
        role: 'tehsildar',
        name: 'Smt. Priya Sharma, PCS',
        officerId: 'SDM-UP-LKO-081',
        designation: 'Sub-Divisional Magistrate & Tehsildar',
        jurisdiction: 'Revenue Court Mohanlalganj, Lucknow',
        department: 'Judicial Revenue Magistracy, U.P. Civil Services',
        badgeNumber: 'UP-JUD-SDM081',
        clearanceLevel: 'Level-3 Judicial e-Sign & Form-II Statutory Decree Authority',
        token: 'GEOSYNC-SDM-081-AUTH-TOKEN-2026'
      }));
    });

    await page.goto('http://localhost:3000/tehsildar', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    await captureStep(13, 'tehsildar_judicial_chamber', 'Tehsildar Judicial Chamber & Pending Approvals Queue');

    // Step 14: Select Khasra 102 docket
    console.log('Step 14: Selecting Khasra 102 in Tehsildar docket...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div, span, strong'));
      const k102 = items.find(el => el.textContent.includes('102') && el.textContent.includes('Sita Devi'));
      if (k102) {
        k102.closest('div[style*="cursor: pointer"]')?.click() || k102.click();
      }
    });
    await delay(1500);
    await captureStep(14, 'tehsildar_khasra102_adjudication', 'Adjudicating Khasra 102 Docket & Legal Review');

    // Step 15: Enter remarks and Approve & Commit
    console.log('Step 15: Entering remarks and sanctioning parcel...');
    await page.evaluate(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.value = 'Verified boundary alignment against 1974 cloth cadastre and 5cm drone ortho. Approved under DILRMP / NAKSHA protocol.';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btns = Array.from(document.querySelectorAll('button'));
      const approveBtn = btns.find(b => b.textContent.includes('Sanction & Publish') || b.textContent.includes('Approve & Seal Ledger'));
      if (approveBtn) approveBtn.click();
    });
    await delay(2500);
    await captureStep(15, 'sanctioned_and_cryptosealed', 'Judicial Sanction Granted & SHA-256 Ledger Sealed');

    // Step 16: Open Audit History Modal
    console.log('Step 16: Viewing Immutable Audit Logs...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const auditBtn = btns.find(b => b.textContent.includes('Audit History') || b.textContent.includes('History'));
      if (auditBtn) auditBtn.click();
    });
    await delay(1800);
    await captureStep(16, 'immutable_audit_logs_modal', 'Cryptographic Audit Trail (State Machine Transitions)');

    // Close audit modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const closeBtn = btns.find(b => b.title?.includes('Close') || b.textContent.includes('Close') || b.querySelector('svg'));
      if (closeBtn) closeBtn.click();
    });
    await delay(800);

    // Step 17: Download Form-II PDF
    console.log('Step 17: Generating Form-II Survey Certificate (PDF)...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const pdfBtn = btns.find(b => b.textContent.includes('Download Form-II') || b.textContent.includes('PDF'));
      if (pdfBtn) pdfBtn.click();
    });
    await delay(1800);
    await captureStep(17, 'survey_certificate_pdf_ready', 'Statutory Form-II Naksha Passbook PDF Exported');

    console.log('Walkthrough completed successfully! Captured', stepsTaken.length, 'milestone steps.');
  } catch (err) {
    console.error('Error during walkthrough:', err);
    await captureStep(99, 'error_state', 'Error State');
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }

  // Generate an interactive HTML recording player
  const playerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GeoSync Live Browser Walkthrough Recording</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B1120; color: #F8FAFC; margin: 0; padding: 24px; display: flex; flex-direction: column; align-items: center; }
    header { text-align: center; margin-bottom: 20px; }
    h1 { margin: 0 0 8px 0; font-size: 1.8rem; color: #14B8A6; font-weight: 800; letter-spacing: -0.02em; }
    p { margin: 0; color: #94A3B8; font-size: 0.95rem; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #0D9488; color: #FFF; font-size: 0.75rem; font-weight: 700; margin-bottom: 8px; }
    .player-container { max-width: 1200px; width: 100%; background: #1E293B; border-radius: 14px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); border: 1.5px solid #334155; }
    .screen-img { width: 100%; height: auto; display: block; border-bottom: 1.5px solid #334155; background: #000; }
    .controls { padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #0F172A; flex-wrap: wrap; }
    .btn-group { display: flex; gap: 8px; align-items: center; }
    .btn { background: #0D9488; color: #FFF; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 6px; }
    .btn:hover { background: #14B8A6; transform: translateY(-1px); }
    .btn-secondary { background: #334155; color: #E2E8F0; }
    .btn-secondary:hover { background: #475569; }
    .step-label { font-size: 1rem; font-weight: 700; color: #F1F5F9; }
    .timeline { display: flex; gap: 10px; overflow-x: auto; padding: 14px 20px; background: #1E293B; border-top: 1.5px solid #334155; scrollbar-width: thin; }
    .thumb-btn { background: #0F172A; border: 2px solid transparent; border-radius: 8px; padding: 3px; cursor: pointer; flex-shrink: 0; opacity: 0.75; transition: all 0.15s ease; text-align: left; }
    .thumb-btn:hover { opacity: 1; border-color: #64748B; }
    .thumb-btn.active { border-color: #14B8A6; opacity: 1; box-shadow: 0 0 12px rgba(20, 184, 166, 0.4); }
    .thumb-btn img { width: 110px; height: 68px; object-fit: cover; border-radius: 5px; display: block; }
    .thumb-title { font-size: 0.68rem; color: #CBD5E1; margin-top: 4px; max-width: 110px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
  </style>
</head>
<body>
  <header>
    <span class="badge">LIVE AUTOMATION RECORDING</span>
    <h1>🎥 GeoSync Land Harmonization Walkthrough</h1>
    <p>Complete End-to-End Execution • Ward 12 Mohanlalganj • Khasra 102 (Sita Devi)</p>
  </header>

  <div class="player-container">
    <img id="main-frame" class="screen-img" src="${stepsTaken[0]?.filename || ''}" alt="Walkthrough Step Screen">
    <div class="controls">
      <div class="btn-group">
        <button class="btn btn-secondary" id="prev-btn" onclick="prevStep()">◀ Prev Step</button>
        <button class="btn" id="play-btn" onclick="togglePlay()">▶ Play Walkthrough</button>
        <button class="btn btn-secondary" id="next-btn" onclick="nextStep()">Next Step ▶</button>
      </div>
      <div id="step-info" class="step-label">Step 1 / ${stepsTaken.length}: ${stepsTaken[0]?.label || ''}</div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="restart()">↺ Restart</button>
      </div>
    </div>
    <div class="timeline" id="timeline">
      ${stepsTaken.map((s, idx) => `
        <button class="thumb-btn \${idx === 0 ? 'active' : ''}" id="thumb-\${idx}" onclick="goToStep(\${idx})" title="Step \${s.stepNum}: \${s.label}">
          <img src="\${s.filename}" alt="\${s.label}">
          <div class="thumb-title">\${s.stepNum}. \${s.label}</div>
        </button>
      `).join('')}
    </div>
  </div>

  <script>
    const steps = ${JSON.stringify(stepsTaken)};
    let currentIndex = 0;
    let timer = null;

    function updateView() {
      const s = steps[currentIndex];
      if (!s) return;
      document.getElementById('main-frame').src = s.filename;
      document.getElementById('step-info').textContent = \`Step \${s.stepNum} / \${steps.length}: \${s.label}\`;
      const thumbs = document.querySelectorAll('.thumb-btn');
      thumbs.forEach((t, i) => {
        if (i === currentIndex) {
          t.classList.add('active');
          t.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } else {
          t.classList.remove('active');
        }
      });
    }

    function nextStep() {
      if (currentIndex < steps.length - 1) {
        currentIndex++;
        updateView();
      } else {
        stopPlay();
      }
    }

    function prevStep() {
      if (currentIndex > 0) {
        currentIndex--;
        updateView();
      }
    }

    function goToStep(idx) {
      currentIndex = idx;
      updateView();
    }

    function restart() {
      currentIndex = 0;
      updateView();
    }

    function togglePlay() {
      if (timer) {
        stopPlay();
      } else {
        startPlay();
      }
    }

    function startPlay() {
      document.getElementById('play-btn').textContent = '⏸ Pause Walkthrough';
      timer = setInterval(() => {
        if (currentIndex < steps.length - 1) {
          currentIndex++;
          updateView();
        } else {
          stopPlay();
        }
      }, 2200);
    }

    function stopPlay() {
      clearInterval(timer);
      timer = null;
      document.getElementById('play-btn').textContent = '▶ Play Walkthrough';
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(ARTIFACT_DIR, 'walkthrough_player.html'), playerHtml, 'utf8');
  console.log('Created interactive walkthrough player at:', path.join(ARTIFACT_DIR, 'walkthrough_player.html'));

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'walkthrough_summary.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), totalSteps: stepsTaken.length, steps: stepsTaken }, null, 2),
    'utf8'
  );
}

run();

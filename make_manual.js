const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "IM Dashboard End-User Manual";

// ── Color palette ──────────────────────────────────────────
const C = {
  navy:        "1E3A5F",
  navyMid:     "2D5282",
  navyLight:   "EBF4FF",
  green:       "276749",
  greenMid:    "38A169",
  greenLight:  "F0FFF4",
  white:       "FFFFFF",
  offWhite:    "F8FAFC",
  gray100:     "F1F5F9",
  gray300:     "CBD5E0",
  gray500:     "718096",
  gray700:     "2D3748",
  placeholderBg:   "E2ECF8",
  placeholderBdr:  "90AFC8",
  placeholderTxt:  "4A6FA5",
  yellowBg:    "FFFBEB",
  yellowBdr:   "F6C90E",
  yellowTxt:   "92400E",
  red:         "C53030",
  purple:      "553C9A",
  purpleLight: "FAF5FF",
};

// ── Helpers ────────────────────────────────────────────────
function addHeader(slide, title, subtitle) {
  // Navy top bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.85,
    fill: { color: C.navy }, line: { color: C.navy }
  });
  slide.addText(title, {
    x: 0.35, y: 0, w: subtitle ? 7 : 9.3, h: 0.85,
    fontSize: 22, bold: true, color: C.white,
    valign: "middle", margin: 0
  });
  if (subtitle) {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 9.0, y: 0.1, w: 0.85, h: 0.65,
      fill: { color: C.greenMid }, line: { color: C.greenMid },
      rectRadius: 0.05
    });
    slide.addText(subtitle, {
      x: 8.9, y: 0.1, w: 1.0, h: 0.65,
      fontSize: 9, bold: true, color: C.white,
      align: "center", valign: "middle", margin: 0
    });
  }
}

function addPlaceholder(slide, x, y, w, h, label) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: C.placeholderBg },
    line: { color: C.placeholderBdr, width: 1.5, dashType: "dash" }
  });
  slide.addText([
    { text: "[ Screenshot ]", options: { bold: true, breakLine: true, fontSize: 11, color: C.placeholderTxt } },
    { text: label, options: { fontSize: 9, color: C.gray500, italic: true } }
  ], {
    x: x + 0.1, y, w: w - 0.2, h,
    align: "center", valign: "middle"
  });
}

function addNoteBox(slide, x, y, w, text, isGreen) {
  const bg  = isGreen ? C.greenLight : C.yellowBg;
  const bdr = isGreen ? C.greenMid   : C.yellowBdr;
  const txt = isGreen ? C.green      : C.yellowTxt;
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h: 0.6,
    fill: { color: bg }, line: { color: bdr, width: 1 }
  });
  slide.addText(text, {
    x: x + 0.12, y: y + 0.03, w: w - 0.24, h: 0.54,
    fontSize: 9.5, color: txt, italic: false, valign: "middle"
  });
}

function numberedStep(n, text) {
  return [
    { text: `${n}  `, options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text, options: { color: C.gray700, fontSize: 12, breakLine: true } }
  ];
}

// ══════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  // Large decorative accent
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 3.8, w: 10, h: 1.825,
    fill: { color: C.navyMid }, line: { color: C.navyMid }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 3.75, w: 10, h: 0.06,
    fill: { color: C.greenMid }, line: { color: C.greenMid }
  });

  s.addText("IM Dashboard", {
    x: 0.6, y: 0.9, w: 8.8, h: 1.4,
    fontSize: 60, bold: true, color: C.white, align: "center", valign: "middle"
  });
  s.addText("End-User Manual", {
    x: 0.6, y: 2.3, w: 8.8, h: 0.7,
    fontSize: 26, color: "90CDF4", align: "center", valign: "middle"
  });
  s.addText("Inventory Management & Order Planning System", {
    x: 0.6, y: 2.95, w: 8.8, h: 0.55,
    fontSize: 13, color: "A0AEC0", align: "center", valign: "middle"
  });
  s.addText("Version 1.0  —  2026", {
    x: 0.6, y: 4.05, w: 8.8, h: 0.5,
    fontSize: 11, color: "A0AEC0", align: "center", valign: "middle"
  });
}

// ══════════════════════════════════════════════════════════
// SLIDE 2 — What is IM Dashboard?
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "What is IM Dashboard?");

  const bullets = [
    "A web-based inventory management and order planning tool",
    "Connects to a cloud database to display up-to-date stock data",
    "Helps you monitor stock levels, predict future inventory, and plan orders",
    "Accessible from any browser — no installation required",
  ];

  s.addText(
    bullets.map((b, i) => [
      { text: b, options: { bullet: true, breakLine: i < bullets.length - 1, fontSize: 14, color: C.gray700, paraSpaceAfter: 8 } }
    ]).flat(),
    { x: 0.4, y: 1.0, w: 5.5, h: 2.2 }
  );

  // Flow diagram
  const flowItems = ["Google Sheets", "Database\n(Supabase)", "IM Dashboard"];
  const flowColors = [C.navyMid, C.green, C.greenMid];
  flowItems.forEach((label, i) => {
    const bx = 0.4 + i * 1.85;
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: 3.4, w: 1.55, h: 0.75,
      fill: { color: flowColors[i] }, line: { color: flowColors[i] }
    });
    s.addText(label, {
      x: bx, y: 3.4, w: 1.55, h: 0.75,
      fontSize: 10, bold: true, color: C.white, align: "center", valign: "middle"
    });
    if (i < flowItems.length - 1) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: bx + 1.57, y: 3.73, w: 0.26, h: 0.08,
        fill: { color: C.gray500 }, line: { color: C.gray500 }
      });
      s.addText("▶", { x: bx + 1.79, y: 3.67, w: 0.2, h: 0.2, fontSize: 10, color: C.gray500 });
    }
  });
  s.addText("Data Flow", {
    x: 0.4, y: 3.2, w: 5.5, h: 0.25,
    fontSize: 9, bold: true, color: C.gray500, align: "left"
  });

  // Right side image placeholder
  addPlaceholder(s, 6.0, 1.0, 3.7, 3.1, "Diagram showing the app in use\n(optional overview screenshot)");
}

// ══════════════════════════════════════════════════════════
// SLIDE 3 — System Overview (How to Use)
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.offWhite };
  addHeader(s, "How to Use This System");

  const steps = [
    { n: "1", title: "Login", desc: "Sign in with your Google account" },
    { n: "2", title: "Load Data", desc: "Click Data Setup and load from Supabase" },
    { n: "3", title: "Open Analytics", desc: "Go to Analytics & Order Planning tab" },
    { n: "4", title: "Analyze SKUs", desc: "Search SKUs, review stock & predictions" },
    { n: "5", title: "Export", desc: "Enter order quantities and export to Excel" },
  ];

  const boxW = 1.7, boxH = 1.7, startX = 0.25, startY = 1.5;
  const gap = (10 - startX * 2 - boxW * 5) / 4;

  steps.forEach((step, i) => {
    const bx = startX + i * (boxW + gap);
    // Shadow rect
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx + 0.04, y: startY + 0.04, w: boxW, h: boxH,
      fill: { color: C.gray300 }, line: { color: C.gray300 }
    });
    // Card
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: startY, w: boxW, h: boxH,
      fill: { color: C.white }, line: { color: C.gray300, width: 1 }
    });
    // Number circle (simulated with colored rect)
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: startY, w: boxW, h: 0.45,
      fill: { color: C.navy }, line: { color: C.navy }
    });
    s.addText(step.n, {
      x: bx, y: startY, w: boxW, h: 0.45,
      fontSize: 18, bold: true, color: C.white, align: "center", valign: "middle", margin: 0
    });
    s.addText(step.title, {
      x: bx + 0.08, y: startY + 0.5, w: boxW - 0.16, h: 0.5,
      fontSize: 12, bold: true, color: C.navy, align: "center", valign: "middle"
    });
    s.addText(step.desc, {
      x: bx + 0.08, y: startY + 0.95, w: boxW - 0.16, h: 0.7,
      fontSize: 9.5, color: C.gray500, align: "center", valign: "top"
    });

    // Arrow between boxes
    if (i < steps.length - 1) {
      const ax = bx + boxW + gap * 0.15;
      s.addText("▶", {
        x: ax, y: startY + 0.65, w: gap * 0.7, h: 0.4,
        fontSize: 14, color: C.greenMid, align: "center"
      });
    }
  });

  s.addText("Follow these 5 steps each time you use IM Dashboard", {
    x: 0.5, y: 4.65, w: 9, h: 0.35,
    fontSize: 10, color: C.gray500, align: "center", italic: true
  });
}

// ══════════════════════════════════════════════════════════
// SLIDE 4 — Login
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "Step 1: Login", "STEP 1");

  s.addText([
    { text: "1  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "Open the app URL in your browser", options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "2  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "You will see the login screen", options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "3  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: 'Click "Sign in with Google"', options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "4  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "Use your authorized company Google account", options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "5  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "After login, you will be redirected to the dashboard", options: { color: C.gray700, fontSize: 12 } },
  ], { x: 0.4, y: 1.05, w: 5.3, h: 3.0, paraSpaceAfter: 10 });

  addNoteBox(s, 0.4, 4.2, 5.3,
    "Note: Only authorized Google accounts can access the system. Contact your admin if you cannot log in.");

  addPlaceholder(s, 5.9, 1.0, 3.8, 3.5, "login.html\nFull login screen showing\nthe Google sign-in button");
}

// ══════════════════════════════════════════════════════════
// SLIDE 5 — Load Data Overview
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "Step 2: Load Data from the Database", "STEP 2");

  s.addText([
    { text: "1  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "Before using the dashboard, you must load data from the cloud database", options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "2  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: 'Click the "Data Setup" button in the top-right corner of the screen', options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "3  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "This opens the Database Setup & Management page", options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "4  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: 'Find the green "Load from Supabase" card (see next slide)', options: { color: C.gray700, fontSize: 12 } },
  ], { x: 0.4, y: 1.05, w: 5.3, h: 2.8, paraSpaceAfter: 10 });

  addNoteBox(s, 0.4, 4.1, 5.3,
    "Note: Data is managed by the admin team. If you see no data after loading, contact your administrator.", false);

  addPlaceholder(s, 5.9, 1.0, 3.8, 3.5,
    "Top header area showing\nthe 'Data Setup' button\nlocation (top-right corner)");
}

// ══════════════════════════════════════════════════════════
// SLIDE 6 — Load from Supabase
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "Load from Supabase", "STEP 2");

  const steps6 = [
    'Find the green "Load from Supabase" card (marked Recommended)',
    'Select weeks of data from the dropdown (default: 52 weeks / 1 year)',
    'Check "Active stock only" — recommended for normal use',
    'Set Safety Stock value in weeks (default: 6 weeks)',
    'Click the green "Load from Supabase" button',
    'Wait for the spinner to finish — status appears below the button',
  ];

  s.addText(
    steps6.flatMap((t, i) => [
      { text: `${i+1}  `, options: { bold: true, color: C.greenMid, fontSize: 13 } },
      { text: t, options: { color: C.gray700, fontSize: 11.5, breakLine: true, paraSpaceAfter: 6 } }
    ]),
    { x: 0.4, y: 1.05, w: 5.3, h: 3.2 }
  );

  addNoteBox(s, 0.4, 4.2, 5.3,
    "Tip: If unsure which settings to use, keep the defaults and just click the button.", true);

  addPlaceholder(s, 5.9, 1.0, 3.8, 3.8,
    "The green 'Load from Supabase' card\nshowing dropdown, checkbox,\nSafety Stock input, and button");
}

// ══════════════════════════════════════════════════════════
// SLIDE 7 — Return to Dashboard
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "Return to the Dashboard", "STEP 2");

  s.addText([
    { text: "1  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: 'After loading is complete, click "Back to Dashboard" in the top-right corner', options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "2  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "You will see the main dashboard with 3 tabs:", options: { color: C.gray700, fontSize: 12, breakLine: true } },
  ], { x: 0.4, y: 1.05, w: 5.3, h: 1.3, paraSpaceAfter: 10 });

  // 3 tab cards
  const tabs = [
    { icon: "NOS", label: "NOS Meeting List",           col: C.gray300 },
    { icon: "ANA", label: "Analytics & Order Planning", col: C.greenMid },
    { icon: "MAP", label: "Warehouse Map",              col: C.gray300 },
  ];
  tabs.forEach((tab, i) => {
    const bx = 0.4 + i * 1.8;
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: 2.55, w: 1.6, h: 0.65,
      fill: { color: tab.col }, line: { color: tab.col }
    });
    s.addText(tab.label, {
      x: bx + 0.05, y: 2.55, w: 1.5, h: 0.65,
      fontSize: 9, bold: tab.col === C.greenMid, color: C.white, align: "center", valign: "middle"
    });
  });

  s.addText([
    { text: "3  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: 'Click the "Analytics & Order Planning" tab to start analyzing inventory', options: { color: C.gray700, fontSize: 12 } },
  ], { x: 0.4, y: 3.4, w: 5.3, h: 0.7, paraSpaceAfter: 10 });

  addNoteBox(s, 0.4, 4.2, 5.3,
    "Tip: You will need to load fresh data each session. Data is not saved between browser sessions.", true);

  addPlaceholder(s, 5.9, 1.0, 3.8, 3.8,
    "The dashboard tab bar showing\nall 3 tabs, with\n'Analytics & Order Planning'\nhighlighted/active");
}

// ══════════════════════════════════════════════════════════
// SLIDE 8 — KPI Cards
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.offWhite };
  addHeader(s, "Dashboard KPIs at a Glance");

  const kpis = [
    { color: C.navyMid, label: "Normal Stock Value (TC)", desc: "Total cost value of all current inventory in dollars. Reflects the overall size of your stock position." },
    { color: C.red,     label: "Waste Risk Amount",       desc: "Total value of stock at risk of expiry or waste. Monitor this closely — high values need immediate action." },
    { color: C.purple,  label: "Total Managed SKUs",      desc: "Number of active SKUs currently tracked in the system." },
  ];

  kpis.forEach((k, i) => {
    const bx = 0.3 + i * 3.15;
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: 1.1, w: 3.0, h: 1.8,
      fill: { color: C.white }, line: { color: C.gray300, width: 1 },
      shadow: { type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.08 }
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: 1.1, w: 0.1, h: 1.8,
      fill: { color: k.color }, line: { color: k.color }
    });
    s.addText(k.label, {
      x: bx + 0.18, y: 1.15, w: 2.75, h: 0.45,
      fontSize: 10, bold: true, color: C.gray500
    });
    s.addText("$0 / 0", {
      x: bx + 0.18, y: 1.55, w: 2.75, h: 0.5,
      fontSize: 22, bold: true, color: k.color
    });
    s.addText(k.desc, {
      x: bx + 0.18, y: 2.1, w: 2.75, h: 0.7,
      fontSize: 9, color: C.gray500
    });
  });

  addPlaceholder(s, 0.3, 3.1, 9.4, 1.8,
    "Screenshot: The 3 KPI cards at the top of the Analytics tab showing actual values");

  s.addText("These numbers update every time you load fresh data from Supabase.", {
    x: 0.3, y: 5.05, w: 9.4, h: 0.35,
    fontSize: 9.5, color: C.gray500, align: "center", italic: true
  });
}

// ══════════════════════════════════════════════════════════
// SLIDE 9 — SKU Search
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "Searching for a SKU", "STEP 3");

  s.addText([
    { text: "1  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: 'In the "SKU Detailed Analysis & Future Prediction" section, click the search box', options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "2  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: 'Type a SKU code (e.g. "CF001") or part of an item name', options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "3  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "A dropdown list will appear — click the item you want", options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "4  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "The detail panel will open below the search box", options: { color: C.gray700, fontSize: 12 } },
  ], { x: 0.4, y: 1.05, w: 5.3, h: 3.0, paraSpaceAfter: 12 });

  addNoteBox(s, 0.4, 4.2, 5.3,
    "Tip: You can search by partial name — e.g. type 'sauce' to find all sauce-related SKUs.", true);

  addPlaceholder(s, 5.9, 1.0, 3.8, 3.8,
    "The SKU search box with a\ndropdown suggestion list visible\n(showing search results)");
}

// ══════════════════════════════════════════════════════════
// SLIDE 10 — SKU Detail Panel
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "Reading the SKU Detail Panel", "STEP 3");

  const fields = [
    { label: "Code / Item Name",  desc: "Basic product identifier and description",                                color: C.navyMid },
    { label: "Temp",              desc: "Storage temperature (Dry / Chill / Frozen)",                             color: C.navy },
    { label: "UoM",               desc: "Unit of Measure — e.g. case, kg, piece",                                 color: C.navy },
    { label: "Safety",            desc: "Minimum stock level (units). Action needed if current stock falls below", color: C.red },
    { label: "Current Qty",       desc: "Latest recorded stock quantity",                                         color: C.greenMid },
    { label: "WOS",               desc: "Weeks of Stock — how many weeks current stock will last at avg sales",   color: C.navyMid },
    { label: "Total Value",       desc: "Current stock value at TC (cost) price",                                 color: C.gray700 },
  ];

  fields.forEach((f, i) => {
    const row = i < 4 ? i : i - 4;
    const col = i < 4 ? 0 : 1;
    const bx = 0.3 + col * 4.8;
    const by = 1.1 + row * 0.88;

    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: by, w: 4.5, h: 0.75,
      fill: { color: C.white }, line: { color: C.gray300, width: 0.75 }
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: by, w: 0.08, h: 0.75,
      fill: { color: f.color }, line: { color: f.color }
    });
    s.addText(f.label, {
      x: bx + 0.16, y: by + 0.04, w: 4.2, h: 0.3,
      fontSize: 10, bold: true, color: f.color
    });
    s.addText(f.desc, {
      x: bx + 0.16, y: by + 0.33, w: 4.2, h: 0.35,
      fontSize: 9, color: C.gray500
    });
  });

  addPlaceholder(s, 0.3, 4.7, 9.4, 0.65,
    "Screenshot: SKU detail header row showing all fields (Code, Name, Temp, UoM, Safety, Current Qty, Total Value)");
}

// ══════════════════════════════════════════════════════════
// SLIDE 11 — Future Trend Chart
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "Understanding the Future Trend Chart", "STEP 3");

  const legend = [
    { color: "3182CE", label: "Sales (blue bars)",         desc: "Weekly actual sales history" },
    { color: "38A169", label: "Inventory (green bars)",    desc: "Weekly actual inventory levels" },
    { color: "D69E2E", label: "Prediction (yellow dashed)", desc: "Projected future inventory based on average sales" },
    { color: "E53E3E", label: "Safety Stock (red dashed)", desc: "The minimum threshold — order if prediction crosses below this line" },
  ];

  legend.forEach((l, i) => {
    const by = 1.05 + i * 0.78;
    // Color swatch
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y: by + 0.15, w: 0.35, h: 0.35,
      fill: { color: l.color }, line: { color: l.color }
    });
    s.addText(l.label, {
      x: 0.88, y: by + 0.05, w: 4.5, h: 0.3,
      fontSize: 11, bold: true, color: C.gray700
    });
    s.addText(l.desc, {
      x: 0.88, y: by + 0.32, w: 4.5, h: 0.35,
      fontSize: 9.5, color: C.gray500
    });
  });

  // Controls description
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 4.2, w: 5.3, h: 0.65,
    fill: { color: C.navyLight }, line: { color: C.gray300 }
  });
  s.addText([
    { text: "Zoom dropdown: ", options: { bold: true, color: C.navy, fontSize: 10 } },
    { text: "Adjust time range (12 / 24 weeks / All Time)    ", options: { color: C.gray700, fontSize: 10 } },
    { text: "Sim Avg: ", options: { bold: true, color: C.navy, fontSize: 10 } },
    { text: "Simulate a custom sales rate to test order scenarios", options: { color: C.gray700, fontSize: 10 } },
  ], { x: 0.5, y: 4.23, w: 5.1, h: 0.6, valign: "middle" });

  addPlaceholder(s, 5.9, 1.0, 3.8, 3.8,
    "The full Future Trend Simulation\nchart with all 4 legend items\n(Sales, Inventory, Prediction,\nSafety Stock) visible");
}

// ══════════════════════════════════════════════════════════
// SLIDE 12 — Order Judgment & Predicted Balances
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "Order Judgment & Predicted Balances", "STEP 4");

  // Order Judgment box
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.05, w: 5.4, h: 1.35,
    fill: { color: C.purpleLight }, line: { color: "805AD5", width: 1.5 }
  });
  s.addText("Order Judgment Panel (purple border)", {
    x: 0.45, y: 1.08, w: 5.1, h: 0.35,
    fontSize: 10, bold: true, color: C.purple
  });
  s.addText([
    { text: '"auto: X units"', options: { bold: true, color: C.purple, fontSize: 11 } },
    { text: " — the system suggests ordering X units to maintain safety stock through the next container arrival", options: { color: C.gray700, fontSize: 10 } },
  ], { x: 0.45, y: 1.4, w: 5.1, h: 0.85 });

  // Predicted Balances box
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 2.55, w: 5.4, h: 1.35,
    fill: { color: C.navyLight }, line: { color: "4299E1", width: 1.5 }
  });
  s.addText("Predicted Balances Panel (blue border)", {
    x: 0.45, y: 2.58, w: 5.1, h: 0.35,
    fontSize: 10, bold: true, color: C.navyMid
  });
  s.addText([
    { text: "Shows estimated stock levels for ", options: { color: C.gray700, fontSize: 10 } },
    { text: "Next, 2nd Next, and 3rd Next", options: { bold: true, color: C.navyMid, fontSize: 10 } },
    { text: " container arrivals. Enter your planned order quantity in the ", options: { color: C.gray700, fontSize: 10 } },
    { text: '"Order Qty"', options: { bold: true, color: C.navyMid, fontSize: 10 } },
    { text: " fields — the predicted balances update automatically.", options: { color: C.gray700, fontSize: 10 } },
  ], { x: 0.45, y: 2.92, w: 5.1, h: 0.9 });

  addNoteBox(s, 0.3, 4.15, 5.4,
    "Tip: Use the 'auto' suggestion as a starting point, then adjust based on promotions or supplier constraints.", true);

  addPlaceholder(s, 5.9, 1.0, 3.8, 3.8,
    "The 'Predicted Balances' blue card\nand 'Order Judgment' purple card\nside by side");
}

// ══════════════════════════════════════════════════════════
// SLIDE 13 — Order Planning Table
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "Order Planning Table", "STEP 4");

  const points = [
    { text: "Scroll down on the Analytics tab to find the full Order Planning table" },
    { text: "Every active SKU is listed with current stock, WOS, ABC rank, and order fields" },
    { text: "Enter order quantities directly in the table — the system automatically recalculates predicted balances" },
    { text: "Use filters at the top to focus on specific categories or risk levels" },
    { text: "Red-highlighted rows indicate SKUs below safety stock — prioritize these", highlight: true },
  ];

  s.addText(
    points.flatMap(p => [
      { text: p.text, options: {
          bullet: true,
          breakLine: true,
          fontSize: 12,
          color: p.highlight ? C.red : C.gray700,
          bold: p.highlight || false,
          paraSpaceAfter: 8
        }
      }
    ]),
    { x: 0.4, y: 1.05, w: 5.3, h: 3.3 }
  );

  addNoteBox(s, 0.4, 4.55, 5.3,
    "Tip: Always review red-highlighted rows first — these represent items at or below safety stock.", false);

  addPlaceholder(s, 5.9, 1.0, 3.8, 3.8,
    "The Order Planning table showing\nmultiple SKUs with colored rows\nand order quantity input fields");
}

// ══════════════════════════════════════════════════════════
// SLIDE 14 — Export to Excel
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "Exporting the Order Plan to Excel", "STEP 5");

  s.addText([
    { text: "1  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "Review and fill in your order quantities in the Order Planning table", options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "2  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: 'Click the green "Export to Excel" button (top-right of the table)', options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "3  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "An .xlsx file will be downloaded automatically to your browser's download folder", options: { color: C.gray700, fontSize: 12, breakLine: true } },
    { text: "4  ", options: { bold: true, color: C.greenMid, fontSize: 13 } },
    { text: "The file contains all SKU data and your entered order quantities", options: { color: C.gray700, fontSize: 12 } },
  ], { x: 0.4, y: 1.05, w: 5.3, h: 3.0, paraSpaceAfter: 14 });

  addNoteBox(s, 0.4, 4.2, 5.3,
    "Tip: Always load the latest data from Supabase before exporting to ensure your order plan is current.", true);

  addPlaceholder(s, 5.9, 1.0, 3.8, 3.8,
    "The green 'Export to Excel' button\nhighlighted in the Order Planning\ntable header area");
}

// ══════════════════════════════════════════════════════════
// SLIDE 15 — Coming Soon
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.offWhite };
  addHeader(s, "Coming Soon");

  const features = [
    { icon: "NOS", title: "NOS Meeting List" },
    { icon: "MAP", title: "Warehouse Map" },
  ];

  features.forEach((f, i) => {
    const bx = 1.0 + i * 4.5;
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: 1.3, w: 3.8, h: 2.8,
      fill: { color: C.gray100 }, line: { color: C.gray300, width: 1.5, dashType: "dash" }
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: 1.3, w: 3.8, h: 0.5,
      fill: { color: C.gray300 }, line: { color: C.gray300 }
    });
    s.addText(f.title, {
      x: bx + 0.1, y: 1.3, w: 3.6, h: 0.5,
      fontSize: 13, bold: true, color: "4A5568", align: "center", valign: "middle", margin: 0
    });
    // "Coming Soon" badge
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx + 1.1, y: 2.5, w: 1.6, h: 0.45,
      fill: { color: "ECC94B" }, line: { color: "D69E2E" }
    });
    s.addText("Coming Soon", {
      x: bx + 1.1, y: 2.5, w: 1.6, h: 0.45,
      fontSize: 11, bold: true, color: "744210", align: "center", valign: "middle", margin: 0
    });
  });

  s.addText("These features are currently under development and will be available in a future release.", {
    x: 0.5, y: 4.6, w: 9, h: 0.5,
    fontSize: 11, color: C.gray500, align: "center", italic: true
  });
}

// ══════════════════════════════════════════════════════════
// SLIDE 16 — Glossary
// ══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addHeader(s, "Glossary");

  const glossary = [
    ["SKU",          "Stock Keeping Unit — a unique code identifying a product"],
    ["WOS",          "Weeks of Stock — how many weeks current inventory will last at the current sales rate"],
    ["Safety Stock", "The minimum stock level buffer, expressed in weeks of average sales"],
    ["TC Price",     "Transfer Cost Price — the cost price used for internal stock valuation"],
    ["UoM",          "Unit of Measure — the unit in which a product is counted (e.g. case, kg, piece)"],
    ["ABC Rank",     "A sales-volume classification: A = high volume, B = medium, C = low"],
    ["Supabase",     "The cloud database where all inventory and sales data is stored"],
  ];

  const tableData = [
    [
      { text: "Term",       options: { bold: true, color: C.white, fill: { color: C.navy }, align: "center", fontSize: 12 } },
      { text: "Definition", options: { bold: true, color: C.white, fill: { color: C.navy }, align: "left",   fontSize: 12 } }
    ],
    ...glossary.map(([term, def], i) => [
      { text: term, options: { bold: true, color: C.navyMid, fill: { color: i % 2 === 0 ? C.white : C.offWhite }, align: "center", fontSize: 11 } },
      { text: def,  options: { color: C.gray700,             fill: { color: i % 2 === 0 ? C.white : C.offWhite }, align: "left",   fontSize: 10.5 } }
    ])
  ];

  s.addTable(tableData, {
    x: 0.4, y: 1.0, w: 9.2, h: 4.3,
    border: { pt: 0.5, color: C.gray300 },
    colW: [1.6, 7.6],
    rowH: 0.5,
  });
}

// ══════════════════════════════════════════════════════════
// Save
// ══════════════════════════════════════════════════════════
pres.writeFile({ fileName: "C:\\Users\\DELL\\Desktop\\IM-Dashboard\\IM_Dashboard_User_Manual.pptx" })
  .then(() => console.log("Done: IM_Dashboard_User_Manual.pptx"))
  .catch(err => { console.error("Error:", err); process.exit(1); });

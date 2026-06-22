"""
IM Dashboard — End-User Manual (python-pptx)
16 slides, 16:9 widescreen
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
from pptx.oxml.ns import qn
from pptx.enum.dml import MSO_THEME_COLOR
import copy
from lxml import etree

# ── Palette ───────────────────────────────────────────────────
def rgb(h):
    r = int(h[0:2], 16)
    g = int(h[2:4], 16)
    b = int(h[4:6], 16)
    return RGBColor(r, g, b)

NAVY       = "1E3A5F"
NAVY_MID   = "2D5282"
NAVY_LIGHT = "EBF4FF"
GREEN      = "276749"
GREEN_MID  = "38A169"
GREEN_LT   = "F0FFF4"
WHITE      = "FFFFFF"
OFF_WHITE  = "F8FAFC"
GRAY_100   = "F1F5F9"
GRAY_200   = "E2E8F0"
GRAY_300   = "CBD5E0"
GRAY_500   = "718096"
GRAY_700   = "2D3748"
PH_BG      = "E2ECF8"
PH_BDR     = "90AFC8"
PH_TXT     = "4A6FA5"
YELLOW_BG  = "FFFBEB"
YELLOW_BDR = "F6C90E"
YELLOW_TXT = "92400E"
RED        = "C53030"
PURPLE     = "553C9A"
PURPLE_LT  = "FAF5FF"

W  = Inches(10)
H  = Inches(5.625)

# ── Presentation setup ────────────────────────────────────────
prs = Presentation()
prs.slide_width  = W
prs.slide_height = H
blank_layout = prs.slide_layouts[6]  # blank

# ── Low-level helpers ─────────────────────────────────────────
def add_rect(slide, x, y, w, h, fill_hex=None, line_hex=None, line_width=Pt(0.75), line_dash=None):
    shape = slide.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Inches(h))  # MSO_SHAPE_TYPE.RECTANGLE = 1
    tf = shape.fill
    if fill_hex:
        tf.solid()
        tf.fore_color.rgb = rgb(fill_hex)
    else:
        tf.background()
    ln = shape.line
    if line_hex:
        ln.color.rgb = rgb(line_hex)
        ln.width = line_width
        if line_dash:
            ln.dash_style = line_dash
    else:
        ln.fill.background()
    return shape

def add_text(slide, text, x, y, w, h,
             font_size=12, bold=False, italic=False,
             color_hex=GRAY_700, align=PP_ALIGN.LEFT,
             v_anchor=None, bg_hex=None, wrap=True, font_name="Calibri"):
    txb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    txb.word_wrap = wrap
    if bg_hex:
        txb.fill.solid()
        txb.fill.fore_color.rgb = rgb(bg_hex)
    tf = txb.text_frame
    tf.word_wrap = wrap
    if v_anchor:
        tf.vertical_anchor = v_anchor
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.name = font_name
    run.font.color.rgb = rgb(color_hex)
    return txb

def add_richtext(slide, runs, x, y, w, h,
                 align=PP_ALIGN.LEFT, v_anchor=None,
                 para_space_after=0, wrap=True):
    """
    runs: list of (text, font_size, bold, italic, color_hex, break_line)
    Each tuple element after text is optional (defaults apply).
    """
    from pptx.oxml.ns import qn
    from pptx.util import Pt as _Pt
    txb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    txb.word_wrap = wrap
    tf = txb.text_frame
    tf.word_wrap = wrap
    if v_anchor:
        tf.vertical_anchor = v_anchor

    # Remove default empty paragraph
    for i, run_data in enumerate(runs):
        text       = run_data[0]
        font_size  = run_data[1] if len(run_data) > 1 else 12
        bold       = run_data[2] if len(run_data) > 2 else False
        italic     = run_data[3] if len(run_data) > 3 else False
        color_hex  = run_data[4] if len(run_data) > 4 else GRAY_700
        break_line = run_data[5] if len(run_data) > 5 else False

        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.alignment = align
        if para_space_after:
            p.space_after = Pt(para_space_after)

        run = p.add_run()
        run.text = text
        run.font.size = _Pt(font_size)
        run.font.bold = bold
        run.font.italic = italic
        run.font.name = "Calibri"
        run.font.color.rgb = rgb(color_hex)

        if break_line:
            # Add a line break at end of this paragraph by adding a <a:br>
            from pptx.oxml import parse_xml
            br = parse_xml('<a:br xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>')
            p._p.append(br)

    return txb

def add_placeholder_box(slide, x, y, w, h, label):
    add_rect(slide, x, y, w, h, fill_hex=PH_BG, line_hex=PH_BDR, line_width=Pt(1.5))
    add_text(slide, "[ Screenshot ]", x, y + h*0.3, w, h*0.2,
             font_size=11, bold=True, color_hex=PH_TXT, align=PP_ALIGN.CENTER)
    add_text(slide, label, x + 0.1, y + h*0.5, w - 0.2, h*0.45,
             font_size=8.5, italic=True, color_hex=GRAY_500, align=PP_ALIGN.CENTER)

def add_header(slide, title, badge=None):
    add_rect(slide, 0, 0, 10, 0.85, fill_hex=NAVY)
    add_text(slide, title, 0.35, 0.0, 9.3, 0.85,
             font_size=22, bold=True, color_hex=WHITE, align=PP_ALIGN.LEFT)
    if badge:
        add_rect(slide, 9.0, 0.1, 0.75, 0.65, fill_hex=GREEN_MID)
        add_text(slide, badge, 9.0, 0.1, 0.75, 0.65,
                 font_size=8, bold=True, color_hex=WHITE, align=PP_ALIGN.CENTER)

def add_note(slide, x, y, w, text, green=False):
    bg  = GREEN_LT  if green else YELLOW_BG
    bdr = GREEN_MID if green else YELLOW_BDR
    txt = GREEN     if green else YELLOW_TXT
    add_rect(slide, x, y, w, 0.62, fill_hex=bg, line_hex=bdr, line_width=Pt(1))
    add_text(slide, text, x + 0.12, y + 0.05, w - 0.24, 0.52,
             font_size=9.5, color_hex=txt)

def add_steps(slide, steps, x, y, w, h, para_space=10):
    """steps: list of strings"""
    rows = []
    for i, s in enumerate(steps):
        rows.append((f"{i+1}   ", 13, True, False, GREEN_MID, False))
        rows.append((s, 12, False, False, GRAY_700, i < len(steps)-1))
    add_richtext(slide, rows, x, y, w, h, para_space_after=para_space)

# ══════════════════════════════════════════════════════════════
# SLIDE 1 — Title
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=NAVY)
add_rect(s, 0, 3.8,  10, 1.825, fill_hex=NAVY_MID)
add_rect(s, 0, 3.75, 10, 0.06,  fill_hex=GREEN_MID)

add_text(s, "IM Dashboard",
         0.5, 0.8, 9, 1.5,
         font_size=60, bold=True, color_hex=WHITE, align=PP_ALIGN.CENTER)
add_text(s, "End-User Manual",
         0.5, 2.3, 9, 0.75,
         font_size=28, color_hex="90CDF4", align=PP_ALIGN.CENTER)
add_text(s, "Inventory Management & Order Planning System",
         0.5, 3.0, 9, 0.55,
         font_size=14, color_hex="A0AEC0", align=PP_ALIGN.CENTER)
add_text(s, "Version 1.0  —  2026",
         0.5, 4.1, 9, 0.45,
         font_size=11, color_hex="A0AEC0", align=PP_ALIGN.CENTER)

# ══════════════════════════════════════════════════════════════
# SLIDE 2 — What is IM Dashboard?
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "What is IM Dashboard?")

bullets = [
    "A web-based inventory management and order planning tool",
    "Connects to a cloud database to display up-to-date stock data",
    "Helps you monitor stock levels, predict future inventory, and plan orders",
    "Accessible from any browser — no installation required",
]
for i, b in enumerate(bullets):
    by = 1.1 + i * 0.62
    add_text(s, "●  " + b, 0.4, by, 5.3, 0.55, font_size=12, color_hex=GRAY_700)

# Flow diagram
flow_items  = ["Excel\n(.xlsx Upload)", "Database\n(Supabase)", "IM\nDashboard"]
flow_colors = [NAVY_MID, GREEN, GREEN_MID]
for i, (label, col) in enumerate(zip(flow_items, flow_colors)):
    bx = 0.5 + i * 1.85
    add_rect(s, bx, 3.45, 1.55, 0.75, fill_hex=col)
    add_text(s, label, bx, 3.45, 1.55, 0.75,
             font_size=10, bold=True, color_hex=WHITE, align=PP_ALIGN.CENTER)
    if i < len(flow_items) - 1:
        add_text(s, "▶", bx + 1.58, 3.57, 0.25, 0.4, font_size=13, color_hex=GRAY_500)

add_text(s, "Data Flow:", 0.5, 3.25, 3.0, 0.25,
         font_size=9, bold=True, color_hex=GRAY_500)

add_placeholder_box(s, 6.0, 1.0, 3.7, 3.2,
    "Diagram / overview screenshot\n(optional — shows app in use)")

# ══════════════════════════════════════════════════════════════
# SLIDE 3 — System Overview
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=OFF_WHITE)
add_header(s, "How to Use This System")

steps3 = [
    ("1", "Login",          "Sign in with\nyour Google account"),
    ("2", "Load Data",      "Click Data Setup\nand load from Supabase"),
    ("3", "Open Analytics", "Go to Analytics &\nOrder Planning tab"),
    ("4", "Analyze SKUs",   "Search SKUs, review\nstock & predictions"),
    ("5", "Export",         "Enter order quantities\nand export to Excel"),
]
box_w, box_h = 1.66, 1.8
start_x, start_y = 0.2, 1.4
gap = (10 - start_x * 2 - box_w * 5) / 4

for i, (num, title, desc) in enumerate(steps3):
    bx = start_x + i * (box_w + gap)
    # shadow
    add_rect(s, bx + 0.04, start_y + 0.04, box_w, box_h, fill_hex=GRAY_300)
    # card
    add_rect(s, bx, start_y, box_w, box_h, fill_hex=WHITE, line_hex=GRAY_300, line_width=Pt(0.5))
    # header bar
    add_rect(s, bx, start_y, box_w, 0.45, fill_hex=NAVY)
    add_text(s, num, bx, start_y, box_w, 0.45,
             font_size=20, bold=True, color_hex=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, title, bx + 0.07, start_y + 0.5, box_w - 0.14, 0.45,
             font_size=11, bold=True, color_hex=NAVY, align=PP_ALIGN.CENTER)
    add_text(s, desc, bx + 0.07, start_y + 0.95, box_w - 0.14, 0.75,
             font_size=9, color_hex=GRAY_500, align=PP_ALIGN.CENTER)
    # arrow
    if i < len(steps3) - 1:
        ax = bx + box_w + gap * 0.18
        add_text(s, "▶", ax, start_y + 0.7, gap * 0.64, 0.4,
                 font_size=14, color_hex=GREEN_MID, align=PP_ALIGN.CENTER)

add_text(s, "Follow these 5 steps each time you use IM Dashboard",
         0.5, 4.65, 9, 0.35, font_size=10, italic=True,
         color_hex=GRAY_500, align=PP_ALIGN.CENTER)

# ══════════════════════════════════════════════════════════════
# SLIDE 4 — Login
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "Step 1: Login", "STEP 1")

add_steps(s, [
    "Open the app URL in your browser",
    'You will see the login screen',
    'Click "Sign in with Google"',
    "Use your authorized company Google account",
    "After login, you will be redirected to the dashboard",
], 0.4, 1.05, 5.3, 3.0)

add_note(s, 0.4, 4.2, 5.3,
    "Note: Only authorized Google accounts can access the system.\nContact your admin if you cannot log in.")

add_placeholder_box(s, 5.9, 1.0, 3.8, 3.5,
    "login.html\nFull login screen showing\nthe Google sign-in button")

# ══════════════════════════════════════════════════════════════
# SLIDE 5 — Load Data Overview
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "Step 2: Load Data from the Database", "STEP 2")

add_steps(s, [
    "Before using the dashboard, you must load data from the cloud database",
    'Click the "Data Setup" button in the top-right corner of the screen',
    "This opens the Database Setup & Management page",
    'Find the green "Load from Supabase" card (see next slide)',
], 0.4, 1.05, 5.3, 2.8)

add_note(s, 0.4, 4.1, 5.3,
    "Note: Data is managed by the admin team.\nIf you see no data after loading, contact your administrator.")

add_placeholder_box(s, 5.9, 1.0, 3.8, 3.5,
    "Top header area showing\nthe 'Data Setup' button\nlocation (top-right corner)")

# ══════════════════════════════════════════════════════════════
# SLIDE 6 — Load from Supabase
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "Load from Supabase", "STEP 2")

add_steps(s, [
    'Find the green "Load from Supabase" card (marked Recommended)',
    'Select weeks of data from the dropdown (default: 52 weeks / 1 year)',
    '"Active stock only" — check this box (recommended)',
    'Set Safety Stock value in weeks (default: 6 weeks)',
    'Click the green "Load from Supabase" button',
    'Wait for the spinner to finish — status appears below the button',
], 0.4, 1.05, 5.3, 3.2, para_space=7)

add_note(s, 0.4, 4.3, 5.3,
    "Tip: If unsure which settings to use, keep the defaults and just click the button.", green=True)

add_placeholder_box(s, 5.9, 1.0, 3.8, 3.8,
    "The green 'Load from Supabase' card\nshowing dropdown, checkbox,\nSafety Stock input, and button")

# ══════════════════════════════════════════════════════════════
# SLIDE 7 — Return to Dashboard
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "Return to the Dashboard", "STEP 2")

add_richtext(s, [
    ("1   ", 13, True, False, GREEN_MID, False),
    ('After loading, click "Back to Dashboard" in the top-right corner', 12, False, False, GRAY_700, True),
    ("2   ", 13, True, False, GREEN_MID, False),
    ("You will see the main dashboard with 3 tabs:", 12, False, False, GRAY_700, True),
], 0.4, 1.05, 5.3, 1.2, para_space_after=10)

# 3 tab boxes
tab_labels = ["NOS Meeting List", "Analytics & Order Planning", "Warehouse Map"]
tab_colors = [GRAY_300, GREEN_MID, GRAY_300]
for i, (label, col) in enumerate(zip(tab_labels, tab_colors)):
    bx = 0.4 + i * 1.75
    add_rect(s, bx, 2.55, 1.6, 0.6, fill_hex=col)
    add_text(s, label, bx + 0.05, 2.55, 1.5, 0.6,
             font_size=8.5, bold=(col == GREEN_MID), color_hex=WHITE, align=PP_ALIGN.CENTER)

add_richtext(s, [
    ("3   ", 13, True, False, GREEN_MID, False),
    ('Click "Analytics & Order Planning" to start analyzing inventory', 12, False, False, GRAY_700, True),
], 0.4, 3.35, 5.3, 0.7, para_space_after=10)

add_note(s, 0.4, 4.2, 5.3,
    "Tip: You will need to load fresh data each session.\nData is not saved between browser sessions.", green=True)

add_placeholder_box(s, 5.9, 1.0, 3.8, 3.8,
    "The dashboard tab bar showing\nall 3 tabs, with\n'Analytics & Order Planning'\nhighlighted/active")

# ══════════════════════════════════════════════════════════════
# SLIDE 8 — KPI Cards
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=OFF_WHITE)
add_header(s, "Dashboard KPIs at a Glance")

kpis = [
    (NAVY_MID, "Normal Stock Value (TC)",
     "Total cost value of all current inventory in dollars.\nReflects the overall size of your stock position."),
    (RED, "Waste Risk Amount",
     "Total value of stock at risk of expiry or waste.\nMonitor this closely — high values need immediate action."),
    (PURPLE, "Total Managed SKUs",
     "Number of active SKUs currently tracked in the system."),
]

for i, (col, label, desc) in enumerate(kpis):
    bx = 0.3 + i * 3.15
    add_rect(s, bx, 1.1, 3.0, 1.85, fill_hex=WHITE, line_hex=GRAY_300, line_width=Pt(0.5))
    add_rect(s, bx, 1.1, 0.1, 1.85, fill_hex=col)
    add_text(s, label, bx + 0.18, 1.15, 2.75, 0.42, font_size=10, bold=True, color_hex=GRAY_500)
    add_text(s, "$0 / 0", bx + 0.18, 1.52, 2.75, 0.5, font_size=22, bold=True, color_hex=col)
    add_text(s, desc, bx + 0.18, 2.05, 2.75, 0.8, font_size=9, color_hex=GRAY_500)

add_placeholder_box(s, 0.3, 3.15, 9.4, 1.75,
    "Screenshot: The 3 KPI cards at the top of the Analytics tab showing actual values")

add_text(s, "These numbers update every time you load fresh data from Supabase.",
         0.3, 5.1, 9.4, 0.3, font_size=9.5, italic=True,
         color_hex=GRAY_500, align=PP_ALIGN.CENTER)

# ══════════════════════════════════════════════════════════════
# SLIDE 9 — SKU Search
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "Searching for a SKU", "STEP 3")

add_steps(s, [
    'In the "SKU Detailed Analysis" section, click the search box',
    'Type a SKU code (e.g. "CF001") or part of an item name',
    "A dropdown list will appear — click the item you want",
    "The detail panel will open below the search box",
], 0.4, 1.05, 5.3, 3.0)

add_note(s, 0.4, 4.2, 5.3,
    "Tip: You can search by partial name — e.g. type 'sauce' to find all sauce-related SKUs.", green=True)

add_placeholder_box(s, 5.9, 1.0, 3.8, 3.8,
    "The SKU search box with a\ndropdown suggestion list visible\n(showing search results)")

# ══════════════════════════════════════════════════════════════
# SLIDE 10 — SKU Detail Panel
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "Reading the SKU Detail Panel", "STEP 3")

fields = [
    (NAVY_MID, "Code / Item Name",  "Basic product identifier and description"),
    (NAVY,     "Temp",              "Storage temperature: Dry / Chill / Frozen"),
    (NAVY,     "UoM",               "Unit of Measure — e.g. case, kg, piece"),
    (RED,      "Safety",            "Minimum stock (units). Action needed if stock falls below this"),
    (GREEN_MID,"Current Qty",       "Latest recorded stock quantity"),
    (NAVY_MID, "WOS",               "Weeks of Stock — how many weeks stock will last at avg sales"),
    (GRAY_700, "Total Value",       "Current stock value at TC (cost) price"),
]

for i, (col, label, desc) in enumerate(fields):
    col_i = 0 if i < 4 else 1
    row_i = i if i < 4 else i - 4
    bx = 0.3 + col_i * 4.85
    by = 1.05 + row_i * 0.88
    add_rect(s, bx, by, 4.55, 0.78, fill_hex=WHITE, line_hex=GRAY_200, line_width=Pt(0.75))
    add_rect(s, bx, by, 0.08, 0.78, fill_hex=col)
    add_text(s, label, bx + 0.16, by + 0.05, 4.3, 0.3, font_size=10, bold=True, color_hex=col)
    add_text(s, desc,  bx + 0.16, by + 0.35, 4.3, 0.38, font_size=9, color_hex=GRAY_500)

add_placeholder_box(s, 0.3, 4.65, 9.4, 0.7,
    "Screenshot: SKU detail header row showing all fields (Code, Name, Temp, UoM, Safety, Current Qty, Total Value)")

# ══════════════════════════════════════════════════════════════
# SLIDE 11 — Future Trend Chart
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "Understanding the Future Trend Chart", "STEP 3")

legend = [
    ("3182CE", "Sales (blue bars)",          "Weekly actual sales history"),
    ("38A169", "Inventory (green bars)",     "Weekly actual inventory levels"),
    ("D69E2E", "Prediction (yellow dashed)", "Projected future inventory based on average sales rate"),
    ("E53E3E", "Safety Stock (red dashed)",  "Minimum threshold — place an order if the prediction line crosses below this"),
]

for i, (col, label, desc) in enumerate(legend):
    by = 1.05 + i * 0.82
    add_rect(s, 0.4, by + 0.18, 0.35, 0.32, fill_hex=col)
    add_text(s, label, 0.9, by + 0.06, 4.8, 0.3, font_size=11, bold=True, color_hex=GRAY_700)
    add_text(s, desc,  0.9, by + 0.35, 4.8, 0.38, font_size=9.5, color_hex=GRAY_500)

# Controls panel
add_rect(s, 0.4, 4.3, 5.3, 0.65, fill_hex=NAVY_LIGHT, line_hex=GRAY_300, line_width=Pt(0.75))
add_richtext(s, [
    ("Zoom dropdown: ", 10, True, False, NAVY, False),
    ("Adjust time range shown (12 / 24 weeks / All Time)     ", 10, False, False, GRAY_700, True),
    ("Sim Avg: ", 10, True, False, NAVY, False),
    ("Simulate a custom sales rate to test order scenarios", 10, False, False, GRAY_700, False),
], 0.52, 4.33, 5.06, 0.6)

add_placeholder_box(s, 5.9, 1.0, 3.8, 3.8,
    "The full Future Trend Simulation chart\nwith all 4 legend items visible\n(Sales, Inventory, Prediction, Safety Stock)")

# ══════════════════════════════════════════════════════════════
# SLIDE 12 — Order Judgment & Predicted Balances
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "Order Judgment & Predicted Balances", "STEP 4")

# Order Judgment box (purple)
add_rect(s, 0.3, 1.05, 5.4, 1.35, fill_hex=PURPLE_LT, line_hex="805AD5", line_width=Pt(1.5))
add_text(s, "Order Judgment Panel  (purple border)",
         0.45, 1.08, 5.1, 0.32, font_size=10, bold=True, color_hex=PURPLE)
add_richtext(s, [
    ('"auto: X units"', 11, True, False, PURPLE, False),
    (" — the system suggests ordering X units to maintain safety stock through the next container arrival",
     10, False, False, GRAY_700, False),
], 0.45, 1.4, 5.1, 0.85)

# Predicted Balances box (blue)
add_rect(s, 0.3, 2.55, 5.4, 1.5, fill_hex=NAVY_LIGHT, line_hex="4299E1", line_width=Pt(1.5))
add_text(s, "Predicted Balances Panel  (blue border)",
         0.45, 2.58, 5.1, 0.32, font_size=10, bold=True, color_hex=NAVY_MID)
add_richtext(s, [
    ("Shows estimated stock levels for ", 10, False, False, GRAY_700, False),
    ("Next, 2nd Next, and 3rd Next", 10, True, False, NAVY_MID, False),
    (" container arrivals. Enter your planned order quantity in the ", 10, False, False, GRAY_700, False),
    ('"Order Qty"', 10, True, False, NAVY_MID, False),
    (" fields — predicted balances update automatically.", 10, False, False, GRAY_700, False),
], 0.45, 2.92, 5.1, 0.95)

add_note(s, 0.3, 4.2, 5.4,
    "Tip: Use the 'auto' suggestion as a starting point, then adjust based on promotions or supplier constraints.",
    green=True)

add_placeholder_box(s, 5.9, 1.0, 3.8, 3.8,
    "The 'Predicted Balances' blue card\nand 'Order Judgment' purple card\nside by side")

# ══════════════════════════════════════════════════════════════
# SLIDE 13 — Order Planning Table
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "Order Planning Table", "STEP 4")

points = [
    ("Scroll down on the Analytics tab to find the full Order Planning table", False),
    ("Every active SKU is listed with current stock, WOS, ABC rank, and order fields", False),
    ("Enter order quantities directly in the table — the system automatically recalculates predicted balances", False),
    ("Use filter / sort controls at the top to focus on specific categories or risk levels", False),
    ("Red-highlighted rows = SKUs below safety stock — prioritize these", True),
]

for i, (text, highlight) in enumerate(points):
    by = 1.08 + i * 0.6
    col = RED if highlight else GRAY_700
    bold = highlight
    add_text(s, "●  " + text, 0.4, by, 5.3, 0.55,
             font_size=12, color_hex=col, bold=bold)

add_note(s, 0.4, 4.5, 5.3,
    "Tip: Always review red-highlighted rows first — these are items at or below safety stock.")

add_placeholder_box(s, 5.9, 1.0, 3.8, 3.8,
    "The Order Planning table showing\nmultiple SKUs with colored rows\nand order quantity input fields")

# ══════════════════════════════════════════════════════════════
# SLIDE 14 — Export to Excel
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "Exporting the Order Plan to Excel", "STEP 5")

add_steps(s, [
    "Review and fill in your order quantities in the Order Planning table",
    'Click the green "Export to Excel" button (top-right of the table)',
    "An .xlsx file will be downloaded to your browser's download folder",
    "The file contains all SKU data and your entered order quantities",
], 0.4, 1.05, 5.3, 3.0)

add_note(s, 0.4, 4.2, 5.3,
    "Tip: Always load the latest data from Supabase before exporting to ensure your order plan is current.",
    green=True)

add_placeholder_box(s, 5.9, 1.0, 3.8, 3.8,
    "The green 'Export to Excel' button\nhighlighted in the Order Planning\ntable header area")

# ══════════════════════════════════════════════════════════════
# SLIDE 15 — Coming Soon
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=OFF_WHITE)
add_header(s, "Coming Soon")

features = ["NOS Meeting List", "Warehouse Map"]
for i, label in enumerate(features):
    bx = 1.0 + i * 4.5
    add_rect(s, bx, 1.3, 3.8, 2.8, fill_hex=GRAY_100, line_hex=GRAY_300, line_width=Pt(1.5))
    add_rect(s, bx, 1.3, 3.8, 0.5, fill_hex=GRAY_300)
    add_text(s, label, bx + 0.1, 1.3, 3.6, 0.5,
             font_size=14, bold=True, color_hex="4A5568", align=PP_ALIGN.CENTER)
    # badge
    add_rect(s, bx + 1.1, 2.55, 1.6, 0.45, fill_hex="ECC94B", line_hex="D69E2E", line_width=Pt(1))
    add_text(s, "Coming Soon", bx + 1.1, 2.55, 1.6, 0.45,
             font_size=11, bold=True, color_hex="744210", align=PP_ALIGN.CENTER)

add_text(s, "These features are currently under development and will be available in a future release.",
         0.5, 4.6, 9, 0.4, font_size=11, italic=True,
         color_hex=GRAY_500, align=PP_ALIGN.CENTER)

# ══════════════════════════════════════════════════════════════
# SLIDE 16 — Glossary
# ══════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank_layout)
add_rect(s, 0, 0, 10, 5.625, fill_hex=WHITE)
add_header(s, "Glossary")

glossary = [
    ("SKU",          "Stock Keeping Unit — a unique code identifying a product"),
    ("WOS",          "Weeks of Stock — how many weeks current inventory will last at the current sales rate"),
    ("Safety Stock", "The minimum stock level buffer, expressed in weeks of average sales"),
    ("TC Price",     "Transfer Cost Price — the cost price used for internal stock valuation"),
    ("UoM",          "Unit of Measure — the unit in which a product is counted (e.g. case, kg, piece)"),
    ("ABC Rank",     "Sales-volume classification: A = high volume, B = medium, C = low"),
    ("Supabase",     "The cloud database where all inventory and sales data is stored"),
]

row_h = 0.54
header_h = 0.5
table_y = 0.98
col1_w = 1.6
col2_w = 7.8

# Header row
add_rect(s, 0.3, table_y, col1_w, header_h, fill_hex=NAVY)
add_rect(s, 0.3 + col1_w, table_y, col2_w, header_h, fill_hex=NAVY)
add_text(s, "Term",       0.3,           table_y, col1_w, header_h,
         font_size=12, bold=True, color_hex=WHITE, align=PP_ALIGN.CENTER)
add_text(s, "Definition", 0.3 + col1_w, table_y, col2_w, header_h,
         font_size=12, bold=True, color_hex=WHITE, align=PP_ALIGN.LEFT)

for i, (term, defn) in enumerate(glossary):
    row_y = table_y + header_h + i * row_h
    bg = WHITE if i % 2 == 0 else GRAY_100
    add_rect(s, 0.3,           row_y, col1_w, row_h, fill_hex=bg, line_hex=GRAY_200, line_width=Pt(0.5))
    add_rect(s, 0.3 + col1_w, row_y, col2_w, row_h, fill_hex=bg, line_hex=GRAY_200, line_width=Pt(0.5))
    add_text(s, term, 0.3,           row_y + 0.04, col1_w, row_h - 0.08,
             font_size=11, bold=True, color_hex=NAVY_MID, align=PP_ALIGN.CENTER)
    add_text(s, defn, 0.35 + col1_w, row_y + 0.04, col2_w - 0.1, row_h - 0.08,
             font_size=10, color_hex=GRAY_700)

# ══════════════════════════════════════════════════════════════
# Save
# ══════════════════════════════════════════════════════════════
out = r"C:\Users\DELL\Desktop\IM-Dashboard\IM_Dashboard_User_Manual.pptx"
prs.save(out)
print(f"Saved: {out}")

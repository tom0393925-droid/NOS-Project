# IM Dashboard — System Specification

> Audience: Internal staff (no engineering background required)
> Purpose: Primary reference document for NotebookLM Q&A bot — covers all system logic and specifications

---

## 1. System Overview

### What does this system do?

IM Dashboard is a **web-based dashboard that centralizes inventory management, order planning, and customer analytics** for a food import and wholesale business. Its primary purpose is to automatically calculate order quantities from weekly inventory Excel uploads and prevent stockouts before they happen.

### Who uses it?

- Internal staff (ordering, inventory, and sales analytics roles)
- Data is separated per client (distributor). After logging in, each user can only view and edit data for their assigned client.

### Where does it run?

- A web application accessible via browser (hosted on Vercel)
- All data is stored in a cloud database (Supabase)
- No offline functionality — an internet connection is required at all times

---

## 2. Login & Authentication

### How to log in

Uses Google OAuth authentication ("Sign in with Google" button).

### Access control

- Only **pre-approved email addresses** can access the system
- Unapproved Google accounts are blocked at login
- The approved email list is managed in the `allowed_emails` table in Supabase
- The approved list is **cached for 30 days** (optimization to avoid querying the database on every login)

---

## 3. Data Structure

### Main data types

| Data | Description | Storage |
|---|---|---|
| SKU Master | Product code, name, unit price, storage type, weight, shelf location | Supabase `sku_master` |
| Weekly Inventory | Sales quantity and remaining stock per week | Supabase `weekly_sales` |
| Picking Data | Number of orders containing each SKU per week (hit count) | Supabase `picking_data` |
| Order Plan | Order quantities, expected arrival dates, status | Supabase `shipment_orders` |
| Categories | Product groups organized by container (Next / 2nd / 3rd) | Supabase `order_categories` |
| Customer Purchase Data | Customer code, SKU, week, quantity, and amount | Supabase `client_sku_orders` |
| Order Reservations | Customer shipment reservations (SKU, shipment date, quantity, customer name) | Supabase `order_reservations` |

### What is a SKU?

SKU stands for Stock Keeping Unit — a **unique code that identifies a product**. Examples: `JP001`, `US-BEEF-200G`. Even the same product gets a different SKU if the spec, lot, or storage temperature differs.

### History data structure

```
historyData[sku_code] = [
  { week: "2025-01-01", qty: 100, sales: 20 },  // stock count, sales qty
  { week: "2025-01-08", qty: 80,  sales: 15 },
  ...
]
```

Weeks are stored as Monday dates in YYYY-MM-DD format.

---

## 4. File Upload Logic

### Weekly inventory file (main upload)

Uploading a weekly inventory Excel file updates the system's data.

**File parsing logic:**

1. The header row is auto-detected (looks for columns: Code, Name, Sales, Qty, UoM, Expiry/Lot)
2. If the weight unit is `g` or `kg`, values are automatically divided by 1,000 to standardize units
3. If data for the same SKU and same week already exists, it is **overwritten**; otherwise a **new record is created**
4. The date is extracted from the filename to determine which week the data belongs to

**How dates are read from filenames:**
- A regex pattern scans the filename for date formats (e.g. `2025-01-07`, `07012025`, etc.)
- This date becomes the **baseline for the latest data**, which is the starting point for all future predictions

### Picking (Invoice) file

Uploading a shipment invoice Excel records how many orders included each SKU per week (hit count).

- SKU names are auto-extracted from the format `"CODE name"` (code + space + name)
- Uploading multiple files for the same week does not create duplicates — data is aggregated per week

### Customer sales file (Customer Insights)

Upload a weekly sales-by-customer Excel file.

- The week start date is extracted from the header row in the format `"From: DD/MM/YYYY"`
- Customer codes and names are parsed from the format `"CODE NAME"`
- Data is upserted to Supabase (update if exists, insert if new)

---

## 5. Screen Layout (Tab Overview)

The dashboard has **7 tabs**. Each tab uses **lazy rendering** — it is only drawn when first clicked (performance optimization).

| Tab | Function |
|---|---|
| NOS | Inventory analysis, per-SKU detail panel, inventory forecast chart |
| Order Planning | Create and input order quantities |
| Analytics | ABC analysis, picking frequency analysis, 9-box matrix |
| Customer Insights | Per-customer purchase heatmap and sales analysis |
| Warehouse Map | Warehouse shelf map and location optimization |
| Category | Container category management |
| Master | SKU master data editor |

---

## 6. NOS Tab (Inventory Analysis)

### 7 action categories

The NOS tab automatically classifies every SKU into one of these 7 categories:

| Category | Condition |
|---|---|
| New Arrival | SKU with stock recorded for the first time in the latest week |
| No Sale | SKU with stock on hand but no sales for a certain period |
| Expired | SKU near or past its expiry date |
| Damaged | SKU requiring damage write-off or disposal |
| FF (Fulfillment Failed) | SKU involved in an unfulfilled shipment |
| Return | Returned product |
| Normal | All other SKUs with no special flags |

### SKU detail panel

Clicking a SKU opens the detail panel, which shows:

- **Current stock quantity**
- **Average weekly sales** (calculated from historical data)
- **Safety stock** (average weekly sales × safety weeks, default: 6 weeks)
- **Weeks of Supply (WOS)**: how many weeks the current stock will last
- **Projected remaining stock** at each arrival date (Next / 2nd / 3rd)
- **Recommended order quantity** (shown as `auto: X`)

### Weeks of Supply (WOS) color coding

| Color | Meaning |
|---|---|
| Red | Danger — stock is below safety stock level |
| Yellow | Caution — approaching safety stock |
| Green | Sufficient stock |

---

## 7. Inventory Forecast Chart Logic

### Core concept

The chart visualizes: *"If stock continues to deplete at the average weekly sales rate, when will it run out?"* — displayed as a line graph projecting into the future.

### Demand estimation during stockout periods (_calcStockoutAvg)

When a SKU has had zero stock for several consecutive weeks, its actual demand during that period is unknown. In this case:

1. The system looks back up to **12 weeks** to find the most recent period when stock was available
2. The average sales from that in-stock period is used as the **estimated demand during the stockout**
3. This ensures that SKUs which went out of stock — but still had real demand — are not incorrectly evaluated as low-demand items

### Safety stock line

Displayed as a horizontal line on the chart. Formula:

```
Safety Stock = Average Weekly Sales × Safety Weeks (default: 6 weeks)
```

The safety weeks value can be adjusted per SKU by the user.

### Arrival date lines

Displayed as vertical lines on the chart (one each for Next / 2nd / 3rd containers). The forecast line jumps upward at each arrival date to reflect incoming stock.

### Stockout zone

Any period where projected stock drops below zero is shown as a **red shaded area**.

### Drag to adjust demand

The forecast line on the chart can be **dragged** to manually adjust the average weekly demand figure (for simulation purposes). Changes are automatically reflected in the recommended order quantity.

---

## 8. Order Planning Tab

### Order quantity cascade logic

Order quantities are determined using the following priority order:

1. **User-entered quantity** (highest priority)
2. **Predicted quantity for the Next container** (auto-calculated from forecast)
3. **Auto-recommended quantity for the 2nd container**
4. **Predicted quantity for the 3rd container**
5. **Auto-recommended quantity for the 3rd container**

This is called the **cascade logic**. If a higher-priority value exists, lower-priority values are ignored.

### Order table operations

- Supports **search and sort**
- Changes are **auto-saved 2.5 seconds** after input (debounce)
- Saved to: Supabase `shipment_orders` table

### Category filter

Switch between container category tabs (Next / 2nd / 3rd) to manage order quantities separately per container.

### Order reservations

Register customer shipment reservations:
- Specify SKU code, shipment date, customer name, and quantity
- Reserved quantities are automatically reflected in the inventory forecast

### Excel import

Order quantities can also be bulk-imported from an Excel file.

---

## 9. Analytics Tab

### ABC Analysis

All SKUs are classified into 3 tiers based on cumulative sales value:

| Rank | Criteria |
|---|---|
| A | SKUs that account for the top 0–80% of cumulative sales value |
| B | Cumulative 80–95% |
| C | Bottom 5% (low-frequency, low-value items) |

### Picking frequency analysis

SKUs are ranked by picking hit count (number of orders in which each SKU appeared). This is an indicator of how frequently an item is handled in the warehouse.

### 9-Box Matrix (Cross Matrix)

SKUs are plotted on a 2-axis grid: **sales value (ABC)** × **picking frequency**. This produces 9 segments and supports strategic decisions about inventory prioritization and shelf placement.

---

## 10. Customer Insights Tab

### Per-customer heatmap

A heatmap showing which SKU each customer purchased, in which week, and in what quantity — visualized using color intensity.

- **Rows**: SKUs
- **Columns**: Weeks
- **Color intensity**: Purchase quantity

### KPI cards (last 4 weeks)

| Metric | Description |
|---|---|
| Total purchase amount | Sum of all purchases in the last 4 weeks |
| Active SKU count | Number of SKUs purchased at least once in the last 4 weeks |
| Growth rate | % change vs. the prior 4-week period |

### Active vs. Dormant SKUs

| Status | Condition |
|---|---|
| Active | At least one purchase within the last 4 weeks |
| Dormant | No purchase for 8 or more weeks |

### Per-SKU chart

Clicking a SKU expands a weekly sales bar chart. An average line and color intensity proportional to purchase volume make trends easy to read.

### SKU mix donut chart

Displays the customer's SKU composition as a donut chart for the selected period (4 weeks / 12 weeks / all time).

---

## 11. Warehouse Map Tab

### Shelf color coding

| Color | Picking frequency |
|---|---|
| Red | Over 50 hits/week (high frequency) |
| Yellow | 20–50 hits/week (medium frequency) |
| Blue | 1–20 hits/week (low frequency) |
| Grey | No data |

### Optimization calculation logic

The system calculates how much walking distance cost could be saved by **moving high-frequency items to shelves closer to the entrance**.

**Cost formula:**
```
Movement Cost = Picking Hit Count × Shelf Distance × Weight Factor
```

The optimization recommendation:
- Proposes **swapping** high-frequency items on distant shelves with low-frequency items on nearby shelves
- Shows improvement percentage and cost reduction amount

### Simulator

Before committing to any physical shelf moves, you can stage hypothetical moves to estimate their impact:
- Add proposed moves to a staging list
- If the numbers make sense, click "Apply" to commit changes to the SKU master

---

## 12. Category Tab (Container Category Management)

### The container concept

Products are imported in container units. This tab manages **which SKUs are on which container**.

### Parent and child categories

- **Parent category**: The container itself (holds the arrival dates for Next / 2nd / 3rd)
- **Child category**: A sub-group of SKUs (auto-filtered by SKU code prefix)

### What happens when an arrival date changes

When a category's arrival date is updated:
1. Order quantities tied to that category migrate to the new date
2. The global arrival dates (Next / 2nd / 3rd) are automatically updated
3. The vertical lines on the inventory forecast chart are refreshed

### Mark as Received

When the Next container is marked as received:
- Next → removed (receipt complete)
- 2nd → promoted to Next
- 3rd → promoted to 2nd

### Bulk SKU assignment

Upload an Excel file to assign SKUs to categories in bulk.

---

## 13. Master Tab (SKU Master Editor)

### Fields managed

| Field | Description |
|---|---|
| SKU Code | Unique identifier (primary key) |
| Product Name | Display name |
| Unit Price | Purchase/cost price |
| Storage Type | Dry (ambient) / Frozen / Chilled |
| Weight | Weight per unit (kg) |
| Shelf Location | Storage position within the warehouse |
| Safety Stock Weeks | Number of weeks used in safety stock calculation (default: 6) |

### How saving works

- Saving an individual SKU → immediately upserted to Supabase (update if exists, insert if new)
- The on-screen list is updated instantly without a page reload (optimistic update)

---

## 14. Auto-Save & Data Persistence

### Auto-save behavior

Changes to order quantities in the Order Planning tab are **automatically saved to Supabase 2.5 seconds after input**. No manual save button is needed.

### Local backup (JSON)

Data can be exported and imported as a JSON file, providing a local browser backup option.

---

## 15. Data Loading & Caching

### First load vs. cached load

- **First access**: All data is fetched from Supabase and loaded into memory
- **Subsequent navigation (same session)**: In-memory cache is used (fast)
- **After a weekly file upload**: Cache is cleared and data is re-fetched from Supabase

### Data load order

1. SKU master (`sku_master`)
2. Weekly sales data (`weekly_sales`) → converted to `historyData` format
3. Picking data (`picking_data`) → converted to `invoiceHistoryData` format
4. Order data (`shipment_orders`)
5. Categories (`order_categories`)

---

## 16. Frequently Asked Questions (FAQ)

**Q: I uploaded a file but the data hasn't updated.**
A: Try reloading the page. After an upload, the cache is cleared automatically — but the browser's own cache may still be holding old data.

**Q: The inventory forecast numbers look wrong.**
A: Check the following:
1. Has the latest week's file been uploaded correctly?
2. Does the filename include a date? (If not, the system cannot determine which week it belongs to, causing the forecast baseline to shift.)
3. Is the affected SKU registered in the SKU master?

**Q: How is the recommended order quantity (auto: X) calculated?**
A: The base formula is: `(stock expected to be consumed before the arrival date) − (already ordered quantity)`. The result is adjusted upward if needed to ensure safety stock is not breached.

**Q: Why does the average weekly sales figure remain non-zero even when stock is at zero?**
A: A period of zero stock is interpreted as "couldn't sell because there was nothing to sell," not "no demand existed." The system looks back up to 12 weeks to find the most recent in-stock period and uses that period's average sales as the demand estimate.

**Q: A customer's data is not showing up.**
A: The Customer Insights Excel for that customer may not have been uploaded yet, or the weekly sales file for that customer has not been imported.

**Q: Does changing a shelf location number do anything?**
A: Yes — it updates the Warehouse Map display and affects the optimization cost calculations. Physical movement of products in the warehouse must be done separately.

**Q: What happens to order quantities when a category's arrival date is changed?**
A: Existing order quantities are carried over to the new arrival date. No quantities are lost or reset to zero.

**Q: Can the same SKU belong to multiple categories?**
A: The current specification assumes each SKU is assigned to one category. Assigning a SKU to multiple categories may cause duplicate entries to appear in the order planning table.

**Q: A staff member can no longer log in.**
A: Ask an administrator to verify that the email address is registered in the `allowed_emails` table in Supabase.

---

## 17. Tech Stack (Reference)

| Component | Technology |
|---|---|
| Frontend | HTML / CSS / Vanilla JavaScript |
| Chart library | Chart.js |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth (Google OAuth) |
| Hosting | Vercel |
| Excel parsing | SheetJS (xlsx.js) |

---

*This document was auto-generated from the IM Dashboard v1.0 codebase.*

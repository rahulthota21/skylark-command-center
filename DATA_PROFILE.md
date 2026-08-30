# Supplied Data Profile and Mapping Decisions

This document records the source-data inspection performed before implementation. The web application does **not** read these local files at runtime; it reads the imported monday.com boards dynamically.

## Source files inspected

| Source | Usable records | Notable structure |
|---|---:|---|
| `Deal funnel Data.xlsx - Deal tracker.csv` | 346 rows | 12 source columns; Deal Name is a suitable monday Item Name |
| `Work_Order_Tracker Data.xlsx - work order tracker.csv` | 176 rows | 38 source columns; one all-blank leading line; Serial # is a suitable unique monday Item Name |

## Sales Pipeline mapping

| Source column | monday type | Application semantic | Notes |
|---|---|---|---|
| Deal Name | Item Name | `itemName`, group link key | Masked deal label; not unique across all rows. |
| Owner code | Text | `owner` | Uses anonymized owner code. |
| Client Code | Text | `account`, `clientCode` | Useful within the sales board; does not reliably match work-order customer codes. |
| Deal Status | Status | `dealStatus` | Primary lifecycle field: Open, Won, Dead, On Hold. |
| Close Date (A) | Date | retained raw / actual-close context | Sparse and not used as the default forecast field. |
| Closure Probability | Status / Dropdown | `probability` | High/Medium/Low. Explicit directional mapping: 75% / 50% / 25%. |
| Masked Deal value | Numbers | `amount` | No per-cell currency marker. Treated as INR only through a visible board-context assumption. |
| Tentative Close Date | Date | `closeDate` | Preferred date for forward pipeline analysis. |
| Deal Stage | Status | `stage` | Used for stage mix; Deal Status decides terminal/open lifecycle where available. |
| Product deal | Dropdown / Text | retained raw | Optional product context. |
| Sector/service | Dropdown | `sector` | Renewables and Powerline are visibly rolled into Energy sub-sectors for “energy” questions. |
| Created Date | Date | `createdDate` | Used only as contextual metadata. |

## Project Execution / Work Orders mapping

| Source column | monday type | Application semantic | Notes |
|---|---|---|---|
| Serial # | Item Name | `identifier` / item name | Unique work-order reference; deliberately placed first in the import-ready file. |
| Deal name masked | Text | `linkedDealName` | Used for transparent cross-board matching. |
| Customer Name Code | Text | `account`, `clientCode` | Not assumed to be directly equivalent to Sales Client Code. |
| Execution Status | Status | `status` | Completed, Ongoing, Not Started, Pause/struck, etc. |
| Data Delivery Date | Date | `deliveryDate` | Actual delivery context. |
| Date of PO/LOI | Date | retained raw | Commercial context. |
| Probable Start Date | Date | `startDate` | Planned start. |
| Probable End Date | Date | `dueDate` | Preferred planned due date. |
| BD/KAM Personnel code | Text | `owner` | Anonymized owner code. |
| Sector | Dropdown | `sector` | Same displayed energy roll-up. |
| Amount in Rupees (Incl of GST) (Masked) | Numbers | `amount` | Contract/work-order value; inclusive-of-GST tax basis. |
| Billed Value in Rupees (Incl of GST.) (Masked) | Numbers | `billedValue` | Uses the same inclusive-of-GST basis. |
| Collected Amount in Rupees (Incl of GST.) (Masked) | Numbers | `collectedAmount` | Cash collection value. |
| Amount to be billed in Rs. (Incl. of GST) (Masked) | Numbers | `unbilledAmount` | Remaining billing value. |
| Amount Receivable (Masked) | Numbers | `receivableAmount` | Treated as INR through the board-wide Rupee context. |
| Invoice Status | Status | `invoiceStatus` | Fully/Partially/Not Billed and Stuck states. |
| Billing Status | Status | `billingStatus` | Additional billing signal. |

All other columns remain available in monday.com and are read as raw source context; they are not silently repurposed as another metric.

## Observed data-quality conditions

- The Deals file includes **two embedded repeated header rows** within the record body. The app detects and excludes them from business calculations while reporting the issue.
- Two sales rows have a blank Deal Name.
- Deal probability is qualitative rather than numeric. The High/Medium/Low mapping is clearly disclosed in weighted-pipeline responses.
- Deal value cells do not individually show currency. The Work Orders tracker explicitly labels related financial values as Rupees, so the app makes an explicit, visible INR board-context assumption rather than hiding it.
- Work Orders has a single all-blank leading line; the import-ready version removes only that technical line and reorders columns so Serial # becomes the monday Item Name.
- Four work orders have missing execution status; 19 lack a usable Probable End Date.
- The source does not provide a reliable work-order progress percentage, so the app does not invent one.
- There is no robust common unique ID across both boards. The shared masked Deal Name produces **27 one-to-one exact links**, **142 group-level links** where one label maps to multiple sales rows, and **7 unmatched work orders**. Group-level links are never presented as one-to-one matches.

## Date context

The active sales-pipeline tentative close dates are concentrated in historical periods and run through early 2026. The app therefore does not blindly answer “this quarter” with a misleading empty number when the runtime current quarter has no relevant records. It asks whether the user wants the latest quarter represented by the relevant active-pipeline data.

## Why these decisions help

The mapping distinguishes an operational truth from a convenient but unsafe shortcut:

- Deal Status determines whether a sale is open/won/dead; Deal Stage explains the funnel position.
- Probable End Date is planned delivery timing; Data Delivery Date is actual delivery context.
- Inclusive-of-GST work-order financial fields are compared only with other inclusive-of-GST fields.
- Cross-board name links are confidence-labelled rather than silently treated as exact customer IDs.

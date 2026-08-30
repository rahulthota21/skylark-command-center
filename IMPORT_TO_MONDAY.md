# Import the supplied data into monday.com — click-by-click

You only need to do this once. The app code is already designed to read these boards dynamically afterward.

## Use these prepared files

Use the files in the workspace folder **`import-ready-files`**:

1. `01_Deals_Import_Ready.csv`
2. `02_Work_Orders_Import_Ready.csv`

Why these versions?

- The Deals file is unchanged.
- The Work Orders source had one entirely blank first line. The import-ready copy removes only that technical blank line and moves **Serial #** to the first column so monday gives every work order a unique Item Name.
- No business data is cleaned, altered, removed, or fabricated.

## Part 1 — Create the Sales Pipeline board

1. Sign in to monday.com.
2. Click **Add** or **+** in the left sidebar.
3. Choose **New Board** → choose **Main board**.
4. Name it exactly: **Sales Pipeline**.
5. Choose **Import data** / **Import from CSV or Excel** when monday asks how to create the board.
6. Upload `01_Deals_Import_Ready.csv`.
7. Make sure the first row is treated as column names.
8. Let `Deal Name` be the main Item Name column.
9. After import, set these important columns to these types if monday did not infer them:

| Column | Select this monday type |
|---|---|
| Owner code | Text |
| Client Code | Text |
| Deal Status | Status |
| Close Date (A) | Date |
| Closure Probability | Status or Dropdown |
| Masked Deal value | Numbers |
| Tentative Close Date | Date |
| Deal Stage | Status |
| Product deal | Dropdown or Text |
| Sector/service | Dropdown |
| Created Date | Date |

10. Do not delete blank, odd, or inconsistent values. The app is expected to handle them.

## Part 2 — Create the Project Execution board

1. Click **Add** / **+** again.
2. Choose **New Board** → **Main board**.
3. Name it exactly: **Project Execution**.
4. Choose **Import data** / **Import from CSV or Excel**.
5. Upload `02_Work_Orders_Import_Ready.csv`.
6. Make sure the first row is treated as column names.
7. `Serial #` should become the Item Name. This is intentional because it is unique.
8. Keep `Deal name masked` as a normal Text column. Do **not** delete it; the app uses it for transparent cross-board matching.
9. Set these important columns:

| Column | Select this monday type |
|---|---|
| Deal name masked | Text |
| Customer Name Code | Text |
| Execution Status | Status |
| Data Delivery Date | Date |
| Date of PO/LOI | Date |
| Probable Start Date | Date |
| Probable End Date | Date |
| BD/KAM Personnel code | Text |
| Sector | Dropdown |
| Amount in Rupees (Incl of GST) (Masked) | Numbers |
| Billed Value in Rupees (Incl of GST.) (Masked) | Numbers |
| Collected Amount in Rupees (Incl of GST.) (Masked) | Numbers |
| Amount to be billed in Rs. (Incl. of GST) (Masked) | Numbers |
| Amount Receivable (Masked) | Numbers |
| Invoice Status | Status |
| Billing Status | Status |

10. Leave less important columns as Text if configuring all 38 columns feels slow. The app dynamically reads all columns, but the listed fields are the ones used in calculations.

## Part 3 — Find the two board IDs

Open each board in your browser. The URL usually includes a long number after `/boards/`.

Example:

```text
https://youraccount.monday.com/boards/1234567890
                                     ^^^^^^^^^^
                                     board ID
```

Write down:

```text
Sales Pipeline board ID: __________
Project Execution board ID: _______
```

These two ID numbers are safe to share with me. Do **not** share your API token in chat.

## Part 4 — Create the API token

Current monday instructions:

1. Click your profile picture in the top-right.
2. Select **Developers**. A Developer Center opens.
3. Open **API token** / **My access tokens**.
4. Click **Show** and copy your personal API token.

monday personal API tokens inherit the permissions of the user that owns them. Use an account/user with access only to these assignment boards where possible. The app itself uses GraphQL queries only, never mutations.

Official reference: https://developer.monday.com/api-reference/docs/authentication

**Do not paste this token in this chat, GitHub, a screenshot, README, or public code.** You will paste it only into Vercel’s private Environment Variables screen.

## Before you tell me you are finished

Check that both boards have rows visible and that the required columns still have the same titles. Then send me only:

```text
Sales Pipeline Board ID: [number]
Project Execution Board ID: [number]
```

I will then guide the final private Vercel configuration and live test.

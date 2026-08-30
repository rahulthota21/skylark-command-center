# Run, test, deploy, and submit — beginner-friendly guide

There are two ways to use this project:

1. **Recommended:** deploy it on Vercel, then submit the public link.
2. **Optional:** run it locally on your own laptop for testing.

You do **not** need to write code for either route.

---

## A. What must be ready first

Before the app can show real results, you need:

- the two monday.com boards imported using [`IMPORT_TO_MONDAY.md`](./IMPORT_TO_MONDAY.md),
- the two board IDs,
- a monday personal API token,
- optionally an OpenAI-compatible LLM API key.

The app will never use the source CSV files at runtime. It only reads the monday boards.

---

## B. Easiest path: deploy to Vercel

### Step 1 — Get the source code ZIP

Use the final `Skylark-Command-Center-Submission.zip` file supplied with this project. It contains the code, README, Decision Log, tests, and no secrets.

### Step 2 — Create a GitHub repository without using commands

1. Go to https://github.com and sign in/create an account.
2. Click the **+** icon in the upper-right → **New repository**.
3. Name it `skylark-command-center`.
4. Select **Private** while working. You can make it public later only if the evaluator needs GitHub access.
5. Click **Create repository**.
6. Click **uploading an existing file**.
7. Extract the ZIP on your computer first.
8. Drag the contents of the extracted `skylark-command-center` folder into GitHub’s upload page. Upload source files/folders only; do not upload `node_modules` or `.next` if they appear.
9. Click **Commit changes**.

### Step 3 — Deploy from Vercel

1. Go to https://vercel.com and sign in with your GitHub account.
2. Click **Add New** → **Project**.
3. Choose the `skylark-command-center` GitHub repository.
4. Vercel should detect **Next.js** automatically. Do not change the build command.
5. Before clicking Deploy, open **Environment Variables**.
6. Add the following private variables one by one:

```text
MONDAY_API_TOKEN = [your private monday token]
MONDAY_SALES_BOARD_ID = [Sales Pipeline board number]
MONDAY_WORK_ORDERS_BOARD_ID = [Project Execution board number]
```

Optional but strongly recommended for natural language AI:

```text
LLM_API_KEY = [your private API key]
LLM_BASE_URL = https://api.openai.com/v1
LLM_MODEL = gpt-4o-mini
```

If you use a different OpenAI-compatible service, use its API endpoint and supported model name instead.

7. Click **Deploy**.
8. Wait for the deployment to finish, then click **Visit**.
9. Open the public link in an incognito/private browser window.

### Step 4 — Test the public app

On the deployed website, check:

- The badge says **Live monday.com data**.
- It displays two connected boards and record counts.
- Click **Refresh** — it should update the sync timestamp.
- Ask these questions:

```text
How is our pipeline looking for the energy sector this quarter?
Compare sector performance across the pipeline.
Which work orders are delayed or at risk?
How are billing, collections, and receivables looking?
Prepare a leadership update.
```

Note: the supplied active pipeline dates are historical relative to the current date. For the first question, a good agent response is a clarification asking whether to use the latest relevant quarter. That is intentional and demonstrates sound BI judgment.

### Step 5 — Prove dynamic integration

This is the strongest part of your demo:

1. In monday.com, change a visible Deal Value or Execution Status.
2. Return to your app.
3. Click **Refresh**.
4. Ask the same question again.
5. The result should update from the live board.

---

## C. Optional: run locally on your laptop

Only use this if you want to test before deploying.

### You need

- Node.js 20 or later: https://nodejs.org
- The project source folder
- Your private monday token / board IDs

### Steps

1. Extract the source ZIP.
2. Open the extracted `skylark-command-center` folder.
3. Create a copy of `.env.example` named `.env.local`.
4. Open `.env.local` in Notepad/TextEdit and fill in your private variables:

```text
MONDAY_API_TOKEN=put-token-here
MONDAY_SALES_BOARD_ID=put-sales-board-number-here
MONDAY_WORK_ORDERS_BOARD_ID=put-work-order-board-number-here
LLM_API_KEY=optional-key-here
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

5. Open Terminal in that folder.
6. Run these commands one at a time:

```bash
npm install
npm run dev
```

7. Open this address in a browser:

```text
http://localhost:3000
```

To stop it, return to the terminal and press `Ctrl + C`.

### Check code quality locally

```bash
npm run lint
npm test
npm run build
```

Expected result: lint passes, tests pass, and production build succeeds.

---

## D. Submission checklist

Submit:

- [ ] Public Vercel URL
- [ ] GitHub repository URL **or** `Skylark-Command-Center-Submission.zip`
- [ ] `DECISION_LOG.md` (under two pages)
- [ ] `README.md`
- [ ] Optional 60–90 second Loom video

Use [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) for the video walkthrough.

---

## E. If something goes wrong

| Problem | What to check |
|---|---|
| “Setup required” page | Missing Environment Variables in Vercel, or they were added after deploy without redeploying. |
| “Connection could not be completed” | Board ID is wrong, token belongs to a user without access to both boards, or token was copied incorrectly. |
| No LLM-style answer | Add `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL`. Core deterministic analysis still works for common questions. |
| App does not change after monday edit | Click **Refresh**; board data uses a short server cache for efficiency. |
| Vercel fails build | Confirm that GitHub has `package.json`, then copy the Vercel error text and send it here. |

Never send tokens or API keys in chat or commit them into GitHub.

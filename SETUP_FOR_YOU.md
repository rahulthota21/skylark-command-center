# The only external steps you need to do

I will build and test the code. You only need to do the account actions below because I cannot log into or create accounts on your behalf.

## A. Send the source files here

Upload these two files in this chat:

1. `Deal funnel Data.xlsx`
2. `Work_Order_Tracker Data.xlsx`

I will inspect them and tailor the column mapping, data rules, README, test questions, and Decision Log to the actual values.

## B. Create a monday.com workspace and import the files

1. Go to [monday.com](https://monday.com) and sign in or create an account.
2. Create a workspace such as **Skylark Assignment**.
3. Create a new board named **Sales Pipeline** and import `Deal funnel Data.xlsx`.
4. Create a second board named **Project Execution** and import `Work_Order_Tracker Data.xlsx`.
5. Keep the boards available to the API user. Do not delete rows or “clean” the messy values before the app has analyzed them.
6. Copy the board ID from each board URL. It is normally the long number in the URL after `/boards/`.

## C. Create a read-only API connection

1. In monday.com, open the developer/API-token area for your account. The exact menu labels may differ slightly by plan/version.
2. Create a personal or integration API token tied to a user who can read only these two boards where possible.
3. Keep the token private. **Do not paste it into this chat, GitHub, screenshots, README, or a public file.**

You will later add these private values in Vercel:

```text
MONDAY_API_TOKEN = your private monday token
MONDAY_SALES_BOARD_ID = Sales Pipeline board number
MONDAY_WORK_ORDERS_BOARD_ID = Project Execution board number
```

## D. LLM key (recommended)

The app works deterministically for standard questions without an LLM key, but an LLM key makes natural-language interpretation and executive narrative stronger.

Use an OpenAI-compatible endpoint if you have one:

```text
LLM_API_KEY = private key
LLM_BASE_URL = https://api.openai.com/v1
LLM_MODEL = your selected model name
```

Do not paste that key in chat either.

## E. Deploy through Vercel when the repository is ready

1. Create/sign in to [vercel.com](https://vercel.com) with GitHub.
2. Create a new GitHub repository from the supplied project source.
3. In Vercel, choose **Add New → Project**, import the repository, and click **Deploy**.
4. Before deployment, open **Environment Variables** and add the private values from sections C and D.
5. Deploy, open the public URL in an incognito browser, and test the suggested questions.
6. Leave the deployment and monday boards accessible until the evaluation is complete.

## What to send me next

- The two `.xlsx` files, attached in chat.
- After importing them: the two board IDs (safe to share) and a screenshot or copy of the column headings if needed.
- Do **not** send any API token or LLM key in chat.

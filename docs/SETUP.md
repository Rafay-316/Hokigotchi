# Local setup

## Requirements

- The complete existing `Budgeting-app` repository, including its `web/package.json`.
- Node.js 24 for the supplied native TypeScript tests.
- A configured Nessie sandbox customer for balance requests.
- A Supabase project for cloud accounts and rankings.

The submission package supplies presentation materials and the new Chaos folder. It is an addition to the existing application, not a replacement for its package files.

## Start the app

From PowerShell:

```powershell
cd "C:\Users\mrafa\OneDrive\Desktop\Budgeting-app-1\web"
npm.cmd install
npm.cmd run dev -- --port 3000
```

Keep that terminal running and open `http://localhost:3000`. Open `http://localhost:3000/chaos` for the separate encounter. The new route does not add a home-page navigation item automatically.

## Environment

Keep the existing `web/.env.local` on your computer. The variable names are:

```dotenv
NESSIE_API_KEY=your_nessie_api_key
NESSIE_BASE_URL=https://prod-api.nessieisreal.com
NESSIE_CUSTOMER_ID=your_sandbox_customer_id
NEXT_PUBLIC_SUPABASE_URL=https://your_project_ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_server_secret_key
```

The first two Supabase values support browser authentication. `SUPABASE_SECRET_KEY` stays on the server. Keep your existing `.env*` ignore rule. This documentation contains placeholders only.

## Supabase database

For a new setup, apply the complete migration at `web/supabase/migrations/202609200001_hokigotchi.sql` in the project's SQL Editor. It creates the Hokigotchi tables and restricted functions. The corrected migration supports re-running the same setup without deleting player data. Do not change a working project just to prepare the presentation.

## Email-code login

Enable email sign-in and configure the SMTP provider in Supabase. In the email templates used for sign-in and signup confirmation, use the code token rather than relying on a browser link:

```html
<h2>Your Hokigotchi sign-in code</h2>
<p>Enter this code in the Hokigotchi window where you requested it:</p>
<p style="font-size:32px;font-weight:bold;">{{ .Token }}</p>
<p>If you did not request this code, ignore this email.</p>
```

Save the relevant templates. Request a new code from the app and enter it in the same app window. Existing delivered messages do not change when a template changes.

SMTP host, username, and password must all belong to the same provider. For an already working project, leave its settings as they are during the demo.

## Verification

With the development server running, use a second terminal in `web`:

```powershell
node scripts/check-cloud.mjs
```

This creates temporary test accounts, checks the API/database behavior, and deletes the test accounts. It does not test actual email delivery. Also verify that a real email code signs in, a saved action survives reload, and the opted-in nickname appears in the league.

## If time is short

Use the existing signed-in app for the main demo. Download and double-click `docs/demo/Hokigotchi-Chaos-Offline.html` for a reliable sample encounter without any server. It does not sign in, change cloud progress, or load live sandbox balances.

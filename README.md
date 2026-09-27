# Flux — Personal Cloud Storage (Supabase Edition)

A private personal cloud storage web app powered by **Supabase Authentication**, **Supabase PostgreSQL Database**, and **Supabase Cloud Storage**.

100% Free with **no credit card required**!

---

## Architecture Overview

- **Authentication**: Supabase Auth (GoTrue JWT, Email/Password, secure session handling, native password resets).
- **Database**: Supabase PostgreSQL (Relational schema with cascade deletes, RLS policies, indexing).
- **File Storage**: Supabase Storage bucket (`flux-files`, 1 GB free cloud storage) with safe local disk fallback.
- **Backend API**: Node.js Express server verifying Supabase JWTs via `@supabase/supabase-js`.
- **Frontend SPA**: React 18 + Vite using `@supabase/supabase-js`.

---

## Step-by-Step Supabase Setup Guide

Follow these quick steps in the [Supabase Dashboard](https://supabase.com/dashboard):

### Step 1: Create a Free Project
1. Go to **[https://supabase.com/dashboard](https://supabase.com/dashboard)** and sign in with GitHub or your email.
2. Click **New project**.
3. Choose your Organization.
4. **Name**: `flux`
5. **Database Password**: Set a strong password (and save it).
6. **Region**: Select a region closest to you (e.g. `South Asia (Mumbai)` or `US East`).
7. Click **Create new project**. *(Takes ~1-2 minutes to provision).*

---

### Step 2: Create Database Tables with 1-Click SQL
1. In your Supabase project left sidebar, click the **SQL Editor** icon (`>_` or SQL).
2. Click **New query**.
3. Open [`supabase_schema.sql`](file:///c:/Users/mayur/OneDrive/Desktop/flux/supabase_schema.sql) in your project root, copy the entire code, and paste it into the Supabase SQL editor.
4. Click the green **Run** button.
   *(This automatically creates the `folders`, `files`, `settings`, and `activity_logs` tables, sets up Row Level Security policies, and inserts your default folders: "Software", "Operating System", "Codebase / Projects").*

---

### Step 3: (Optional) Create a Storage Bucket
1. In the left sidebar, click **Storage**.
2. Click **New bucket**.
3. Bucket name: **`flux-files`**.
4. Toggle **Public bucket** to **ON** (or leave private; both work).
5. Click **Save bucket**.

---

### Step 4: Copy API Credentials
1. In the left sidebar, click **Project Settings** (the ⚙️ gear icon at the bottom).
2. Click on the **API** tab.
3. You will see:
   - **Project URL** (e.g., `https://abcdefghijklm.supabase.co`)
   - **anon / public** key (`eyJh...`)
   - **service_role** secret key (`eyJh...`)

4. Open [`backend/.env`](file:///c:/Users/mayur/OneDrive/Desktop/flux/backend/.env) and update:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```

5. Open [`frontend/.env`](file:///c:/Users/mayur/OneDrive/Desktop/flux/frontend/.env) and update:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

---

### Step 5: Create Your Owner Account
1. In the Supabase left sidebar, click **Authentication** (the 👥 users icon).
2. Under the **Users** tab, click **Add user** → **Create user**:
   - **Email**: Enter your desired email (e.g. `owner@flux.local` or your personal email).
   - **Password**: Enter your password.
   - Toggle **Auto Confirm User?** to **YES** (so you can log in immediately without email confirmation).
   - Click **Create user**.

---

## Running the Application

From the root `flux/` directory:

### Option A: Unified Full Application (Single Server)
```bash
# 1. Build frontend
npm run build

# 2. Start unified full app
npm start
```
Open **http://localhost:5000** in your browser.

---

### Option B: Live Development Mode (Concurrent)
```bash
npm run dev
```
Open **http://localhost:5173** (with instant hot-reloading) or **http://localhost:5000** (backend API).
Log in with the user email and password you created in Step 5!

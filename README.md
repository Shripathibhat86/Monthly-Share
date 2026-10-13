# Monthly Share - Shared Expense Management Tracker

A full-stack, responsive monthly expense sharing and settlement management web application designed for housemates, roommates, and small teams. Built with React (Vite + Tailwind CSS), Node.js (Express), and dual-database support for **Neon Serverless PostgreSQL** and **Local SQLite**.

---

## 🚀 Features

- **Split Methods**:
  - Equal split across all or selected members
  - Exact amount allocation
  - Percentage-based allocation
  - Share-based split
- **Smart Settlement Engine**:
  - Automatically calculates net balances per member for each month
  - Greedy debt-simplification algorithm minimizing total transaction count
  - Record payment references, completion timestamps, and settlement status
- **Dashboard & Analytics**:
  - Monthly and yearly expense breakdown by category
  - Member spending distribution and net settlement status
  - Interactive charts powered by Recharts
- **Receipt Management**:
  - Attach images or documents to expense entries
- **PIN-Protected Member Actions**:
  - PIN authorization for member management, editing, and backup restoration
- **Data Backup & Restore**:
  - One-click JSON backup export and restore
- **Dual Database Architecture**:
  - **Local Development**: Built-in zero-config SQLite (`data/expenses.db`)
  - **Production / Cloud**: Neon Serverless PostgreSQL via `DATABASE_URL`

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Node.js (ES Modules), Express
- **Database**: Neon DB (`pg`) for cloud / `node:sqlite` for local
- **Deployment**: Vercel ready (Serverless Functions via `vercel.json` & `/api`)

---

## 💻 Local Development

### 1. Prerequisites
- Node.js 18+ or 20+
- npm

### 2. Installation
Install root dependencies and client dependencies:
```bash
npm install
npm --prefix client install
```

### 3. Environment Variables (Optional for local)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
If `DATABASE_URL` is left blank, the app automatically initializes a local SQLite database in `data/expenses.db` with default members.

### 4. Running Locally
Run the server (port 3002) and Vite frontend (port 5173) concurrently:
```bash
# Terminal 1: Run Backend Server
npm start

# Terminal 2: Run Client Dev Server
npm run client
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🌐 Deploying to Vercel

### Step 1: Push Repository to GitHub
Ensure your latest changes are pushed to your GitHub repository:
```bash
git push -u origin main
```

### Step 2: Set up Neon Database (PostgreSQL)
1. Go to [Neon.tech](https://neon.tech) and create a free PostgreSQL project.
2. Copy your connection string:
   ```
   postgresql://user:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
   ```

### Step 3: Deploy on Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository: `Monthly-Share`.
4. Under **Environment Variables**, add:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string.
5. Click **Deploy**.

Vercel will automatically:
- Run the build command (`npm --prefix client install && npm --prefix client run build`)
- Serve frontend static assets from `client/dist`
- Route `/api/*` requests to the serverless function `/api/index.js`
- Auto-create tables and seed initial users on first visit!

---

## 📄 License
MIT

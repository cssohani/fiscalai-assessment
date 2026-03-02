## Running the Project

### Prerequisites

- Node.js 18+ (recommended)
- npm

---

### 1. Clone the repository

```bash
git clone <REPO_URL>
cd fiscalai_assessment
```

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Start the development server

```bash
npm run dev
```

Open your browser and navigate to:

http://localhost:3000

The application should run immediately.

---

## Data Availability

This repository includes all required financial data under:

- data/extracted/
- data/compiled/
- data/normalized/

Because the normalized 10-year datasets are already committed, no additional scripts need to be run to view the application.

Regenerating data is not required to run the application, but the full data pipeline is included for transparency and reproducibility.

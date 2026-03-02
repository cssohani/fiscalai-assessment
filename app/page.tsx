import { COMPANIES, loadNormalized, type Company } from "../src/lib/normalization/loadNormalized";
import CompanyTabsTable from "./ui/CompanyTabsTable";

export const dynamic = "force-dynamic";

export default async function FinancialsPage() {
  const all = await Promise.all(COMPANIES.map((c) => loadNormalized(c as Company)));
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">10 Year Financials</h1>
        
      </div>

      <CompanyTabsTable data={all} />
    </div>
  );
}
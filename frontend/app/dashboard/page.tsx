import { Activity, TrendingUp, Users2 } from 'lucide-react';

import { KpiCard } from './components/kpi-card';

/**
 * Dashboard home — template stub. Replace the placeholder cards with your
 * project's KPIs, activity feed, and quick actions.
 */
export default function DashboardPage() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <KpiCard label="Metric one" value="—" icon={Users2} />
                <KpiCard label="Metric two" value="—" icon={TrendingUp} />
                <KpiCard label="Metric three" value="—" icon={Activity} />
            </div>
        </div>
    );
}

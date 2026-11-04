import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Empty, Panel } from './ui';
import { money } from '../lib/finance';

const tick = { fill: '#7b8796', fontSize: 11 };
const tooltip = {
  border: '1px solid #e4eaf0',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 8px 24px #102a4310',
};
const shortDay = (value) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
export function ActivityChart({ trend }) {
  return (
    <Panel title="Transaction activity" subtitle="Credits and debits by posting date · INR">
      <div
        className="chart"
        role="img"
        aria-label="Daily credit and debit amounts. Exact totals are shown in the KPI cards and transaction table."
      >
        {!trend.length ? (
          <Empty title="Your activity will appear here">
            Charts use posted transactions from your API.
          </Empty>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 20, right: 12, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="credit-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3369d6" stopOpacity={0.17} />
                  <stop offset="100%" stopColor="#3369d6" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf1f5" />
              <XAxis
                dataKey="day"
                tickFormatter={shortDay}
                tick={tick}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
              />
              <YAxis
                tick={tick}
                axisLine={false}
                tickLine={false}
                width={62}
                tickFormatter={(value) =>
                  Intl.NumberFormat('en', { notation: 'compact' }).format(value)
                }
              />
              <Tooltip
                contentStyle={tooltip}
                formatter={(value, name) => [money(value), name]}
                labelFormatter={shortDay}
              />
              <Legend
                iconType="circle"
                iconSize={7}
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                name="Credits"
                dataKey="credit"
                stroke="#3369d6"
                strokeWidth={2.5}
                fill="url(#credit-fill)"
                dot={trend.length === 1}
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                name="Debits"
                dataKey="debit"
                stroke="#18a38e"
                strokeWidth={2}
                fill="#18a38e"
                fillOpacity={0.03}
                dot={trend.length === 1}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
export function RiskChart({ risk, pending }) {
  const total = risk.reduce((sum, row) => sum + row.value, 0);
  return (
    <Panel title="Risk distribution" subtitle="Completed assessments in the selected period">
      <div className="risk-chart">
        <div
          className="donut"
          role="img"
          aria-label={risk.map((row) => `${row.name}: ${row.value}`).join(', ')}
        >
          {total ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={risk}
                    dataKey="value"
                    innerRadius="70%"
                    outerRadius="90%"
                    paddingAngle={total > 1 ? 4 : 0}
                    cornerRadius={4}
                    stroke="none"
                  >
                    {risk.map((row) => (
                      <Cell key={row.name} fill={row.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-label">
                <strong>{total.toLocaleString()}</strong>
                <span>assessed</span>
              </div>
            </>
          ) : (
            <Empty title="No assessments yet">Refresh after detection runs.</Empty>
          )}
        </div>
        <div className="risk-legend">
          {risk.map((row) => (
            <div key={row.name}>
              <span>
                <i style={{ background: row.color }} />
                {row.name}
              </span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
        {pending > 0 && (
          <p className="chart-note">
            {pending} transaction{pending === 1 ? '' : 's'} awaiting assessment. Refresh to check.
          </p>
        )}
      </div>
    </Panel>
  );
}
export function VolumeChart({ trend }) {
  return (
    <Panel title="Transaction volume" subtitle="Number of postings per day · UTC">
      <div className="chart" role="img" aria-label="Daily posted transaction count">
        {!trend.length ? (
          <Empty title="No volume to display">
            Post a transaction to start building your activity history.
          </Empty>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 20, right: 15, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="#edf1f5" />
              <XAxis
                dataKey="day"
                tickFormatter={shortDay}
                tick={tick}
                axisLine={false}
                tickLine={false}
                minTickGap={25}
              />
              <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltip} labelFormatter={shortDay} />
              <Bar
                isAnimationActive={false}
                dataKey="count"
                name="Transactions"
                fill="#436fc5"
                maxBarSize={38}
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

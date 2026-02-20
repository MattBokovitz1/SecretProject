"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { useEffect, useCallback } from "react";

// Redux hooks and actions
import { useAppSelector, useAppDispatch } from "../store/hooks";
import { fetchNFLStats, setSelectedMetric, setTeam1, setTeam2 } from "../store/nflStatsSlice";

// Selectors — each one reads or derives a specific piece of state
import {
  selectDefenseData,
  selectLoading,
  selectError,
  selectSelectedMetric,
  selectTeam1,
  selectTeam2,
  selectSortedData,
  selectLogoMap,
  selectRadarData,
  selectTableData,
} from "../store/selectors";

// Custom Y-axis tick that renders team logo + abbreviation
interface CustomTickProps {
  x?: string | number;
  y?: string | number;
  payload?: { value: string };
  logoMap: Map<string, string>;
}

function CustomYAxisTick({ x = 0, y = 0, payload, logoMap }: CustomTickProps) {
  if (!payload) return null;
  const teamAbbr = payload.value;
  const logoUrl = logoMap.get(teamAbbr);
  const nx = Number(x);
  const ny = Number(y);

  return (
    <g transform={`translate(${nx},${ny})`}>
      {logoUrl && (
        <image
          href={logoUrl}
          x={-50}
          y={-10}
          width={20}
          height={20}
          style={{ objectFit: "contain" }}
        />
      )}
      <text
        x={-26}
        y={0}
        dy={4}
        textAnchor="start"
        fill="#a1a1aa"
        fontSize={11}
        fontWeight={600}
      >
        {teamAbbr}
      </text>
    </g>
  );
}

type MetricKey = "pointsAllowed" | "yardsAllowed" | "sacks" | "interceptions" | "dvoa";

const metrics: { key: MetricKey; label: string; color: string; gradient: [string, string] }[] = [
  { key: "pointsAllowed", label: "Points Allowed/Game", color: "#f87171", gradient: ["#ef4444", "#dc2626"] },
  { key: "yardsAllowed", label: "Yards Allowed/Game", color: "#60a5fa", gradient: ["#3b82f6", "#2563eb"] },
  { key: "sacks", label: "Sacks", color: "#34d399", gradient: ["#10b981", "#059669"] },
  { key: "interceptions", label: "Interceptions", color: "#c084fc", gradient: ["#a855f7", "#7c3aed"] },
  { key: "dvoa", label: "Efficiency Rating", color: "#fbbf24", gradient: ["#f59e0b", "#d97706"] },
];

export default function NFLDefenseChart() {
  // ── Read from Redux store via selectors ──
  const defenseData    = useAppSelector(selectDefenseData);
  const loading        = useAppSelector(selectLoading);
  const error          = useAppSelector(selectError);
  const selectedMetric = useAppSelector(selectSelectedMetric);
  const team1          = useAppSelector(selectTeam1);
  const team2          = useAppSelector(selectTeam2);
  const sortedData     = useAppSelector(selectSortedData);     // memoized
  const logoMap        = useAppSelector(selectLogoMap);         // memoized
  const radarData      = useAppSelector(selectRadarData);       // memoized
  const tableData      = useAppSelector(selectTableData);       // memoized

  // ── Dispatch function ──
  const dispatch = useAppDispatch();

  // ── Fetch data on mount ──
  // dispatch(fetchNFLStats()) kicks off the async thunk.
  // The slice's extraReducers handle pending → fulfilled/rejected transitions.
  useEffect(() => {
    dispatch(fetchNFLStats());
  }, [dispatch]);

  // Current metric config object
  const currentMetric = metrics.find((m) => m.key === selectedMetric)!;

  // Memoised tick so Recharts gets a stable reference
  // Only re-create when the underlying data identity changes (not on metric switch)
  const renderYTick = useCallback(
    (props: { x?: string | number; y?: string | number; payload?: { value: string } }) => (
      <CustomYAxisTick {...props} logoMap={logoMap} />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defenseData],
  );

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center py-32">
          <div className="relative">
            <div className="h-14 w-14 rounded-full border-2 border-zinc-800"></div>
            <div className="absolute inset-0 h-14 w-14 animate-spin rounded-full border-2 border-transparent border-t-blue-500"></div>
          </div>
          <p className="mt-6 text-sm font-medium tracking-wide text-zinc-500 uppercase">Loading defensive statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center py-20 glass-card">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <p className="text-red-400 text-lg font-semibold">Error loading data</p>
          <p className="mt-2 text-zinc-500 text-sm">{error}</p>
          <button
            onClick={() => dispatch(fetchNFLStats())}
            className="mt-6 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-all duration-200 shadow-lg shadow-blue-600/20"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="text-center pt-4 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-widest uppercase mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></span>
          Live Data
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3">
          NFL Defense <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Analytics</span>
        </h1>
        <p className="text-zinc-500 text-base max-w-md mx-auto">
          Defensive statistics for all 32 teams — powered by ESPN
        </p>
      </div>

      {/* Metric Selector */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-1 rounded-full bg-gradient-to-b from-blue-500 to-cyan-500"></div>
          <h2 className="text-lg font-semibold text-white">
            Select Metric
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {metrics.map((metric) => (
            <button
              key={metric.key}
              onClick={() => dispatch(setSelectedMetric(metric.key))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedMetric === metric.key
                  ? "text-white shadow-lg scale-[1.02]"
                  : "bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-zinc-200"
              }`}
              style={
                selectedMetric === metric.key
                  ? { background: `linear-gradient(135deg, ${metric.gradient[0]}, ${metric.gradient[1]})`, boxShadow: `0 4px 20px ${metric.color}33` }
                  : {}
              }
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Bar Chart */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-8 w-1 rounded-full" style={{ background: `linear-gradient(to bottom, ${currentMetric.gradient[0]}, ${currentMetric.gradient[1]})` }}></div>
          <h2 className="text-lg font-semibold text-white">
            {currentMetric.label} <span className="text-zinc-500 font-normal">— All 32 Teams</span>
          </h2>
        </div>
        <div className="h-[1100px]" key={selectedMetric}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
              <YAxis
                dataKey="team"
                type="category"
                width={55}
                tick={renderYTick}
                tickLine={false}
                interval={0}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 15, 25, 0.95)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                  color: "#e4e4e7",
                  backdropFilter: "blur(12px)",
                }}
                formatter={(value) => [Number(Number(value).toFixed(1)), currentMetric.label]}
                labelFormatter={(label) => {
                  const team = sortedData.find(t => t.team === label);
                  return team?.fullName || label;
                }}
              />
              <Legend wrapperStyle={{ color: '#a1a1aa' }} />
              <Bar
                dataKey={selectedMetric}
                fill={currentMetric.color}
                radius={[0, 4, 4, 0]}
                name={currentMetric.label}
                fillOpacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Team Comparison Radar Chart */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-8 w-1 rounded-full bg-gradient-to-b from-purple-500 to-pink-500"></div>
          <h2 className="text-lg font-semibold text-white">
            Team Comparison
          </h2>
        </div>
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase text-zinc-500 mb-2">
              Team 1
            </label>
            <select
              value={team1}
              onChange={(e) => dispatch(setTeam1(e.target.value))}
              className="px-4 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
            >
              {defenseData.map((team) => (
                <option key={team.team} value={team.team} className="bg-zinc-900 text-white">
                  {team.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <span className="text-zinc-600 text-sm font-medium">vs</span>
          </div>
          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase text-zinc-500 mb-2">
              Team 2
            </label>
            <select
              value={team2}
              onChange={(e) => dispatch(setTeam2(e.target.value))}
              className="px-4 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
            >
              {defenseData.map((team) => (
                <option key={team.team} value={team.team} className="bg-zinc-900 text-white">
                  {team.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="stat" tick={{ fontSize: 12, fill: '#a1a1aa' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 10 }} />
              <Radar
                name={defenseData.find((t) => t.team === team1)?.fullName}
                dataKey={team1}
                stroke="#60a5fa"
                fill="#3b82f6"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Radar
                name={defenseData.find((t) => t.team === team2)?.fullName}
                dataKey={team2}
                stroke="#f87171"
                fill="#ef4444"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Legend wrapperStyle={{ color: '#a1a1aa' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 15, 25, 0.95)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                  color: "#e4e4e7",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-zinc-600 mt-4 text-center">
          Higher values indicate better defensive performance (normalized to 0-100 scale)
        </p>
      </div>

      {/* Stats Table */}
      <div className="glass-card p-5 overflow-x-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-8 w-1 rounded-full bg-gradient-to-b from-amber-500 to-orange-500"></div>
          <h2 className="text-lg font-semibold text-white">
            Full Statistics
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left py-3 px-3 text-xs font-semibold tracking-wider uppercase text-zinc-500">
                #
              </th>
              <th className="text-left py-3 px-3 text-xs font-semibold tracking-wider uppercase text-zinc-500">
                Team
              </th>
              <th className="text-center py-3 px-3 text-xs font-semibold tracking-wider uppercase text-zinc-500">
                Pts/G
              </th>
              <th className="text-center py-3 px-3 text-xs font-semibold tracking-wider uppercase text-zinc-500">
                Yds/G
              </th>
              <th className="text-center py-3 px-3 text-xs font-semibold tracking-wider uppercase text-zinc-500">
                Pass Yds
              </th>
              <th className="text-center py-3 px-3 text-xs font-semibold tracking-wider uppercase text-zinc-500">
                Rush Yds
              </th>
              <th className="text-center py-3 px-3 text-xs font-semibold tracking-wider uppercase text-zinc-500">
                Sacks
              </th>
              <th className="text-center py-3 px-3 text-xs font-semibold tracking-wider uppercase text-zinc-500">
                INT
              </th>
              <th className="text-center py-3 px-3 text-xs font-semibold tracking-wider uppercase text-zinc-500">
                FF
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((team, index) => (
                <tr
                  key={team.team}
                  className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors group"
                >
                  <td className="py-3 px-3 text-zinc-600 tabular-nums">
                    {index + 1}
                  </td>
                  <td className="py-3 px-3 font-medium text-zinc-200 group-hover:text-white transition-colors">
                    <div className="flex items-center gap-2.5">
                      {team.logo && (
                        <img src={team.logo} alt={team.team} className="w-6 h-6 object-contain" />
                      )}
                      <span>{team.fullName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center text-zinc-400 tabular-nums">
                    {team.pointsAllowed.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-center text-zinc-400 tabular-nums">
                    {team.yardsAllowed.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-center text-zinc-400 tabular-nums">
                    {team.passYardsAllowed.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-center text-zinc-400 tabular-nums">
                    {team.rushYardsAllowed.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-center text-zinc-400 tabular-nums">
                    {team.sacks}
                  </td>
                  <td className="py-3 px-3 text-center text-zinc-400 tabular-nums">
                    {team.interceptions}
                  </td>
                  <td className="py-3 px-3 text-center text-zinc-400 tabular-nums">
                    {team.fumbles}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

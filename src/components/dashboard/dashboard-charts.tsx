"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompanyBreakdown, StatusDistribution } from "@/lib/types";

const PALETTE = [
  "#2c6d55",
  "#6f9d86",
  "#a3bfae",
  "#8a958f",
  "#1f5944",
  "#b8904f",
  "#4d8a72",
  "#c1744e",
  "#6e7672",
  "#9c4a42",
  "#c3cbc7",
  "#3c8267",
];

const STATUS_COLORS: Record<string, string> = {
  not_contacted: "#8a958f",
  message_drafted: "#a3bfae",
  message_sent: "#6f9d86",
  awaiting_reply: "#b8904f",
  replied: "#4d8a72",
  follow_up_needed: "#c1744e",
  interview_discussion: "#3c8267",
  shortlisted: "#2c6d55",
  selected_offer: "#1f5944",
  rejected: "#9c4a42",
  not_interested: "#6e7672",
  archived: "#c3cbc7",
};

function statusColor(status: string, index: number) {
  return STATUS_COLORS[status] ?? PALETTE[index % PALETTE.length];
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

export function StatusDistributionChart({ data }: { data: StatusDistribution[] }) {
  if (data.length === 0) {
    return <ChartEmpty message="No outreach yet. Add a contact to start building your pipeline." />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius={54}
              outerRadius={84}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={entry.status} fill={statusColor(entry.status, index)} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid max-h-[220px] grid-cols-1 gap-1.5 overflow-y-auto pr-1 text-sm">
        {data.map((entry, index) => (
          <li key={entry.status} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: statusColor(entry.status, index) }}
            />
            <span className="flex-1 truncate text-muted-foreground">{entry.label}</span>
            <span className="font-medium">{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompanyBreakdownChart({ data }: { data: CompanyBreakdown[] }) {
  if (data.length === 0) {
    return <ChartEmpty message="No companies with contacts yet." />;
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="companyName"
            width={120}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar dataKey="contactCount" name="Contacts" fill="#2c6d55" radius={[0, 4, 4, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

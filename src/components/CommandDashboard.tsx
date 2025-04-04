import React, { useEffect, useState } from 'react';
import { commandAnalytics } from '../lib/command-analytics';
import { Line } from 'react-chartjs-2';

interface DashboardStats {
  totalCommands: number;
  successRate: number;
  averageResponseTime: number;
  commonFailures: Array<{command: string; count: number}>;
  offlineUsage: number;
}

export const CommandDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeframe, setTimeframe] = useState<number>(7 * 24 * 60 * 60 * 1000); // 7 days

  useEffect(() => {
    const updateStats = () => {
      const newStats = commandAnalytics.getStats(timeframe);
      setStats(newStats);
    };

    updateStats();
    const interval = setInterval(updateStats, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [timeframe]);

  if (!stats) return null;

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Voice Command Analytics</h2>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(Number(e.target.value))}
          className="p-2 border rounded"
        >
          <option value={24 * 60 * 60 * 1000}>Last 24 Hours</option>
          <option value={7 * 24 * 60 * 60 * 1000}>Last 7 Days</option>
          <option value={30 * 24 * 60 * 60 * 1000}>Last 30 Days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Commands"
          value={stats.totalCommands}
          icon="📊"
        />
        <StatCard
          title="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          icon="✅"
        />
        <StatCard
          title="Avg Response Time"
          value={`${stats.averageResponseTime.toFixed(2)}ms`}
          icon="⚡"
        />
        <StatCard
          title="Offline Usage"
          value={stats.offlineUsage}
          icon="📱"
        />
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Common Issues</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          {stats.commonFailures.length > 0 ? (
            <ul className="space-y-2">
              {stats.commonFailures.map((failure, index) => (
                <li key={index} className="flex justify-between items-center">
                  <span className="text-red-600">{failure.command}</span>
                  <span className="text-gray-600">{failure.count} failures</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">No common issues detected</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Voice Settings</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="mb-4">
            <p className="text-gray-700">Voice: OpenAI (Default)</p>
            <p className="text-gray-700">Voice Model: alloy</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: string;
}> = ({ title, value, icon }) => (
  <div className="bg-gray-50 p-4 rounded-lg">
    <div className="flex items-center mb-2">
      <span className="text-2xl mr-2">{icon}</span>
      <h4 className="text-gray-600">{title}</h4>
    </div>
    <p className="text-2xl font-bold text-gray-800">{value}</p>
  </div>
);

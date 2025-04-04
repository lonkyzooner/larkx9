import React, { useState, useEffect } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { commandAnalytics } from '../lib/command-analytics';
import { commandLearning } from '../lib/command-learning';
import { commandContext } from '../lib/command-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Mic,
  Brain,
  BarChart,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  WifiOff
} from 'lucide-react';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: '#8e8e93'
      }
    }
  },
  scales: {
    y: {
      grid: {
        color: 'rgba(44, 44, 46, 0.5)'
      },
      ticks: {
        color: '#8e8e93'
      }
    },
    x: {
      grid: {
        color: 'rgba(44, 44, 46, 0.5)'
      },
      ticks: {
        color: '#8e8e93'
      }
    }
  }
};

export const AdvancedDashboard: React.FC = () => {
  const [timeframe, setTimeframe] = useState<number>(24 * 60 * 60 * 1000); // 24 hours
  const [stats, setStats] = useState(commandAnalytics.getStats(timeframe));
  const [learningStats, setLearningStats] = useState(commandLearning.getStats());

  useEffect(() => {
    const updateStats = () => {
      setStats(commandAnalytics.getStats(timeframe));
      setLearningStats(commandLearning.getStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 30000);
    return () => clearInterval(interval);
  }, [timeframe]);

  const successRateData = {
    labels: ['Success', 'Failure'],
    datasets: [{
      data: [stats.successRate, 100 - stats.successRate],
      backgroundColor: ['#30d158', '#ff453a'],
      borderColor: ['#28b44c', '#e63c32'],
      borderWidth: 1
    }]
  };

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: 'up' | 'down';
    status?: 'success' | 'warning' | 'error';
  }> = ({ title, value, icon, trend, status = 'success' }) => (
    <div className="bg-[#1c1c1e] rounded-xl p-4 border border-[#2c2c2e] shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#8e8e93] text-sm">{title}</span>
        <span className={`
          ${status === 'success' ? 'text-[#30d158]' : ''}
          ${status === 'warning' ? 'text-[#f8c53a]' : ''}
          ${status === 'error' ? 'text-[#ff453a]' : ''}
        `}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  );

  return (
    <div className="bg-[#1c1c1e]/95 backdrop-blur-xl rounded-2xl border border-[#2c2c2e] shadow-[0_0_25px_rgba(0,0,0,0.3)] p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-white">Command Analytics</h2>
          <p className="text-[#8e8e93] text-sm">Real-time voice command performance</p>
        </div>
        
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(Number(e.target.value))}
          className="bg-[#2c2c2e] text-white px-3 py-2 rounded-lg border border-[#3a3a3c] focus:outline-none focus:ring-2 focus:ring-[#0a84ff]"
        >
          <option value={60 * 60 * 1000}>Last Hour</option>
          <option value={24 * 60 * 60 * 1000}>Last 24 Hours</option>
          <option value={7 * 24 * 60 * 60 * 1000}>Last 7 Days</option>
        </select>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6 bg-[#2c2c2e] rounded-xl p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#3a3a3c]">
            <BarChart className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="voice" className="data-[state=active]:bg-[#3a3a3c]">
            <Mic className="w-4 h-4 mr-2" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="learning" className="data-[state=active]:bg-[#3a3a3c]">
            <Brain className="w-4 h-4 mr-2" />
            Learning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Commands"
              value={stats.totalCommands}
              icon={<Activity className="w-5 h-5" />}
              status="success"
            />
            <StatCard
              title="Success Rate"
              value={`${Math.round(stats.successRate)}%`}
              icon={<CheckCircle2 className="w-5 h-5" />}
              status={stats.successRate > 90 ? 'success' : stats.successRate > 70 ? 'warning' : 'error'}
            />
            <StatCard
              title="Avg Response"
              value={`${Math.round(stats.averageResponseTime)}ms`}
              icon={<Clock className="w-5 h-5" />}
              status={stats.averageResponseTime < 500 ? 'success' : 'warning'}
            />
            <StatCard
              title="Offline Usage"
              value={stats.offlineUsage}
              icon={stats.offlineUsage > 0 ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
              status={stats.offlineUsage > 0 ? 'warning' : 'success'}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-[#2c2c2e] rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Success Rate</h3>
              <div className="h-64">
                <Doughnut data={successRateData} options={chartOptions} />
              </div>
            </div>
            
            <div className="bg-[#2c2c2e] rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Common Issues</h3>
              <div className="space-y-3">
                {stats.commonFailures.map((failure, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-[#3a3a3c] rounded-lg">
                    <div className="flex-1">
                      <p className="text-[#ff453a] truncate">{failure.command}</p>
                      <p className="text-sm text-[#8e8e93]">{failure.count} failures</p>
                    </div>
                    <Badge variant="destructive">
                      {((failure.count / stats.totalCommands) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="voice">
          <div className="bg-[#2c2c2e] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Voice Configuration</h3>
              <Badge className="bg-[#0a84ff]">OpenAI Voice</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#3a3a3c] rounded-xl">
                <p className="text-[#8e8e93] mb-1">Voice</p>
                <p className="font-mono text-white">alloy</p>
              </div>
              <div className="p-4 bg-[#3a3a3c] rounded-xl">
                <p className="text-[#8e8e93] mb-1">Language</p>
                <p className="text-white capitalize">{commandContext.getLanguagePreference()}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="learning">
          <div className="space-y-6">
            <div className="bg-[#2c2c2e] p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Learning Progress</h3>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <Badge className="bg-[#30d158] text-white">
                    {learningStats.learningProgress}% Complete
                  </Badge>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-[#3a3a3c]">
                  <div
                    style={{ width: `${learningStats.learningProgress}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#30d158]"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#2c2c2e] p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Command Patterns</h3>
              <div className="space-y-3">
                {learningStats.commonPatterns.map((pattern, index) => (
                  <div key={index} className="p-4 bg-[#3a3a3c] rounded-xl">
                    <p className="font-mono text-[#0a84ff] mb-2">{pattern.pattern}</p>
                    <div className="flex flex-wrap gap-2">
                      {pattern.replacements.map((replacement, i) => (
                        <Badge key={i} variant="outline" className="bg-[#2c2c2e]">
                          {replacement}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

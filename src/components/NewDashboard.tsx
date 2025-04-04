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
        color: '#E0E0E0'
      }
    }
  },
  scales: {
    y: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)'
      },
      ticks: {
        color: '#E0E0E0'
      }
    },
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)'
      },
      ticks: {
        color: '#E0E0E0'
      }
    }
  }
};

export const NewDashboard: React.FC = () => {
  const [timeframe, setTimeframe] = useState<number>(24 * 60 * 60 * 1000); // 24 hours
  const [stats, setStats] = useState(commandAnalytics.getStats(timeframe));
  const [learningStats, setLearningStats] = useState(commandLearning.getStats());
  const [activeTab, setActiveTab] = useState<'overview' | 'voice' | 'learning'>('overview');

  useEffect(() => {
    const updateStats = () => {
      setStats(commandAnalytics.getStats(timeframe));
      setLearningStats(commandLearning.getStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timeframe]);

  const performanceData = {
    labels: stats.performanceOverTime.map(p => new Date(p.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Success Rate',
        data: stats.performanceOverTime.map(p => p.successRate),
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        tension: 0.4
      },
      {
        label: 'Voice Accuracy',
        data: stats.performanceOverTime.map(p => p.accuracy),
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        tension: 0.4
      }
    ]
  };

  const successRateData = {
    labels: ['Success', 'Failure'],
    datasets: [{
      data: [stats.successRate, 100 - stats.successRate],
      backgroundColor: ['#4CAF50', '#f44336'],
      borderColor: ['#388E3C', '#D32F2F'],
      borderWidth: 1
    }]
  };

  const CommandTypeCard: React.FC<{
    title: string;
    count: number;
    icon: string;
    color: string;
  }> = ({ title, count, icon, color }) => (
    <div className="bg-gray-800 rounded-lg p-4 flex items-center">
      <div className={`text-2xl mr-3 ${color}`}>{icon}</div>
      <div>
        <h4 className="text-gray-400 text-sm">{title}</h4>
        <p className="text-white text-xl font-bold">{count}</p>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">L.A.R.K Command Center</h2>
        <div className="flex gap-4">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(Number(e.target.value))}
            className="bg-gray-800 text-white px-3 py-1 rounded border border-gray-700"
          >
            <option value={60 * 60 * 1000}>Last Hour</option>
            <option value={24 * 60 * 60 * 1000}>Last 24 Hours</option>
            <option value={7 * 24 * 60 * 60 * 1000}>Last 7 Days</option>
          </select>
          <div className="flex rounded-lg bg-gray-800">
            {(['overview', 'voice', 'learning'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1 ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                } rounded-lg transition-colors`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <CommandTypeCard
              title="Total Commands"
              count={stats.totalCommands}
              icon="📊"
              color="text-blue-400"
            />
            <CommandTypeCard
              title="Voice Accuracy"
              count={Math.round(stats.voiceRecognitionAccuracy * 100)}
              icon="🎙️"
              color="text-purple-400"
            />
            <CommandTypeCard
              title="Avg Response (ms)"
              count={Math.round(stats.averageResponseTime)}
              icon="⚡"
              color="text-yellow-400"
            />
            <CommandTypeCard
              title="Suggestion Rate"
              count={Math.round(stats.predictiveMetrics.suggestionAcceptanceRate * 100)}
              icon="🎯"
              color="text-green-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Performance Trends</h3>
              <div className="h-64">
                <Line data={performanceData} options={chartOptions} />
              </div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Command Type Distribution</h3>
              <div className="space-y-3">
                {Object.entries(stats.commandTypeBreakdown).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-blue-400 capitalize">{type.replace('_', ' ')}</p>
                      <p className="text-sm text-gray-400">{count} commands</p>
                    </div>
                    <div className="ml-2 px-2 py-1 bg-blue-900/50 rounded-full text-xs">
                      {((count / stats.totalCommands) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Top Command Suggestions</h3>
              <div className="space-y-3">
                {stats.predictiveMetrics.topSuggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-green-400">{suggestion.command}</p>
                      <p className="text-sm text-gray-400">{suggestion.useCount} uses</p>
                    </div>
                    <div className="ml-2 px-2 py-1 bg-green-900/50 rounded-full text-xs">
                      {((suggestion.useCount / stats.totalCommands) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Common Issues</h3>
              <div className="space-y-3">
                {stats.commonFailures.map((failure, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-red-400 truncate">{failure.command}</p>
                      <p className="text-sm text-gray-400">{failure.count} failures</p>
                    </div>
                    <div className="ml-2 px-2 py-1 bg-red-900/50 rounded-full text-xs">
                      {((failure.count / stats.totalCommands) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'voice' && (
        <div className="space-y-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Voice Configuration</h3>
              <div className="px-3 py-1 bg-blue-600 rounded-full text-sm">
                OpenAI Voice
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-700 rounded">
                <p className="text-gray-400">Voice Model</p>
                <p className="text-white font-mono text-sm mt-1">alloy</p>
              </div>
              <div className="p-3 bg-gray-700 rounded">
                <p className="text-gray-400">Recognition Accuracy</p>
                <p className="text-white font-mono text-sm mt-1">
                  {(stats.voiceRecognitionAccuracy * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Voice Recognition Trends</h3>
            <div className="h-64">
              <Line 
                data={{
                  labels: stats.performanceOverTime.map(p => new Date(p.timestamp).toLocaleTimeString()),
                  datasets: [{
                    label: 'Recognition Accuracy',
                    data: stats.performanceOverTime.map(p => p.accuracy * 100),
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4
                  }]
                }} 
                options={chartOptions} 
              />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Command Processing</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-700 rounded">
                <p className="text-gray-400">Avg Response Time</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {Math.round(stats.averageResponseTime)}ms
                </p>
              </div>
              <div className="p-3 bg-gray-700 rounded">
                <p className="text-gray-400">Success Rate</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {Math.round(stats.successRate)}%
                </p>
              </div>
              <div className="p-3 bg-gray-700 rounded">
                <p className="text-gray-400">Offline Usage</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {Math.round((stats.offlineUsage / stats.totalCommands) * 100)}%
                </p>
              </div>
            </div>
          </div>
        </div>

      )}

      {activeTab === 'learning' && (
        <div className="space-y-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Learning Progress</h3>
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-green-900 text-green-300">
                    {learningStats.learningProgress}% Complete
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-700">
                <div
                  style={{ width: `${learningStats.learningProgress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Common Command Patterns</h3>
            <div className="space-y-3">
              {learningStats.commonPatterns.map((pattern, index) => (
                <div key={index} className="p-3 bg-gray-700 rounded">
                  <p className="font-mono text-blue-400">{pattern.pattern}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pattern.replacements.map((replacement, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-600 rounded text-sm">
                        {replacement}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

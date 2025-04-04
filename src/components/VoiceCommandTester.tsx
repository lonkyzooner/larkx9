import React, { useState, useEffect } from 'react';
import { useVoiceFeedback } from '../hooks/useVoiceFeedback';
import { commandAnalytics } from '../lib/command-analytics';
import { commandLearning } from '../lib/command-learning';
import { processVoiceCommand } from '../lib/openai-service';

interface TestCase {
  command: string;
  expectedAction: string;
  parameters?: Record<string, string>;
}

const DEFAULT_TEST_CASES: TestCase[] = [
  {
    command: "Read Miranda rights in Spanish",
    expectedAction: "miranda",
    parameters: { language: "spanish" }
  },
  {
    command: "Check statute 14:30",
    expectedAction: "statute",
    parameters: { statute: "14:30" }
  },
  {
    command: "Assess threat level at current location",
    expectedAction: "threat",
    parameters: { location: "current" }
  }
];

export const VoiceCommandTester: React.FC = () => {
  const [testCases, setTestCases] = useState<TestCase[]>(DEFAULT_TEST_CASES);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [customCommand, setCustomCommand] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const { generateAudioFeedback } = useVoiceFeedback();

  const runTest = async (command: string, expectedAction: string, parameters?: Record<string, string>) => {
    try {
      const startTime = Date.now();
      const response = await processVoiceCommand(command);
      const responseTime = Date.now() - startTime;

      const success = response.action === expectedAction &&
        (!parameters || Object.entries(parameters).every(([key, value]) => 
          response.parameters?.[key] === value
        ));

      // Record analytics
      commandAnalytics.recordCommand({
        command,
        success,
        responseTime,
        confidence: success ? 1.0 : 0.0,
        offline: false
      });

      // If test failed, add to learning system
      if (!success) {
        const correctedCommand = testCases.find(tc => 
          tc.expectedAction === expectedAction &&
          JSON.stringify(tc.parameters) === JSON.stringify(parameters)
        )?.command;

        if (correctedCommand) {
          commandLearning.addCorrection(command, correctedCommand);
        }
      }

      return success;
    } catch (error) {
      console.error('Test failed:', error);
      return false;
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    const newResults: Record<string, boolean> = {};

    // Use Josh voice to announce test start
    await generateAudioFeedback('processing', 'Starting voice command tests');

    for (const testCase of testCases) {
      const success = await runTest(
        testCase.command,
        testCase.expectedAction,
        testCase.parameters
      );
      newResults[testCase.command] = success;
    }

    setResults(newResults);
    setIsRunning(false);

    // Announce test completion with Josh voice
    const successCount = Object.values(newResults).filter(Boolean).length;
    await generateAudioFeedback(
      'success',
      `Testing complete. ${successCount} out of ${testCases.length} tests passed.`
    );
  };

  const addCustomTest = () => {
    if (customCommand.trim()) {
      setTestCases([...testCases, {
        command: customCommand,
        expectedAction: 'general_query'
      }]);
      setCustomCommand('');
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Voice Command Testing</h2>
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className={`px-4 py-2 rounded ${
            isRunning 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>
      </div>

      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={customCommand}
            onChange={(e) => setCustomCommand(e.target.value)}
            placeholder="Add custom test command..."
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={addCustomTest}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Add Test
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {testCases.map((testCase, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              results[testCase.command] === undefined
                ? 'bg-gray-50'
                : results[testCase.command]
                ? 'bg-green-50'
                : 'bg-red-50'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">{testCase.command}</p>
                <p className="text-sm text-gray-600">
                  Expected: {testCase.expectedAction}
                  {testCase.parameters && 
                    ` (${Object.entries(testCase.parameters)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ')})`
                  }
                </p>
              </div>
              {results[testCase.command] !== undefined && (
                <span className={`px-2 py-1 rounded ${
                  results[testCase.command]
                    ? 'bg-green-200 text-green-800'
                    : 'bg-red-200 text-red-800'
                }`}>
                  {results[testCase.command] ? 'Pass' : 'Fail'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(results).length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Test Summary</h3>
          <p>
            Passed: {Object.values(results).filter(Boolean).length} / {testCases.length}
            ({Math.round((Object.values(results).filter(Boolean).length / testCases.length) * 100)}%)
          </p>
        </div>
      )}
    </div>
  );
};

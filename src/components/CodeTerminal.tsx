/**
 * CodeTerminal — In-browser terminal panel for the coding platform.
 *
 * Features:
 *   - Run / Stop button
 *   - Tabbed output: Console | Test Cases
 *   - stdin input field
 *   - Auto-scroll output
 *   - Syntax-highlighted error lines
 *   - Test case pass/fail indicators
 *   - Execution time display
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  executeCode,
  runTestCases,
  isExecutable,
  type ExecutionResult,
  type TestCaseResult,
} from "../lib/browser-compiler";
import type { CodingLanguage } from "../lib/coding-test";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CodeTerminalProps {
  code: string;
  language: CodingLanguage;
  testCases?: { input: string; expectedOutput: string }[];
  /** If true, shows a loading message while Pyodide loads */
  className?: string;
}

type TermTab = "console" | "testcases";

interface ConsoleEntry {
  type: "stdout" | "stderr" | "info" | "system";
  text: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CodeTerminal({ code, language, testCases = [], className = "" }: CodeTerminalProps) {
  const [activeTab, setActiveTab] = useState<TermTab>("console");
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stdin, setStdin] = useState("");
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const executable = isExecutable(language);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [entries, testResults]);

  const addEntry = useCallback((type: ConsoleEntry["type"], text: string) => {
    setEntries((prev) => [...prev, { type, text, timestamp: Date.now() }]);
  }, []);

  // ---- Run code ----
  const handleRun = useCallback(async () => {
    if (isRunning || !code.trim()) return;
    setIsRunning(true);
    setEntries([]);
    setLastDuration(null);

    addEntry("system", `$ Running ${language}...`);

    const result: ExecutionResult = await executeCode(code, language, stdin);
    setLastDuration(result.duration);

    if (result.stdout) addEntry("stdout", result.stdout);
    if (result.stderr) addEntry("stderr", result.stderr);

    if (result.exitCode === 0 && !result.stdout && !result.stderr) {
      addEntry("info", "(Program finished with no output)");
    }

    addEntry(
      "system",
      `\nProcess exited with code ${result.exitCode} (${result.duration.toFixed(0)}ms)`,
    );

    setIsRunning(false);
  }, [code, language, stdin, isRunning, addEntry]);

  // ---- Run test cases ----
  const handleRunTests = useCallback(async () => {
    if (isRunning || !code.trim() || testCases.length === 0) return;
    setIsRunning(true);
    setTestResults([]);
    setActiveTab("testcases");

    const results = await runTestCases(code, language, testCases);
    setTestResults(results);
    setLastDuration(results.reduce((acc, r) => acc + r.duration, 0));
    setIsRunning(false);
  }, [code, language, testCases, isRunning]);

  // ---- Clear ----
  const handleClear = useCallback(() => {
    setEntries([]);
    setTestResults([]);
    setLastDuration(null);
  }, []);

  const passCount = testResults.filter((r) => r.passed).length;

  return (
    <div className={`term ${className}`}>
      {/* ---- Header ---- */}
      <div className="term__header">
        <div className="term__tabs">
          <button
            className={`term__tab ${activeTab === "console" ? "term__tab--active" : ""}`}
            onClick={() => setActiveTab("console")}
          >
            <ConsoleIcon /> Console
          </button>
          {testCases.length > 0 && (
            <button
              className={`term__tab ${activeTab === "testcases" ? "term__tab--active" : ""}`}
              onClick={() => setActiveTab("testcases")}
            >
              <TestIcon /> Test Cases
              {testResults.length > 0 && (
                <span className={`term__badge ${passCount === testResults.length ? "term__badge--pass" : "term__badge--fail"}`}>
                  {passCount}/{testResults.length}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="term__actions">
          {lastDuration !== null && (
            <span className="term__duration">{lastDuration.toFixed(0)}ms</span>
          )}
          <button
            className="term__btn term__btn--clear"
            onClick={handleClear}
            title="Clear output"
            disabled={isRunning}
          >
            <ClearIcon />
          </button>
          {testCases.length > 0 && (
            <button
              className="term__btn term__btn--test"
              onClick={() => void handleRunTests()}
              disabled={isRunning || !executable || !code.trim()}
              title={executable ? "Run all test cases" : `Test execution not available for ${language}`}
            >
              {isRunning && activeTab === "testcases" ? <SpinnerIcon /> : <TestIcon />}
              Run Tests
            </button>
          )}
          <button
            className="term__btn term__btn--run"
            onClick={() => void handleRun()}
            disabled={isRunning || !code.trim()}
            title={executable ? "Run code" : `Browser execution not available for ${language}. Supported: JS, TS, Python`}
          >
            {isRunning && activeTab === "console" ? <SpinnerIcon /> : <PlayIcon />}
            {isRunning && activeTab === "console" ? "Running..." : "Run"}
          </button>
        </div>
      </div>

      {/* ---- Stdin bar ---- */}
      {executable && (
        <div className="term__stdin">
          <label className="term__stdin-label">stdin</label>
          <input
            className="term__stdin-input"
            type="text"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Enter input (newline-separated)..."
            disabled={isRunning}
          />
        </div>
      )}

      {/* ---- Output area ---- */}
      <div className="term__output" ref={outputRef}>
        {activeTab === "console" && (
          <>
            {entries.length === 0 && !isRunning && (
              <div className="term__empty">
                {executable ? (
                  <>
                    <PlayIcon />
                    <span>Click <strong>Run</strong> to execute your code</span>
                  </>
                ) : (
                  <>
                    <InfoIcon />
                    <span>
                      Browser execution supports <strong>JavaScript</strong>, <strong>TypeScript</strong>, and <strong>Python</strong>.
                      <br />
                      You can still write {language} code and submit for AI evaluation.
                    </span>
                  </>
                )}
              </div>
            )}
            {entries.map((entry, i) => (
              <div key={i} className={`term__line term__line--${entry.type}`}>
                <pre>{entry.text}</pre>
              </div>
            ))}
            {isRunning && activeTab === "console" && (
              <div className="term__line term__line--info">
                <span className="term__spinner-inline" /> Executing...
              </div>
            )}
          </>
        )}

        {activeTab === "testcases" && (
          <>
            {testResults.length === 0 && !isRunning && (
              <div className="term__empty">
                <TestIcon />
                <span>Click <strong>Run Tests</strong> to execute against test cases</span>
              </div>
            )}
            {isRunning && activeTab === "testcases" && testResults.length === 0 && (
              <div className="term__line term__line--info">
                <span className="term__spinner-inline" /> Running {testCases.length} test cases...
              </div>
            )}
            {testResults.map((result, i) => (
              <div
                key={i}
                className={`term__test-case ${result.passed ? "term__test-case--pass" : "term__test-case--fail"}`}
              >
                <div className="term__tc-header">
                  <span className={`term__tc-icon ${result.passed ? "term__tc-icon--pass" : "term__tc-icon--fail"}`}>
                    {result.passed ? <CheckIcon /> : <XIcon />}
                  </span>
                  <span className="term__tc-label">Test Case {i + 1}</span>
                  <span className="term__tc-time">{result.duration.toFixed(0)}ms</span>
                </div>
                <div className="term__tc-body">
                  <div className="term__tc-row">
                    <span className="term__tc-key">Input:</span>
                    <code className="term__tc-val">{result.input || "(none)"}</code>
                  </div>
                  <div className="term__tc-row">
                    <span className="term__tc-key">Expected:</span>
                    <code className="term__tc-val">{result.expectedOutput || "(none)"}</code>
                  </div>
                  <div className="term__tc-row">
                    <span className="term__tc-key">Actual:</span>
                    <code className={`term__tc-val ${result.passed ? "" : "term__tc-val--wrong"}`}>
                      {result.actualOutput || "(no output)"}
                    </code>
                  </div>
                </div>
              </div>
            ))}
            {testResults.length > 0 && (
              <div className="term__tc-summary">
                <span className={passCount === testResults.length ? "term__tc-summary--pass" : "term__tc-summary--fail"}>
                  {passCount === testResults.length
                    ? `All ${testResults.length} test cases passed!`
                    : `${passCount}/${testResults.length} test cases passed`}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// SVG Icons
// ===========================================================================

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function ConsoleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function TestIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="term__spinner-svg">
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

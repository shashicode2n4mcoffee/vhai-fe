/**
 * Browser Compiler — In-browser code execution engine.
 *
 * Supports:
 *   - JavaScript  → sandboxed iframe execution
 *   - TypeScript  → transpile (TypeScript compiler via CDN) → sandboxed iframe
 *   - Python      → Pyodide (CPython compiled to WASM)
 *   - Others      → basic syntax check / dry-run message
 *
 * All execution is local — no backend, no network calls (except lazy-loading
 * the Pyodide runtime or TS compiler on first use).
 */

import type { CodingLanguage } from "./coding-test";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number; // ms
  error?: string;
}

export interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  duration: number;
}

// Languages that support direct browser execution
const EXECUTABLE_LANGUAGES = new Set<CodingLanguage>([
  "javascript",
  "typescript",
  "python",
]);

export function isExecutable(language: CodingLanguage): boolean {
  return EXECUTABLE_LANGUAGES.has(language);
}

// ---------------------------------------------------------------------------
// Main entry — run code
// ---------------------------------------------------------------------------

export async function executeCode(
  code: string,
  language: CodingLanguage,
  stdin: string = "",
  timeoutMs: number = 10_000,
): Promise<ExecutionResult> {
  const start = performance.now();

  try {
    switch (language) {
      case "javascript":
        return await executeJavaScript(code, stdin, timeoutMs);
      case "typescript":
        return await executeTypeScript(code, stdin, timeoutMs);
      case "python":
        return await executePython(code, stdin, timeoutMs);
      default:
        return {
          stdout: "",
          stderr: `Browser execution is not available for ${language}.\nSupported: JavaScript, TypeScript, Python.\n\nYou can still write and submit code for AI evaluation.`,
          exitCode: 1,
          duration: performance.now() - start,
        };
    }
  } catch (err) {
    return {
      stdout: "",
      stderr: err instanceof Error ? err.message : String(err),
      exitCode: 1,
      duration: performance.now() - start,
      error: "Execution failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Run test cases
// ---------------------------------------------------------------------------

export async function runTestCases(
  code: string,
  language: CodingLanguage,
  testCases: { input: string; expectedOutput: string }[],
  timeoutMs: number = 10_000,
): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];

  for (const tc of testCases) {
    const result = await executeCode(code, language, tc.input, timeoutMs);
    const actual = result.stdout.trim();
    const expected = tc.expectedOutput.trim();
    results.push({
      input: tc.input,
      expectedOutput: expected,
      actualOutput: result.stderr ? `${actual}\n[Error] ${result.stderr}` : actual,
      passed: result.exitCode === 0 && actual === expected,
      duration: result.duration,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// JavaScript — sandboxed iframe execution
// ---------------------------------------------------------------------------

function executeJavaScript(
  code: string,
  stdin: string,
  timeoutMs: number,
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.sandbox.add("allow-scripts");
    document.body.appendChild(iframe);

    let settled = false;
    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      window.removeEventListener("message", handler);
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve({
          stdout: "",
          stderr: `Execution timed out after ${timeoutMs}ms`,
          exitCode: 124,
          duration: timeoutMs,
          error: "Timeout",
        });
      }
    }, timeoutMs);

    function handler(event: MessageEvent) {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (data?.type === "__exec_result__") {
        settled = true;
        cleanup();
        resolve({
          stdout: data.stdout ?? "",
          stderr: data.stderr ?? "",
          exitCode: data.error ? 1 : 0,
          duration: performance.now() - start,
          error: data.error || undefined,
        });
      }
    }

    window.addEventListener("message", handler);

    // Build the sandboxed script.
    // We override console methods and capture output.
    const escapedCode = code
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$/g, "\\$");
    const escapedStdin = stdin
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$/g, "\\$");

    iframe.srcdoc = `<!DOCTYPE html><html><head><script>
(function() {
  const _stdout = [];
  const _stderr = [];
  const _stdin = \`${escapedStdin}\`.split("\\n");
  let _stdinIdx = 0;

  // Override console
  console.log = function(...args) { _stdout.push(args.map(String).join(" ")); };
  console.error = function(...args) { _stderr.push(args.map(String).join(" ")); };
  console.warn = function(...args) { _stderr.push("[warn] " + args.map(String).join(" ")); };
  console.info = function(...args) { _stdout.push(args.map(String).join(" ")); };

  // Provide readline/prompt for simple I/O
  self.prompt = function() { return _stdinIdx < _stdin.length ? _stdin[_stdinIdx++] : null; };
  self.readline = self.prompt;

  try {
    const _result = (function() {
      ${code}
    })();
    // If the function returns a value, print it
    if (_result !== undefined) _stdout.push(String(_result));
    parent.postMessage({ type: "__exec_result__", stdout: _stdout.join("\\n"), stderr: _stderr.join("\\n") }, "*");
  } catch(e) {
    parent.postMessage({ type: "__exec_result__", stdout: _stdout.join("\\n"), stderr: _stderr.join("\\n") + "\\n" + String(e), error: String(e) }, "*");
  }
})();
<\/script></head></html>`;
  });
}

// ---------------------------------------------------------------------------
// TypeScript — transpile then execute as JS
// ---------------------------------------------------------------------------

// Lazy-loaded TS compiler reference
let tsCompilerPromise: Promise<typeof import("typescript")> | null = null;

async function loadTypeScriptCompiler(): Promise<typeof import("typescript")> {
  if (tsCompilerPromise) return tsCompilerPromise;
  tsCompilerPromise = new Promise<typeof import("typescript")>(
    (resolve, reject) => {
      // Check if already loaded
      if ((window as unknown as Record<string, unknown>).ts) {
        resolve((window as unknown as Record<string, unknown>).ts as typeof import("typescript"));
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/typescript@5.4.5/lib/typescript.min.js";
      script.onload = () => {
        const ts = (window as unknown as Record<string, unknown>).ts as typeof import("typescript");
        if (ts) resolve(ts);
        else reject(new Error("TypeScript compiler failed to load"));
      };
      script.onerror = () => reject(new Error("Failed to load TypeScript compiler from CDN"));
      document.head.appendChild(script);
    },
  );
  return tsCompilerPromise;
}

async function executeTypeScript(
  code: string,
  stdin: string,
  timeoutMs: number,
): Promise<ExecutionResult> {
  const start = performance.now();

  // Load TypeScript compiler
  const ts = await loadTypeScriptCompiler();

  // Transpile TS → JS
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      strict: false,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: false,
    },
    reportDiagnostics: true,
  });

  // Check for transpilation errors
  if (transpiled.diagnostics && transpiled.diagnostics.length > 0) {
    const errors = transpiled.diagnostics
      .map((d) => {
        const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
        return d.file && d.start !== undefined
          ? `Line ${d.file.getLineAndCharacterOfPosition(d.start).line + 1}: ${msg}`
          : msg;
      })
      .join("\n");
    return {
      stdout: "",
      stderr: `TypeScript Compilation Errors:\n${errors}`,
      exitCode: 1,
      duration: performance.now() - start,
      error: "Compilation failed",
    };
  }

  // Execute transpiled JS
  return executeJavaScript(transpiled.outputText, stdin, timeoutMs);
}

// ---------------------------------------------------------------------------
// Python — Pyodide (CPython → WASM)
// ---------------------------------------------------------------------------

// Lazy-loaded Pyodide reference
let pyodidePromise: Promise<PyodideInterface> | null = null;

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>;
  runPython: (code: string) => unknown;
  globals: { get: (key: string) => unknown };
}

export function isPyodideLoading(): boolean {
  return pyodidePromise !== null;
}

async function loadPyodideRuntime(): Promise<PyodideInterface> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = new Promise<PyodideInterface>((resolve, reject) => {
    // Check if already loaded
    if ((window as unknown as Record<string, unknown>).loadPyodide) {
      (
        (window as unknown as Record<string, unknown>)
          .loadPyodide as () => Promise<PyodideInterface>
      )()
        .then(resolve)
        .catch(reject);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
    script.onload = () => {
      const loadPyodide = (window as unknown as Record<string, unknown>)
        .loadPyodide as (config?: unknown) => Promise<PyodideInterface>;
      if (loadPyodide) {
        loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/" })
          .then(resolve)
          .catch(reject);
      } else {
        reject(new Error("Pyodide loader failed to initialize"));
      }
    };
    script.onerror = () => {
      pyodidePromise = null;
      reject(new Error("Failed to load Pyodide from CDN"));
    };
    document.head.appendChild(script);
  });
  return pyodidePromise;
}

/** Callback for progress updates during Pyodide loading */
let pyodideLoadCallback: ((msg: string) => void) | null = null;

export function onPyodideLoad(cb: (msg: string) => void): void {
  pyodideLoadCallback = cb;
}

async function executePython(
  code: string,
  stdin: string,
  timeoutMs: number,
): Promise<ExecutionResult> {
  const start = performance.now();

  // Load Pyodide (shows progress on first load)
  if (pyodideLoadCallback && !pyodidePromise) {
    pyodideLoadCallback("Loading Python runtime (first time may take a few seconds)...");
  }

  let pyodide: PyodideInterface;
  try {
    pyodide = await loadPyodideRuntime();
  } catch (err) {
    return {
      stdout: "",
      stderr: `Failed to load Python runtime: ${err instanceof Error ? err.message : String(err)}`,
      exitCode: 1,
      duration: performance.now() - start,
      error: "Runtime load failed",
    };
  }

  // Reset I/O
  const stdinLines = stdin
    .split("\n")
    .map((l) => l.replace(/'/g, "\\'"))
    .join("\\n");

  const setup = `
import sys
from io import StringIO

sys.stdout = StringIO()
sys.stderr = StringIO()

_stdin_data = '${stdinLines}'.split('\\n')
_stdin_idx = [0]

def _mock_input(prompt=''):
    if _stdin_idx[0] < len(_stdin_data):
        val = _stdin_data[_stdin_idx[0]]
        _stdin_idx[0] += 1
        return val
    return ''

__builtins__['input'] = _mock_input
`;

  try {
    pyodide.runPython(setup);

    // Run with timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs),
    );

    await Promise.race([pyodide.runPythonAsync(code), timeoutPromise]);

    const stdout = String(pyodide.runPython("sys.stdout.getvalue()"));
    const stderr = String(pyodide.runPython("sys.stderr.getvalue()"));

    return {
      stdout,
      stderr,
      exitCode: stderr ? 1 : 0,
      duration: performance.now() - start,
    };
  } catch (err) {
    // Try to capture partial output
    let stdout = "";
    let stderr = "";
    try {
      stdout = String(pyodide.runPython("sys.stdout.getvalue()"));
      stderr = String(pyodide.runPython("sys.stderr.getvalue()"));
    } catch { /* ignore */ }

    const errorMsg = err instanceof Error ? err.message : String(err);
    // Clean up Python traceback for readability
    const cleanError = errorMsg
      .replace(/PythonError: Traceback \(most recent call last\):\n\s+File "<exec>",\s*/g, "")
      .replace(/\n\s*File "<exec>",\s*/g, "\n");

    return {
      stdout,
      stderr: stderr ? `${stderr}\n${cleanError}` : cleanError,
      exitCode: 1,
      duration: performance.now() - start,
      error: cleanError,
    };
  }
}

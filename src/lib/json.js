// Shared JSON helpers. Every converter returns { output, notes } and throws Error with a readable message.

const stripBom = (text) => text.replace(/^﻿/, "");

export function clean(text) {
  const out = stripBom(text);
  if (!out.trim()) throw new Error("The input is empty.");
  return out;
}

const longIntegerNotes = (unsafe) => (unsafe ? [`${unsafe} integer(s) too long for exact numeric handling were kept as text.`] : []);

function parseCounting(text) {
  let unsafe = 0;
  const data = JSON.parse(text, (_key, value, context) => {
    if (typeof value === "number" && !Number.isSafeInteger(value) && /^-?\d+$/.test(context?.source ?? "")) {
      unsafe += 1;
      return context.source;
    }
    return value;
  });
  return { data, unsafe };
}

/** JSON.parse that keeps integers too long for JavaScript as text instead of silently rounding them. */
export function parseJson(text) {
  const source = clean(text);
  try {
    const { data, unsafe } = parseCounting(source);
    return { data, notes: longIntegerNotes(unsafe) };
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

/** Reads one JSON value, or JSON Lines (one value per line) when the whole text isn't a single value. */
export function parseJsonOrLines(text) {
  try {
    return parseJson(text);
  } catch (original) {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((line, i) => [line.trim(), i + 1]).filter(([line]) => line);
    if (lines.length < 2) throw original;
    try {
      JSON.parse(lines[0][0]);
    } catch {
      throw original; // an ordinary multi-line document with a syntax error
    }
    let unsafe = 0;
    const data = lines.map(([line, number]) => {
      try {
        const parsed = parseCounting(line);
        unsafe += parsed.unsafe;
        return parsed.data;
      } catch (error) {
        // The engine counts within the one line it was given, so its own "line 1" would mislead here.
        throw new Error(`Invalid JSON Lines on line ${number}: ${error.message.replace(/ at position \d+ \(line \d+ column (\d+)\)/, " at column $1")}`);
      }
    });
    return { data, notes: [`Read as JSON Lines: ${data.length} values, one per line.`, ...longIntegerNotes(unsafe)] };
  }
}

/** { a: { b: [1] } } becomes { "a.b.0": 1 }. */
export function flatten(value, prefix = "", out = {}) {
  if (value !== null && typeof value === "object") {
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value);
    if (!entries.length && prefix) out[prefix] = Array.isArray(value) ? "[]" : "{}";
    for (const [key, item] of entries) flatten(item, prefix ? `${prefix}.${key}` : key, out);
  } else {
    out[prefix] = value;
  }
  return out;
}

/** The reverse of flatten for dotted keys; numeric parts become array positions. */
export function unflatten(flat) {
  const root = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split(".");
    if (parts.some((part) => !part || part === "__proto__")) {
      root[path] = value;
      continue;
    }
    let node = root;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        node[part] = value;
      } else {
        if (typeof node[part] !== "object" || node[part] === null) node[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
        node = node[part];
      }
    });
  }
  return root;
}

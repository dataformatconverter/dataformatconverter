import Papa from "papaparse";
import { clean, flatten, parseJsonOrLines, unflatten } from "./json.js";

const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

/** Numbers that survive a round trip: no leading zeros, no more digits than a double holds exactly. */
export function looksNumeric(text) {
  return NUMBER.test(text) && text.replace(/[-.]/g, "").length <= 15;
}

export const count = (n, word) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

function coerce(text) {
  if (text === "true") return true;
  if (text === "false") return false;
  return looksNumeric(text) ? Number(text) : text;
}

function cell(value, nested) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return nested(value);
  return String(value);
}

export function jsonToCsv(text, { delimiter = ",", flatten: flat = true, escapeFormulae = false, bom = false } = {}) {
  const { data, notes } = parseJsonOrLines(text);
  const items = Array.isArray(data) ? data : [data];
  if (!items.length) throw new Error("The JSON array is empty, so there are no rows to write.");

  let fields = [];
  let rows;
  if (items.every(Array.isArray)) {
    rows = items.map((row) => row.map((v) => cell(v, JSON.stringify)));
    notes.push("The input is an array of arrays, so each inner array became one row with no header.");
  } else {
    const records = items.map((item) => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) return { value: item };
      return flat ? flatten(item) : item;
    });
    const seen = new Set();
    for (const record of records) {
      for (const key of Object.keys(record)) {
        if (!seen.has(key)) {
          seen.add(key);
          fields.push(key);
        }
      }
    }
    rows = records.map((record) => fields.map((field) => cell(record[field], JSON.stringify)));
  }
  const csv = Papa.unparse(fields.length ? { fields, data: rows } : rows, { delimiter, newline: "\n", escapeFormulae });
  const columns = fields.length || rows.reduce((max, row) => Math.max(max, row.length), 0);
  return { output: (bom ? "﻿" : "") + csv, notes, summary: `${count(rows.length, "row")}, ${count(columns, "column")}` };
}

/** Parses CSV text into an array of rows of strings. */
export function parseCsv(text, delimiter = "") {
  const source = clean(text);
  const result = Papa.parse(source, { delimiter: delimiter === "auto" ? "" : delimiter, skipEmptyLines: "greedy" });
  const fatal = result.errors.find((e) => e.type === "Quotes");
  if (fatal) throw new Error(`Invalid CSV on row ${fatal.row + 1}: ${fatal.message}.`);
  if (!result.data.length) throw new Error("No rows were found in the input.");
  return { rows: result.data, delimiter: result.meta.delimiter };
}

function uniqueHeaders(header) {
  const used = new Map();
  return header.map((raw, i) => {
    const name = raw.trim() || `column_${i + 1}`;
    const count = (used.get(name) ?? 0) + 1;
    used.set(name, count);
    return count > 1 ? `${name}_${count}` : name;
  });
}

export function csvToJson(text, { delimiter = "auto", header = true, types = true, nest = false, indent = "2" } = {}) {
  const { rows } = parseCsv(text, delimiter);
  const notes = [];
  const value = (v) => (types ? coerce(v) : v);
  let data;
  if (header) {
    const names = uniqueHeaders(rows[0]);
    if (new Set(rows[0].map((h) => h.trim())).size !== rows[0].length) {
      notes.push("Repeated or blank column names were renamed so that no data is overwritten.");
    }
    let uneven = 0;
    data = rows.slice(1).map((row) => {
      if (row.length !== names.length) uneven += 1;
      const record = {};
      row.forEach((v, i) => {
        record[names[i] ?? `column_${i + 1}`] = value(v);
      });
      names.slice(row.length).forEach((name) => {
        record[name] = null;
      });
      return nest ? unflatten(record) : record;
    });
    if (uneven) notes.push(`${uneven} row(s) had a different number of columns than the header.`);
  } else {
    data = rows.map((row) => row.map(value));
  }
  return { output: JSON.stringify(data, null, Number(indent)), notes, summary: count(data.length, header ? "record" : "row") };
}

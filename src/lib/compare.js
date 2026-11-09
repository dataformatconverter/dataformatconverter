import { parseJson } from "./json.js";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const keyPath = (path, key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`);
const keyPointer = (pointer, key) => `${pointer}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`;

/** Maps each item's ID to its position, or returns null if any item lacks a usable, unique ID. */
function idIndex(items, key) {
  const index = new Map();
  for (const [i, item] of items.entries()) {
    if (!isObject(item) || !Object.hasOwn(item, key)) return null;
    const id = item[key];
    if ((typeof id !== "string" && typeof id !== "number") || index.has(id)) return null;
    index.set(id, i);
  }
  return index;
}

// Entries are in JSON Patch order: an array's removals run from high to low, then changes, then additions,
// so every pointer is still correct at the moment its operation is applied.
function walkArrays(left, right, ctx, path, pointer) {
  const { out, matchKey, ignoreOrder } = ctx;
  const leftIds = matchKey ? idIndex(left, matchKey) : null;
  const rightIds = leftIds && idIndex(right, matchKey);
  if (matchKey && !rightIds && [...left, ...right].some(isObject)) ctx.unmatched = true;

  if (rightIds) {
    const at = (id) => `${path}[${matchKey}=${JSON.stringify(id)}]`;
    const kept = [];
    for (let i = left.length - 1; i >= 0; i -= 1) {
      const id = left[i][matchKey];
      if (rightIds.has(id)) kept.unshift(i);
      else out.push({ kind: "removed", path: at(id), pointer: `${pointer}/${i}`, left: left[i] });
    }
    kept.forEach((i, position) => {
      const id = left[i][matchKey];
      walk(left[i], right[rightIds.get(id)], ctx, at(id), `${pointer}/${position}`);
    });
    for (const item of right) {
      const id = item[matchKey];
      if (!leftIds.has(id)) out.push({ kind: "added", path: at(id), pointer: `${pointer}/-`, right: item });
    }
  } else if (ignoreOrder) {
    const remaining = new Map();
    for (const item of right) {
      const key = canonical(item);
      remaining.set(key, (remaining.get(key) ?? 0) + 1);
    }
    const removed = [];
    left.forEach((item, i) => {
      const key = canonical(item);
      if (remaining.get(key) > 0) remaining.set(key, remaining.get(key) - 1);
      else removed.unshift({ kind: "removed", path: `${path}[${i}]`, pointer: `${pointer}/${i}`, left: item });
    });
    out.push(...removed);
    right.forEach((item, i) => {
      const key = canonical(item);
      if (remaining.get(key) > 0) {
        remaining.set(key, remaining.get(key) - 1);
        out.push({ kind: "added", path: `${path}[${i}]`, pointer: `${pointer}/-`, right: item });
      }
    });
  } else {
    const shared = Math.min(left.length, right.length);
    for (let i = 0; i < shared; i += 1) walk(left[i], right[i], ctx, `${path}[${i}]`, `${pointer}/${i}`);
    for (let i = left.length - 1; i >= shared; i -= 1) out.push({ kind: "removed", path: `${path}[${i}]`, pointer: `${pointer}/${i}`, left: left[i] });
    for (let i = shared; i < right.length; i += 1) out.push({ kind: "added", path: `${path}[${i}]`, pointer: `${pointer}/${i}`, right: right[i] });
  }
}

function walk(left, right, ctx, path, pointer) {
  if (Array.isArray(left) && Array.isArray(right)) {
    walkArrays(left, right, ctx, path, pointer);
  } else if (isObject(left) && isObject(right)) {
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      const at = keyPath(path, key);
      const to = keyPointer(pointer, key);
      if (!Object.hasOwn(right, key)) ctx.out.push({ kind: "removed", path: at, pointer: to, left: left[key] });
      else if (!Object.hasOwn(left, key)) ctx.out.push({ kind: "added", path: at, pointer: to, right: right[key] });
      else walk(left[key], right[key], ctx, at, to);
    }
  } else if (canonical(left) !== canonical(right)) {
    ctx.out.push({ kind: "changed", path, pointer, left, right });
  }
}

export function diffValues(left, right, { ignoreOrder = false, matchKey = "" } = {}) {
  const ctx = { ignoreOrder, matchKey, out: [], unmatched: false };
  walk(left, right, ctx, "$", "");
  return { differences: ctx.out, unmatched: ctx.unmatched };
}

function toPatch(differences) {
  return differences.map((d) => {
    if (d.kind === "removed") return { op: "remove", path: d.pointer };
    return { op: d.kind === "added" ? "add" : "replace", path: d.pointer, value: d.right };
  });
}

export function jsonCompare(leftText, rightText, { format = "list", ignoreOrder = false, matchKey = "" } = {}) {
  let left;
  let right;
  try {
    left = parseJson(leftText);
  } catch (error) {
    throw new Error(`First document: ${error.message}`);
  }
  try {
    right = parseJson(rightText);
  } catch (error) {
    throw new Error(`Second document: ${error.message}`);
  }
  const key = matchKey.trim();
  const { differences, unmatched } = diffValues(left.data, right.data, { ignoreOrder, matchKey: key });
  const notes = [...new Set([...left.notes, ...right.notes])];
  const patch = format === "patch";
  if (patch && notes.length) notes.push("Those long integers appear as quoted text in the patch, so check them before applying it.");
  if (unmatched) notes.push(`Some arrays couldn't be matched by "${key}" because items lack it or repeat it, so they were compared ${ignoreOrder ? "ignoring order" : "by position"}.`);
  if (patch && differences.length && (ignoreOrder || key)) notes.push("The patch adds new array items at the end and doesn't reorder existing ones.");
  const ext = patch ? "json" : undefined;
  if (!differences.length) {
    return { output: patch ? "[]" : "No differences. The two documents are equivalent.", notes, summary: "No differences", ext };
  }

  const count = (kind) => differences.filter((d) => d.kind === kind).length;
  const summary = `${differences.length} difference(s): ${count("added")} added, ${count("removed")} removed, ${count("changed")} changed`;
  if (patch) return { output: JSON.stringify(toPatch(differences), null, 2), notes, summary, ext };

  const show = (v) => JSON.stringify(v);
  const lines = differences.map((d) => {
    if (d.kind === "added") return `+ ${d.path}: ${show(d.right)}`;
    if (d.kind === "removed") return `- ${d.path}: ${show(d.left)}`;
    return `~ ${d.path}: ${show(d.left)} → ${show(d.right)}`;
  });
  return { output: `${summary}\n\n${lines.join("\n")}`, notes, summary };
}

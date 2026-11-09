import assert from "node:assert/strict";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { jsonCompare } from "../src/lib/compare.js";
import { csvToJson, jsonToCsv } from "../src/lib/csv.js";
import { flatten, parseJson, unflatten } from "../src/lib/json.js";
import { csvToXlsx } from "../src/lib/xlsx.js";
import { jsonToXml, xmlToJson } from "../src/lib/xml.js";
import { jsonToYaml, yamlToJson } from "../src/lib/yaml.js";

test("flatten and unflatten round trip", () => {
  const value = { a: { b: [1, { c: 2 }] }, d: "x" };
  assert.deepEqual(flatten(value), { "a.b.0": 1, "a.b.1.c": 2, d: "x" });
  assert.deepEqual(unflatten(flatten(value)), value);
});

test("unflatten can't reach Object.prototype", () => {
  const out = unflatten({ "__proto__.polluted": 1 });
  assert.equal({}.polluted, undefined);
  assert.equal(out["__proto__.polluted"], 1);
});

test("long integers aren't rounded", () => {
  const { data, notes } = parseJson('{"id": 12345678901234567890, "n": 5}');
  assert.equal(data.id, "12345678901234567890");
  assert.equal(data.n, 5);
  assert.equal(notes.length, 1);
});

test("invalid and empty JSON give readable errors", () => {
  assert.throws(() => parseJson("{bad"), /^Error: Invalid JSON/);
  assert.throws(() => parseJson("  "), /empty/);
});

test("json to csv unions columns and flattens", () => {
  const { output } = jsonToCsv('[{"a":1,"b":{"c":"x,y"}},{"a":2,"d":null}]');
  assert.equal(output, 'a,b.c,d\n1,"x,y",\n2,,');
});

test("json to csv without flattening keeps nested JSON in the cell", () => {
  const { output } = jsonToCsv('[{"a":{"b":1}}]', { flatten: false });
  assert.equal(output, 'a\n"{""b"":1}"');
});

test("json to csv handles delimiter, BOM, formulas, single object, primitives and rows", () => {
  assert.equal(jsonToCsv('{"a":1,"b":2}', { delimiter: ";" }).output, "a;b\n1;2");
  assert.ok(jsonToCsv('[{"a":1}]', { bom: true }).output.startsWith("﻿"));
  assert.ok(jsonToCsv('[{"a":"=1+1"}]', { escapeFormulae: true }).output.includes("'=1+1"));
  assert.equal(jsonToCsv("[1,2]").output, "value\n1\n2");
  assert.equal(jsonToCsv('[["a","b"],[1,2]]').output, "a,b\n1,2");
  assert.throws(() => jsonToCsv("[]"), /empty/);
});

test("csv to json infers safe types only", () => {
  const out = JSON.parse(csvToJson("id,zip,ok,price,long\n1,02134,true,1.50,123456789012345678\n").output);
  assert.deepEqual(out, [{ id: 1, zip: "02134", ok: true, price: 1.5, long: "123456789012345678" }]);
  assert.deepEqual(JSON.parse(csvToJson("a\n1\n", { types: false }).output), [{ a: "1" }]);
});

test("csv to json handles quoting, newlines, delimiters, duplicates and uneven rows", () => {
  assert.deepEqual(JSON.parse(csvToJson('a,b\n"x,1","l1\nl2"\n').output), [{ a: "x,1", b: "l1\nl2" }]);
  assert.deepEqual(JSON.parse(csvToJson("a;b\n1;2\n").output), [{ a: 1, b: 2 }]);
  assert.deepEqual(JSON.parse(csvToJson("a\tb\n1\t2\n", { delimiter: "\t" }).output), [{ a: 1, b: 2 }]);
  const dupes = csvToJson("a,a,\n1,2,3\n");
  assert.deepEqual(JSON.parse(dupes.output), [{ a: 1, a_2: 2, column_3: 3 }]);
  assert.equal(dupes.notes.length, 1);
  const uneven = csvToJson("a,b\n1\n1,2,3\n");
  assert.deepEqual(JSON.parse(uneven.output), [{ a: 1, b: null }, { a: 1, b: 2, column_3: 3 }]);
  assert.match(uneven.notes[0], /2 row/);
});

test("csv to json options: no header and nesting", () => {
  assert.deepEqual(JSON.parse(csvToJson("1,2\n", { header: false }).output), [[1, 2]]);
  assert.deepEqual(JSON.parse(csvToJson("a.b,a.c\n1,2\n", { nest: true }).output), [{ a: { b: 1, c: 2 } }]);
});

test("json and csv round trip", () => {
  const source = [{ name: "Ann", age: 30, tags: ["a", "b"] }];
  const csv = jsonToCsv(JSON.stringify(source)).output;
  assert.deepEqual(JSON.parse(csvToJson(csv, { nest: true }).output), source);
});

test("xml to json keeps attributes, repeats and text", () => {
  const xml = '<?xml version="1.0"?><a id="7"><b>1</b><b>007</b><c x="y">t &amp; u</c></a>';
  assert.deepEqual(JSON.parse(xmlToJson(xml).output), {
    a: { "@id": 7, b: [1, "007"], c: { "@x": "y", "#text": "t & u" } },
  });
  assert.deepEqual(JSON.parse(xmlToJson("<a><b>1</b></a>", { types: false }).output), { a: { b: "1" } });
  assert.throws(() => xmlToJson("<a><b></a>"), /Invalid XML on line 1/);
});

test("json to xml wraps, escapes, renames and round trips", () => {
  assert.match(jsonToXml('[{"a":1},{"a":2}]').output, /<root>\s*<item>\s*<a>1<\/a>/);
  assert.match(jsonToXml('{"a":"x<y&z"}').output, /<a>x&lt;y&amp;z<\/a>/);
  const renamed = jsonToXml('{"r":{"1 bad":"v"}}');
  assert.match(renamed.output, /<_1_bad>v<\/_1_bad>/);
  assert.equal(renamed.notes.length, 1);
  assert.match(jsonToXml('{"a":1,"b":2}', { root: "doc" }).output, /<doc>/);
  const source = { a: { "@id": "x", b: ["1", "2"], c: "t" } };
  const back = xmlToJson(jsonToXml(JSON.stringify(source)).output, { types: false });
  assert.deepEqual(JSON.parse(back.output), source);
});

test("yaml to json keeps 1.2 semantics and reports errors", () => {
  assert.deepEqual(JSON.parse(yamlToJson("a: 1\nb: [x, y]\nc: no\nd: 2001-12-14\n").output), {
    a: 1,
    b: ["x", "y"],
    c: "no",
    d: "2001-12-14",
  });
  const multi = yamlToJson("a: 1\n---\nb: 2\n");
  assert.deepEqual(JSON.parse(multi.output), [{ a: 1 }, { b: 2 }]);
  assert.equal(multi.notes.length, 1);
  assert.throws(() => yamlToJson("a: [1\n"), /Invalid YAML on line/);
});

test("json and yaml round trip, keeping key order", () => {
  const source = { z: 1, a: { b: [1, "x", null] }, s: "yes" };
  const yaml = jsonToYaml(JSON.stringify(source)).output;
  assert.ok(yaml.indexOf("z:") < yaml.indexOf("a:"));
  assert.deepEqual(JSON.parse(yamlToJson(yaml).output), source);
});

test("csv to xlsx writes a valid package", () => {
  const { binary, output } = csvToXlsx('name,zip,n\n"A&B",02134,5\n');
  const files = unzipSync(binary);
  assert.ok(files["xl/workbook.xml"] && files["[Content_Types].xml"] && files["xl/styles.xml"]);
  const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  assert.match(sheet, /A&amp;B/);
  assert.match(sheet, /<c r="B2" t="inlineStr"><is><t xml:space="preserve">02134/);
  assert.match(sheet, /<c r="C2"><v>5<\/v><\/c>/);
  assert.match(sheet, /<c r="A1" s="1"/);
  assert.match(output, /name/);
});

function applyPatch(doc, ops) {
  const root = { doc: structuredClone(doc) };
  for (const { op, path, value } of ops) {
    const parts = ["doc", ...path.split("/").slice(1).map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))];
    const key = parts.pop();
    const parent = parts.reduce((node, part) => node[part], root);
    if (Array.isArray(parent)) {
      const at = key === "-" ? parent.length : Number(key);
      if (op === "add") parent.splice(at, 0, value);
      else if (op === "remove") parent.splice(at, 1);
      else parent[at] = value;
    } else if (op === "remove") delete parent[key];
    else parent[key] = value;
  }
  return root.doc;
}
const patched = (a, b, options) => applyPatch(JSON.parse(a), JSON.parse(jsonCompare(a, b, { format: "patch", ...options }).output));

test("json to csv reads JSON Lines", () => {
  const { output, notes } = jsonToCsv('{"a":1}\n\n{"a":2,"b":"x"}\r\n');
  assert.equal(output, "a,b\n1,\n2,x");
  assert.match(notes[0], /JSON Lines: 2 values/);
  assert.equal(jsonToCsv('{"a":1}\n').notes.length, 0);
  assert.throws(() => jsonToCsv('{"a":1}\n{"a":2}\n{"a":\n'), /JSON Lines on line 3/);
  assert.throws(() => jsonToCsv('[\n{"a":1},\n]'), /^Error: Invalid JSON: /);
  assert.match(jsonToCsv('{"id":12345678901234567890}\n{"id":1}').notes[1], /1 integer/);
});

test("json compare matches arrays by key", () => {
  const a = '{"users":[{"id":1,"n":"a"},{"id":2,"n":"b"}]}';
  assert.match(jsonCompare(a, '{"users":[{"id":2,"n":"b"},{"id":1,"n":"a"}]}', { matchKey: "id" }).output, /No differences/);
  const out = jsonCompare(a, '{"users":[{"id":3,"n":"c"},{"id":2,"n":"z"}]}', { matchKey: " id " }).output;
  assert.match(out, /- \$\.users\[id=1\]/);
  assert.match(out, /~ \$\.users\[id=2\]\.n: "b" → "z"/);
  assert.match(out, /\+ \$\.users\[id=3\]/);
  assert.match(jsonCompare('["a",1]', '["a",1]', { matchKey: "id" }).notes.join(), /^$/);
  assert.match(jsonCompare('[{"id":1},{"id":1}]', '[{"id":1}]', { matchKey: "id" }).notes[0], /compared by position/);
});

test("json patch turns the first document into the second", () => {
  for (const [a, b] of [
    ['{"a":1,"b":[1,2,3],"c":{"d":1}}', '{"a":2,"b":[1],"c":{"e":[1]}}'],
    ["[1]", "[1,2,3]"],
    ["[[1,2],[3]]", "[[2],[3,4],[]]"],
    ['{"a/b":1,"m~n":{"x":1}}', '{"a/b":2,"m~n":{"x":2}}'],
    ["[1]", '{"a":1}'],
  ]) {
    assert.deepEqual(patched(a, b), JSON.parse(b));
  }
  const byId = (doc) => doc.sort((x, y) => x.id - y.id);
  const a = '[{"id":1,"v":1},{"id":2,"v":2},{"id":3,"v":3}]';
  const b = '[{"id":4,"v":4},{"id":3,"v":9},{"id":2,"v":2}]';
  assert.deepEqual(byId(patched(a, b, { matchKey: "id" })), byId(JSON.parse(b)));
  assert.deepEqual(patched("[1,2,2,3]", "[3,4,2]", { ignoreOrder: true }).sort(), [2, 3, 4]);
  const empty = jsonCompare("{}", "{}", { format: "patch" });
  assert.equal(empty.output, "[]");
  assert.equal(empty.ext, "json");
});

test("json compare finds changes, ignores key order, optionally array order", () => {
  assert.match(jsonCompare('{"a":1,"b":2}', '{"b":2,"a":1}').output, /No differences/);
  const out = jsonCompare('{"a":1,"b":[1],"x y":0}', '{"a":2,"b":[1,2],"c":3}').output;
  assert.match(out, /~ \$\.a: 1 → 2/);
  assert.match(out, /\+ \$\.b\[1\]: 2/);
  assert.match(out, /\+ \$\.c: 3/);
  assert.match(out, /- \$\["x y"\]: 0/);
  assert.match(jsonCompare("[1,2]", "[2,1]", { ignoreOrder: true }).output, /No differences/);
  assert.match(jsonCompare("[1,2]", "[2,1]").output, /2 difference/);
  assert.match(jsonCompare("[1,1]", "[1]", { ignoreOrder: true }).output, /- \$\[1\]: 1/);
  assert.throws(() => jsonCompare("{", "{}"), /First document/);
  assert.throws(() => jsonCompare("{}", "{"), /Second document/);
});

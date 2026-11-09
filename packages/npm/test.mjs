import assert from "node:assert/strict";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { csvToJson, csvToXlsx, jsonCompare, jsonToCsv, jsonToXml, jsonToYaml, xmlToJson, yamlToJson } from "./index.js";

test("every converter is exported and works", () => {
  assert.equal(jsonToCsv('[{"a":{"b":1}}]').output, "a.b\n1");
  assert.deepEqual(JSON.parse(csvToJson("id,zip\n1,02134\n").output), [{ id: 1, zip: "02134" }]);
  assert.deepEqual(JSON.parse(xmlToJson('<a x="1"><b>2</b></a>').output), { a: { "@x": 1, b: 2 } });
  assert.match(jsonToXml('{"a":1,"b":2}').output, /<root>\s*<a>1<\/a>\s*<b>2<\/b>\s*<\/root>/);
  assert.deepEqual(JSON.parse(yamlToJson("a: 1\n").output), { a: 1 });
  assert.equal(jsonToYaml('{"a":1}').output, "a: 1\n");
});

test("json lines are read automatically", () => {
  assert.equal(jsonToCsv('{"a":1}\n{"a":2}\n').output, "a\n1\n2");
});

test("csvToXlsx returns a readable workbook", () => {
  const { binary } = csvToXlsx("a,b\n1,2\n");
  assert.ok(binary instanceof Uint8Array);
  assert.match(strFromU8(unzipSync(binary)["xl/worksheets/sheet1.xml"]), /<v>1<\/v>/);
});

test("jsonCompare matches by key and outputs patches", () => {
  const a = '[{"id":1,"v":1},{"id":2,"v":2}]';
  const b = '[{"id":2,"v":3},{"id":1,"v":1}]';
  assert.match(jsonCompare(a, b, { matchKey: "id" }).output, /\$\[id=2\]\.v: 2 → 3/);
  assert.deepEqual(JSON.parse(jsonCompare('{"a":1}', '{"a":2}', { format: "patch" }).output), [{ op: "replace", path: "/a", value: 2 }]);
});

test("invalid input throws a readable error", () => {
  assert.throws(() => jsonToCsv("{"), /Invalid JSON/);
  assert.throws(() => xmlToJson("<a>"), /Invalid XML/);
});

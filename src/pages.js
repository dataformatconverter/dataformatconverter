// Content for every tool page. Example outputs are generated at build time by the real converters.

const DELIMITER_IN = {
  type: "select",
  name: "delimiter",
  label: "Delimiter",
  value: "auto",
  options: [["auto", "Detect automatically"], [",", "Comma"], [";", "Semicolon"], ["\t", "Tab"], ["|", "Pipe"]],
};
const INDENT = {
  type: "select",
  name: "indent",
  label: "Indent",
  value: "2",
  options: [["2", "2 spaces"], ["4", "4 spaces"]],
};

const CSV_SAMPLE = `id,name,zip,active,price
1,Ada Lovelace,02134,true,19.50
2,"Hopper, Grace",94103,false,7
`;
const JSON_SAMPLE = `[
  { "id": 1, "name": "Ada", "address": { "city": "London" }, "tags": ["math", "code"] },
  { "id": 2, "name": "Grace", "address": { "city": "New York" }, "active": true }
]
`;
const XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<library city="London">
  <book id="1"><title>Notes</title><year>1843</year></book>
  <book id="2"><title>Compilers &amp; Code</title><year>1952</year></book>
</library>
`;
const YAML_SAMPLE = `# Service settings
service: api
replicas: 3
debug: false
ports:
  - 8080
  - 8443
env:
  region: eu-west-1
`;

export const PAGES = [
  {
    slug: "json-to-csv",
    from: "JSON",
    to: "CSV",
    title: "JSON to CSV Converter: Free, Private, In Your Browser",
    description: "Convert JSON or JSON Lines to CSV in your browser. Flattens nested objects, merges different keys into columns, and never uploads your data.",
    lead: "Paste JSON or JSON Lines, or open a file, to get a CSV with one row per object. The conversion runs entirely in your browser, so your data is never uploaded.",
    accept: ".json,.jsonl,.ndjson,application/json,text/plain",
    outExt: "csv",
    mime: "text/csv",
    swap: "csv-to-json",
    sample: JSON_SAMPLE,
    options: [
      { type: "select", name: "delimiter", label: "Delimiter", value: ",", options: [[",", "Comma"], [";", "Semicolon"], ["\t", "Tab"], ["|", "Pipe"]] },
      { type: "checkbox", name: "flatten", label: "Flatten nested data", checked: true },
      { type: "checkbox", name: "bom", label: "Add BOM for Excel", checked: false },
      { type: "checkbox", name: "escapeFormulae", label: "Escape spreadsheet formulas", checked: false },
    ],
    edge: [
      ["Nested objects", "With flattening on, nested keys become dotted columns such as address.city, and arrays use positions such as tags.0. Turn it off to keep each nested value as JSON text in one cell."],
      ["Objects with different keys", "Columns are the union of every key in the file, in the order they first appear. A row that lacks a key gets an empty cell."],
      ["JSON Lines and NDJSON", "Files with one JSON value per line, common in logs and data exports, are detected automatically and become one row per line. If a line is broken, the error names its line number."],
      ["Very long integers", "IDs longer than about 16 digits can't be held exactly as JavaScript numbers. This tool keeps them as written, and shows a note when it does."],
      ["Accents in Excel", "Excel can misread UTF-8 CSV files as another encoding. Turning on the BOM option adds a marker that tells it the file is UTF-8."],
      ["Formula injection", "A cell beginning with =, +, - or @ can run as a formula when the CSV is opened in a spreadsheet. If the data comes from people you don't trust, turn on formula escaping."],
    ],
    faq: [
      ["Is my JSON uploaded anywhere?", "No. The page's code does the conversion on your device, and the site's security policy blocks the page from sending data out."],
      ["What JSON shapes can be converted?", "An array of objects or a JSON Lines file works best. A single object becomes one row, an array of arrays becomes rows with no header, and an array of plain values becomes one column named value."],
      ["How do I convert a CSV back to JSON?", "Use the CSV to JSON page. Column names with dots can be rebuilt into nested objects with its nesting option."],
    ],
    code: ["Python with pandas", `import json
import pandas as pd

with open("in.json", encoding="utf-8") as f:
    data = json.load(f)
pd.json_normalize(data).to_csv("out.csv", index=False)`],
    related: ["csv-to-json", "json-to-xml", "json-compare"],
  },
  {
    slug: "csv-to-json",
    from: "CSV",
    to: "JSON",
    title: "CSV to JSON Converter: Free, Private, In Your Browser",
    description: "Convert CSV to JSON in your browser. Detects the delimiter, keeps leading zeros, handles quoted fields, and never uploads your data.",
    lead: "Paste CSV or open a file to get a JSON array with one object per row. The conversion runs entirely in your browser, so your data is never uploaded.",
    accept: ".csv,.tsv,.txt,text/csv,text/plain",
    outExt: "json",
    mime: "application/json",
    swap: "json-to-csv",
    sample: CSV_SAMPLE,
    options: [
      DELIMITER_IN,
      INDENT,
      { type: "checkbox", name: "header", label: "First row is a header", checked: true },
      { type: "checkbox", name: "types", label: "Detect numbers and booleans", checked: true },
      { type: "checkbox", name: "nest", label: "Nest dotted column names", checked: false },
    ],
    edge: [
      ["Leading zeros", "Values like the ZIP code 02134 stay text, because turning them into numbers would drop the zero. The same goes for numbers too long to hold exactly."],
      ["Delimiters", "Commas, semicolons, tabs and pipes are detected automatically. Choose one by hand if a file is detected wrongly."],
      ["Quoted fields", "Fields in double quotes can contain delimiters and line breaks, and a doubled quote stands for a literal quote, as in RFC 4180."],
      ["Repeated or blank headers", "JSON keys must be unique, so a repeated column a becomes a and a_2, and a blank header becomes column_3 or similar. A note appears when this happens."],
      ["Uneven rows", "Missing cells at the end of a row become null. Extra cells get column_N keys so nothing is dropped."],
    ],
    faq: [
      ["Can I keep every value as text?", "Yes. Turn off number and boolean detection and every value stays a string."],
      ["Can columns become nested objects?", "Yes. With nesting on, the columns address.city and address.zip become an address object."],
      ["Is my CSV uploaded?", "No. The file is read and converted on your device."],
    ],
    code: ["Python standard library", `import csv, json

with open("in.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
with open("out.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, indent=2, ensure_ascii=False)`],
    related: ["json-to-csv", "csv-to-xlsx", "yaml-to-json"],
  },
  {
    slug: "xml-to-json",
    from: "XML",
    to: "JSON",
    title: "XML to JSON Converter: Free, Private, In Your Browser",
    description: "Convert XML to JSON in your browser. Keeps attributes, turns repeated elements into arrays, and reports the line of any XML error.",
    lead: "Paste XML or open a file to get equivalent JSON. The conversion runs entirely in your browser, so your data is never uploaded.",
    accept: ".xml,application/xml,text/xml,text/plain",
    outExt: "json",
    mime: "application/json",
    swap: "json-to-xml",
    sample: XML_SAMPLE,
    options: [INDENT, { type: "checkbox", name: "types", label: "Detect numbers and booleans", checked: true }],
    edge: [
      ["Attributes", "An attribute becomes a key with an @ prefix, so id=\"1\" becomes \"@id\": 1. When an element has both attributes and text, the text goes in #text."],
      ["Repeated elements", "Elements that repeat become an array. An element that appears only once stays a single value, so code reading the JSON should allow for both shapes."],
      ["Namespaces", "Prefixes stay in the key name, so soap:Body becomes the key soap:Body."],
      ["What isn't kept", "XML comments and processing instructions are dropped. CDATA becomes normal text. In mixed content, where text and child elements alternate, their relative order is not preserved."],
      ["Invalid XML", "The document is validated first, and the error message gives the line and column of the problem."],
    ],
    faq: [
      ["Why did my number stay text?", "Values with leading zeros stay text so that codes like 007 aren't changed. You can also turn off detection so every value stays text."],
      ["Is there one standard way to map XML to JSON?", "No. Tools differ on attributes and arrays. This one uses the @ prefix for attributes and #text for element text."],
      ["Is my XML uploaded?", "No. It is parsed on your device."],
    ],
    code: ["Python with xmltodict", `import json, xmltodict

with open("in.xml", encoding="utf-8") as f:
    data = xmltodict.parse(f.read())
print(json.dumps(data, indent=2))`],
    related: ["json-to-xml", "yaml-to-json", "json-to-csv"],
  },
  {
    slug: "json-to-xml",
    from: "JSON",
    to: "XML",
    title: "JSON to XML Converter: Free, Private, In Your Browser",
    description: "Convert JSON to well-formed XML in your browser. Choose the root element, write attributes with @ keys, and never upload your data.",
    lead: "Paste JSON or open a file to get well-formed XML. The conversion runs entirely in your browser, so your data is never uploaded.",
    accept: ".json,application/json,text/plain",
    outExt: "xml",
    mime: "application/xml",
    swap: "xml-to-json",
    sample: JSON_SAMPLE,
    options: [
      { type: "text", name: "root", label: "Root element", value: "root" },
      { type: "text", name: "item", label: "Array item element", value: "item" },
    ],
    edge: [
      ["The single root rule", "XML allows only one top-level element. If the JSON is an object with one key, that key is the root. Otherwise the output is wrapped in the root element you choose."],
      ["Arrays", "A key holding an array becomes one repeated element per value. A top-level array uses the array item name for each entry."],
      ["Attributes", "Keys starting with @ become attributes and #text becomes element text, matching what the XML to JSON page produces."],
      ["Invalid element names", "XML names can't contain spaces or start with a digit, so such keys are adjusted: \"1 bad\" becomes _1_bad. A note reports how many keys changed."],
      ["Null values", "A null becomes an empty element."],
    ],
    faq: [
      ["Are special characters escaped?", "Yes. Characters like & and < are written as entities, so the output stays well-formed."],
      ["Can I convert the XML back?", "Yes, with the XML to JSON page. Numbers become text in XML, so use its detection option to restore them."],
      ["Is my JSON uploaded?", "No. It is converted on your device."],
    ],
    code: ["Python with xmltodict", `import json, xmltodict

with open("in.json", encoding="utf-8") as f:
    data = json.load(f)
print(xmltodict.unparse({"root": data}, pretty=True))`],
    related: ["xml-to-json", "json-to-yaml", "json-to-csv"],
  },
  {
    slug: "yaml-to-json",
    from: "YAML",
    to: "JSON",
    title: "YAML to JSON Converter: Free, Private, In Your Browser",
    description: "Convert YAML to JSON in your browser. Follows YAML 1.2, expands anchors, combines multiple documents, and reports the line of any error.",
    lead: "Paste YAML or open a file to get JSON. The conversion runs entirely in your browser, so config files and secrets are never uploaded.",
    accept: ".yaml,.yml,text/yaml,text/plain",
    outExt: "json",
    mime: "application/json",
    swap: "json-to-yaml",
    sample: YAML_SAMPLE,
    options: [INDENT],
    edge: [
      ["Yes, no, on, off", "This converter follows YAML 1.2, where only true and false are booleans. Tools built on YAML 1.1, including PyYAML, read yes, no, on and off as booleans, so results can differ."],
      ["Dates", "Dates like 2001-12-14 stay text rather than being converted to a timestamp."],
      ["Anchors and aliases", "Aliases are expanded, so the JSON contains a full copy of each referenced value."],
      ["Multiple documents", "Documents separated by --- are combined into one JSON array, and a note says how many were found."],
      ["Comments", "JSON has no comments, so YAML comments are not carried over."],
    ],
    faq: [
      ["Why do I get an indentation error?", "YAML doesn't allow tabs for indentation, and items at the same level must line up. The error message gives the line number."],
      ["Is it safe to paste secrets?", "The page doesn't send your input anywhere, but it's still good practice to rotate any secret that has been pasted into a tool you don't control."],
      ["Does it keep key order?", "Yes. Keys appear in the same order as in the YAML, apart from keys that look like integers, which JavaScript sorts first."],
    ],
    code: ["Command line with yq", `yq -o=json '.' in.yaml > out.json`],
    related: ["json-to-yaml", "xml-to-json", "json-compare"],
  },
  {
    slug: "json-to-yaml",
    from: "JSON",
    to: "YAML",
    title: "JSON to YAML Converter: Free, Private, In Your Browser",
    description: "Convert JSON to clean YAML in your browser. Keeps key order, quotes strings only when needed, and never uploads your data.",
    lead: "Paste JSON or open a file to get readable YAML. The conversion runs entirely in your browser, so your data is never uploaded.",
    accept: ".json,application/json,text/plain",
    outExt: "yaml",
    mime: "text/yaml",
    swap: "yaml-to-json",
    sample: JSON_SAMPLE,
    options: [INDENT],
    edge: [
      ["Strings that look like other types", "A string such as \"123\" or \"true\" is quoted in the YAML, so it stays a string when read back."],
      ["Key order", "Keys stay in the order they have in the JSON, apart from keys that look like integers, which JavaScript sorts first."],
      ["Repeated values", "Identical objects are written out in full rather than as anchors and aliases, so the output works with simple parsers."],
      ["Long lines", "Long strings stay on one line instead of being wrapped, which keeps diffs small."],
      ["Very long integers", "Integers too long for exact numeric handling are written as text, and a note says so."],
    ],
    faq: [
      ["Is every JSON file valid YAML?", "Very nearly. YAML 1.2 was designed as a superset of JSON, but converting gives a far more readable result."],
      ["Can I choose the indent?", "Yes, 2 or 4 spaces."],
      ["Is my JSON uploaded?", "No. It is converted on your device."],
    ],
    code: ["Command line with yq", `yq -p=json -o=yaml in.json > out.yaml`],
    related: ["yaml-to-json", "json-to-xml", "json-compare"],
  },
  {
    slug: "csv-to-xlsx",
    from: "CSV",
    to: "XLSX",
    title: "CSV to XLSX Converter: Free, Private, In Your Browser",
    description: "Convert CSV to an XLSX spreadsheet in your browser. Keeps leading zeros and long IDs intact and never uploads your file.",
    lead: "Paste CSV or open a file to create an XLSX spreadsheet. The file is built entirely in your browser, so your data is never uploaded.",
    accept: ".csv,.tsv,.txt,text/csv,text/plain",
    outExt: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    binary: true,
    swap: null,
    sample: CSV_SAMPLE,
    outputLabel: "Preview",
    options: [
      DELIMITER_IN,
      { type: "checkbox", name: "header", label: "Bold first row", checked: true },
      { type: "checkbox", name: "numbers", label: "Store numbers as numbers", checked: true },
    ],
    edge: [
      ["Leading zeros and long IDs", "Opening a CSV directly in a spreadsheet often turns 02134 into 2134 and rounds long IDs. Here, those values are stored as text and stay exactly as written."],
      ["Dates", "Dates stay as text instead of being reinterpreted, since 03/04/2025 means different days in different countries."],
      ["Formulas", "A value like =1+1 is stored as plain text, so it doesn't run when the file is opened."],
      ["Size limits", "An XLSX sheet holds at most 1,048,576 rows and 16,384 columns, and each cell at most 32,767 characters. Larger files get an error or a note."],
      ["One sheet", "A CSV has one table, so the workbook has one sheet, named Sheet1."],
    ],
    faq: [
      ["Why not just open the CSV in a spreadsheet?", "You can, but spreadsheet apps guess each column's type when opening a CSV and can change your data. This keeps values as written."],
      ["Is my file uploaded?", "No. The spreadsheet is created on your device."],
      ["Can I set column types by hand?", "Not yet. Numbers are detected safely, or you can turn that off so everything is text."],
    ],
    code: ["Python with pandas and openpyxl", `import pandas as pd

pd.read_csv("in.csv", dtype=str).to_excel("out.xlsx", index=False)`],
    related: ["csv-to-json", "json-to-csv", "xml-to-json"],
  },
  {
    slug: "json-compare",
    from: "JSON",
    to: null,
    title: "JSON Compare: Find Differences Between Two JSON Files",
    description: "Compare two JSON documents in your browser. Matches arrays by ID, ignores key order, exports JSON Patch, and never uploads your data.",
    h1: "JSON Compare",
    lead: "Paste two JSON documents to see what was added, removed or changed, as a list by path or as a JSON Patch. The comparison runs entirely in your browser, so your data is never uploaded.",
    accept: ".json,application/json,text/plain",
    outExt: "txt",
    mime: "text/plain",
    swap: null,
    two: true,
    sample: `{ "name": "api", "replicas": 3, "ports": [8080], "debug": true }\n`,
    sample2: `{ "replicas": 5, "name": "api", "ports": [8080, 8443], "region": "eu" }\n`,
    outputLabel: "Differences",
    options: [
      { type: "select", name: "format", label: "Output", value: "list", options: [["list", "List of differences"], ["patch", "JSON Patch (RFC 6902)"]] },
      { type: "text", name: "matchKey", label: "Match arrays by key", value: "", placeholder: "e.g. id" },
      { type: "checkbox", name: "ignoreOrder", label: "Ignore array order", checked: false },
    ],
    edge: [
      ["Key order doesn't matter", "JSON objects are unordered, so the same keys in a different order count as equal. A plain text diff would flag those lines."],
      ["Array order does matter", "Arrays are compared position by position unless you match them by a key or turn on the option to ignore order."],
      ["Matching arrays by ID", "Enter a key such as id and arrays of objects are paired by that value, wherever each item sits. One new record at the start of a list then shows as one addition, not a change to every row. If items lack the key or repeat it, a note says so and that array is compared without it."],
      ["JSON Patch output", "Choose JSON Patch to get RFC 6902 operations that turn the first document into the second. When arrays are matched by key or order is ignored, the patch adds new items at the end and doesn't reorder existing ones."],
      ["Equal values, different text", "1 and 1.0 are the same number, so they count as equal. The number 1 and the string \"1\" are different."],
      ["Reading the result", "Each line starts with + for added, - for removed or ~ for changed, followed by a path such as $.ports[1], or $.users[id=7] when arrays are matched by key."],
    ],
    faq: [
      ["Can I apply the differences to my file?", "Yes. Switch the output to JSON Patch and download it, then apply it with any RFC 6902 library."],
      ["Does formatting affect the result?", "No. Both documents are parsed first, so whitespace and indentation are ignored."],
      ["Which document is the original?", "The first box is treated as the original, so something only in the second box is listed as added."],
      ["Is my data uploaded?", "No. Both documents stay on your device."],
    ],
    code: ["Command line with jq", `diff <(jq -S . a.json) <(jq -S . b.json)`],
    related: ["json-to-yaml", "json-to-csv", "yaml-to-json"],
  },
];

export const bySlug = Object.fromEntries(PAGES.map((page) => [page.slug, page]));
export const pageName = (page) => page.h1 ?? `${page.from} to ${page.to}`;

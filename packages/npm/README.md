# dataformatconverter

Convert between JSON, JSON Lines, CSV, XML, YAML and XLSX, and compare JSON documents. These are the converters behind [dataformatconverter.com](https://dataformatconverter.com).

```bash
npm install dataformatconverter
```

Requires Node.js 22 or later. The package is ESM only and also works with browser bundlers.

## Usage

```js
import { jsonToCsv, jsonCompare, csvToXlsx } from "dataformatconverter";
import { writeFile } from "node:fs/promises";

const { output, notes } = jsonToCsv('[{"id":1,"address":{"city":"London"}}]');
// id,address.city
// 1,London

// Pair records by ID, wherever they sit in the array.
const before = '[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]';
const after = '[{"id":2,"name":"G. Hopper"},{"id":1,"name":"Ada"}]';
jsonCompare(before, after, { matchKey: "id" }).output;
// 1 difference(s): 0 added, 0 removed, 1 changed
//
// ~ $[id=2].name: "Grace" → "G. Hopper"

// Or get an RFC 6902 JSON Patch.
jsonCompare(before, after, { matchKey: "id", format: "patch" }).output;

await writeFile("sheet.xlsx", csvToXlsx("a,b\n1,2\n").binary);
```

Each function returns `{ output, notes }`, and invalid input throws an `Error` with a readable message.

## Functions

| Function | Options |
|---|---|
| `jsonToCsv(text, options)` | `delimiter`, `flatten`, `bom`, `escapeFormulae` |
| `csvToJson(text, options)` | `delimiter`, `header`, `types`, `nest`, `indent` |
| `xmlToJson(text, options)` | `types`, `indent` |
| `jsonToXml(text, options)` | `root`, `item` |
| `yamlToJson(text, options)` | `indent` |
| `jsonToYaml(text, options)` | `indent` |
| `csvToXlsx(text, options)` | `delimiter`, `header`, `numbers` |
| `jsonCompare(first, second, options)` | `format`, `matchKey`, `ignoreOrder` |

TypeScript types describe every option and its default.

## Behaviour worth knowing

- `jsonToCsv` reads JSON Lines automatically, and flattens nested data into dotted columns.
- `csvToJson` keeps values such as `02134` as text, so leading zeros survive.
- Integers too long for JavaScript numbers are kept as text and reported in `notes`, rather than being rounded.
- `xmlToJson` writes attributes with an `@` prefix and turns repeated elements into arrays.
- With `matchKey` or `ignoreOrder`, a JSON Patch adds new array items at the end and doesn't reorder existing ones.

## Licence

[MIT](https://github.com/dataformatconverter/dataformatconverter/blob/main/LICENSE)

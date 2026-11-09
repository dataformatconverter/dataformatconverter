# Data Format Converter for VS Code

Convert JSON, JSON Lines, CSV, XML, YAML and XLSX without leaving the editor, and compare JSON files by what actually changed.

Everything runs locally on your computer. The extension makes no network requests.

## Commands

Open the Command Palette and type **Data Format**.

| Command | What it does |
|---|---|
| JSON to CSV | Flattens nested objects, merges different keys into columns, and reads JSON Lines |
| CSV to JSON | Detects the delimiter and keeps leading zeros |
| XML to JSON | Keeps attributes and turns repeated elements into arrays |
| JSON to XML | Writes well-formed XML, with `@` keys as attributes |
| YAML to JSON | Follows YAML 1.2 and expands anchors |
| JSON to YAML | Keeps key order |
| CSV to XLSX | Saves a real Excel workbook and keeps long IDs intact |
| Compare JSON | Lists what was added, removed or changed, ignoring key order |
| Create JSON Patch | Writes an RFC 6902 patch from the current file to another one |

Conversions use your selection if you have one, or otherwise the whole file. The result opens in a new tab beside your file, and your original isn't changed.

Compare JSON and Create JSON Patch ask for the second file, then for an optional key such as `id`. With a key, objects in arrays are paired by that value wherever they sit, so one new record at the start of a list shows as one addition.

## Prefer a website or a library?

- Online, with the same converters: [dataformatconverter.com](https://dataformatconverter.com)
- Source code: [GitHub](https://github.com/dataformatconverter/dataformatconverter)

## Licence

MIT. Notices for bundled packages are in `THIRD_PARTY_NOTICES.txt`.

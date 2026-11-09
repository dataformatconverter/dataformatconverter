import { strToU8, zipSync } from "fflate";
import { count, looksNumeric, parseCsv } from "./csv.js";

const MAX_ROWS = 1048576;
const MAX_COLUMNS = 16384;
const MAX_CELL = 32767;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;

function columnName(index) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function escapeXml(text) {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function csvToXlsx(text, { delimiter = "auto", header = true, numbers = true } = {}) {
  const { rows } = parseCsv(text, delimiter);
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (rows.length > MAX_ROWS) throw new Error(`This file has ${rows.length} rows; XLSX sheets allow ${MAX_ROWS}.`);
  if (width > MAX_COLUMNS) throw new Error(`This file has ${width} columns; XLSX sheets allow ${MAX_COLUMNS}.`);

  let truncated = 0;
  const sheetRows = rows.map((row, r) => {
    const style = header && r === 0 ? ' s="1"' : "";
    const cells = row.map((raw, c) => {
      const ref = `${columnName(c)}${r + 1}`;
      if (raw === "") return "";
      if (numbers && !style && looksNumeric(raw)) return `<c r="${ref}"><v>${raw}</v></c>`;
      if (raw.length > MAX_CELL) truncated += 1;
      const value = escapeXml(raw.slice(0, MAX_CELL));
      return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`;
    });
    return `<row r="${r + 1}">${cells.join("")}</row>`;
  });
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows.join("")}</sheetData></worksheet>`;

  const binary = zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      "_rels/.rels": strToU8(ROOT_RELS),
      "xl/workbook.xml": strToU8(WORKBOOK),
      "xl/_rels/workbook.xml.rels": strToU8(WORKBOOK_RELS),
      "xl/styles.xml": strToU8(STYLES),
      "xl/worksheets/sheet1.xml": strToU8(sheet),
    },
    { level: 6 },
  );
  const notes = truncated ? [`${truncated} cell(s) were cut to the XLSX limit of ${MAX_CELL} characters.`] : [];
  const preview = rows.slice(0, 20).map((row) => row.join("  |  ")).join("\n");
  const more = rows.length > 20 ? `\n… and ${rows.length - 20} more rows` : "";
  return { output: `${preview}${more}`, binary, notes, summary: `${count(rows.length, "row")}, ${count(width, "column")}` };
}

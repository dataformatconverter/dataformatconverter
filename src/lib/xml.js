import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import { clean, parseJson } from "./json.js";

export function xmlToJson(text, { types = true, indent = "2" } = {}) {
  const source = clean(text);
  const check = XMLValidator.validate(source);
  if (check !== true) {
    throw new Error(`Invalid XML on line ${check.err.line}, column ${check.err.col}: ${check.err.msg}`);
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    textNodeName: "#text",
    parseTagValue: types,
    parseAttributeValue: types,
    numberParseOptions: { leadingZeros: false, hex: false, eNotation: false },
    ignoreDeclaration: true,
    ignorePiTags: true,
    htmlEntities: false,
  });
  return { output: JSON.stringify(parser.parse(source), null, Number(indent)), notes: [] };
}

function xmlName(key) {
  const name = key.replace(/[^\p{L}\p{N}_.-]/gu, "_");
  return /^[\p{L}_]/u.test(name) ? name : `_${name}`;
}

function prepare(value, renamed) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => prepare(item, renamed));
  if (typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    const special = key.startsWith("@") || key === "#text";
    const name = special ? key : xmlName(key);
    if (name !== key) renamed.add(key);
    out[name] = special ? item : prepare(item, renamed);
  }
  return out;
}

function hasSingleRoot(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const elements = Object.keys(value).filter((key) => !key.startsWith("@"));
  return elements.length === 1 && !Array.isArray(value[elements[0]]) && elements[0] !== "#text";
}

export function jsonToXml(text, { root = "root", item = "item" } = {}) {
  const { data, notes } = parseJson(text);
  const renamed = new Set();
  const body = prepare(data, renamed);
  const rootName = xmlName(root || "root");
  let document;
  if (hasSingleRoot(body)) document = body;
  else if (Array.isArray(body)) document = { [rootName]: { [xmlName(item || "item")]: body } };
  else document = { [rootName]: body };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    textNodeName: "#text",
    format: true,
    indentBy: "  ",
    suppressEmptyNode: true,
  });
  if (renamed.size) notes.push(`${renamed.size} key(s) were renamed because they aren't valid XML element names.`);
  return { output: `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(document).trim()}\n`, notes };
}

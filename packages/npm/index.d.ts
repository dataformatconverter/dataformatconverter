export interface ConvertResult {
  /** The converted text. For csvToXlsx, a short text preview of the sheet. */
  output: string;
  /** Anything the caller should know, such as renamed keys. */
  notes: string[];
  /** A short description of the result, on the converters that have one. */
  summary?: string;
}

export interface XlsxResult extends ConvertResult {
  /** The bytes of the XLSX file. */
  binary: Uint8Array;
  summary: string;
}

export interface CompareResult extends ConvertResult {
  summary: string;
  /** "json" when format is "patch". */
  ext?: "json";
}

export interface JsonToCsvOptions {
  /** Default ",". */
  delimiter?: string;
  /** Turn nested values into dotted columns. Default true. */
  flatten?: boolean;
  /** Add a UTF-8 byte order mark for Excel. Default false. */
  bom?: boolean;
  /** Neutralise cells that a spreadsheet would run as formulas. Default false. */
  escapeFormulae?: boolean;
}

export interface CsvToJsonOptions {
  /** A delimiter, or "auto" to detect it. Default "auto". */
  delimiter?: string;
  /** Use the first row as keys. Default true. */
  header?: boolean;
  /** Convert safe numbers and booleans. Default true. */
  types?: boolean;
  /** Build nested objects from dotted column names. Default false. */
  nest?: boolean;
  /** Default 2. */
  indent?: number | string;
}

export interface XmlToJsonOptions {
  /** Convert safe numbers and booleans. Default true. */
  types?: boolean;
  /** Default 2. */
  indent?: number | string;
}

export interface JsonToXmlOptions {
  /** Root element name, when one is needed. Default "root". */
  root?: string;
  /** Element name for array items. Default "item". */
  item?: string;
}

export interface IndentOptions {
  /** Default 2. */
  indent?: number | string;
}

export interface CsvToXlsxOptions {
  /** A delimiter, or "auto" to detect it. Default "auto". */
  delimiter?: string;
  /** Make the first row bold. Default true. */
  header?: boolean;
  /** Store safe numbers as numbers. Default true. */
  numbers?: boolean;
}

export interface JsonCompareOptions {
  /** "list" for readable lines, "patch" for an RFC 6902 JSON Patch. Default "list". */
  format?: "list" | "patch";
  /** Compare arrays regardless of order. Default false. */
  ignoreOrder?: boolean;
  /** Pair objects in arrays by this key, wherever they sit. Default "" (off). */
  matchKey?: string;
}

/** Accepts one JSON value, or JSON Lines. Throws Error with a readable message on invalid input. */
export function jsonToCsv(text: string, options?: JsonToCsvOptions): ConvertResult;
export function csvToJson(text: string, options?: CsvToJsonOptions): ConvertResult;
export function xmlToJson(text: string, options?: XmlToJsonOptions): ConvertResult;
export function jsonToXml(text: string, options?: JsonToXmlOptions): ConvertResult;
export function yamlToJson(text: string, options?: IndentOptions): ConvertResult;
export function jsonToYaml(text: string, options?: IndentOptions): ConvertResult;
export function csvToXlsx(text: string, options?: CsvToXlsxOptions): XlsxResult;
export function jsonCompare(first: string, second: string, options?: JsonCompareOptions): CompareResult;

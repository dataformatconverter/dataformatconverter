// Loads each converter only on the page that needs it.
export const LOADERS = {
  "json-to-csv": () => import("./lib/csv.js").then((m) => m.jsonToCsv),
  "csv-to-json": () => import("./lib/csv.js").then((m) => m.csvToJson),
  "xml-to-json": () => import("./lib/xml.js").then((m) => m.xmlToJson),
  "json-to-xml": () => import("./lib/xml.js").then((m) => m.jsonToXml),
  "yaml-to-json": () => import("./lib/yaml.js").then((m) => m.yamlToJson),
  "json-to-yaml": () => import("./lib/yaml.js").then((m) => m.jsonToYaml),
  "csv-to-xlsx": () => import("./lib/xlsx.js").then((m) => m.csvToXlsx),
  "json-compare": () => import("./lib/compare.js").then((m) => m.jsonCompare),
};

import { CORE_SCHEMA, dump, loadAll } from "js-yaml";
import { clean, parseJson } from "./json.js";

export function yamlToJson(text, { indent = "2" } = {}) {
  let documents;
  try {
    documents = loadAll(clean(text), null, { schema: CORE_SCHEMA });
  } catch (error) {
    if (error.name !== "YAMLException") throw error;
    const line = error.mark ? ` on line ${error.mark.line + 1}` : "";
    throw new Error(`Invalid YAML${line}: ${error.reason}`);
  }
  if (!documents.length) throw new Error("The input is empty.");
  const notes = documents.length > 1 ? [`${documents.length} YAML documents were combined into one JSON array.`] : [];
  const data = documents.length > 1 ? documents : documents[0];
  return { output: JSON.stringify(data, null, Number(indent)), notes };
}

export function jsonToYaml(text, { indent = "2" } = {}) {
  const { data, notes } = parseJson(text);
  return { output: dump(data, { indent: Number(indent), lineWidth: -1, noRefs: true, sortKeys: false }), notes };
}

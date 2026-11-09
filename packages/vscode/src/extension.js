import * as vscode from "vscode";
import { jsonCompare } from "../../../src/lib/compare.js";
import { csvToJson, jsonToCsv } from "../../../src/lib/csv.js";
import { csvToXlsx } from "../../../src/lib/xlsx.js";
import { jsonToXml, xmlToJson } from "../../../src/lib/xml.js";
import { jsonToYaml, yamlToJson } from "../../../src/lib/yaml.js";

// VS Code has no built-in CSV language, so CSV results open as plain text.
const TEXT_TOOLS = {
  jsonToCsv: [jsonToCsv, "plaintext"],
  csvToJson: [csvToJson, "json"],
  xmlToJson: [xmlToJson, "json"],
  jsonToXml: [jsonToXml, "xml"],
  yamlToJson: [yamlToJson, "json"],
  jsonToYaml: [jsonToYaml, "yaml"],
};

function inputText(editor) {
  return editor.selection.isEmpty ? editor.document.getText() : editor.document.getText(editor.selection);
}

function activeEditor() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) vscode.window.showErrorMessage("Open a file first, then run this command.");
  return editor;
}

async function showResult(result, language) {
  const document = await vscode.workspace.openTextDocument({ content: result.output, language });
  await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preview: false });
  for (const note of result.notes) vscode.window.showInformationMessage(note);
}

function guarded(work) {
  return async (...args) => {
    try {
      await work(...args);
    } catch (error) {
      vscode.window.showErrorMessage(error.message);
    }
  };
}

async function convertToXlsx() {
  const editor = activeEditor();
  if (!editor) return;
  const result = csvToXlsx(inputText(editor));
  const source = editor.document.uri;
  const defaultUri = source.scheme === "file" ? vscode.Uri.file(source.fsPath.replace(/(\.[^.\\/]+)?$/, ".xlsx")) : undefined;
  const target = await vscode.window.showSaveDialog({ defaultUri, filters: { "Excel workbook": ["xlsx"] } });
  if (!target) return;
  await vscode.workspace.fs.writeFile(target, result.binary);
  vscode.window.showInformationMessage(`Saved ${result.summary} to ${target.fsPath}.`);
}

const BROWSE = "Browse for a file…";

async function pickOtherDocument(current) {
  const open = vscode.workspace.textDocuments.filter((d) => d !== current && !d.isClosed && d.uri.scheme !== "output" && d.languageId !== "Log");
  const items = [...open.map((d) => ({ label: vscode.workspace.asRelativePath(d.uri), uri: d.uri })), { label: BROWSE }];
  const picked = await vscode.window.showQuickPick(items, { placeHolder: "Compare the current file with…" });
  if (!picked) return undefined;
  if (picked.uri) return picked.uri;
  const chosen = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { JSON: ["json"], "All files": ["*"] } });
  return chosen?.[0];
}

/** `options` skips the prompts: { other: Uri, matchKey: string }. */
async function compare(format, options = {}) {
  const editor = activeEditor();
  if (!editor) return;
  const other = options.other ?? (await pickOtherDocument(editor.document));
  if (!other) return;
  const matchKey = options.matchKey ?? (await vscode.window.showInputBox({ prompt: "Match arrays by key (optional)", placeHolder: "e.g. id" }));
  if (matchKey === undefined) return;
  const second = await vscode.workspace.openTextDocument(other);
  const result = jsonCompare(editor.document.getText(), second.getText(), { format, matchKey });
  await showResult(result, format === "patch" ? "json" : "plaintext");
}

export function activate(context) {
  const register = (name, work) => context.subscriptions.push(vscode.commands.registerCommand(`dataFormatConverter.${name}`, guarded(work)));
  for (const [name, [convert, language]] of Object.entries(TEXT_TOOLS)) {
    register(name, async () => {
      const editor = activeEditor();
      if (editor) await showResult(convert(inputText(editor)), language);
    });
  }
  register("csvToXlsx", convertToXlsx);
  register("compare", (options) => compare("list", options));
  register("patch", (options) => compare("patch", options));
}

export function deactivate() {}

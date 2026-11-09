// Runs inside a real VS Code window, driving the extension through its commands.
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const vscode = require("vscode");

const prefix = "dataFormatConverter.";

async function open(content, language) {
  const document = await vscode.workspace.openTextDocument({ content, language });
  return vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preview: false });
}

async function closeAll() {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
}

async function convert(command, content, language, ...args) {
  await open(content, language);
  await vscode.commands.executeCommand(prefix + command, ...args);
  return vscode.window.activeTextEditor.document;
}

exports.run = async () => {
  const declared = vscode.extensions.getExtension("dataformatconverter.data-format-converter").packageJSON.contributes.commands.map((c) => c.command);
  const registered = await vscode.commands.getCommands(true);
  await vscode.extensions.getExtension("dataformatconverter.data-format-converter").activate();
  const after = await vscode.commands.getCommands(true);
  for (const id of declared) assert.ok(after.includes(id) || registered.includes(id), `${id} isn't registered`);

  const checks = [
    ["jsonToCsv", '[{"a":{"b":1}}]', "json", "a.b\n1", "plaintext"],
    ["jsonToCsv", '{"a":1}\n{"a":2}\n', "plaintext", "a\n1\n2", "plaintext"],
    ["csvToJson", "id,zip\n1,02134\n", "plaintext", JSON.stringify([{ id: 1, zip: "02134" }], null, 2), "json"],
    ["xmlToJson", "<a><b>2</b></a>", "xml", JSON.stringify({ a: { b: 2 } }, null, 2), "json"],
    ["yamlToJson", "a: 1\n", "yaml", JSON.stringify({ a: 1 }, null, 2), "json"],
    ["jsonToYaml", '{"a":1}', "json", "a: 1\n", "yaml"],
  ];
  for (const [command, input, language, expected, resultLanguage] of checks) {
    await closeAll();
    const result = await convert(command, input, language);
    assert.equal(result.getText().replace(/\r\n/g, "\n"), expected, command);
    assert.equal(result.languageId, resultLanguage, `${command} language`);
  }

  await closeAll();
  const xml = await convert("jsonToXml", '{"a":1,"b":2}', "json");
  assert.match(xml.getText(), /<root>\s*<a>1<\/a>\s*<b>2<\/b>\s*<\/root>/);
  assert.equal(xml.languageId, "xml");

  await closeAll();
  const editor = await open('[{"a":1}]\nnot json', "json");
  editor.selection = new vscode.Selection(0, 0, 0, 9);
  await vscode.commands.executeCommand(`${prefix}jsonToCsv`);
  assert.equal(vscode.window.activeTextEditor.document.getText().replace(/\r\n/g, "\n"), "a\n1", "converts only the selection");

  await closeAll();
  const bad = await open("{", "json");
  await vscode.commands.executeCommand(`${prefix}jsonToCsv`);
  assert.equal(vscode.window.activeTextEditor.document, bad.document, "invalid input opens no result");

  const folder = mkdtempSync(join(tmpdir(), "dfc-"));
  const otherPath = join(folder, "other.json");
  writeFileSync(otherPath, '[{"id":2,"v":3},{"id":1,"v":1}]');
  const options = { other: vscode.Uri.file(otherPath), matchKey: "id" };
  const first = '[{"id":1,"v":1},{"id":2,"v":2}]';

  await closeAll();
  const list = await convert("compare", first, "json", options);
  assert.match(list.getText(), /\$\[id=2\]\.v: 2 → 3/);

  await closeAll();
  const patch = await convert("patch", first, "json", options);
  assert.deepEqual(JSON.parse(patch.getText()), [{ op: "replace", path: "/1/v", value: 3 }]);
  assert.equal(patch.languageId, "json");

  await closeAll();
};

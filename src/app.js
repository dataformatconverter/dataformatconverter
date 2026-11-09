import { LOADERS } from "./registry.js";

// Above this size text stays out of the page's text boxes, which get slow, and conversion waits for the button.
const LARGE = 1_000_000;

const menu = document.querySelector(".menu");
document.addEventListener("click", (event) => {
  if (menu.open && !menu.contains(event.target)) menu.open = false;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu.open) {
    menu.open = false;
    menu.querySelector("summary").focus();
  }
});

const tool = document.querySelector("[data-tool]");
if (tool) start(tool);

function start(root) {
  const slug = root.dataset.tool;
  const $ = (id) => document.getElementById(id);
  const inputs = [...root.querySelectorAll("[data-input]")];
  const output = $("output");
  const status = $("status");
  const notes = $("notes");
  const large = new Map(); // textarea -> text of a file too big to display
  let names = "converted";
  let result = null;
  let timer;
  let snackTimer;

  const textOf = (box) => large.get(box) ?? box.value;

  LOADERS[slug]().catch(() => {}); // fetch the converter now, so it still works if the connection drops

  function options() {
    const out = {};
    for (const field of $("options").elements) {
      if (field.name) out[field.name] = field.type === "checkbox" ? field.checked : field.value;
    }
    return out;
  }

  function show(message, kind = "") {
    status.textContent = message;
    status.className = `status ${kind}`;
  }

  function clearResult() {
    result = null;
    output.value = "";
    notes.replaceChildren();
    $("copy").disabled = true;
    $("download").disabled = true;
  }

  async function convert() {
    const texts = inputs.map(textOf);
    if (texts.some((text) => !text.trim())) {
      clearResult();
      show("");
      return;
    }
    show("Converting…");
    await new Promise((resolve) => setTimeout(resolve)); // let the message paint before heavy work
    try {
      const run = await LOADERS[slug]();
      result = run(...texts, options());
      const big = result.output.length > LARGE;
      output.value = big ? `The result is ${size(result.output.length)}, too large to show here. Use Download.` : result.output;
      notes.replaceChildren(...result.notes.map((text) => Object.assign(document.createElement("li"), { textContent: text })));
      $("copy").disabled = big || Boolean(result.binary);
      $("download").disabled = false;
      const lines = result.output.split("\n").length;
      show(result.summary ?? `${lines.toLocaleString("en-US")} line${lines === 1 ? "" : "s"} of ${root.dataset.ext.toUpperCase()}`, "ok");
    } catch (error) {
      clearResult();
      show(error.message, "error");
    }
  }

  function schedule() {
    clearTimeout(timer);
    const big = inputs.some((box) => textOf(box).length >= LARGE);
    $("convert").hidden = !big;
    if (big) show("Large input: press Convert when ready.");
    else timer = setTimeout(convert, 200);
  }

  function snack(message) {
    const bar = $("snackbar");
    bar.hidden = false;
    bar.textContent = message;
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => {
      bar.hidden = true;
    }, 2500);
  }

  function size(chars) {
    return `${(chars / 1_000_000).toFixed(1)} MB`;
  }

  async function load(file, box) {
    const text = await file.text();
    names = file.name.replace(/\.[^.]+$/, "") || "converted";
    if (text.length > LARGE) {
      large.set(box, text);
      box.value = `${file.name} (${size(text.length)}) is loaded.`;
      box.readOnly = true;
    } else {
      large.delete(box);
      box.readOnly = false;
      box.value = text;
    }
    schedule();
  }

  // A file dropped outside the boxes would otherwise replace the page.
  for (const type of ["dragover", "drop"]) document.addEventListener(type, (event) => event.preventDefault());

  inputs.forEach((box, index) => {
    const area = box.closest(".box");
    box.addEventListener("input", schedule);
    area.addEventListener("dragover", () => area.classList.add("dragging"));
    area.addEventListener("dragleave", (event) => {
      if (!area.contains(event.relatedTarget)) area.classList.remove("dragging");
    });
    area.addEventListener("drop", (event) => {
      event.preventDefault();
      area.classList.remove("dragging");
      const file = event.dataTransfer.files[0];
      if (file) load(file, box);
    });
    const picker = root.querySelector(`[data-file="${index}"]`);
    picker.addEventListener("change", () => {
      if (picker.files[0]) load(picker.files[0], box);
      picker.value = "";
    });
  });

  $("options").addEventListener("input", schedule);
  $("options").addEventListener("submit", (event) => event.preventDefault());
  $("convert").addEventListener("click", convert);

  $("sample").addEventListener("click", () => {
    for (const box of inputs) {
      large.delete(box);
      box.readOnly = false;
      box.value = box.dataset.sample;
    }
    $("convert").hidden = true;
    convert();
  });

  $("clear").addEventListener("click", () => {
    for (const box of inputs) {
      large.delete(box);
      box.readOnly = false;
      box.value = "";
    }
    names = "converted";
    $("convert").hidden = true;
    clearResult();
    show("");
  });

  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(output.value);
    } catch {
      output.select();
      document.execCommand("copy");
    }
    snack("Copied to clipboard");
  });

  $("download").addEventListener("click", () => {
    if (!result) return;
    const blob = new Blob([result.binary ?? result.output], { type: root.dataset.mime });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${names}.${result.ext ?? root.dataset.ext}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  });

  $("copy").disabled = true;
  $("download").disabled = true;
}

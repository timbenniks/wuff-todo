// Shared embedded controls; product renderers receive the same platform runtime.
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (tag === "button") {
    e.className = "wuff-button";
    e.dataset.variant = "default";
  }
  return e;
}
export function button(text: string, run: () => void, disabled = false) {
  const e = element("button", text);
  e.type = "button";
  e.disabled = disabled;
  e.onclick = run;
  if (/^Save (my )?notes$/.test(text)) e.dataset.variant = "primary";
  if (/^(Delete|Remove|Disconnect)/.test(text)) e.dataset.variant = "danger";
  if (/^Delete task/.test(text)) e.dataset.variant = "destructive";
  return e;
}
let fieldSequence = 0;
export function wireForm(
  form: HTMLFormElement,
  save: HTMLButtonElement,
  run: () => void,
) {
  save.dataset.variant = "primary";
  for (const control of form.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("input:not([type=hidden]),textarea,select")) {
    const name = control.getAttribute("aria-label");
    if (!name || control.labels?.length || control.closest("label")) continue;
    control.id ||= `wuff-field-${++fieldSequence}`;
    const label = element("label", name);
    label.htmlFor = control.id;
    label.className = "field-label";
    control.before(label);
  }
  const submit = () => {
    if (!save.disabled && form.reportValidity()) {
      save.disabled = true;
      run();
    }
  };
  save.type = "button";
  save.onclick = submit;
  form.onsubmit = (e) => {
    e.preventDefault();
    submit();
  };
  form.onkeydown = (e) => {
    if (e.isComposing) return;
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      submit();
    }
  };
}

const TEST_ID_ATTRIBUTES = ["data-testid", "data-test", "data-qa"];

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function quoteAttribute(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function addCandidate(candidates, candidate) {
  const identity = JSON.stringify([
    candidate.kind,
    candidate.value,
    candidate.options ?? null,
  ]);
  if (!candidates.some((item) => item.identity === identity)) {
    candidates.push({ ...candidate, identity });
  }
}

export function isLikelyGeneratedIdentifier(value) {
  const text = normalizeText(value);
  if (!text) return true;
  return (
    text.length > 80 ||
    /^:r[0-9a-z]+:$/i.test(text) ||
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(text) ||
    /^[0-9a-f]{20,}$/i.test(text) ||
    /(?:^|[-_])\d{8,}(?:$|[-_])/i.test(text)
  );
}

export function discoverSelectorCandidates(snapshot, options = {}) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new TypeError("snapshot must be an object");
  }

  const candidates = [];
  const configuredTestId =
    options.testIdAttribute ?? "data-testid";
  const accessibleName = normalizeText(snapshot.accessibleName);
  const role = normalizeText(snapshot.role);
  const label = normalizeText(snapshot.label);
  const placeholder = normalizeText(snapshot.placeholder);
  const text = normalizeText(snapshot.text);
  const id = normalizeText(snapshot.id);
  const name = normalizeText(snapshot.name);
  const tagName = normalizeText(snapshot.tagName).toLowerCase() || "*";
  const testId = snapshot.testId ?? null;

  if (role && accessibleName) {
    addCandidate(candidates, {
      kind: "role",
      value: role,
      options: { name: accessibleName, exact: true },
      score: 100,
      reason: "Accessible role and name reflect the user-facing contract.",
    });
  }

  if (label) {
    addCandidate(candidates, {
      kind: "label",
      value: label,
      options: { exact: true },
      score: 95,
      reason: "The associated label is readable and resilient to layout changes.",
    });
  }

  if (testId?.attribute && normalizeText(testId.value)) {
    const testIdValue = normalizeText(testId.value);
    if (testId.attribute === configuredTestId) {
      addCandidate(candidates, {
        kind: "testId",
        value: testIdValue,
        score: 90,
        reason: `The configured ${configuredTestId} contract is explicit.`,
      });
    } else {
      addCandidate(candidates, {
        kind: "css",
        value: `[${testId.attribute}="${quoteAttribute(testIdValue)}"]`,
        score: 85,
        reason: `${testId.attribute} is an explicit automation hook.`,
      });
    }
  }

  if (placeholder) {
    addCandidate(candidates, {
      kind: "placeholder",
      value: placeholder,
      options: { exact: true },
      score: 80,
      reason: "The placeholder is user-facing, but labels are preferred.",
      warning: "Placeholder copy can change during content revisions.",
    });
  }

  if (id && !isLikelyGeneratedIdentifier(id)) {
    addCandidate(candidates, {
      kind: "css",
      value: `[id="${quoteAttribute(id)}"]`,
      score: 75,
      reason: "The element has a stable-looking identifier.",
      warning: "Confirm the identifier is an application contract, not generated.",
    });
  }

  if (name && !isLikelyGeneratedIdentifier(name)) {
    addCandidate(candidates, {
      kind: "css",
      value: `${tagName}[name="${quoteAttribute(name)}"]`,
      score: 65,
      reason: "The form name is more stable than a structural selector.",
    });
  }

  if (text && text.length <= 100) {
    addCandidate(candidates, {
      kind: "text",
      value: text,
      options: { exact: true },
      score: 55,
      reason: "Exact visible text is understandable but copy-sensitive.",
      warning: "Prefer role, label, or an explicit test id when available.",
    });
  }

  return candidates
    .sort((left, right) => right.score - left.score)
    .map(({ identity, ...candidate }) => candidate);
}

export function locatorFromCandidate(page, candidate) {
  if (!page || !candidate) {
    throw new TypeError("page and candidate are required");
  }

  switch (candidate.kind) {
    case "role":
      return page.getByRole(candidate.value, candidate.options);
    case "label":
      return page.getByLabel(candidate.value, candidate.options);
    case "testId":
      return page.getByTestId(candidate.value);
    case "placeholder":
      return page.getByPlaceholder(candidate.value, candidate.options);
    case "text":
      return page.getByText(candidate.value, candidate.options);
    case "css":
      return page.locator(candidate.value);
    default:
      throw new Error(`Unsupported locator candidate kind: ${candidate.kind}`);
  }
}

export function formatPlaywrightLocator(candidate) {
  const value = JSON.stringify(candidate.value);
  switch (candidate.kind) {
    case "role":
      return `page.getByRole(${value}, ${JSON.stringify(candidate.options)})`;
    case "label":
      return `page.getByLabel(${value}, ${JSON.stringify(candidate.options)})`;
    case "testId":
      return `page.getByTestId(${value})`;
    case "placeholder":
      return `page.getByPlaceholder(${value}, ${JSON.stringify(candidate.options)})`;
    case "text":
      return `page.getByText(${value}, ${JSON.stringify(candidate.options)})`;
    case "css":
      return `page.locator(${value})`;
    default:
      throw new Error(`Unsupported locator candidate kind: ${candidate.kind}`);
  }
}

export function resolveSearchRoot(page, options = {}) {
  const frame = options.frame;
  if (!frame) return page;
  if (typeof frame === "string") {
    if (typeof page.frameLocator !== "function") {
      throw new TypeError("page does not support frameLocator");
    }
    return page.frameLocator(frame);
  }
  if (Array.isArray(frame)) {
    return frame.reduce((root, step) => {
      if (typeof root.frameLocator !== "function") {
        throw new TypeError("nested frame traversal requires frameLocator");
      }
      return root.frameLocator(step);
    }, page);
  }
  throw new TypeError("options.frame must be a selector string or an array");
}

export async function captureTargetSnapshot(page, selector, options = {}) {
  if (!page || typeof selector !== "string" || !selector.trim()) {
    throw new TypeError("page and a non-empty selector are required");
  }

  const root = resolveSearchRoot(page, options);

  return root.locator(selector).first().evaluate(
    (element, testIdAttributes) => {
      const normalized = (value) =>
        String(value ?? "").replace(/\s+/g, " ").trim();

      const staticRoles = {
        article: "article",
        aside: "complementary",
        button: "button",
        dialog: "dialog",
        fieldset: "group",
        figure: "figure",
        form: "form",
        h1: "heading",
        h2: "heading",
        h3: "heading",
        h4: "heading",
        h5: "heading",
        h6: "heading",
        hr: "separator",
        img: "img",
        main: "main",
        meter: "meter",
        nav: "navigation",
        ol: "list",
        optgroup: "group",
        option: "option",
        output: "status",
        progress: "progressbar",
        search: "search",
        summary: "button",
        table: "table",
        tbody: "rowgroup",
        td: "cell",
        textarea: "textbox",
        tfoot: "rowgroup",
        th: "columnheader",
        thead: "rowgroup",
        tr: "row",
        ul: "list",
      };
      const inputTypeRoles = {
        button: "button",
        checkbox: "checkbox",
        email: "textbox",
        image: "button",
        number: "spinbutton",
        radio: "radio",
        range: "slider",
        reset: "button",
        search: "searchbox",
        submit: "button",
        tel: "textbox",
        text: "textbox",
        url: "textbox",
      };

      const tagName = element.tagName.toLowerCase();
      const inputType = normalized(element.getAttribute("type")).toLowerCase();

      let implicitRole = normalized(element.getAttribute("role"));
      if (!implicitRole) {
        if (tagName === "a" || tagName === "area") {
          implicitRole = element.hasAttribute("href") ? "link" : "";
        } else if (tagName === "input") {
          // A list-backed text input exposes the combobox role.
          implicitRole =
            inputType === "text" && element.hasAttribute("list")
              ? "combobox"
              : (inputTypeRoles[inputType] ?? "textbox");
        } else if (tagName === "select") {
          // Multi-select and sized selects expose listbox, not combobox.
          implicitRole =
            element.multiple || Number(element.size) > 1
              ? "listbox"
              : "combobox";
        } else if (tagName === "section") {
          // Only a named section is a region.
          implicitRole =
            element.hasAttribute("aria-label") ||
            element.hasAttribute("aria-labelledby")
              ? "region"
              : "";
        } else {
          implicitRole = staticRoles[tagName] ?? "";
        }
      }

      const labels = "labels" in element ? element.labels : null;
      const label = normalized(labels?.[0]?.textContent);

      // aria-labelledby wins over aria-label in the accessible name calculation.
      const labelledBy = normalized(element.getAttribute("aria-labelledby"));
      const labelledByText = labelledBy
        ? normalized(
            labelledBy
              .split(/\s+/)
              .map((id) => element.ownerDocument.getElementById(id))
              .filter(Boolean)
              .map((node) =>
                normalized(
                  node.getAttribute("aria-label") || node.textContent,
                ),
              )
              .filter(Boolean)
              .join(" "),
          )
        : "";

      const accessibleName =
        labelledByText ||
        normalized(element.getAttribute("aria-label")) ||
        label ||
        normalized(element.getAttribute("alt")) ||
        normalized(element.getAttribute("title")) ||
        normalized(element.textContent);

      const testIdAttribute = testIdAttributes.find((attribute) =>
        element.hasAttribute(attribute),
      );

      return {
        tagName,
        inputType,
        role: normalized(implicitRole),
        accessibleName,
        label,
        labelledByText,
        placeholder: normalized(element.getAttribute("placeholder")),
        text: normalized(element.textContent),
        id: normalized(element.id),
        name: normalized(element.getAttribute("name")),
        testId: testIdAttribute
          ? {
              attribute: testIdAttribute,
              value: normalized(element.getAttribute(testIdAttribute)),
            }
          : null,
      };
    },
    TEST_ID_ATTRIBUTES,
  );
}

export async function validateSelectorCandidates(page, candidates, options = {}) {
  const timeout = options.timeout ?? 5_000;
  const requireVisible = options.requireVisible ?? true;
  const root = resolveSearchRoot(page, options);

  return Promise.all(
    candidates.map(async (candidate) => {
      const locator = locatorFromCandidate(root, candidate);
      let count = 0;
      let visible = false;
      let error = null;

      try {
        count = await locator.count();
        if (count === 1) {
          visible = requireVisible
            ? await locator.first().isVisible({ timeout })
            : true;
        }
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }

      return {
        ...candidate,
        locator: formatPlaywrightLocator(candidate),
        count,
        unique: count === 1,
        visible,
        valid: count === 1 && visible,
        error,
      };
    }),
  );
}

export function chooseBestCandidate(results) {
  return results.find((result) => result.valid) ?? null;
}

export async function discoverAndValidate(page, selector, options = {}) {
  const snapshot = await captureTargetSnapshot(page, selector, options);
  const candidates = discoverSelectorCandidates(snapshot, options);
  const results = await validateSelectorCandidates(page, candidates, options);
  return {
    snapshot,
    results,
    best: chooseBestCandidate(results),
  };
}

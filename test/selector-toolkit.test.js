import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseBestCandidate,
  discoverSelectorCandidates,
  formatPlaywrightLocator,
  isLikelyGeneratedIdentifier,
  locatorFromCandidate,
  validateSelectorCandidates,
} from "../src/index.js";

test("ranks accessible contracts ahead of implementation selectors", () => {
  const candidates = discoverSelectorCandidates({
    tagName: "button",
    role: "button",
    accessibleName: "Save changes",
    label: "",
    placeholder: "",
    text: "Save changes",
    id: "save-button",
    name: "",
    testId: { attribute: "data-testid", value: "save" },
  });

  assert.equal(candidates[0].kind, "role");
  assert.equal(candidates[0].score, 100);
  assert.ok(candidates.some((candidate) => candidate.kind === "testId"));
  assert.ok(candidates.some((candidate) => candidate.kind === "css"));
  assert.equal(
    formatPlaywrightLocator(candidates[0]),
    'page.getByRole("button", {"name":"Save changes","exact":true})',
  );
});

test("uses non-default test hooks as explicit CSS candidates", () => {
  const [candidate] = discoverSelectorCandidates({
    tagName: "input",
    testId: { attribute: "data-qa", value: 'account"name' },
  });

  assert.deepEqual(candidate, {
    kind: "css",
    value: '[data-qa="account\\"name"]',
    score: 85,
    reason: "data-qa is an explicit automation hook.",
  });
});

test("rejects generated identifiers and keeps stable names", () => {
  assert.equal(isLikelyGeneratedIdentifier(":r17:"), true);
  assert.equal(
    isLikelyGeneratedIdentifier("9f47ef59-7bd5-4a91-a410-fd027f746bc4"),
    true,
  );
  assert.equal(isLikelyGeneratedIdentifier("customer-email"), false);

  const candidates = discoverSelectorCandidates({
    tagName: "input",
    id: ":r17:",
    name: "customer-email",
  });
  assert.deepEqual(candidates.map((candidate) => candidate.value), [
    'input[name="customer-email"]',
  ]);
});

test("builds each supported Playwright locator", () => {
  const calls = [];
  const locator = {};
  const page = {
    getByRole: (...args) => (calls.push(["role", ...args]), locator),
    getByLabel: (...args) => (calls.push(["label", ...args]), locator),
    getByTestId: (...args) => (calls.push(["testId", ...args]), locator),
    getByPlaceholder: (...args) =>
      (calls.push(["placeholder", ...args]), locator),
    getByText: (...args) => (calls.push(["text", ...args]), locator),
    locator: (...args) => (calls.push(["css", ...args]), locator),
  };

  for (const candidate of [
    { kind: "role", value: "button", options: { name: "Save" } },
    { kind: "label", value: "Email", options: { exact: true } },
    { kind: "testId", value: "save" },
    { kind: "placeholder", value: "name@example.com", options: {} },
    { kind: "text", value: "Continue", options: { exact: true } },
    { kind: "css", value: '[name="email"]' },
  ]) {
    assert.equal(locatorFromCandidate(page, candidate), locator);
  }

  assert.deepEqual(calls.map(([kind]) => kind), [
    "role",
    "label",
    "testId",
    "placeholder",
    "text",
    "css",
  ]);
});

test("validates uniqueness and visibility without hiding failures", async () => {
  const state = new Map([
    ["button", { count: 1, visible: true }],
    ["duplicate", { count: 2, visible: true }],
    ["hidden", { count: 1, visible: false }],
  ]);
  const locatorFor = (value) => ({
    count: async () => state.get(value).count,
    first: () => ({
      isVisible: async () => state.get(value).visible,
    }),
  });
  const page = {
    getByRole: (value) => locatorFor(value),
    getByText: (value) => locatorFor(value),
    locator: (value) => locatorFor(value),
  };
  const candidates = [
    { kind: "role", value: "button", options: {}, score: 100 },
    { kind: "text", value: "duplicate", options: {}, score: 55 },
    { kind: "css", value: "hidden", score: 50 },
  ];

  const results = await validateSelectorCandidates(page, candidates);
  assert.deepEqual(
    results.map(({ count, unique, visible, valid }) => ({
      count,
      unique,
      visible,
      valid,
    })),
    [
      { count: 1, unique: true, visible: true, valid: true },
      { count: 2, unique: false, visible: false, valid: false },
      { count: 1, unique: true, visible: false, valid: false },
    ],
  );
  assert.equal(chooseBestCandidate(results), results[0]);
});

test("returns no best candidate when every locator is ambiguous", () => {
  assert.equal(
    chooseBestCandidate([
      { valid: false, count: 2 },
      { valid: false, count: 0 },
    ]),
    null,
  );
});

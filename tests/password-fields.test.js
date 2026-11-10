import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("password controls start masked with independent accessible non-submit visibility buttons", async () => {
  const directory = mkdtempSync(join(process.cwd(), ".finbiz-password-check-"));
  const entry = join(directory, "ui.mjs");
  try {
    await build({
      stdin: {
        contents:
          "export {FormInput} from './src/PasswordInput.tsx'; export {default as Login} from './src/Login.tsx'; export {default as Setup} from './src/Setup.tsx'; export {PasswordReset} from './src/RoleWorkflows.tsx';",
        resolveDir: process.cwd(),
        loader: "tsx",
      },
      outfile: entry,
      bundle: true,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      external: ["react", "react/*", "@phosphor-icons/react"],
      loader: { ".css": "empty" },
      logLevel: "silent",
    });
    const { FormInput, Login, Setup, PasswordReset } = await import(
      pathToFileURL(entry).href
    );
    const render = (component, props) =>
      renderToStaticMarkup(React.createElement(component, props));
    const login = render(Login, {
      demo: false,
      onAuthenticate: async () => {},
    });
    assert.match(login, /id="login-password" type="password"/);
    assert.match(
      login,
      /type="button" class="password-visibility" aria-label="Show password" aria-controls="login-password" aria-pressed="false"/,
    );
    assert.match(login, /autoComplete="current-password"/);
    const setup = render(Setup, {
      tokenRequired: true,
      onComplete: async () => {},
    });
    assert.match(
      setup,
      /aria-label="Show password" aria-controls="setup-owner_password"/,
    );
    assert.match(
      setup,
      /aria-label="Show confirm password" aria-controls="setup-owner_confirm"/,
    );
    assert.equal((setup.match(/class="password-visibility"/g) || []).length, 2);
    const reset = render(PasswordReset, {
      user: { name: "Test staff", email: "staff@example.com", id: "staff" },
      api: async () => ({}),
      refresh: () => {},
      onClose: () => {},
    });
    assert.match(reset, /aria-label="Show administrator password"/);
    assert.match(reset, /type="password"/);
    for (const name of [
      "current",
      "password",
      "confirmation",
      "admin_password",
      "admin_confirm",
      "setup_token",
    ]) {
      const html = render(FormInput, {
        name,
        id: name,
        type: "password",
        required: true,
        autoComplete: name === "current" ? "current-password" : "new-password",
        "aria-describedby": `${name}-help`,
        "aria-invalid": true,
      });
      assert.match(html, new RegExp(`aria-controls="${name}"`));
      assert.match(html, /aria-invalid="true"/);
      assert.match(html, /required=""/);
      assert.match(html, /type="password"/);
    }
    const ordinary = render(FormInput, {
      name: "email",
      type: "email",
      visibilityLabel: "email",
    });
    assert.ok(!ordinary.includes("password-visibility"));
    assert.ok(!ordinary.includes("visibilityLabel"));
    const disabled = render(FormInput, { type: "password", disabled: true });
    assert.match(disabled, /aria-pressed="false" disabled=""/);
  } finally {
    unlinkSync(entry);
    rmdirSync(directory);
  }
});

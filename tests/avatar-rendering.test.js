import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("profile, shared header and user identity render saved photos with labelled initials fallbacks", async () => {
  const directory = mkdtempSync(join(process.cwd(), ".finbiz-avatar-check-"));
  const entry = join(directory, "ui.mjs");
  try {
    await build({
      stdin: {
        contents:
          "export {WorkspaceTopbar} from './src/Dashboard.tsx'; export {default as ProfilePage} from './src/ProfilePage.tsx'; export {UserIdentity} from './src/UserAvatar.tsx';",
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
    const { WorkspaceTopbar, ProfilePage, UserIdentity } = await import(
      pathToFileURL(entry).href
    );
    const user = {
      id: "test",
      name: "Hannah Gassama",
      email: "test@example.com",
      role: "manager",
      image_url: "/api/profile/image?v=123",
    };
    const noop = () => {};
    const header = renderToStaticMarkup(
      React.createElement(WorkspaceTopbar, {
        user,
        pending: 0,
        readAll: true,
        onMenu: noop,
        onNavigate: noop,
        onSearch: noop,
        onRefresh: noop,
      }),
    );
    assert.match(header, /src="\/api\/profile\/image\?v=123"/);
    assert.match(header, /aria-label="Account menu for Hannah Gassama"/);
    assert.match(header, /My profile and password/);
    assert.match(header, /workspace-profile-status/);
    const profile = renderToStaticMarkup(
      React.createElement(ProfilePage, {
        user,
        role: "Manager",
        company: "Test company",
        demo: true,
        canApprove: true,
        onEdit: noop,
        onPassword: noop,
        onPhoto: async () => {},
      }),
    );
    assert.match(profile, /src="\/api\/profile\/image\?v=123"/);
    assert.match(profile, /Change photo/);
    assert.match(profile, /Remove photo/);
    const fallback = renderToStaticMarkup(
      React.createElement(UserIdentity, { name: user.name }),
    );
    assert.match(fallback, />HG<\/span>/);
    assert.match(fallback, /Hannah Gassama/);
    assert.ok(!fallback.includes("<img"));
    const person = renderToStaticMarkup(
      React.createElement(UserIdentity, {
        name: user.name,
        src: "/api/users/test/image?v=123",
        detail: user.email,
      }),
    );
    assert.match(person, /src="\/api\/users\/test\/image\?v=123"/);
    assert.match(person, /test@example.com/);
  } finally {
    unlinkSync(entry);
    rmdirSync(directory);
  }
});

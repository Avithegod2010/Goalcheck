import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyNativeGlue } from "../../scripts/native-glue.mjs";

/*
 * Android backup policy (audit M2).
 *
 * The workspace lives on the device as plaintext JSON in IndexedDB, a permanent
 * duplicate in localStorage, and unencrypted attachment blobs. The Capacitor
 * template ships `android:allowBackup="true"`, and `android:allowBackup`
 * defaults to true, so the whole task/note history was eligible for Google
 * Drive cloud backup and device transfer — while the product promise is "your
 * data stays on your device". Vault encryption does not cover it (that only
 * wraps the optional sync file).
 *
 * The fix has two halves that must not drift:
 *   1. the committed manifest says allowBackup="false" (what `./gradlew
 *      assembleDebug` builds without running the sync script), and
 *   2. scripts/native-glue.mjs forces it back after every `cap add android`,
 *      which regenerates the whole manifest from the template.
 * These tests drive the real glue against a template-shaped fixture, so a
 * regression in either half fails here instead of in a shipped APK.
 */

const TEMPLATE_MANIFEST = `<?xml version="1.0" encoding="utf-8" ?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;

const MAIN_ACTIVITY_JAVA = `package com.example.gc;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
}
`;

/** Minimal but structurally faithful `cap add android` tree for the glue. */
function scaffold(manifestXml: string): string {
  const dir = mkdtempSync(join(tmpdir(), "gc-glue-"));
  const android = join(dir, "android");
  const main = join(android, "app", "src", "main");
  mkdirSync(join(main, "java", "com", "example", "gc"), { recursive: true });
  mkdirSync(join(main, "res", "values"), { recursive: true });

  writeFileSync(join(main, "AndroidManifest.xml"), manifestXml);
  writeFileSync(join(main, "java", "com", "example", "gc", "MainActivity.java"), MAIN_ACTIVITY_JAVA);
  writeFileSync(join(main, "res", "values", "strings.xml"), `<resources>\n    <string name="app_name">Goalcheck</string>\n</resources>\n`);
  writeFileSync(
    join(android, "build.gradle"),
    `buildscript {\n    dependencies {\n        classpath 'com.android.tools.build:gradle:8.7.2'\n    }\n}\n`
  );
  writeFileSync(join(android, "app", "build.gradle"), `android {\n    defaultConfig {\n        applicationId "com.example.gc"\n    }\n}\n`);
  return android;
}

function manifestOf(android: string): string {
  return readFileSync(join(android, "app", "src", "main", "AndroidManifest.xml"), "utf8");
}

/** The <application ...> opening tag, wherever it sits. */
function applicationTag(xml: string): string {
  const m = xml.match(/<application\b[^>]*>/);
  if (!m) throw new Error("fixture has no <application> tag");
  return m[0];
}

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("native glue — Android backup policy", () => {
  it("rewrites the template's allowBackup=true to false and keeps the rest of the tag", () => {
    const android = scaffold(TEMPLATE_MANIFEST);
    dirs.push(dirname(android));

    applyNativeGlue(android);
    const xml = manifestOf(android);

    expect(applicationTag(xml)).toContain('android:allowBackup="false"');
    expect(xml).not.toContain('android:allowBackup="true"');
    // one attribute only — no duplicate from a clumsy insert
    expect(xml.match(/android:allowBackup=/g)).toHaveLength(1);
    // the rewrite must not eat the rest of the opening tag
    expect(applicationTag(xml)).toContain('android:icon="@mipmap/ic_launcher"');
    expect(applicationTag(xml)).toContain('android:supportsRtl="true"');
    expect(xml.trimEnd().endsWith("</manifest>")).toBe(true);
  });

  it("is byte-stable: a second run changes nothing", () => {
    const android = scaffold(TEMPLATE_MANIFEST);
    dirs.push(dirname(android));

    applyNativeGlue(android);
    const first = manifestOf(android);
    applyNativeGlue(android);
    const second = manifestOf(android);

    expect(second).toBe(first);
    expect(second.match(/android:allowBackup=/g)).toHaveLength(1);
    expect(applicationTag(second)).toContain('android:allowBackup="false"');
  });

  it("inserts the attribute when a future template drops it (the platform default is true)", () => {
    const android = scaffold(TEMPLATE_MANIFEST.replace(/\s*android:allowBackup="true"/, ""));
    dirs.push(dirname(android));
    expect(manifestOf(android)).not.toContain("android:allowBackup");

    applyNativeGlue(android);
    const xml = manifestOf(android);

    expect(xml.match(/android:allowBackup=/g)).toHaveLength(1);
    expect(applicationTag(xml)).toContain('android:allowBackup="false"');
    expect(applicationTag(xml)).toContain('android:supportsRtl="true"');
  });

  it("leaves an already-hardened manifest alone across runs", () => {
    const android = scaffold(TEMPLATE_MANIFEST.replace('android:allowBackup="true"', 'android:allowBackup="false"'));
    dirs.push(dirname(android));

    applyNativeGlue(android);
    const first = manifestOf(android);
    applyNativeGlue(android);

    expect(manifestOf(android)).toBe(first);
    expect(manifestOf(android).match(/android:allowBackup=/g)).toHaveLength(1);
    expect(applicationTag(first)).toContain('android:allowBackup="false"');
  });

  it("fails closed when there is no <application> tag to harden", () => {
    const android = scaffold(`<?xml version="1.0" encoding="utf-8" ?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n</manifest>\n`);
    dirs.push(dirname(android));

    expect(() => applyNativeGlue(android)).toThrow(/no <application>/);
  });

  it("still refuses a manifest that declares INTERNET (glue runs after the zero-internet strip)", () => {
    const android = scaffold(
      TEMPLATE_MANIFEST.replace(
        "</manifest>",
        `    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>`
      )
    );
    dirs.push(dirname(android));

    expect(() => applyNativeGlue(android)).toThrow(/INTERNET/);
  });

  it("keeps the committed manifest hardened — builds that skip the script are covered too", () => {
    const committed = readFileSync(
      join(process.cwd(), "capacitor", "android", "app", "src", "main", "AndroidManifest.xml"),
      "utf8"
    );

    expect(committed.match(/android:allowBackup=/g)).toHaveLength(1);
    expect(applicationTag(committed)).toContain('android:allowBackup="false"');
    expect(committed).not.toMatch(/android:allowBackup="true"/);
    // the promise it protects is still intact next door
    expect(committed).not.toMatch(/<uses-permission[^>]*INTERNET/);
  });
});

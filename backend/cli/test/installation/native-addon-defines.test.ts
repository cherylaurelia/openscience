import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { nativeAddonDefines } from "../../script/build-options"

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

test("nativeAddonDefines turns off cbor native acceleration in a bundle", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openscience-cbor-build-"))
  roots.push(root)
  const cbor = Bun.resolveSync("cbor-x", path.dirname(Bun.resolveSync("modal", import.meta.dir)))
  const entry = path.join(root, "entry.ts")
  await Bun.write(
    entry,
    `import { decode, encode, isNativeAccelerationEnabled } from ${JSON.stringify(cbor)}; console.log(JSON.stringify({ native: isNativeAccelerationEnabled, value: decode(encode({ a: [1, "b"] })) }));`,
  )
  const build = await Bun.build({
    entrypoints: [entry],
    outdir: path.join(root, "out"),
    target: "bun",
    define: nativeAddonDefines,
  })
  expect(build.success, build.logs.join("\n")).toBe(true)
  const child = Bun.spawn([process.execPath, path.join(root, "out/entry.js")], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, CBOR_NATIVE_ACCELERATION_DISABLED: undefined },
  })
  const output = await new Response(child.stdout).text()
  expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
  expect(JSON.parse(output)).toEqual({ native: false, value: { a: [1, "b"] } })
})

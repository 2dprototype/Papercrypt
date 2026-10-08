const assert = require("assert");
global.btoa = global.btoa || (s => Buffer.from(s, "binary").toString("base64"));
const PC = require("../js/codec.js");
const rnd = n => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (Math.random() * 256) | 0; return b; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
let t = 0; const ok = m => console.log("ok", ++t, m);

// 1. random binary, shuffled, duplicates
let data = rnd(20000);
let r = PC.encode(data, { name: "a.bin", chunkBytes: 400 });
let A = new PC.Assembler();
shuffle([...r.chunks, ...r.chunks.slice(0, 5)]).forEach(c => A.add(c));
let out = A.finish(r.id);
assert(eq(out.bytes, data) && out.name === "a.bin"); ok("binary roundtrip, shuffled+dupes (" + r.chunks.length + " chunks)");

// 2. compressible text w/ unicode
const txt = PC.utf8("héllo wörld ✓ ".repeat(3000));
r = PC.encode(txt, { chunkBytes: 300 }); assert(r.info.flags.includes("z"));
A = new PC.Assembler(); r.chunks.forEach(c => A.add(c));
assert(eq(A.finish(r.id).bytes, txt)); ok("compressed unicode text, " + r.info.dataChunks + " chunks vs " + Math.ceil(txt.length / 300));

// 3. encryption
data = rnd(5000);
r = PC.encode(data, { password: "hunter2", chunkBytes: 500 });
A = new PC.Assembler(); r.chunks.forEach(c => A.add(c));
assert.throws(() => A.finish(r.id), e => e.code === "NEEDPASS");
assert.throws(() => A.finish(r.id, "wrong"), e => e.code === "BADPASS");
assert(eq(A.finish(r.id, "hunter2").bytes, data)); ok("encryption: needpass / badpass / ok");

// 4. parity: drop one chunk per group (incl. last chunk) & recover
data = rnd(10000);
r = PC.encode(data, { chunkBytes: 333, parityGroup: 4, compress: false });
const n = r.info.dataChunks;
const dropped = [];
for (let k = 0; k * 4 < n; k++) { const hi = Math.min(n, k * 4 + 4); dropped.push(k === Math.floor((n - 1) / 4) ? n - 1 : hi - 1 - (k % 2)); }
A = new PC.Assembler();
r.chunks.forEach((c, i) => { if (!dropped.includes(i)) A.add(c); });
const st = A.status(r.id); assert(st.complete && st.recovered > 0, JSON.stringify(st));
assert(eq(A.finish(r.id).bytes, data)); ok("parity recovery of " + st.recovered + " lost chunks");

// 5. two drops in same group -> incomplete
A = new PC.Assembler();
r.chunks.forEach((c, i) => { if (i !== 0 && i !== 1) A.add(c); });
assert(!A.status(r.id).complete); assert.deepStrictEqual(A.missing(r.id), [0, 1]); ok("unrecoverable reported as missing");

// 6. corruption detected
const bad = r.chunks[2].slice(0, -6) + "AAAAA=";
assert.throws(() => new PC.Assembler().add(bad), e => e.code === "CRC"); ok("corrupt chunk rejected");
assert.throws(() => new PC.Assembler().add("hello"), e => e.code === "FORMAT"); ok("foreign QR rejected");

// 7. tiny + empty + capacity
for (const d of [new Uint8Array(0), PC.utf8("x")]) {
	r = PC.encode(d, {}); A = new PC.Assembler(); r.chunks.forEach(c => A.add(c)); assert(eq(A.finish(r.id).bytes, d));
} ok("empty and 1-byte inputs");
for (const L of "LMQH") { const cb = PC.maxChunkBytes(L); r = PC.encode(rnd(cb * 2), { chunkBytes: cb, compress: false }); assert(r.chunks[0].length <= PC.QR_CAPACITY[L]); }
ok("max chunk size fits QR capacity at every level");
console.log("ALL PASS");

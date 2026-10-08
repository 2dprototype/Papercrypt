/*
 * Papercrypt codec (no DOM) — wire format "PC2".
 *
 *   file -> container(meta+data) -> [deflate] -> [AES-256-CBC + HMAC] -> split into N-byte chunks
 *   every chunk -> "PC2|id|i|n|g|flags|L|crc32\n" + base64(bytes)
 *
 *   i     data index 0..n-1, or "p<k>" = XOR parity of data group k
 *   n     number of data chunks         g  parity group size (0 = no parity)
 *   flags "-" or letters: z = deflated, e = encrypted
 *   L     byte length of the (compressed/encrypted) stream, used to trim padding
 *   crc32 of the base64 body (hex)
 */
(function (root) {
	"use strict";
	const isNode = typeof module === "object" && module.exports;
	const pako = isNode ? require("../lib/pako.min.js") : root.pako;
	const CryptoJS = isNode ? require("../lib/crypto-js.min.js") : root.CryptoJS;

	const MAGIC = "PC2";
	const PBKDF2_ITER = 100000;
	// max bytes a QR (v40, byte mode) can hold per error-correction level
	const QR_CAPACITY = { L: 2953, M: 2331, Q: 1663, H: 1273 };
	const HEADER_BUDGET = 72;

	/* ---------- byte helpers ---------- */
	function utf8(str) { return new TextEncoder().encode(str); }
	function unutf8(b) { return new TextDecoder().decode(b); }

	function b64encode(u8) {
		let s = "";
		for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
		return btoa(s);
	}
	function b64decode(str) {
		const s = atob(str);
		const u8 = new Uint8Array(s.length);
		for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
		return u8;
	}
	function concat(arrs) {
		let len = 0; for (const a of arrs) len += a.length;
		const out = new Uint8Array(len); let o = 0;
		for (const a of arrs) { out.set(a, o); o += a.length; }
		return out;
	}
	function toWA(u8) {
		const words = [];
		for (let i = 0; i < u8.length; i += 4)
			words.push(((u8[i] << 24) | ((u8[i + 1] || 0) << 16) | ((u8[i + 2] || 0) << 8) | (u8[i + 3] || 0)) | 0);
		return CryptoJS.lib.WordArray.create(words, u8.length);
	}
	function fromWA(wa) {
		const n = wa.sigBytes, u8 = new Uint8Array(n);
		for (let i = 0; i < n; i++) u8[i] = (wa.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
		return u8;
	}
	let CRC_TABLE = null;
	function crc32(str) {
		if (!CRC_TABLE) {
			CRC_TABLE = new Uint32Array(256);
			for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
		}
		let c = 0xffffffff;
		for (let i = 0; i < str.length; i++) c = CRC_TABLE[(c ^ str.charCodeAt(i)) & 0xff] ^ (c >>> 8);
		return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
	}
	function sha256hex(u8) { return CryptoJS.SHA256(toWA(u8)).toString(); }
	function randomId(n = 6) {
		const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
		const r = new Uint8Array(n);
		(root.crypto || require("crypto").webcrypto).getRandomValues(r);
		return Array.from(r, v => chars[v % chars.length]).join("");
	}

	/* ---------- crypto ---------- */
	function encryptBytes(u8, password) {
		const salt = CryptoJS.lib.WordArray.random(16), iv = CryptoJS.lib.WordArray.random(16);
		const dk = CryptoJS.PBKDF2(password, salt, { keySize: 16, iterations: PBKDF2_ITER, hasher: CryptoJS.algo.SHA256 });
		const key = CryptoJS.lib.WordArray.create(dk.words.slice(0, 8), 32);
		const hkey = CryptoJS.lib.WordArray.create(dk.words.slice(8, 16), 32);
		const ct = CryptoJS.AES.encrypt(toWA(u8), key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).ciphertext;
		const body = salt.clone().concat(iv).concat(ct);
		const mac = CryptoJS.HmacSHA256(body, hkey);
		return fromWA(body.clone().concat(mac));
	}
	function decryptBytes(u8, password) {
		if (u8.length < 16 + 16 + 16 + 32) throw codecError("CORRUPT", "Encrypted payload too short");
		const salt = toWA(u8.subarray(0, 16)), iv = toWA(u8.subarray(16, 32));
		const ct = toWA(u8.subarray(32, u8.length - 32));
		const mac = u8.subarray(u8.length - 32);
		const dk = CryptoJS.PBKDF2(password, salt, { keySize: 16, iterations: PBKDF2_ITER, hasher: CryptoJS.algo.SHA256 });
		const key = CryptoJS.lib.WordArray.create(dk.words.slice(0, 8), 32);
		const hkey = CryptoJS.lib.WordArray.create(dk.words.slice(8, 16), 32);
		const expect = fromWA(CryptoJS.HmacSHA256(toWA(u8.subarray(0, u8.length - 32)), hkey));
		let diff = 0; for (let i = 0; i < 32; i++) diff |= expect[i] ^ mac[i];
		if (diff) throw codecError("BADPASS", "Wrong password (or corrupted data)");
		const pt = CryptoJS.AES.decrypt({ ciphertext: ct }, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
		return fromWA(pt);
	}
	function codecError(code, msg) { const e = new Error(msg); e.code = code; return e; }

	/* ---------- encode ---------- */
	function maxChunkBytes(level) {
		const cap = QR_CAPACITY[level] || QR_CAPACITY.M;
		return Math.floor((cap - HEADER_BUDGET) / 4) * 3;
	}

	/**
	 * @param {Uint8Array} data
	 * @param {{name?:string, mime?:string, chunkBytes?:number, parityGroup?:number,
	 *          compress?:boolean, password?:string, id?:string}} o
	 * @returns {{id:string, chunks:string[], info:object}}
	 */
	function encode(data, o = {}) {
		const chunkBytes = Math.max(16, o.chunkBytes || 400);
		const g = Math.max(0, Math.min(255, o.parityGroup | 0));
		const id = (o.id || randomId()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 12) || randomId();
		const meta = utf8(JSON.stringify({ v: 2, name: o.name || "", mime: o.mime || "", size: data.length, sha: sha256hex(data).slice(0, 16) }));
		const head = new Uint8Array(4); new DataView(head.buffer).setUint32(0, meta.length);
		let stream = concat([head, meta, data]), flags = "";
		if (o.compress !== false) {
			const z = pako.deflate(stream, { level: 9 });
			if (z.length < stream.length) { stream = z; flags += "z"; }
		}
		if (o.password) { stream = encryptBytes(stream, o.password); flags += "e"; }
		if (!flags) flags = "-";

		const L = stream.length, n = Math.max(1, Math.ceil(L / chunkBytes));
		const mk = (i, bytes) => {
			const body = b64encode(bytes);
			return `${MAGIC}|${id}|${i}|${n}|${g}|${flags}|${L}|${crc32(body)}\n${body}`;
		};
		const chunks = [], raw = [];
		for (let i = 0; i < n; i++) {
			const part = stream.subarray(i * chunkBytes, (i + 1) * chunkBytes);
			raw.push(part); chunks.push(mk(i, part));
		}
		if (g > 0) {
			for (let k = 0; k * g < n; k++) {
				const par = new Uint8Array(chunkBytes);
				for (let i = k * g; i < Math.min(n, (k + 1) * g); i++)
					for (let j = 0; j < raw[i].length; j++) par[j] ^= raw[i][j];
				chunks.push(mk("p" + k, par));
			}
		}
		return { id, chunks, info: { dataChunks: n, parityChunks: chunks.length - n, streamBytes: L, flags, originalBytes: data.length } };
	}

	/* ---------- decode ---------- */
	function parseChunk(text) {
		text = String(text).trim();
		const nl = text.indexOf("\n");
		if (nl < 0 || !text.startsWith(MAGIC + "|")) throw codecError("FORMAT", "Not a Papercrypt chunk");
		const h = text.slice(0, nl).split("|"), body = text.slice(nl + 1).trim();
		if (h.length !== 8) throw codecError("FORMAT", "Bad chunk header");
		const parity = h[2][0] === "p";
		const c = { id: h[1], parity, idx: parseInt(parity ? h[2].slice(1) : h[2], 10), n: +h[3], g: +h[4], flags: h[5], L: +h[6], crc: h[7], body };
		if (![c.idx, c.n, c.g, c.L].every(Number.isFinite) || c.n < 1) throw codecError("FORMAT", "Bad chunk header");
		if (crc32(body) !== c.crc) throw codecError("CRC", "Chunk failed checksum (bad scan?)");
		return c;
	}

	class Assembler {
		constructor() { this.sessions = {}; }

		/** @returns {{id:string, isNew:boolean}} — throws on invalid chunk */
		add(text) {
			const c = parseChunk(text);
			let s = this.sessions[c.id];
			if (!s) s = this.sessions[c.id] = { id: c.id, n: c.n, g: c.g, flags: c.flags, L: c.L, data: {}, parity: {}, recovered: {}, N: 0 };
			if (s.n !== c.n || s.L !== c.L) throw codecError("MISMATCH", `Chunk doesn't belong to set "${c.id}"`);
			const map = c.parity ? s.parity : s.data;
			const isNew = !(c.idx in map);
			if (isNew) {
				map[c.idx] = b64decode(c.body);
				if (c.parity || c.idx < c.n - 1) s.N = map[c.idx].length;
				this._recover(s);
			}
			return { id: c.id, isNew };
		}

		_recover(s) {
			if (!s.g || !s.N) return;
			for (let k = 0; k * s.g < s.n; k++) {
				if (!(k in s.parity)) continue;
				const lo = k * s.g, hi = Math.min(s.n, lo + s.g);
				const missing = []; for (let i = lo; i < hi; i++) if (!(i in s.data)) missing.push(i);
				if (missing.length !== 1) continue;
				const out = new Uint8Array(s.N); out.set(s.parity[k].subarray(0, s.N));
				for (let i = lo; i < hi; i++) if (i in s.data) for (let j = 0; j < s.data[i].length; j++) out[j] ^= s.data[i][j];
				const m = missing[0];
				s.data[m] = m === s.n - 1 ? out.subarray(0, s.L - m * s.N) : out;
				s.recovered[m] = true;
			}
		}

		status(id) {
			const s = this.sessions[id]; if (!s) return null;
			const cells = [];
			for (let i = 0; i < s.n; i++) cells.push(s.recovered[i] ? 2 : (i in s.data) ? 1 : 0);
			const have = cells.filter(Boolean).length;
			return { id, n: s.n, have, cells, parity: Object.keys(s.parity).length, encrypted: s.flags.includes("e"), complete: have === s.n, recovered: Object.keys(s.recovered).length };
		}
		missing(id) { const st = this.status(id); return st ? st.cells.map((v, i) => v ? -1 : i).filter(i => i >= 0) : []; }

		/** Reassemble. Throws NEEDPASS / BADPASS / CORRUPT. */
		finish(id, password) {
			const s = this.sessions[id];
			if (!s) throw codecError("NOSET", "Unknown set");
			const st = this.status(id);
			if (!st.complete) throw codecError("INCOMPLETE", "Missing chunks");
			let stream = concat(Array.from({ length: s.n }, (_, i) => s.data[i])).subarray(0, s.L);
			if (s.flags.includes("e")) {
				if (!password) throw codecError("NEEDPASS", "Password required");
				stream = decryptBytes(stream, password);
			}
			if (s.flags.includes("z")) {
				try { stream = pako.inflate(stream); } catch (e) { throw codecError("CORRUPT", "Decompression failed"); }
			}
			const metaLen = new DataView(stream.buffer, stream.byteOffset, stream.byteLength).getUint32(0);
			if (metaLen > stream.length - 4) throw codecError("CORRUPT", "Bad container");
			const meta = JSON.parse(unutf8(stream.subarray(4, 4 + metaLen)));
			const bytes = stream.slice(4 + metaLen);
			if (bytes.length !== meta.size || sha256hex(bytes).slice(0, 16) !== meta.sha) throw codecError("CORRUPT", "Integrity check failed");
			return { name: meta.name, mime: meta.mime, bytes };
		}
		reset() { this.sessions = {}; }
	}

	const api = { encode, Assembler, parseChunk, maxChunkBytes, randomId, utf8, unutf8, crc32, QR_CAPACITY };
	if (isNode) module.exports = api; else root.PC = api;
})(typeof window !== "undefined" ? window : globalThis);

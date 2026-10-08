class Scanner {
	constructor() {
		this.$ = id => document.getElementById(id);
		this.asm = new PC.Assembler();
		this.stream = null; this.running = false; this.timer = null;
		this.seen = new Set(); this.results = {};   // id -> {name,mime,bytes,url}
		this.passwords = {};
		this.detector = ("BarcodeDetector" in window) ? new BarcodeDetector({ formats: ["qr_code"] }) : null;
		this.canvas = document.createElement("canvas"); this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
		this.bind();
	}
	bind() {
		const $ = this.$;
		$("btn-start").onclick = () => this.start();
		$("btn-stop").onclick = () => this.stop();
		$("btn-reset").onclick = () => this.reset();
		$("btn-manual").onclick = () => { const t = $("manual").value; if (t.trim()) { this.handle(t); $("manual").value = ""; } };
		$("btn-images").onclick = () => {
			const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
			inp.onchange = async () => { let ok = 0; for (const f of inp.files) { try { if (await this.scanImage(f)) ok++; } catch (e) { console.warn(e); } }
				this.msg(`${ok}/${inp.files.length} image(s) contained a readable QR code`); };
			inp.click();
		};
	}
	msg(t, bad) { const m = this.$("scan-msg"); m.textContent = t; m.style.color = bad ? "var(--bad)" : ""; }

	/* ---- decoding engines: native BarcodeDetector, else jsQR (loaded on demand) ---- */
	loadJsQR() {
		if (window.jsQR) return Promise.resolve();
		return this._jsqr || (this._jsqr = new Promise((res, rej) => {
			const s = document.createElement("script"); s.src = "./lib/jsQR.js";
			s.onload = res;
			s.onerror = () => { const c = document.createElement("script"); c.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"; c.onload = res; c.onerror = () => rej(new Error("QR decoder unavailable (no BarcodeDetector, and jsQR could not load)")); document.head.appendChild(c); };
			document.head.appendChild(s);
		}));
	}
	async decodeSource(src, w, h) {
		if (this.detector) { try { const r = await this.detector.detect(src); if (r.length) return r.map(x => x.rawValue); } catch (e) {} }
		if (!this.detector || !window.BarcodeDetector) {
			await this.loadJsQR();
			this.canvas.width = w; this.canvas.height = h; this.ctx.drawImage(src, 0, 0, w, h);
			const d = this.ctx.getImageData(0, 0, w, h), r = jsQR(d.data, w, h, { inversionAttempts: "attemptBoth" });
			return r ? [r.data] : [];
		}
		return [];
	}
	async scanImage(file) {
		const bmp = await createImageBitmap(file); let found = [];
		for (const maxSide of [bmp.width, 1600, 1000]) {   // retry at smaller sizes — helps with huge photos
			const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
			const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(bmp, 0, 0, w, h);
			found = await this.decodeSource(c, w, h); if (found.length) break;
		}
		found.forEach(t => this.handle(t)); return found.length > 0;
	}

	/* ---- camera ---- */
	async start() {
		if (!navigator.mediaDevices) return this.msg("Camera needs HTTPS or localhost (e.g. run: python3 -m http.server). You can still scan image files or paste text.", true);
		try {
			this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } });
			const v = this.$("video"); v.srcObject = this.stream; await v.play(); v.classList.add("on");
			this.$("btn-start").hidden = true; this.$("btn-stop").hidden = false;
			if (!this.detector) await this.loadJsQR();
			this.running = true; this.msg("Scanning… hold steady on each code"); this.loop();
		} catch (e) { this.msg("Camera error: " + e.message, true); this.stop(); }
	}
	stop() {
		this.running = false; clearTimeout(this.timer);
		if (this.stream) this.stream.getTracks().forEach(t => t.stop()); this.stream = null;
		this.$("video").classList.remove("on"); this.$("btn-start").hidden = false; this.$("btn-stop").hidden = true;
	}
	async loop() {
		if (!this.running) return;
		const v = this.$("video");
		if (v.readyState >= 2 && v.videoWidth) {
			try { (await this.decodeSource(v, v.videoWidth, v.videoHeight)).forEach(t => this.handle(t)); } catch (e) { console.warn(e); }
		}
		this.timer = setTimeout(() => this.loop(), 60);
	}

	/* ---- chunk handling ---- */
	handle(text) {
		if (this.seen.has(text)) return;            // same frame/code seen again
		try {
			const { id, isNew } = this.asm.add(text); this.seen.add(text);
			if (isNew && navigator.vibrate) navigator.vibrate(25);
			this.render(id, isNew);
			const st = this.asm.status(id);
			if (st.complete && !this.results[id]) this.tryFinish(id);
		} catch (e) {
			if (e.code === "FORMAT") return this.msg("Ignored a QR code that isn't a Papercrypt chunk");
			if (e.code === "CRC") return this.msg("Bad scan (checksum failed) — rescan that code", true);
			this.msg(e.message, true);
		}
	}
	tryFinish(id) {
		const st = this.asm.status(id);
		if (st.encrypted && !(id in this.passwords)) return this.render(id);
		try {
			const r = this.asm.finish(id, this.passwords[id]);
			r.url = URL.createObjectURL(new Blob([r.bytes], { type: r.mime || "application/octet-stream" }));
			this.results[id] = r; delete this.passwords[id];
			this.msg(`✓ Set "${id}" restored`); this.running && this.stop();
		} catch (e) {
			if (e.code === "BADPASS") { delete this.passwords[id]; this.setError(id, e.message); }
			else this.setError(id, e.message);
		}
		this.render(id);
	}
	setError(id, m) { (this.errors = this.errors || {})[id] = m; }

	reset() { this.stop(); this.asm.reset(); this.seen.clear(); this.results = {}; this.passwords = {}; this.errors = {}; this.$("sets").innerHTML = ""; this.msg(""); }

	render(id, flash) {
		const st = this.asm.status(id), res = this.results[id], box = this.$("sets");
		let el = document.getElementById("set-" + id);
		if (!el) { el = document.createElement("div"); el.id = "set-" + id; el.className = "card set"; box.appendChild(el); }
		const cells = st.cells.map((v, i) => `<div class="cell ${v === 1 ? "have" : v === 2 ? "rec" : ""}" title="${v === 2 ? "recovered via parity" : v ? "scanned" : "missing"}">${i + 1}</div>`).join("");
		const miss = this.asm.missing(id);
		el.innerHTML = `<div class="set"><h4>Set “${id}” ${res ? "✓" : ""}</h4>
			<progress value="${st.have}" max="${st.n}"></progress>
			<div class="muted">${st.have}/${st.n} chunks${st.recovered ? ` (${st.recovered} recovered via parity)` : ""}${st.parity ? ` · ${st.parity} parity scanned` : ""}${st.encrypted ? " · 🔒 encrypted" : ""}</div>
			<div class="cells">${cells}</div>
			${!st.complete && miss.length && miss.length <= 20 ? `<div class="muted">Missing: ${miss.map(i => i + 1).join(", ")}</div>` : ""}
			<div id="res-${id}"></div></div>`;
		if (flash) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
		const out = el.querySelector("#res-" + id);
		if (st.complete && st.encrypted && !res) {
			out.innerHTML = `<div class="result"><div class="row wrap"><input type="password" placeholder="Password" style="flex:1"><button>Decrypt</button></div><div class="muted" style="color:var(--bad)">${(this.errors || {})[id] || ""}</div></div>`;
			const inp = out.querySelector("input"), go = () => { this.passwords[id] = inp.value; delete (this.errors || {})[id]; out.querySelector("button").disabled = true; out.querySelector("button").textContent = "Working…"; setTimeout(() => this.tryFinish(id), 30); };
			out.querySelector("button").onclick = go; inp.onkeydown = e => { if (e.key === "Enter") go(); };
		} else if (res) this.renderResult(out, res);
		else if (st.complete && (this.errors || {})[id]) out.innerHTML = `<div class="result" style="color:var(--bad)">${this.errors[id]}</div>`;
	}
	renderResult(out, res) {
		const isText = (res.mime || "").startsWith("text/") || (!res.name && !res.mime), isImg = (res.mime || "").startsWith("image/");
		const size = res.bytes.length < 1024 ? res.bytes.length + " B" : (res.bytes.length / 1024).toFixed(1) + " KB";
		out.innerHTML = `<div class="result"><div><b>${res.name ? res.name.replace(/</g, "&lt;") : "text"}</b> <span class="muted">${size}</span></div><div class="row wrap" style="margin:8px 0"><button data-a="dl">Download</button>${isText ? '<button data-a="cp">Copy text</button>' : ""}</div></div>`;
		const box = out.firstChild;
		box.querySelector('[data-a="dl"]').onclick = () => saveAs(new Blob([res.bytes], { type: res.mime || "application/octet-stream" }), res.name || "restored.txt");
		if (isText) {
			const text = PC.unutf8(res.bytes), pre = document.createElement("pre"); pre.textContent = text.length > 20000 ? text.slice(0, 20000) + "\n… (truncated preview)" : text; box.appendChild(pre);
			box.querySelector('[data-a="cp"]').onclick = () => navigator.clipboard.writeText(text);
		} else if (isImg) { const im = new Image(); im.src = res.url; box.appendChild(im); }
	}
	hide() { this.stop(); }
}

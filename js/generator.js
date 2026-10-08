class Generator {
	constructor() {
		this.$ = id => document.getElementById(id);
		this.file = null;           // {name, mime, bytes}
		this.set = null;            // {id, chunks, info}
		this.icon = null;
		this.timer = null; this.frame = 0; this.paused = false;
		this.$("opt-id").value = PC.randomId();
		this.bind(); this.buildIcons();
	}
	buildIcons() {
		const names = ["facebook","google","instagram","messenger","twitter","whatsapp","yahoo","gmail","hellocat","reddit","x","youtube","link","website"];
		const box = this.$("icon-picker");
		const none = document.createElement("button"); none.textContent = "No icon"; none.style.cssText = "background:#8884;color:inherit;padding:4px 8px;margin-right:6px";
		none.onclick = () => { this.icon = null; box.querySelectorAll("img").forEach(i => i.classList.remove("sel")); };
		box.appendChild(none);
		for (const n of names) {
			const im = new Image(); im.src = `./res/icons/${n}.png`; im.width = im.height = 32;
			im.onclick = () => { box.querySelectorAll("img").forEach(i => i.classList.remove("sel")); im.classList.add("sel"); this.icon = im; };
			box.appendChild(im);
		}
	}
	bind() {
		const $ = this.$;
		$("pick-file").onclick = () => {
			const inp = document.createElement("input"); inp.type = "file";
			inp.onchange = async () => {
				const f = inp.files[0]; if (!f) return;
				this.file = { name: f.name, mime: f.type, bytes: new Uint8Array(await f.arrayBuffer()) };
				$("file-info").textContent = `${f.name} — ${this.fmt(f.size)}`;
				$("text-input").value = ""; $("text-input").placeholder = "(file selected — text is ignored)";
			};
			inp.click();
		};
		$("text-input").oninput = () => { if ($("text-input").value) { this.file = null; $("file-info").textContent = "using text"; } };
		$("opt-level").onchange = () => this.clampBytes();
		$("btn-generate").onclick = () => this.generate();
		$("btn-zip").onclick = () => this.zip();
		$("btn-print").onclick = () => this.print();
		$("btn-play").onclick = () => this.togglePlayer();
		$("pl-pause").onclick = () => { this.paused = !this.paused; $("pl-pause").textContent = this.paused ? "▶ Resume" : "⏸ Pause"; };
		$("pl-next").onclick = () => { this.paused = true; $("pl-pause").textContent = "▶ Resume"; this.step(1); };
		$("pl-prev").onclick = () => { this.paused = true; $("pl-pause").textContent = "▶ Resume"; this.step(-1); };
		$("pl-fps").onchange = () => this.restartTimer();
	}
	fmt(n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(2) + " MB"; }
	clampBytes() {
		const max = PC.maxChunkBytes(this.$("opt-level").value), el = this.$("opt-bytes");
		if (+el.value > max) el.value = max;
		el.max = max; return max;
	}
	log(msg, err) { const l = this.$("gen-log"); l.textContent = msg; l.classList.toggle("err", !!err); }
	appearance() {
		const $ = this.$;
		return { level: $("opt-level").value, qrfg: $("opt-qrfg").value, qrbg: $("opt-qrbg").value, bg: $("opt-bg").value,
			labelSize: +$("opt-labelsize").value || 28, labelColor: $("opt-labelcolor").value, icon: this.icon };
	}
	labelFor(i) {
		const n = this.set.info.dataChunks, s = this.set.chunks.length;
		const isParity = i >= n, idx = isParity ? "P" + (i - n) : String(i + 1);
		return this.$("opt-label").value.replaceAll("#id", this.set.id).replaceAll("#index", idx).replaceAll("#total", String(n)) + (isParity ? " (parity)" : "");
	}
	renderChunk(i, extra) { return QRX.render(this.set.chunks[i], Object.assign(this.appearance(), { label: this.labelFor(i) }, extra)); }

	async generate() {
		const $ = this.$;
		try {
			let bytes, name = "", mime = "";
			if (this.file) ({ bytes, name, mime } = this.file);
			else { const t = $("text-input").value; if (!t) return this.log("Nothing to encode — choose a file or enter text.", true); bytes = PC.utf8(t); mime = "text/plain"; }
			const level = $("opt-level").value, max = this.clampBytes();
			const chunkBytes = Math.min(max, Math.max(64, +$("opt-bytes").value || 400));
			const pass = $("opt-pass").value;
			this.log(pass ? "Encrypting (key derivation takes a moment)…" : "Encoding…");
			await new Promise(r => setTimeout(r, 30));
			this.set = PC.encode(bytes, { name, mime, chunkBytes, parityGroup: +$("opt-parity").value || 0, compress: $("opt-compress").checked, password: pass, id: $("opt-id").value });
			$("opt-id").value = this.set.id;
			const i = this.set.info, total = this.set.chunks.length;
			this.log([`Set "${this.set.id}": ${i.dataChunks} data QR${i.dataChunks > 1 ? "s" : ""}` + (i.parityChunks ? ` + ${i.parityChunks} parity` : "") + ` = ${total} total`,
				`Original ${this.fmt(i.originalBytes)} → payload ${this.fmt(i.streamBytes)}${i.flags.includes("z") ? " (compressed)" : ""}${i.flags.includes("e") ? " (encrypted)" : ""}`,
				total > 150 ? "Tip: that's a lot of codes — consider a larger file-friendly medium or higher compression." : ""].filter(Boolean).join("\n"));
			$("out-card").hidden = false;
			this.thumbs(); if (!$("player").hidden) this.togglePlayer(true);
		} catch (e) { console.error(e); this.log("Error: " + e.message, true); }
	}
	thumbs() {
		const box = this.$("thumbs"); box.innerHTML = "";
		const show = Math.min(this.set.chunks.length, 60);
		for (let i = 0; i < show; i++) box.appendChild(this.renderChunk(i, { target: 300 }));
		if (this.set.chunks.length > show) { const p = document.createElement("div"); p.className = "muted"; p.textContent = `+ ${this.set.chunks.length - show} more (included in ZIP / print / player)`; box.appendChild(p); }
	}
	async zip() {
		if (!this.set) return;
		const btn = this.$("btn-zip"), zip = new JSZip(), dir = zip.folder(`papercrypt-${this.set.id}`), pad = String(this.set.chunks.length).length;
		btn.disabled = true;
		for (let i = 0; i < this.set.chunks.length; i++) {
			btn.textContent = `Rendering ${i + 1}/${this.set.chunks.length}…`;
			dir.file(`${this.set.id}-${String(i + 1).padStart(pad, "0")}${i >= this.set.info.dataChunks ? "-parity" : ""}.png`, await QRX.toBlob(this.renderChunk(i)));
			if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
		}
		saveAs(await zip.generateAsync({ type: "blob" }), `papercrypt-${this.set.id}.zip`);
		btn.disabled = false; btn.textContent = "Download ZIP (PNGs)";
	}
	print() {
		if (!this.set) return;
		const w = window.open("", "_blank"); if (!w) return alert("Allow pop-ups to print.");
		const imgs = this.set.chunks.map((_, i) => `<figure><img src="${this.renderChunk(i, { target: 700 }).toDataURL("image/png")}"></figure>`).join("");
		w.document.write(`<!doctype html><title>Papercrypt ${this.set.id}</title><style>body{margin:10mm;font-family:sans-serif}.g{display:grid;grid-template-columns:1fr 1fr;gap:8mm}figure{margin:0;break-inside:avoid}img{width:100%}@page{margin:8mm}</style><div class="g">${imgs}</div><script>onload=()=>setTimeout(print,300)<\/script>`);
		w.document.close();
	}
	togglePlayer(forceOpen) {
		const p = this.$("player");
		if (!forceOpen && !p.hidden) { p.hidden = true; clearInterval(this.timer); this.$("btn-play").textContent = "▶ Play on screen"; return; }
		p.hidden = false; this.paused = false; this.frame = 0; this.$("pl-pause").textContent = "⏸ Pause";
		this.$("btn-play").textContent = "■ Stop player"; this.draw(); this.restartTimer();
	}
	restartTimer() { clearInterval(this.timer); const fps = Math.max(0.5, Math.min(15, +this.$("pl-fps").value || 3)); this.timer = setInterval(() => { if (!this.paused) this.step(1); }, 1000 / fps); }
	step(d) { const n = this.set.chunks.length; this.frame = (this.frame + d + n) % n; this.draw(); }
	draw() {
		const src = this.renderChunk(this.frame, { target: 700 }), dst = this.$("player-canvas");
		dst.width = src.width; dst.height = src.height; dst.getContext("2d").drawImage(src, 0, 0);
		this.$("pl-count").textContent = `${this.frame + 1} / ${this.set.chunks.length}`;
	}
	stop() { clearInterval(this.timer); }
}

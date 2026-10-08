/* QR rendering: integer module size + quiet zone => crisp, reliably scannable codes */
const QRX = (function () {
	const LEVEL = { L: QRCode.CorrectLevel.L, M: QRCode.CorrectLevel.M, Q: QRCode.CorrectLevel.Q, H: QRCode.CorrectLevel.H };

	function matrix(text, level) {
		const q = new QRCode(document.createElement("div"), { text, width: 1, height: 1, correctLevel: LEVEL[level] || LEVEL.M });
		const model = q._oQRCode, n = model.getModuleCount(), rows = [];
		for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(model.isDark(r, c)); rows.push(row); }
		return rows;
	}

	/**
	 * @param {string} text  chunk text
	 * @param {object} o     {level, qrfg, qrbg, bg, label, labelSize, labelColor, icon(Image|null), withFooter, target}
	 */
	function render(text, o = {}) {
		const m = matrix(text, o.level), n = m.length, quiet = 4;
		const scale = Math.max(3, Math.round((o.target || 560) / (n + quiet * 2)));
		const qrPx = (n + quiet * 2) * scale;
		const footer = o.withFooter === false ? 0 : Math.round(qrPx * 0.16);
		const cv = document.createElement("canvas");
		cv.width = qrPx; cv.height = qrPx + footer;
		const ctx = cv.getContext("2d");
		ctx.fillStyle = o.bg || "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
		ctx.fillStyle = o.qrbg || "#fff"; ctx.fillRect(0, 0, qrPx, qrPx);
		ctx.fillStyle = o.qrfg || "#000";
		for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
		if (footer) {
			let x = footer * 0.2;
			if (o.icon && o.icon.complete && o.icon.naturalWidth) { const s = footer * 0.7; ctx.drawImage(o.icon, x, qrPx + footer * 0.15, s, s); x += s + footer * 0.2; }
			ctx.fillStyle = o.labelColor || "#000";
			const px = (o.labelSize || 28) * (qrPx / 560);
			ctx.font = `${px}px Arial, sans-serif`; ctx.textBaseline = "middle";
			ctx.fillText(o.label || "", x, qrPx + footer / 2);
		}
		return cv;
	}
	const toBlob = cv => new Promise(res => cv.toBlob(res, "image/png"));
	return { matrix, render, toBlob };
})();

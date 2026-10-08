const gen = new Generator(), scan = new Scanner();
function route() {
	const tab = location.hash.includes("scan") ? "scan" : "generate";
	for (const t of ["generate", "scan"]) {
		document.getElementById("tab-" + t).hidden = t !== tab;
		document.querySelector(`nav a[data-tab=${t}]`).classList.toggle("active", t === tab);
	}
	if (tab !== "scan") scan.hide();
}
addEventListener("hashchange", route); route();

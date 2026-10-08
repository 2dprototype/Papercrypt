const gen = new Generator(), scan = new Scanner();

function route() {
	const tab = location.pathname.includes("scan") ? "scan" : "generate";
	for (const t of ["generate", "scan"]) {
		document.getElementById("tab-" + t).hidden = t !== tab;
		document.querySelector(`nav a[data-tab=${t}]`).classList.toggle("active", t === tab);
	}
	if (tab !== "scan") scan.hide();
}

// Intercept nav clicks so they become pushState calls, not full navigations
document.querySelectorAll("nav a[data-tab]").forEach(a => {
	a.addEventListener("click", e => {
		e.preventDefault();
		const tab = a.dataset.tab;
		const path = tab === "scan" ? "/scan" : "/";
		if (location.pathname !== path) {
			history.pushState(null, "", path);
			route();
		}
	});
});

addEventListener("popstate", route);
route();
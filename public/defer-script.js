const themeSelector = document.getElementById("theme-selector");
const savedTheme = localStorage.getItem("theme");

if (savedTheme) {
	themeSelector.value = savedTheme;
}

themeSelector.addEventListener("change", (e) => {
	const selectedTheme = e.target.value;
	localStorage.setItem("theme", selectedTheme);
});

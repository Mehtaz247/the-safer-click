const filters = [...document.querySelectorAll("[data-filter]")];
const cards = [...document.querySelectorAll("[data-pillar]")];
const empty = document.querySelector(".empty-state");

function applyFilter(filter) {
  let shown = 0;
  for (const card of cards) {
    const visible = filter === "all" || card.dataset.pillar === filter;
    card.hidden = !visible;
    if (visible) shown += 1;
  }
  for (const button of filters) {
    const active = button.dataset.filter === filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  if (empty) empty.hidden = shown !== 0;
}

for (const button of filters) {
  button.addEventListener("click", () => {
    applyFilter(button.dataset.filter);
    const url = new URL(window.location.href);
    if (button.dataset.filter === "all") url.searchParams.delete("topic");
    else url.searchParams.set("topic", button.dataset.filter);
    window.history.replaceState({}, "", url);
  });
}

const initial = new URL(window.location.href).searchParams.get("topic");
if (initial && filters.some((button) => button.dataset.filter === initial)) applyFilter(initial);


export function exportTableCsv(filename) {
  const t = document.querySelector(".tblw table.dt");
  if (!t) return false;
  const rows = [];
  t.querySelectorAll("tr").forEach((tr) => {
    if (tr.style.display === "none") return;
    const cells = [];
    tr.querySelectorAll("th,td").forEach((c) => {
      const txt = c.innerText.replace(/\s+/g, " ").trim();
      cells.push('"' + txt.replace(/"/g, '""') + '"');
    });
    if (cells.length) rows.push(cells.join(","));
  });
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  return true;
}

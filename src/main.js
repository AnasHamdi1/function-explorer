import "./style.css";
import Plotly from "plotly.js-dist-min";
import { create, all } from "mathjs";

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";

const LANG = document.documentElement.lang || "en";
const ADMIN_EMAIL = "anashamdi525@gmail.com";

const math = create(all);

// function debounce(fn, ms) {
//   let t;
//   return (...args) => {
//     clearTimeout(t);
//     t = setTimeout(() => fn(...args), ms);
//   };
// }

// const statusEl = document.getElementById("status");

// function setStatus(msg, kind = "info") {
//   statusEl.textContent = msg;
//   statusEl.classList.toggle("error", kind === "error");
// }

const exprList = document.querySelector(`.app .sidebar .expr__list`);
const addExprEl = document.querySelector(".app .sidebar .add-expr-item");

const exprObjs = [];

const PALETTE = [
  "226, 49, 41", // red
  "0, 122, 255", // blue
  "52, 199, 89", // green
  "175, 82, 222", // purple
  "255, 159, 10", // orange
  "0, 0, 0", // black
];

let paletteIndex = 0;

const plot = document.getElementById("plot");

const layout = createPlotLayout();
layout.yaxis.autorange = false;

const config = {
  responsive: true,
  displayModeBar: true,
  scrollZoom: true,
  displaylogo: false,
  doubleClick: "reset",
};

const viewControlEl = document.querySelector(`.app .canvas__ui .view__control`);

Plotly.newPlot(plot, [], layout, config);

exprList.addEventListener(`input`, (e) => {
  const exprInput = e.target.closest(`.expr__input`);
  const exprItemId = exprInput.closest(`.expr__item`).dataset.id;

  if (!exprInput) return;

  let exprInputVal = exprInput.value;

  const { xs, ys } = compileSample(exprInputVal, layout.xaxis.range, 800);

  updateExprObj(exprItemId, { expr: exprInputVal, xs, ys });

  // const trace = createTrace(xs, ys, exprObj);
  const traces = createTracesFromExprs();

  Plotly.react(plot, traces, layout, config);
});

plot.on("plotly_relayout", () => {
  exprObjs.forEach((exprObj) => {
    const { xs, ys } = compileSample(exprObj.expr, layout.xaxis.range, 800);
    Object.assign(exprObj, { xs, ys });
    // exprObj.xs.map((x, i) => console.log(`(${x}, ${ys[i]})`));
    console.log(math.compile(`tan(x)`).evaluate({ x: 1.5707963268 }));
  });

  let traces = createTracesFromExprs();

  Plotly.react(plot, traces, layout, config);
});

function getCurrentYRange(plotEl, fallback = [-10, 10]) {
  const r = plotEl?._fullLayout?.yaxis?.range;
  return r ? [r[0], r[1]] : fallback;
}

function compileSample(exprText, xRange, n) {
  let expr = exprText.trim();

  // const xs = linspace(xRange, n);
  const xs = sampleXsAnchored(xRange, n);
  let xsLen = xs.length;

  const ys = new Array(xsLen);

  let y;
  let prevY = null;

  const [yMin, yMax] = getCurrentYRange(plot, [-10, 10]);
  const ySpan = Math.abs(yMax - yMin) || 1;

  // Allow some “headroom” above the viewport before we cut
  const Y_CAP = ySpan * 5; // tune: 3–10

  // Thresholds (tune later)
  const MAX_ABS_Y = 1e3; // clip huge values
  const MAX_JUMP = 200; // break line on big jumps

  for (let i = 0; i < xsLen; i++) {
    const x = xs[i];
    try {
      y = math.compile(expr).evaluate({ x }); // error occurs if invalid expression is processed
      ys[i] = y;
      ys[i] = Number.isFinite(y) ? y : null;
    } catch {
      ys[i] = null;
      prevY = null;
      continue;
    }

    // if (!Number.isFinite(y) || Math.abs(y) > MAX_ABS_Y) {
    //   ys[i] = null;
    //   prevY = null;
    //   continue;
    // }

    // // If previous point exists, detect a discontinuity jump
    // if (prevY !== null && Math.abs(y - prevY) > MAX_JUMP) {
    //   ys[i] = null;
    //   prevY = null;
    //   continue;
    // }

    if (!Number.isFinite(y) || Math.abs(y) > Y_CAP) {
      ys[i] = null;
      prevY = null;
      continue;
    }

    ys[i] = y;
    prevY = y;
  }

  return { xs, ys };
}

function createTrace(xs, ys, exprObj) {
  return {
    x: xs,
    y: ys,
    mode: "lines",
    name: exprObj.expr ?? "",
    type: "scatter",

    line: {
      color: `rgb(${exprObj.color})` ?? PALETTE[0],
      width: exprObj.graphWidth ?? 3,
      dash: exprObj.graphDash ?? "solid",
    },
    connectgaps: false,
    visible: exprObj.isVisible ?? true,
    customdata: exprObj.id,
  };
}

function createTracesFromExprs() {
  return exprObjs
    .filter((obj) => obj.isVisible !== false)
    .filter((obj) => obj.xs && obj.ys) // only ones with samples
    .filter((obj) => (obj.expr ?? "").trim() !== "")
    .map((obj) => createTrace(obj.xs, obj.ys, obj));
}

window.addEventListener("resize", () => {
  Plotly.Plots.resize("plot");
});

// handle view control buttons
viewControlEl.addEventListener("click", (e) => {
  handleZoom(e);
  handleGraphDownload(e);
});

// handling removing expr__item
exprList.addEventListener(`click`, (e) => {
  const deleteExprBtn = e.target.closest(`.expr__delete`);
  const exprItem = e.target.closest(`.expr__item`);

  if (!deleteExprBtn || !exprItem) return;

  deleteExprItem(exprItem);

  const traces = createTracesFromExprs();
  Plotly.react(plot, traces, layout, config);
});

// handling adding expr__item
addExprEl.addEventListener("click", () => {
  const newExprItem = createExprItem(nextColorRGB());

  exprList.appendChild(newExprItem);
  newExprItem.querySelector(`.expr__input`).focus();

  // const exprItems = document.querySelectorAll(
  //   ".app .sidebar .expr__list .expr__item"
  // );
  // exprItems.forEach((item) => item.classList.remove(`focus`));
  // newExprItem.classList.add(`focus`);
});

function nextColorRGB() {
  let c = PALETTE[paletteIndex];

  paletteIndex = [paletteIndex + 1] % PALETTE.length;

  return c;
}

function createExprItem(colorRGB) {
  const li = document.createElement(`li`);
  const exprId = crypto.randomUUID();

  const exprObj = {
    id: exprId,
    color: colorRGB,
    expr: "",
    isVisible: true,
    lang: "",
  };
  exprObjs.push(exprObj);

  li.classList.add(`expr__item`, `d-flex`);
  li.dataset.id = exprId;
  li.style.setProperty(`--color-rgb`, colorRGB);

  let placeholder =
    LANG === "ar"
      ? `أدخل مثلاً: sin(x), x^2 + 3x - 1`
      : `Enter e.g. sin(x), x^2 + 3x - 1`;
  console.log(LANG);
  li.innerHTML = `
              <div class="expr__control">
                <span class="expr-control__btn" role="button" tabindex="0">
                  <div class="graph__color"></div>
                </span>
              </div>
              <div class="expr__form">
                <input
                  class="expr__input"
                  type="text"
                  name="expr__input"
                  spellcheck="false"
                  autocomplete="off"
                  autocapitalize="off"
                  autocorrect="off"
                  placeholder="${placeholder}"
                />
              </div>
              <div class="expr__delete">
                <span class="expr-delete__btn" title="Delete Expression" role="button" tabindex="0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="size-6"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M6 18 18 6M6 6l12 12"
                    />
                  </svg>
                </span>
              </div>
  `;
  return li;
}

function deleteExprItem(exprItem) {
  const exprItemId = exprItem.dataset.id;

  let exprObjIndx = exprObjs.findIndex((o) => o.id === exprItemId);

  if (exprObjIndx === -1) return;

  exprObjs.splice(exprObjIndx, 1);

  exprItem.remove();
}

function createPlotLayout() {
  const baseAxis = function () {
    return {
      range: [-5, 5],
      zeroline: true,
      zerolinewidth: 1.5,
      zerolinecolor: "#929292ff",
      gridcolor: "#a9afbaff",
      tickcolor: "#9ca3af",
      ticks: "inside",
      ticklabelposition: "inside",
      showspikes: false,

      minor: {
        showgrid: true,

        gridcolor: "#e5e7eb",
        gridwidth: 1,
      },

      tickfont: {
        color: "#000",
        size: 14,
        weight: 500,
        family: `"Inter", system-ui, sans-serif`,
      },

      exponentformat: "power",
      showexponent: "all",

      showgrid: true,
    };
  };

  return {
    margin: { l: 0, r: 0, t: 0, b: 0 },

    xaxis: {
      ...baseAxis(),
    },

    yaxis: {
      ...baseAxis(),
      scaleanchor: "x", // equal units
    },

    dragmode: "pan",
    hovermode: false,
    showlegend: false,
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
  };
}

function handleZoom(clickEvent) {
  const plotlyZoomIn = document.querySelector(
    `[data-attr="zoom"][data-val="in"]`
  );
  const plotlyZoomOut = document.querySelector(
    `[data-attr="zoom"][data-val="out"]`
  );
  const plotlyReset = document.querySelector(
    `[data-attr="zoom"][data-val="reset"]`
  );

  if (!plotlyZoomIn || !plotlyZoomOut || !plotlyReset) {
    alert("Plotly modebar buttons were not found");
    return;
  }

  if (clickEvent.target.closest(`.app .canvas__ui .view__control .zoom-in`)) {
    plotlyZoomIn.click();
  } else if (
    clickEvent.target.closest(`.app .canvas__ui .view__control .zoom-out`)
  ) {
    plotlyZoomOut.click();
  } else if (
    clickEvent.target.closest(`.app .canvas__ui .view__control .view__reset`)
  ) {
    plotlyReset.click();
    plotlyReset.click();
  }
}

function handleGraphDownload(clickEvent) {
  const plotlyGraphDownloadBtn = document.querySelector(
    `[aria-label="Download plot as a PNG"]`
  );

  if (!plotlyGraphDownloadBtn) {
    alert("Plotly download button was not found");
    return;
  }

  if (clickEvent.target.closest(`.download`)) {
    plotlyGraphDownloadBtn.click();
  } else {
    return;
  }
}

function linspace(xRange, n) {
  let xMin = xRange[0];
  let xMax = xRange[1];

  let step = (xMax - xMin) / (n - 1);
  let xs = [];

  for (let i = 0; i < n; i++) {
    xs.push(xMin + i * step);
  }

  return xs;
}

function sampleXsAnchored(xRange, n) {
  let xMin = xRange[0];
  let xMax = xRange[1];
  const span = xMax - xMin;
  const dx = span / (n - 1);

  const kStart = Math.ceil(xMin / dx);
  const kEnd = Math.floor(xMax / dx);

  const xs = [];
  for (let k = kStart; k <= kEnd; k++) xs.push(k * dx);

  if (xs.length === 0 || xs[0] > xMin) xs.unshift(xMin);
  if (xs[xs.length - 1] < xMax) xs.push(xMax);

  return xs;
}

function updateExprObj(id, patch) {
  const exprObj = exprObjs.find((o) => o.id === id);
  if (!exprObj) return Error("exprObj weren't found!");

  Object.assign(exprObj, patch);
  return exprObj;
}

// header
const mainHeaderNav = document.querySelector(`.header .header__links`);
const overlaysRoot = document.querySelector(`.overlays-root`);

mainHeaderNav.addEventListener(`click`, (e) => {
  const opener = e.target.closest(`[data-open]`);
  if (!opener) return;

  // e.preventDefault();
  const key = opener.dataset.open;
  const overlay = overlaysRoot.querySelector(`.overlay[data-overlay="${key}"]`);

  overlay.classList.add(`is-open`);
});

overlaysRoot.addEventListener("click", (e) => {
  const overlay = e.target.closest(".overlay.is-open");
  if (!overlay) return;

  const clickedCloseBtn = e.target.closest("[data-close]");
  const clickedOutsideModal = !e.target.closest(".modal");

  if (clickedCloseBtn || clickedOutsideModal) {
    overlay.classList.remove("is-open");
    document.documentElement.classList.remove("no-scroll");

    history.replaceState(null, "", location.pathname);
  }
});

function syncOverlayWithHash() {
  const key = location.hash.slice(1); // removes '#'
  if (!key) return;

  const overlay = overlaysRoot.querySelector(`.overlay[data-overlay="${key}"]`);
  if (!overlay) return;
  closeAnyOpenOverlay();

  overlay.classList.add("is-open");
}

function closeAnyOpenOverlay() {
  const open = overlaysRoot.querySelector(".overlay.is-open");
  if (open) open.classList.remove(`is-open`);
}

syncOverlayWithHash();

window.addEventListener("hashchange", syncOverlayWithHash);

// handle signin and signup
// LOGIN
document.addEventListener("submit", async (e) => {
  const form = e.target.closest("[data-login-form]");
  if (!form) return;

  e.preventDefault();

  const email = form.querySelector('[name="email"]').value.trim();
  const password = form.querySelector('[name="password"]').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // optional: close overlay by clearing hash
    // history.replaceState(null, "", location.pathname);
    location.replace("#");
    location.reload();
  } catch (err) {
    alert("Login failed: " + err.message);
  }
});

// SIGNUP
document.addEventListener("submit", async (e) => {
  const form = e.target.closest("[data-signup-form]");
  if (!form) return;

  e.preventDefault();

  const email = form.querySelector('[name="email"]').value.trim();
  const password = form.querySelector('[name="password"]').value;

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    location.replace("#");
    location.reload();
  } catch (err) {
    alert("Signup failed: " + err.message);
  }
});

// logout
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-logout]");
  console.log(btn);
  if (!btn) return;

  await signOut(auth);

  location.replace("#");
  location.reload();
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    // user is logged in
    document.documentElement.classList.add("is-authenticated");
    document.documentElement.classList.remove("is-guest");

    if (user.email === ADMIN_EMAIL) {
      document.documentElement.dataset.isAdmin = "true";
    }
  } else {
    // user is logged out
    document.documentElement.classList.add("is-guest");
    document.documentElement.classList.remove("is-authenticated");
  }

  console.log(`changed`);
});

async function fetchExamples() {
  const snap = await getDocs(collection(db, "ar_collection_1"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function renderExamples(listEl, examples) {
  listEl.innerHTML = "";

  for (const ex of examples) {
    const li = document.createElement("li");
    li.className = "example-item";

    // store expr on the element so click handling is easy
    li.dataset.expr = ex.expr;

    li.innerHTML = `
      <a href="#" class="example-link">
        <div class="example-img">
          <img src="${ex.img || ""}" class="img" alt="example" loading="lazy" />
        </div>
        <h3 class="example-title">${escapeHtml(ex.title || ex.expr || "")}</h3>
        <p class="example-description">${escapeHtml(ex.expr || "")}</p>
      </a>
    `;
    console.log(`liijf`);
    listEl.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[ch])
  );
}

const examplesListEl = document.querySelector(".examples-list");
// const exprInputEl = document.querySelector(".expr__input");

async function initExamplesUI() {
  if (!examplesListEl) return;

  const examples = await fetchExamples();
  renderExamples(examplesListEl, examples);
  // attachExampleClicks(examplesListEl, exprInputEl);
}

initExamplesUI();

examplesListEl.addEventListener(`click`, (e) => {
  const item = e.target.closest(".example-item");
  if (!item) return;

  e.preventDefault();

  const expr = item.dataset.expr;
  if (!expr) return;

  document.querySelectorAll(`.expr__item`).forEach((item) => item.remove());
  exprObjs.forEach((obj, i) => exprObjs.splice(i, 1));
  addExprEl.click();

  const exprItem = document.querySelector(`.expr__item`);
  const exprInputEl = exprItem.querySelector(`.expr__input`);
  exprInputEl.value = expr;
  Plotly.react(plot, [], layout, config);

  exprInputEl.dispatchEvent(new Event("input", { bubbles: true }));

  closeAnyOpenOverlay();
});

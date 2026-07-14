const API_ROOT = "https://dummyjson.com";
const BACKEND_ROOT = window.DWH_BACKEND_ROOT || "http://localhost:8000";
const iconPaths = {
  api: '<path d="M8 7h8M8 12h8M8 17h5"/><rect x="4" y="4" width="16" height="16" rx="3"/>',
  chart: '<path d="M4 19h16"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-4"/>',
  survey: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  file: '<path d="M14 3v5h5"/><path d="M6 3h8l5 5v13H6z"/><path d="M9 13h6M9 17h6"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0"/>',
  route: '<path d="M5 5h5a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h10"/><path d="M5 5l3-3M5 5l3 3M19 21l-3-3M19 21l-3 3"/>',
  stream: '<path d="M4 12h4l3-6 4 12 3-6h2"/><circle cx="4" cy="12" r="2"/><circle cx="20" cy="12" r="2"/>',
  shieldCheck: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M9 12l2 2 4-5"/>',
  bucket: '<path d="M6 8h12l-1 12H7z"/><path d="M7 8c0-2 2-4 5-4s5 2 5 4"/><path d="M9 12h6"/>',
  database: '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  table: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M9 5v14M15 5v14"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/>',
  warehouse: '<path d="M3 10l9-6 9 6v10H3z"/><path d="M7 20v-7h10v7M7 16h10M11 13v7"/>',
  cylinder: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  workflow: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M10 7h4M17 10v2l-5 2-5-2v-2"/>',
  spark: '<path d="M12 2l2.2 7.2L21 12l-6.8 2.8L12 22l-2.2-7.2L3 12l6.8-2.8z"/>',
  code: '<path d="M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
  cubes: '<path d="M12 3l7 4v8l-7 4-7-4V7z"/><path d="M12 11l7-4M12 11L5 7M12 11v8"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="M15 15l5 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  quality: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M8 12h8M8 16h5"/>',
  lineage: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M9 7h6M8 9l3 6M16 9l-3 6"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M12 14h8M17 14v3M20 14v-3"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M12 8v5M12 17h0"/>',
  monitor: '<rect x="4" y="5" width="16" height="12" rx="2"/><path d="M9 21h6M12 17v4"/>',
  logs: '<path d="M5 5h14M5 10h14M5 15h10M5 20h7"/>',
  backup: '<path d="M7 18a5 5 0 1 1 1-9 6 6 0 0 1 11 3 4 4 0 0 1-1 8H7"/><path d="M12 12v6M9 15l3-3 3 3"/>',
  git: '<path d="M7 7l10 10"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M9 6h6"/>',
  refresh: '<path d="M20 12a8 8 0 0 1-14 5"/><path d="M4 12a8 8 0 0 1 14-5"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  loader: '<path d="M12 3a9 9 0 1 0 9 9"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>',
};

function renderIcon(name, className = "ui-icon") {
  const body = iconPaths[name] || iconPaths.database;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
const sources = [
  {
    id: "products",
    title: "eStat 4.0",
    short: "ES",
    icon: "chart",
    description: "Statistik hisobot va elektron shakllar",
    endpoint: "/products",
    collection: "products",
  },
  {
    id: "users",
    title: "SIAT API",
    short: "API",
    icon: "api",
    description: "Vazirlik va idoralar API ma'lumotlari",
    endpoint: "/users",
    collection: "users",
  },
  {
    id: "carts",
    title: "Planshet Survey",
    short: "SV",
    icon: "survey",
    description: "Offline va online birlamchi ma'lumotlar",
    endpoint: "/carts",
    collection: "carts",
  },
  {
    id: "posts",
    title: "Excel / CSV",
    short: "CSV",
    icon: "file",
    description: "Fayl asosidagi import oqimlari",
    endpoint: "/posts",
    collection: "posts",
  },
  {
    id: "todos",
    title: "Batch Import",
    short: "BT",
    icon: "calendar",
    description: "Rejalashtirilgan jadval asosida yuklash",
    endpoint: "/todos",
    collection: "todos",
  },
  {
    id: "quotes",
    title: "Imputatsiya tizimi",
    short: "IM",
    icon: "calculator",
    description: "Hisoblangan va to'ldirilgan qiymatlar",
    endpoint: "/quotes",
    collection: "quotes",
  },
];

const lanes = [
  {
    id: "ingestion",
    number: "2",
    title: "Ingestion",
    color: "#2357b7",
    stages: [
      ["fastapi", "FastAPI", "Gateway va servis integratsiyasi", "api"],
      ["nifi", "NiFi", "Routing, filtering, transform", "route"],
      ["kafka", "Kafka", "Real-time oqim va navbat", "stream"],
      ["gx", "Great Expectations", "Validation va profiling", "shieldCheck"],
      ["landing", "MinIO Landing", "Vaqtinchalik raw qabul", "bucket"],
    ],
  },
  {
    id: "storage",
    number: "3",
    title: "Saqlash",
    color: "#097d75",
    stages: [
      ["raw", "MinIO Raw", "Xom ma'lumotlar", "database"],
      ["clean", "Parquet", "Tozalangan ustunli format", "table"],
      ["curated", "Curated Zone", "Standart model", "layers"],
      ["clickhouse", "ClickHouse", "Analitik DWH", "warehouse"],
      ["postgres", "PostgreSQL ODS", "Metadata va servis data", "cylinder"],
    ],
  },
  {
    id: "processing",
    number: "4",
    title: "Ishlov berish",
    color: "#b56a09",
    stages: [
      ["airflow", "Airflow", "Workflow va scheduler", "workflow"],
      ["spark", "Spark", "Parallel qayta ishlash", "spark"],
      ["dbt", "dbt", "SQL transformatsiya", "code"],
      ["modeling", "Data Modeling", "Fact, dimension va KPI", "cubes"],
    ],
  },
  {
    id: "serving",
    number: "5",
    title: "Taqdim etish",
    color: "#6847b8",
    stages: [
      ["superset", "Superset", "Dashboard va BI", "chart"],
      ["trino", "Trino", "Ad-hoc SQL", "search"],
      ["api", "API Services", "Tashqi integratsiya", "api"],
      ["portal", "Visualization Portal", "Interaktiv ko'rinish", "globe"],
      ["export", "Export Service", "CSV, Excel, PDF, JSON", "download"],
    ],
  },
];

const stageProcesses = {
  fastapi: [
    ["Request qabul qilish", "Source, limit va integration mode parametrlari tekshiriladi."],
    ["API endpoint tayyorlash", "DummyJSON endpointi real test manba sifatida yig'iladi."],
    ["HTTP chaqiruv", "GET so'rovi yuboriladi va response status nazorat qilinadi."],
    ["Payload qabul qilish", "JSON body keyingi NiFi flow uchun tayyorlanadi."],
  ],
  nifi: [
    ["FlowFile yaratish", "Kelgan JSON flow ichida alohida paket sifatida ro'yxatga olinadi."],
    ["Schema aniqlash", "Fieldlar, nested objectlar va collection nomi tekshiriladi."],
    ["Routing", "Batch, API yoki near real-time rejimiga qarab kanal tanlanadi."],
    ["Light transform", "Keraksiz wrapper metadata ajratib olinadi."],
  ],
  kafka: [
    ["Topic tanlash", "Source bo'yicha stream nomi aniqlanadi."],
    ["Message serialize", "Payload key/value formatida navbatga tayyorlanadi."],
    ["Offset saqlash", "Qayta ishlash davomiyligi uchun offset belgilanadi."],
  ],
  gx: [
    ["Expectation suite", "Record count, primary key va schema qoidalari yuklanadi."],
    ["Data profiling", "Null ulushi va bo'sh fieldlar tahlil qilinadi."],
    ["Validation result", "Quality score va check natijalari inspector panelga beriladi."],
  ],
  landing: [
    ["Object key yaratish", "Source, sana va run id asosida landing path yig'iladi."],
    ["Raw snapshot", "Original payload o'zgarmagan holda vaqtincha yoziladi."],
    ["Retention flag", "Keyingi raw zone transferi uchun metadata belgilanadi."],
  ],
  raw: [
    ["Bucket tanlash", "MinIO Raw zone uchun source katalogi tanlanadi."],
    ["Immutable write", "Xom data audit uchun qayta yozilmaydigan obyekt sifatida saqlanadi."],
    ["Catalog update", "Raw obyekt joylashuvi metadata sifatida qayd etiladi."],
  ],
  clean: [
    ["Column normalize", "Field nomlari jadval ko'rinishiga moslanadi."],
    ["Type inference", "Raqam, matn, sana va nested qiymatlar ajratiladi."],
    ["Parquet pack", "Tozalangan data ustunli formatga tayyorlanadi."],
  ],
  curated: [
    ["Business mapping", "Source fieldlar umumiy DWH atributlariga moslanadi."],
    ["Conformed schema", "dw_id, source_system, metric_value kabi ustunlar yaratiladi."],
    ["Curated publish", "Standartlashtirilgan dataset serving qatlamiga tayyorlanadi."],
  ],
  clickhouse: [
    ["Table mapping", "Curated fieldlar fact yoki dimension jadvaliga bog'lanadi."],
    ["Insert batch", "Analitik jadvalga bulk load bajariladi."],
    ["KPI aggregate", "Dashboard uchun tezkor metrikalar yangilanadi."],
  ],
  postgres: [
    ["ODS upsert", "Operatsion holat va servis metadata yangilanadi."],
    ["Run audit", "Pipeline run statusi, source va vaqt yozib boriladi."],
    ["Access metadata", "API va portal uchun lookup ma'lumotlar tayyorlanadi."],
  ],
  airflow: [
    ["DAG trigger", "Pipeline run DAG ichida boshlangan holatga o'tadi."],
    ["Task dependency", "Storage, processing va serving task tartibi tekshiriladi."],
    ["Retry policy", "Xatolik bo'lsa qayta urinish va alert qoidalari ulanadi."],
  ],
  spark: [
    ["Partition read", "Raw/curated dataset bo'laklarga ajratib o'qiladi."],
    ["Distributed transform", "Katta hajmli mapping va enrichment parallel bajariladi."],
    ["Result write", "Natija curated yoki warehouse qatlamiga qayta yoziladi."],
  ],
  dbt: [
    ["Model compile", "SQL model va dependency graph tekshiriladi."],
    ["Transform run", "Staging, intermediate va mart SQL transformatsiyalari bajariladi."],
    ["Model test", "Unique, not null va relationship testlari ishlaydi."],
  ],
  modeling: [
    ["Dimension build", "Kesimlar, kodlar va lookup jadval strukturalari yaratiladi."],
    ["Fact build", "O'lchovlar va ko'rsatkichlar fact jadvalga moslanadi."],
    ["Business rules", "KPI formula va hisoblash qoidalari qo'llanadi."],
  ],
  superset: [
    ["Dataset register", "ClickHouse jadvali BI dataset sifatida ulanadi."],
    ["Chart refresh", "Dashboard grafiklari yangi aggregate bo'yicha yangilanadi."],
    ["Access check", "Rol va ruxsat bo'yicha ko'rish cheklovlari tekshiriladi."],
  ],
  trino: [
    ["Catalog route", "ClickHouse, PostgreSQL yoki lake catalog tanlanadi."],
    ["SQL plan", "Ad-hoc query uchun execution plan tuziladi."],
    ["Result stream", "Natija portal yoki analyst so'roviga qaytariladi."],
  ],
  api: [
    ["Contract mapping", "Curated data response schema bilan moslanadi."],
    ["Service response", "API consumer uchun JSON response tayyorlanadi."],
    ["Rate and audit", "So'rov limiti va audit log yoziladi."],
  ],
  portal: [
    ["View model", "Jadval, filtr va grafik uchun frontend model tayyorlanadi."],
    ["Interactive render", "Visualization portal ko'rinishlari yangilanadi."],
    ["User context", "Rahbariyat, hududiy bo'lim yoki tashqi foydalanuvchi roli tekshiriladi."],
  ],
  export: [
    ["Format tanlash", "CSV, Excel, PDF yoki JSON eksport turi belgilanadi."],
    ["File build", "Natija fayl strukturasi va nomi yig'iladi."],
    ["Download publish", "Eksport foydalanuvchiga tayyor holatda beriladi."],
  ],
};

const operations = [
  ["quality", "Data Quality", "Great Expectations nazorati"],
  ["lineage", "Metadata", "Atlas lineage va ta'sir tahlili"],
  ["key", "IAM / SSO", "Keycloak rol va ruxsatlar"],
  ["shield", "Security", "WAF, audit log, encryption"],
  ["monitor", "Monitoring", "Prometheus va Grafana"],
  ["logs", "Logs", "ELK qidiruv va tahlil"],
  ["backup", "Backup", "Snapshot, retention, DR"],
  ["git", "CI/CD", "GitLab build, test, deploy"],
];

const state = {
  sourceId: "products",
  mode: "batch",
  rawRows: [],
  curatedRows: [],
  tab: "raw",
  logs: [],
  latency: 0,
  qualityScore: 0,
  isRunning: false,
};

const $ = (selector) => document.querySelector(selector);

function boot() {
  renderSourceRail();
  renderSourceSelect();
  renderFlow();
  renderOperations();
  hydrateStaticIcons();
  hydrateLineageIcons();
  bindEvents();
  updateEndpoint();
  setMetrics();
  renderQuality([]);
  renderTable();
  setRunState("Idle");
  log("Console tayyor. Source tanlang va pipeline ishga tushiring.");
}

function renderSourceRail() {
  $("#sourceList").innerHTML = sources
    .map(
      (source) => `
        <button class="source-button ${source.id === state.sourceId ? "active" : ""}" data-source="${source.id}" type="button">
          <span class="source-icon">${renderIcon(source.icon)}</span>
          <div>
            <h3>${source.title}</h3>
            <p>${source.description}</p>
          </div>
        </button>
      `,
    )
    .join("");
}

function renderSourceSelect() {
  $("#sourceSelect").innerHTML = sources
    .map((source) => `<option value="${source.id}">${source.title} / ${source.collection}</option>`)
    .join("");
  $("#sourceSelect").value = state.sourceId;
}

function renderFlow() {
  $("#flowRows").innerHTML = lanes
    .map(
      (lane) => `
        <div class="flow-row" style="--lane-color: ${lane.color}">
          <div class="lane-label">
            <span>${lane.number}-qatlam</span>
            <strong>${lane.title}</strong>
          </div>
          <div class="stage-track" style="--cols: ${lane.stages.length}">
            ${lane.stages
              .map(
                ([id, title, description, icon]) => `
                  <article class="stage" data-stage="${id}" role="button" tabindex="0" aria-label="${title} processlarini ko'rish">
                    <div class="stage-head">
                      <span class="stage-icon">${renderIcon(icon)}</span>
                      <span class="stage-state"></span>
                    </div>
                    <h3>${title}</h3>
                    <p>${description}</p>
                  </article>
                `,
              )
              .join("")}
          </div>
        </div>
      `,
    )
    .join("");
}

function hydrateStaticIcons() {
  const staticButtons = [
    ["#refreshBtn", "refresh", "Refresh"],
    ["#runBtn", "play", "Run Pipeline"],
    ["#exportBtn", "download", "Export JSON"],
    ["#modalCloseBtn", "close", ""],
    ['.mode[data-mode="batch"]', "calendar", "Batch"],
    ['.mode[data-mode="stream"]', "stream", "Near real-time"],
    ['.mode[data-mode="api"]', "api", "API integration"],
    ['.tab[data-tab="raw"]', "database", "Raw"],
    ['.tab[data-tab="curated"]', "layers", "Curated"],
  ];

  staticButtons.forEach(([selector, icon, label]) => {
    const element = document.querySelector(selector);
    if (!element) return;
    const labelMarkup = label ? `<span>${label}</span>` : "";
    element.innerHTML = `${renderIcon(icon, "button-icon")}${labelMarkup}`;
  });
}

function hydrateLineageIcons() {
  const icons = ["chart", "api", "route", "stream", "bucket", "warehouse", "chart"];
  document.querySelectorAll(".lineage span").forEach((item, index) => {
    item.innerHTML = `${renderIcon(icons[index] || "database", "chip-icon")}<span>${item.textContent}</span>`;
  });
}

function renderOperations() {
  $("#opsList").innerHTML = operations
    .map(
      ([icon, title, description]) => `
        <div class="op-item">
          <span class="op-icon">${renderIcon(icon)}</span>
          <div>
            <h3>${title}</h3>
            <p>${description}</p>
          </div>
        </div>
      `,
    )
    .join("");
}

function bindEvents() {
  $("#runBtn").addEventListener("click", runPipeline);
  $("#refreshBtn").addEventListener("click", runPipeline);
  $("#exportBtn").addEventListener("click", exportJson);
  $("#modalCloseBtn").addEventListener("click", closeStageModal);

  $("#stageModal").addEventListener("click", (event) => {
    if (event.target.id === "stageModal") closeStageModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeStageModal();
  });

  $("#sourceSelect").addEventListener("change", (event) => {
    selectSource(event.target.value);
  });

  $("#limitInput").addEventListener("input", updateEndpoint);

  $("#sourceList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-source]");
    if (!button) return;
    selectSource(button.dataset.source);
  });

  $("#flowRows").addEventListener("click", (event) => {
    const stage = event.target.closest("[data-stage]");
    if (!stage) return;
    openStageModal(stage.dataset.stage, "process");
  });

  $("#flowRows").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const stage = event.target.closest("[data-stage]");
    if (!stage) return;
    event.preventDefault();
    openStageModal(stage.dataset.stage, "process");
  });

  document.querySelectorAll(".mode").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".mode").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.mode = button.dataset.mode;
      $("#modeSummary").textContent = button.textContent;
      log(`Integratsiya rejimi tanlandi: ${button.textContent}.`);
    });
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.tab = button.dataset.tab;
      renderTable();
    });
  });
}

function selectSource(sourceId) {
  if (state.isRunning) {
    log("Pipeline ishlayapti. Source almashtirish uchun run tugashini kuting.");
    return;
  }

  state.sourceId = sourceId;
  $("#sourceSelect").value = sourceId;
  renderSourceRail();
  updateEndpoint();
  log(`Source almashtirildi: ${getSource().title}.`);
}

async function runPipeline() {
  if (state.isRunning) {
    log("Pipeline allaqachon ishlayapti.");
    return;
  }

  state.isRunning = true;
  clearStageStatus();
  resetRunData();
  setRunState("Running");
  $("#runTitle").textContent = getSource().title;

  const startedAt = performance.now();

  try {
    log(`Backend pipeline chaqirildi: POST ${BACKEND_ROOT}/pipeline/run`);
    const backendRun = runBackendPipeline();

    await markStages(["fastapi", "nifi", "kafka", "gx", "landing", "raw", "clean", "curated", "clickhouse", "postgres", "airflow", "spark", "dbt", "modeling", "superset", "trino", "api", "portal", "export"]);

    const result = await backendRun;
    state.latency = Math.round(performance.now() - startedAt);
    state.rawRows = result.raw_preview || [];
    state.curatedRows = result.curated_preview || [];
    state.qualityScore = result.quality_score || 0;

    renderQuality(result.quality_checks || []);
    setMetrics();
    renderTable();

    (result.stages || []).forEach((stage) => {
      log(`${stage.id}: ${stage.status} (${stage.duration_ms} ms) - ${stage.message}`);
    });
    (result.warnings || []).forEach((warning) => log(`Warning: ${warning}`));
    log(`Backend run yakunlandi: run_id=${result.run_id}, records=${result.records}.`);
    setRunState("Done", "ok");
  } catch (error) {
    markError();
    setRunState("Error", "error");
    log(`Xatolik: ${error.message}`);
  } finally {
    state.isRunning = false;
    closeStageModal();
  }
}

async function runBackendPipeline() {
  const response = await fetch(`${BACKEND_ROOT}/pipeline/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: state.sourceId,
      limit: getLimit(),
      mode: state.mode,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend API ${response.status}: ${text}`);
  }

  return response.json();
}
function resetRunData() {
  state.logs = [];
  state.rawRows = [];
  state.curatedRows = [];
  state.latency = 0;
  state.qualityScore = 0;
  setMetrics();
  renderQuality([]);
  renderTable();
}

async function markStages(stageIds) {
  for (const stageId of stageIds) {
    const stage = document.querySelector(`[data-stage="${stageId}"]`);
    if (!stage) continue;

    stage.classList.add("running", "current");
    await runStageModal(stageId);
    stage.classList.remove("running", "current");
    stage.classList.add("done");
  }
}

async function runStageModal(stageId) {
  const processes = openStageModal(stageId, "waiting");
  log(`${getStageInfo(stageId).title} stage processlari boshlandi.`);
  await wait(220);

  for (let index = 0; index < processes.length; index += 1) {
    setModalProcessStatus(index, "running");
    await wait(360);
    setModalProcessStatus(index, "done");
    await wait(120);
  }

  await wait(420);
  closeStageModal();
}

function openStageModal(stageId, initialStatus = "process") {
  const info = getStageInfo(stageId);
  const processes = stageProcesses[stageId] || [["Process", info.description]];
  const source = getSource();

  $("#modalLayer").textContent = `${info.laneNumber}-qatlam / ${info.laneTitle}`;
  $("#modalStageTitle").textContent = info.title;
  $("#modalDescription").textContent = info.description;
  $("#modalIcon").innerHTML = renderIcon(info.icon, "modal-svg");
  $("#modalIcon").style.background = info.color;
  $("#modalSource").textContent = `Source: ${source.title}`;
  $("#modalMode").textContent = `Mode: ${state.mode}`;
  $("#modalProcessList").innerHTML = processes
    .map(
      ([title, description], index) => `
        <div class="process-item ${initialStatus === "done" ? "done" : ""}" data-process-index="${index}">
          <span class="process-index">${renderIcon("clock", "tiny-icon")}</span>
          <div>
            <strong>${title}</strong>
            <p>${description}</p>
          </div>
          <span class="process-badge">${renderIcon("clock", "badge-icon")}<span>${getProcessLabel(initialStatus)}</span></span>
        </div>
      `,
    )
    .join("");

  $("#stageModal").setAttribute("aria-hidden", "false");
  return processes;
}

function closeStageModal() {
  $("#stageModal").setAttribute("aria-hidden", "true");
}

function setModalProcessStatus(index, status) {
  const item = document.querySelector(`[data-process-index="${index}"]`);
  if (!item) return;
  item.classList.remove("running", "done");
  if (status === "running" || status === "done") item.classList.add(status);

  const statusIcon = status === "done" ? "check" : status === "running" ? "loader" : "clock";
  const indexIcon = item.querySelector(".process-index");
  if (indexIcon) indexIcon.innerHTML = renderIcon(statusIcon, "tiny-icon");

  const badge = item.querySelector(".process-badge");
  if (badge) badge.innerHTML = `${renderIcon(statusIcon, "badge-icon")}<span>${getProcessLabel(status)}</span>`;
}

function getProcessLabel(status) {
  if (status === "waiting") return "queue";
  if (status === "running") return "running";
  if (status === "done") return "done";
  return "process";
}

function getStageInfo(stageId) {
  for (const lane of lanes) {
    const stage = lane.stages.find(([id]) => id === stageId);
    if (stage) {
      const [, title, description, icon] = stage;
      return {
        id: stageId,
        title,
        description,
        icon,
        color: lane.color,
        laneNumber: lane.number,
        laneTitle: lane.title,
      };
    }
  }

  return {
    id: stageId,
    title: stageId,
    description: "Pipeline process",
    icon: "DW",
    color: "#2357b7",
    laneNumber: "-",
    laneTitle: "Pipeline",
  };
}

function clearStageStatus() {
  document.querySelectorAll(".stage").forEach((stage) => {
    stage.classList.remove("running", "done", "error", "current");
  });
}

function markError() {
  const running = document.querySelector(".stage.running");
  const fallback = document.querySelector(".stage:not(.done)");
  const target = running || fallback;
  if (target) {
    target.classList.remove("running", "current");
    target.classList.add("error");
  }
}

function normalizePayload(payload, collectionKey) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload[collectionKey])) return payload[collectionKey];
  return [];
}

function validateRows(rows) {
  const total = rows.length;
  const hasId = rows.filter((row) => row.id !== undefined && row.id !== null).length;
  const hasData = rows.filter((row) => Object.keys(row).length > 1).length;
  const nullSafe = rows.filter((row) => {
    const values = Object.values(row);
    const empty = values.filter((value) => value === null || value === undefined || value === "").length;
    return values.length > 0 && empty / values.length < 0.35;
  }).length;

  const checks = [
    ["Record count", total > 0, `${total} rows`],
    ["Primary key", total > 0 && hasId === total, `${hasId}/${total}`],
    ["Schema", total > 0 && hasData === total, `${hasData}/${total}`],
    ["Null threshold", total > 0 && nullSafe / total >= 0.9, `${nullSafe}/${total}`],
  ];

  const passed = checks.filter(([, ok]) => ok).length;
  return {
    checks,
    score: checks.length ? Math.round((passed / checks.length) * 100) : 0,
  };
}

function curateRows(rows, sourceId) {
  return rows.map((row) => {
    const base = {
      dw_id: `${sourceId}_${row.id ?? makeId()}`,
      source_system: getSource().title,
      ingestion_mode: state.mode,
      loaded_at: new Date().toISOString(),
    };

    if (sourceId === "products") {
      return {
        ...base,
        entity_name: row.title,
        category: row.category,
        metric_value: row.price,
        status: row.availabilityStatus || "active",
      };
    }

    if (sourceId === "users") {
      return {
        ...base,
        entity_name: [row.firstName, row.lastName].filter(Boolean).join(" "),
        category: row.company?.department || row.role || "user",
        metric_value: row.age,
        status: row.email ? "verified" : "missing_email",
      };
    }

    if (sourceId === "carts") {
      return {
        ...base,
        entity_name: `Cart ${row.id}`,
        category: `user_${row.userId}`,
        metric_value: row.total,
        status: `${row.totalProducts || 0} products`,
      };
    }

    return {
      ...base,
      entity_name: row.title || row.todo || row.quote || `Record ${row.id}`,
      category: row.tags?.[0] || row.userId || "general",
      metric_value: row.reactions?.likes || Number(row.completed === true),
      status: row.completed === true ? "completed" : "active",
    };
  });
}

function renderTable() {
  const table = $("#dataTable");
  const rows = state.tab === "raw" ? state.rawRows : state.curatedRows;

  if (!rows.length) {
    table.innerHTML = `
      <tbody>
        <tr>
          <td class="empty-row">Data hali yuklanmagan. Run Pipeline tugmasini bosing.</td>
        </tr>
      </tbody>
    `;
    return;
  }

  const columns = getColumns(rows);
  const body = rows
    .slice(0, 25)
    .map(
      (row) => `
        <tr>
          ${columns.map((column) => `<td>${formatCell(row[column])}</td>`).join("")}
        </tr>
      `,
    )
    .join("");

  table.innerHTML = `
    <thead>
      <tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr>
    </thead>
    <tbody>${body}</tbody>
  `;
}

function renderQuality(checks) {
  if (!checks.length) {
    $("#qualityList").innerHTML = `
      <div class="quality-item warn">
        <span class="quality-icon">${renderIcon("clock", "tiny-icon")}</span>
        <span>Validation kutilmoqda</span>
        <strong>idle</strong>
      </div>
    `;
    return;
  }

  $("#qualityList").innerHTML = checks
    .map(
      ([label, ok, value]) => `
        <div class="quality-item ${ok ? "" : "warn"}">
          <span class="quality-icon">${renderIcon(ok ? "check" : "clock", "tiny-icon")}</span>
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join("");
}
function setMetrics() {
  $("#recordsMetric").textContent = String(state.rawRows.length);
  $("#qualityMetric").textContent = `${state.qualityScore}%`;
  $("#latencyMetric").textContent = `${state.latency} ms`;
  $("#fieldsMetric").textContent = state.curatedRows.length ? String(Object.keys(state.curatedRows[0]).length) : "0";
}

function setRunState(label, className = "") {
  const stateBadge = $("#runState");
  stateBadge.textContent = label;
  stateBadge.className = `run-state ${className}`.trim();
}

function exportJson() {
  const rows = state.tab === "raw" ? state.rawRows : state.curatedRows;
  if (!rows.length) {
    log("Export uchun data yo'q.");
    return;
  }

  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${state.tab}_${state.sourceId}_warehouse_export.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  log(`${rows.length} ta ${state.tab} record JSON formatda eksport qilindi.`);
}

function updateEndpoint() {
  const source = getSource();
  $("#endpointInput").textContent = `${BACKEND_ROOT}/pipeline/run -> ${API_ROOT}${source.endpoint}?limit=${getLimit()}`;
}

function getSource() {
  return sources.find((source) => source.id === state.sourceId) || sources[0];
}

function getLimit() {
  const value = Number($("#limitInput").value);
  if (!Number.isFinite(value)) return 20;
  return Math.min(Math.max(value, 5), 50);
}

function getColumns(rows) {
  const preferred =
    state.tab === "curated"
      ? ["dw_id", "source_system", "entity_name", "category", "metric_value", "status", "loaded_at"]
      : ["id", "title", "firstName", "lastName", "todo", "quote", "category", "price", "total", "userId"];

  const discovered = new Set();
  rows.slice(0, 6).forEach((row) => Object.keys(row).forEach((key) => discovered.add(key)));
  const ordered = preferred.filter((key) => discovered.has(key));
  const extras = [...discovered].filter((key) => !ordered.includes(key)).slice(0, 6);
  return [...ordered, ...extras].slice(0, 8);
}

function formatCell(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "object" ? JSON.stringify(item) : item)).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function log(message) {
  const time = new Date().toLocaleTimeString("uz-UZ", { hour12: false });
  state.logs.push(`[${time}] ${message}`);
  $("#logBox").textContent = state.logs.join("\n");
  $("#logBox").scrollTop = $("#logBox").scrollHeight;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
}

boot();












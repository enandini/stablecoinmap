import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import geoUrl from "us-atlas/states-10m.json?url";
import regulationData from "./data/stablecoinRegulation.json";
import { ALL_STATES, FIPS_TO_ABBR, STATE_NAME_TO_ABBR } from "./data/stateMappings";

const STATUS_META = {
  clear_friendly: {
    label: "Clear + Favorable",
    mobileLabel: "Clear + Favorable",
    description: "has stablecoin-relevant frameworks, charters, or explicit exemptions that support operations",
    tooltipClass: "w-[min(17rem,calc(100vw-2.5rem))] whitespace-normal leading-snug break-words sm:w-80",
    tooltipPositionClass: "left-0 translate-x-0",
    color: "#15803d",
    chipBg: "#14532d",
    chipBorder: "#22c55e",
    chipText: "#bbf7d0"
  },
  clear_restrictive: {
    label: "Clear + Strict",
    mobileLabel: "Clear + Strict",
    description: "clear framework with higher licensing burden and compliance cost",
    tooltipClass: "w-[min(17rem,calc(100vw-2.5rem))] whitespace-normal leading-snug break-words sm:w-80",
    tooltipPositionClass: "left-1/2 -translate-x-1/2",
    color: "#1e3a8a",
    chipBg: "#1e3a8a",
    chipBorder: "#60a5fa",
    chipText: "#bfdbfe"
  },
  pending: {
    label: "Pending",
    mobileLabel: "Pending",
    description: "active stablecoin-related bills, pilots, or money-transmission modernization",
    tooltipClass: "w-[min(17rem,calc(100vw-2.5rem))] whitespace-normal leading-snug break-words sm:w-80",
    tooltipPositionClass: "left-1/2 -translate-x-1/2",
    color: "#a16207",
    chipBg: "#78350f",
    chipBorder: "#f59e0b",
    chipText: "#fde68a"
  },
  federal_default: {
    label: "Federal Default",
    mobileLabel: "Federal Default",
    description: "no meaningful state stablecoin framework identified; federal baseline plus money-transmission rules",
    tooltipClass: "w-[min(17rem,calc(100vw-2.5rem))] whitespace-normal leading-snug break-words sm:w-80",
    tooltipPositionClass: "left-1/2 -translate-x-1/2 sm:right-0 sm:left-auto sm:translate-x-0",
    color: "#4b5563",
    chipBg: "#1f2937",
    chipBorder: "#9ca3af",
    chipText: "#e5e7eb"
  }
};

const STATUS_ORDER = ["clear_friendly", "clear_restrictive", "pending", "federal_default"];

function formatDate(isoDate) {
  if (!isoDate) return "N/A";
  const value = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(value.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(value);
}

function normalizeStatus(input) {
  if (!input) return "federal_default";
  if (Object.hasOwn(STATUS_META, input)) return input;

  const legacyMap = {
    friendly: "clear_friendly",
    restrictive: "clear_restrictive",
    none: "federal_default",
    unclear: "pending"
  };

  return legacyMap[input] || "federal_default";
}

function shiftHexColor(hex, amount) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const num = Number.parseInt(normalized, 16);
  if (Number.isNaN(num)) return hex;

  const clamp = (value) => Math.min(255, Math.max(0, value));
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0x00ff) + amount);
  const b = clamp((num & 0x0000ff) + amount);

  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, "0")}`;
}

function getSourceLabel(source) {
  try {
    const parsed = new URL(source);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return source;
  }
}

function trackerStatusStyle(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("launch") || normalized.includes("live")) {
    return {
      bg: "#14532d",
      border: "#22c55e",
      text: "#bbf7d0"
    };
  }
  if (normalized.includes("pilot")) {
    return {
      bg: "#78350f",
      border: "#f59e0b",
      text: "#fde68a"
    };
  }
  if (
    normalized.includes("pending")
    || normalized.includes("introduc")
    || normalized.includes("proposal")
    || normalized.includes("committee")
  ) {
    return {
      bg: "#78350f",
      border: "#f59e0b",
      text: "#fde68a"
    };
  }
  return {
    bg: "#1f2937",
    border: "#9ca3af",
    text: "#e5e7eb"
  };
}

function App() {
  const statesData = regulationData.states || regulationData;
  const federalContext = regulationData.federalContext || null;
  const stateIssuedStablecoins = regulationData.stateIssuedStablecoins || [];
  const pendingFederalBills = regulationData.pendingFederalBills || [];
  const majorStateDevelopments = regulationData.majorStateDevelopments || [];

  const allLastUpdated = useMemo(
    () =>
      Object.values(statesData)
        .map((item) => item.lastUpdated)
        .filter(Boolean)
        .sort(),
    [statesData]
  );

  const latestDataDate = allLastUpdated[allLastUpdated.length - 1] || "2026-02-16";

  const [selectedAbbr, setSelectedAbbr] = useState("NY");

  const selectedState = useMemo(() => {
    const fromData = statesData[selectedAbbr];
    if (fromData) return fromData;

    const name = ALL_STATES[selectedAbbr] || "Unknown";
    return {
      name,
      status: "federal_default",
      summary:
        `${name} does not currently have a clearly identified state-specific stablecoin framework in this dataset. ` +
        "As a baseline, activity may still be governed by federal stablecoin rules plus general money transmission, banking, and consumer protection law.",
      keyLaws: ["No dedicated state-level stablecoin framework identified in this dataset."],
      recentDevelopments:
        "No major state-specific stablecoin development is currently listed in this starter dataset.",
      sources: [],
      lastUpdated: latestDataDate
    };
  }, [latestDataDate, selectedAbbr, statesData]);

  const selectedStatus = normalizeStatus(selectedState.status);
  const selectedStateIssuedPrograms = useMemo(() => {
    const selectedName = (selectedState?.name || "").trim().toLowerCase();
    return stateIssuedStablecoins.filter((item) => {
      const code = String(item.state || "").trim().toUpperCase();
      const stateName = (ALL_STATES[code] || "").trim().toLowerCase();
      const directName = String(item.state || "").trim().toLowerCase();
      return code === selectedAbbr || stateName === selectedName || directName === selectedName;
    });
  }, [selectedAbbr, selectedState?.name, stateIssuedStablecoins]);
  const selectedRegulatoryBody = selectedState.regulatoryBody || "State financial regulator(s); see sources for detail.";

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="border-b border-zinc-800 bg-black/90 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">U.S. Stablecoin Regulation Map</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Click a state to see how it treats stablecoin issuance and business operations, with key laws and latest updates.
          </p>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr),360px] lg:px-8">
        <section className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/85 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.35)] sm:p-5">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
            {STATUS_ORDER.map((key, index) => {
              const value = STATUS_META[key];
              const mobileTooltipPositionClass = index % 2 === 0
                ? "left-0 translate-x-0"
                : "right-0 left-auto translate-x-0";
              return (
                <div className="group relative w-full sm:w-auto" key={key}>
                  <div
                    className="inline-flex w-full items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-medium sm:w-auto sm:justify-start sm:px-3 sm:text-sm"
                    style={{
                      backgroundColor: value.chipBg,
                      borderColor: value.chipBorder,
                      color: value.chipText
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="mr-1.5 inline-block h-2 w-2 rounded-full sm:mr-2 sm:h-2.5 sm:w-2.5"
                      style={{ backgroundColor: value.chipBorder }}
                    />
                    <span className="whitespace-nowrap sm:hidden">{value.mobileLabel || value.label}</span>
                    <span className="hidden whitespace-nowrap sm:inline">{value.label}</span>
                  </div>
                  <div
                    className={`pointer-events-none absolute top-full z-30 mt-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100 ${mobileTooltipPositionClass} ${value.tooltipPositionClass || "sm:left-1/2 sm:-translate-x-1/2"} ${value.tooltipClass || "w-64 whitespace-normal"}`}
                    title={value.description}
                  >
                    {value.description}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
            <ComposableMap projection="geoAlbersUsa" className="block h-auto w-full">
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const fips = String(geo.id).padStart(2, "0");
                    const abbr = FIPS_TO_ABBR[fips] || STATE_NAME_TO_ABBR[geo.properties.name];
                    const currentState = abbr ? statesData[abbr] : null;
                    const currentStatus = normalizeStatus(currentState?.status);
                    const isSelected = abbr === selectedAbbr;
                    const baseFill = STATUS_META[currentStatus].color;
                    const selectedFill = shiftHexColor(baseFill, 26);
                    const hoverFill = isSelected ? shiftHexColor(baseFill, 34) : shiftHexColor(baseFill, 14);
                    const pressedFill = shiftHexColor(baseFill, 38);

                    return (
                      <Geography
                        className="transition-all duration-200 ease-out"
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={() => {
                          if (abbr) setSelectedAbbr(abbr);
                        }}
                        onKeyDown={(event) => {
                          if (!abbr) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedAbbr(abbr);
                          }
                        }}
                        role="button"
                        tabIndex={abbr ? 0 : -1}
                        style={{
                          default: {
                            fill: isSelected ? selectedFill : baseFill,
                            opacity: isSelected ? 1 : 0.97,
                            stroke: "#111111",
                            strokeWidth: 0.9,
                            strokeLinejoin: "round",
                            strokeLinecap: "round",
                            vectorEffect: "non-scaling-stroke",
                            transition: "all 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                            outline: "none"
                          },
                          hover: {
                            fill: hoverFill,
                            opacity: 1,
                            stroke: "#27272a",
                            strokeWidth: 0.95,
                            strokeLinejoin: "round",
                            strokeLinecap: "round",
                            vectorEffect: "non-scaling-stroke",
                            transition: "all 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                            outline: "none",
                            cursor: abbr ? "pointer" : "default"
                          },
                          pressed: {
                            fill: pressedFill,
                            opacity: 1,
                            stroke: "#3f3f46",
                            strokeWidth: 0.95,
                            strokeLinejoin: "round",
                            strokeLinecap: "round",
                            vectorEffect: "non-scaling-stroke",
                            transition: "all 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                            outline: "none"
                          }
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)] lg:sticky lg:top-6 lg:max-h-[85vh] lg:overflow-y-auto">
          <h2 className="text-lg font-semibold text-zinc-100">{selectedState.name}</h2>
          <p className="mt-1 text-sm">
            <span
              className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: STATUS_META[selectedStatus].chipBg,
                color: STATUS_META[selectedStatus].chipText,
                borderColor: STATUS_META[selectedStatus].chipBorder
              }}
            >
              {STATUS_META[selectedStatus].label}
            </span>
          </p>

          <div className="mt-4 space-y-4 text-sm text-zinc-300 panel-fade" key={selectedAbbr}>
            <section>
              <h3 className="font-medium text-zinc-100">Summary</h3>
              <p className="mt-1 leading-6">{selectedState.summary}</p>
            </section>

            <section>
              <h3 className="font-medium text-zinc-100">Key Laws or Bills</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {(selectedState.keyLaws || []).map((law) => (
                  <li key={law}>{law}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-medium text-zinc-100">Regulatory Body</h3>
              <p className="mt-1 leading-6">{selectedRegulatoryBody}</p>
            </section>

            <section>
              <h3 className="font-medium text-zinc-100">Recent Developments</h3>
              <p className="mt-1 leading-6">{selectedState.recentDevelopments || "No recent developments listed."}</p>
            </section>

            {selectedStateIssuedPrograms.length ? (
              <section className="space-y-2">
                <h3 className="font-medium text-zinc-100">State-Issued Stablecoin</h3>
                <div className="space-y-2">
                  {selectedStateIssuedPrograms.map((item) => {
                    const style = trackerStatusStyle(item.status);
                    return (
                      <article className="rounded-lg border border-zinc-800/90 bg-zinc-950/35 px-3 py-2.5" key={`${item.state}-${item.program}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="pr-2 text-sm font-semibold leading-snug text-zinc-100">{item.program}</p>
                          <span
                            className="rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none"
                            style={{
                              backgroundColor: style.bg,
                              borderColor: style.border,
                              color: style.text
                            }}
                          >
                            {item.status}
                          </span>
                        </div>
                        <div className="mt-1.5 space-y-1 text-xs leading-5 text-zinc-400">
                          {item.what ? (
                            <p>
                              <span className="font-semibold text-zinc-300">What: </span>
                              {item.what}
                            </p>
                          ) : null}
                          {item.latest ? (
                            <p>
                              <span className="font-semibold text-zinc-300">Latest: </span>
                              {item.latest}
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {selectedState.timeline?.length ? (
              <section>
                <h3 className="font-medium text-zinc-100">Major Legislative Timeline</h3>
                <ul className="mt-2 space-y-1">
                  {selectedState.timeline.map((item) => (
                    <li className="flex items-start gap-2 text-xs text-zinc-300" key={`${selectedState.name}-${item.date}-${item.label}`}>
                      <span aria-hidden="true" className="mt-0.5 text-zinc-500">
                        →
                      </span>
                      <p title={item.detail || item.label}>
                        <span className="font-semibold text-zinc-200">{item.date}</span>
                        {" "}
                        <span className="text-zinc-100">{item.label}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h3 className="font-medium text-zinc-100">Sources</h3>
              {selectedState.sources?.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {selectedState.sources.map((source) => (
                    <li className="min-w-0" key={source}>
                      <a className="break-all underline decoration-sky-500/50 underline-offset-2 hover:text-sky-300" href={source} rel="noreferrer" target="_blank">
                        {getSourceLabel(source)}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1">No source links listed.</p>
              )}
            </section>
          </div>
        </aside>

        {federalContext ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/85 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.35)] sm:p-5 lg:col-start-1 lg:col-end-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Federal Context</p>
            <h2 className="mt-2 text-base font-semibold text-zinc-100">{federalContext.law}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{federalContext.summary}</p>
            <p className="mt-2 text-sm text-zinc-300">
              <span className="font-medium text-zinc-200">Signed: </span>
              {formatDate(federalContext.signedDate)}
            </p>
            {federalContext.sources?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-sky-300">
                {federalContext.sources.map((source) => (
                  <li className="min-w-0" key={source}>
                    <a className="break-all underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200" href={source} rel="noreferrer" target="_blank">
                      {getSourceLabel(source)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </main>

      {majorStateDevelopments.length || pendingFederalBills.length ? (
        <section className="mx-auto mb-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">Pending Legislation</h2>
          <p className="mt-1 text-sm text-zinc-400">Major state and federal items with clear what-it-is and current status.</p>

          <div className="mt-4 space-y-4">
            {majorStateDevelopments.length ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-300 sm:text-base">State Legislative / Policy Watch</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {majorStateDevelopments.map((item) => {
                    const stateName = ALL_STATES[item.state] || item.state;
                    const stateStatus = normalizeStatus(statesData[item.state]?.status);
                    const statusMeta = STATUS_META[stateStatus];
                    return (
                      <article
                        className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-colors duration-150 hover:border-zinc-700 hover:bg-zinc-900/70"
                        key={`${item.state}-${item.title}`}
                        onClick={() => {
                          if (ALL_STATES[item.state]) setSelectedAbbr(item.state);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            if (ALL_STATES[item.state]) setSelectedAbbr(item.state);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{item.state} · {stateName}</p>
                          <span
                            className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              backgroundColor: statusMeta.chipBg,
                              color: statusMeta.chipText,
                              borderColor: statusMeta.chipBorder
                            }}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                        <h3 className="mt-1 text-sm font-semibold text-zinc-100">{item.title}</h3>
                        <p className="mt-2 text-xs text-zinc-300">
                          <span className="font-medium text-zinc-200">What: </span>
                          {item.what || "State policy development affecting digital assets/stablecoins."}
                        </p>
                        <p className="mt-1 text-xs text-zinc-300">
                          <span className="font-medium text-zinc-200">Status: </span>
                          {item.status}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-300">
                          <span className="font-medium text-zinc-200">Latest: </span>
                          {item.latest}
                        </p>
                        {item.sources?.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-sky-300">
                            {item.sources.map((source) => (
                              <li className="min-w-0" key={source}>
                                <a className="break-all underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200" href={source} rel="noreferrer" target="_blank">
                                  {getSourceLabel(source)}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {pendingFederalBills.length ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-300 sm:text-base">Major Pending Federal Bills</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {pendingFederalBills.map((bill) => (
                    <article className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4" key={bill.id}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{bill.id}</p>
                      <h3 className="mt-1 text-sm font-semibold text-zinc-100">{bill.title}</h3>
                      <p className="mt-2 text-xs text-zinc-300">
                        <span className="font-medium text-zinc-200">What: </span>
                        {bill.what || "Pending federal digital asset/stablecoin legislation."}
                      </p>
                      <p className="mt-1 text-xs text-zinc-300">
                        <span className="font-medium text-zinc-200">Status: </span>
                        {bill.status}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-300">
                        <span className="font-medium text-zinc-200">Latest: </span>
                        {bill.latest}
                      </p>
                      {bill.sources?.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-sky-300">
                          {bill.sources.map((source) => (
                            <li className="min-w-0" key={source}>
                              <a className="break-all underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200" href={source} rel="noreferrer" target="_blank">
                                {getSourceLabel(source)}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className="bg-black/90">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Last updated: {formatDate(latestDataDate)}</p>
          <a className="underline decoration-sky-500/50 underline-offset-2 hover:text-sky-300" href="https://x.com/eshita" rel="noreferrer" target="_blank">
            Maintained by Eshita
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;

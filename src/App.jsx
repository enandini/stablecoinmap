import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import geoUrl from "us-atlas/states-10m.json?url";
import regulationData from "./data/stablecoinRegulation.json";
import { ALL_STATES, FIPS_TO_ABBR, STATE_NAME_TO_ABBR } from "./data/stateMappings";

const STATUS_META = {
  friendly: {
    label: "Friendly / Clear Framework",
    color: "#166534",
    chipBg: "#14532d",
    chipBorder: "#22c55e",
    chipText: "#bbf7d0"
  },
  unclear: {
    label: "Unclear / Pending Legislation",
    color: "#a16207",
    chipBg: "#78350f",
    chipBorder: "#f59e0b",
    chipText: "#fde68a"
  },
  restrictive: {
    label: "Restrictive",
    color: "#991b1b",
    chipBg: "#7f1d1d",
    chipBorder: "#ef4444",
    chipText: "#fecaca"
  },
  none: {
    label: "No Specific Framework",
    color: "#374151",
    chipBg: "#1f2937",
    chipBorder: "#9ca3af",
    chipText: "#e5e7eb"
  }
};

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

function statusKey(input) {
  if (!input) return "none";
  if (Object.hasOwn(STATUS_META, input)) return input;
  return "none";
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

function App() {
  const statesData = regulationData.states || regulationData;
  const federalContext = regulationData.federalContext || null;
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

  const latestDataDate = allLastUpdated[allLastUpdated.length - 1] || "2026-02-11";

  const [selectedAbbr, setSelectedAbbr] = useState("NY");

  const selectedState = useMemo(() => {
    const fromData = statesData[selectedAbbr];
    if (fromData) return fromData;

    const name = ALL_STATES[selectedAbbr] || "Unknown";
    return {
      name,
      status: "none",
      summary:
        `${name} does not have a clearly defined, stablecoin-specific statutory framework in this dataset. ` +
        "Most activity appears to be governed through general money transmission, banking, and consumer protection rules.",
      keyLaws: ["No stablecoin-specific state law identified."],
      recentDevelopments:
        "No major state-specific stablecoin development is currently listed in this starter dataset.",
      sources: [],
      lastUpdated: latestDataDate
    };
  }, [latestDataDate, selectedAbbr, statesData]);

  const selectedStatus = statusKey(selectedState.status);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="border-b border-zinc-800 bg-black/90 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">US Stablecoin Regulation Map</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Click any state to view current status, legal references, and recent updates.
          </p>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr),360px] lg:px-8">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/85 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.35)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            {Object.entries(STATUS_META).map(([key, value]) => (
              <div
                className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium sm:text-sm"
                key={key}
                style={{
                  backgroundColor: value.chipBg,
                  borderColor: value.chipBorder,
                  color: value.chipText
                }}
              >
                <span
                  aria-hidden="true"
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: value.chipBorder }}
                />
                <span>{value.label}</span>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
            <ComposableMap projection="geoAlbersUsa" className="h-auto w-full">
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const fips = String(geo.id).padStart(2, "0");
                    const abbr = FIPS_TO_ABBR[fips] || STATE_NAME_TO_ABBR[geo.properties.name];
                    const currentState = abbr ? statesData[abbr] : null;
                    const currentStatus = statusKey(currentState?.status);
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

          {federalContext ? (
            <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
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
        </section>

        <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)] lg:sticky lg:top-6">
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
              <h3 className="font-medium text-zinc-100">Recent Developments</h3>
              <p className="mt-1 leading-6">{selectedState.recentDevelopments || "No recent developments listed."}</p>
            </section>

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
      </main>

      {majorStateDevelopments.length || pendingFederalBills.length ? (
        <section className="mx-auto mb-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">Legislation on the Docket</h2>
          <p className="mt-1 text-sm text-zinc-400">Major state and federal items with clear what-it-is and current status.</p>

          <div className="mt-4 space-y-4">
            {majorStateDevelopments.length ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-300 sm:text-base">State Legislative / Policy Watch</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {majorStateDevelopments.map((item) => {
                    const stateName = ALL_STATES[item.state] || item.state;
                    const stateStatus = statusKey(statesData[item.state]?.status);
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

      <footer className="border-t border-zinc-800 bg-black/90">
        <div className="mx-auto flex w-full max-w-7xl px-4 py-4 text-xs text-zinc-400 sm:px-6 lg:px-8">
          <p>Last updated: {formatDate(latestDataDate)}</p>
        </div>
      </footer>
    </div>
  );
}

export default App;

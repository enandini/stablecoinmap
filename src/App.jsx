import { useEffect, useMemo, useRef, useState } from "react";
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
    tooltipPositionClass: "sm:left-0 sm:translate-x-0",
    color: "#0f766e",
    chipBg: "#134e4a",
    chipBorder: "#2dd4bf",
    chipText: "#99f6e4"
  },
  clear_restrictive: {
    label: "Clear + Strict",
    mobileLabel: "Clear + Strict",
    description: "clear framework with higher licensing burden and compliance cost",
    tooltipClass: "w-[min(17rem,calc(100vw-2.5rem))] whitespace-normal leading-snug break-words sm:w-80",
    tooltipPositionClass: "sm:left-0 sm:translate-x-0",
    color: "#35508f",
    chipBg: "#1e3a6b",
    chipBorder: "#7aa2ff",
    chipText: "#dbe7ff"
  },
  pending: {
    label: "Pending",
    mobileLabel: "Pending",
    description: "active stablecoin-related bills, pilots, or money-transmission modernization",
    tooltipClass: "w-[min(17rem,calc(100vw-2.5rem))] whitespace-normal leading-snug break-words sm:w-80",
    tooltipPositionClass: "sm:left-0 sm:translate-x-0",
    color: "#b45309",
    chipBg: "#78350f",
    chipBorder: "#fbbf24",
    chipText: "#fde68a"
  },
  federal_default: {
    label: "No State Framework",
    mobileLabel: "No State Framework",
    description: "no meaningful state stablecoin framework identified; current baseline is existing money-transmission rules plus applicable federal law",
    tooltipClass: "w-[min(17rem,calc(100vw-2.5rem))] whitespace-normal leading-snug break-words sm:w-80",
    tooltipPositionClass: "sm:right-0 sm:left-auto sm:translate-x-0",
    color: "#5b667a",
    chipBg: "#273244",
    chipBorder: "#a7b0bf",
    chipText: "#e5e7eb"
  }
};

const STATUS_ORDER = ["clear_friendly", "clear_restrictive", "pending", "federal_default"];
const DEFAULT_STATE_ABBR = "NY";
const BILL_ID_PATTERN = /\b(?:CS\/CS\/|CS\/)?(?:H\.R\.|S\.|HB|SB|AB|A|HR)\s*\d+[A-Z0-9-]*\b/gi;

function normalizeLookup(value) {
  return String(value || "").trim().toLowerCase();
}

function toStateSlug(value) {
  return normalizeLookup(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getAbbrFromStateParam(stateParam) {
  if (!stateParam) return null;
  const trimmed = String(stateParam).trim();
  const upper = trimmed.toUpperCase();
  if (ALL_STATES[upper]) return upper;

  const normalized = normalizeLookup(trimmed);
  const match = Object.entries(ALL_STATES).find(([, name]) => toStateSlug(name) === normalized);
  return match?.[0] || null;
}

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

function shouldClampText(value, threshold = 180) {
  return String(value || "").trim().length > threshold;
}

function ensureSentenceEnding(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function stripBillIds(value) {
  const original = String(value || "").trim();
  if (!original) return "";
  const cleaned = original
    .replace(BILL_ID_PATTERN, "")
    .replace(/\(\s*\d{4}\s*\)/g, "")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s*\+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/^\W+|\W+$/g, "")
    .trim();
  return cleaned || original;
}

function simplifyLegislationDates(value) {
  const text = String(value || "");
  const monthNames = "January|February|March|April|May|June|July|August|September|October|November|December";
  const withDayPattern = new RegExp(`\\b(${monthNames})\\s+\\d{1,2},\\s*(20\\d{2})\\b`, "gi");
  const monthYearPattern = new RegExp(`\\b(${monthNames})\\s+(20\\d{2})\\b`, "gi");

  return text
    .replace(withDayPattern, (_, __, year) => (year === "2027" ? `${_}` : year))
    .replace(monthYearPattern, (match, __, year) => (year === "2027" ? match : year))
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeCardText(value) {
  const cleaned = simplifyLegislationDates(stripBillIds(value || ""))
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();
  return ensureSentenceEnding(cleaned);
}

function cleanCardTitle(value) {
  const cleaned = stripBillIds(value || "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+-\s+/g, " ")
    .trim();
  return cleaned || String(value || "").trim();
}

function mergeNarrativeParts(parts) {
  return parts
    .map((part) => normalizeCardText(part || ""))
    .filter(Boolean)
    .join(" ");
}

function PanelAccordionSection({
  id,
  title,
  activeSection,
  setActiveSection,
  children
}) {
  const isOpen = activeSection === id;
  return (
    <section className="detail-panel-section">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-md text-left"
        onClick={() => setActiveSection((prev) => (prev === id ? null : id))}
        aria-expanded={isOpen}
      >
        <h3 className="detail-panel-heading">{title}</h3>
        <span className={`text-sm text-zinc-400 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">
          ▼
        </span>
      </button>
      {isOpen ? <div className="mt-3">{children}</div> : null}
    </section>
  );
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

function SourceDisclosure({ sources, stopPropagation = false, className = "" }) {
  if (!sources?.length) return null;
  return (
    <details
      className={`mt-2 ${className}`}
      onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
    >
      <summary className="sources-summary inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-950/40 px-2.5 py-1 text-sm font-medium text-zinc-300 hover:border-zinc-600 hover:text-zinc-200">
        <span>Source</span>
        <span aria-hidden="true" className="details-chevron text-[10px] text-zinc-500 transition-transform duration-150">
          ▼
        </span>
      </summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-sky-300">
        {sources.map((source) => (
          <li className="min-w-0" key={source}>
            <a className="break-all underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200" href={source} rel="noreferrer" target="_blank">
              {getSourceLabel(source)}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
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

  const [selectedAbbr, setSelectedAbbr] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_STATE_ABBR;
    const fromQuery = getAbbrFromStateParam(new URLSearchParams(window.location.search).get("state"));
    return fromQuery || DEFAULT_STATE_ABBR;
  });
  const leftColumnRef = useRef(null);
  const legendRef = useRef(null);
  const stateSearchRef = useRef(null);
  const [desktopPanelHeight, setDesktopPanelHeight] = useState(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState(null);
  const [stateSearchQuery, setStateSearchQuery] = useState("");
  const [isStateSearchOpen, setIsStateSearchOpen] = useState(false);
  const [expandedPolicyCards, setExpandedPolicyCards] = useState({});
  const [activePanelSection, setActivePanelSection] = useState("summary");

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
  const timelineEntries = selectedState.timeline || [];

  const stateSearchCatalog = useMemo(
    () =>
      Object.entries(ALL_STATES)
        .map(([abbr, name]) => ({
          abbr,
          name,
          searchTerms: [normalizeLookup(abbr), normalizeLookup(name), toStateSlug(name)]
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const stateSearchResults = useMemo(() => {
    const query = normalizeLookup(stateSearchQuery);
    if (!query) return [];
    return stateSearchCatalog.filter((entry) =>
      entry.searchTerms.some((term) => term.includes(query))
    ).slice(0, 8);
  }, [stateSearchCatalog, stateSearchQuery]);

  const toggleCardExpand = (key) => {
    setExpandedPolicyCards((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  useEffect(() => {
    setActivePanelSection("summary");
  }, [selectedAbbr]);

  useEffect(() => {
    const updateHeight = () => {
      if (typeof window === "undefined") return;
      if (window.innerWidth < 1024) {
        setDesktopPanelHeight(null);
        return;
      }
      const nextHeight = leftColumnRef.current?.getBoundingClientRect().height;
      setDesktopPanelHeight(nextHeight ? Math.round(nextHeight) : null);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(updateHeight)
      : null;
    if (observer && leftColumnRef.current) observer.observe(leftColumnRef.current);

    return () => {
      window.removeEventListener("resize", updateHeight);
      if (observer) observer.disconnect();
    };
  }, [selectedAbbr, federalContext]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handlePointerDown = (event) => {
      if (!stateSearchRef.current?.contains(event.target)) setIsStateSearchOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setIsStateSearchOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const selectedName = ALL_STATES[selectedAbbr];
    if (!selectedName) return;

    const url = new URL(window.location.href);
    url.searchParams.set("state", toStateSlug(selectedName));
    const nextPath = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;
    window.history.replaceState({}, "", nextPath);
  }, [selectedAbbr]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const selectedName = ALL_STATES[selectedAbbr] || selectedState.name || "United States Stablecoin Regulation";
    const pageTitle = "United States Stablecoin Regulation";
    const summary = selectedState.summary || "State-by-state stablecoin framework tracker.";
    const shortSummary = summary.length > 180 ? `${summary.slice(0, 177)}...` : summary;

    document.title = pageTitle;
    const descriptionTag = document.querySelector("meta[name='description']");
    if (descriptionTag) {
      descriptionTag.setAttribute("content", `${selectedName}: ${shortSummary}`);
    }
  }, [selectedAbbr, selectedState.name, selectedState.summary]);

  return (
    <div className="min-h-screen bg-black pt-5 text-zinc-100 sm:pt-6">
      <header className="bg-black/90 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">United States Stablecoin Regulation</h1>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr),360px] lg:px-8">
        <div className="min-w-0 space-y-6" ref={leftColumnRef}>
          <section className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/85 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.35)] sm:p-5">
          <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3" ref={legendRef}>
            {STATUS_ORDER.map((key, index) => {
              const value = STATUS_META[key];
              const isFilterActive = activeStatusFilter === key;
              const hasActiveFilter = Boolean(activeStatusFilter);
              const chipOpacity = !hasActiveFilter || isFilterActive ? 1 : 0.46;
              const mobileTooltipPositionClass = index % 2 === 0
                ? "left-0 translate-x-0"
                : "right-0 left-auto translate-x-0";
              return (
                <div className="group relative w-full sm:w-auto" key={key}>
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-xl border px-3 py-1.5 text-[11px] font-semibold tracking-[0.01em] sm:w-auto sm:justify-start sm:px-3.5 sm:text-sm"
                    style={{
                      backgroundColor: value.chipBg,
                      borderColor: value.chipBorder,
                      color: value.chipText,
                      opacity: chipOpacity,
                      boxShadow: isFilterActive ? `0 0 0 1px ${value.chipBorder}` : "none"
                    }}
                    onClick={() => {
                      setActiveStatusFilter((prev) => (prev === key ? null : key));
                    }}
                    aria-controls={`legend-tooltip-${key}`}
                    aria-pressed={isFilterActive}
                  >
                    <span
                      aria-hidden="true"
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-[4px]"
                      style={{ backgroundColor: value.chipBorder }}
                    />
                    <span className="whitespace-nowrap sm:hidden">{value.mobileLabel || value.label}</span>
                    <span className="hidden whitespace-nowrap sm:inline">{value.label}</span>
                  </button>
                  <div
                    id={`legend-tooltip-${key}`}
                    className={`pointer-events-none absolute top-full z-30 mt-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 opacity-0 transition-opacity duration-150 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${mobileTooltipPositionClass} ${value.tooltipPositionClass || "sm:left-1/2 sm:-translate-x-1/2"} ${value.tooltipClass || "w-64 whitespace-normal"}`}
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
                    const matchesFilter = !activeStatusFilter || activeStatusFilter === currentStatus;
                    const baseFill = STATUS_META[currentStatus].color;
                    const mutedFill = "#2f3744";
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
                            fill: isSelected ? selectedFill : (matchesFilter ? baseFill : mutedFill),
                            opacity: isSelected ? 1 : (matchesFilter ? 0.97 : 0.42),
                            stroke: "#111111",
                            strokeWidth: 0.9,
                            strokeLinejoin: "round",
                            strokeLinecap: "round",
                            vectorEffect: "non-scaling-stroke",
                            transition: "all 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                            outline: "none"
                          },
                          hover: {
                            fill: matchesFilter ? hoverFill : mutedFill,
                            opacity: matchesFilter ? 1 : 0.52,
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
                            fill: matchesFilter ? pressedFill : mutedFill,
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

        </div>

        <aside
          className="custom-scrollbar h-fit rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)] lg:overflow-y-auto"
          style={desktopPanelHeight ? { maxHeight: `${desktopPanelHeight}px` } : undefined}
        >
          <div className="relative mb-4" ref={stateSearchRef}>
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.09em] text-zinc-400" htmlFor="state-search-input">
              Search State
            </label>
            <input
              id="state-search-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search a state..."
              value={stateSearchQuery}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setStateSearchQuery(nextQuery);
                setIsStateSearchOpen(normalizeLookup(nextQuery).length > 0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && stateSearchResults[0]) {
                  event.preventDefault();
                  setSelectedAbbr(stateSearchResults[0].abbr);
                  setStateSearchQuery("");
                  setIsStateSearchOpen(false);
                }
                if (event.key === "Escape") setIsStateSearchOpen(false);
              }}
              onBlur={() => {
                window.setTimeout(() => setIsStateSearchOpen(false), 100);
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            {isStateSearchOpen && stateSearchResults.length ? (
              <ul className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 py-1 shadow-xl">
                {stateSearchResults.map((entry) => (
                  <li key={entry.abbr}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                      onClick={() => {
                        setSelectedAbbr(entry.abbr);
                        setStateSearchQuery("");
                        setIsStateSearchOpen(false);
                      }}
                    >
                      {entry.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">{selectedState.name}</h2>
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

          <div className="mt-5 space-y-4 text-sm text-zinc-300 panel-fade" key={selectedAbbr}>
            <PanelAccordionSection
              id="summary"
              title="Summary"
              activeSection={activePanelSection}
              setActiveSection={setActivePanelSection}
            >
              <p className="detail-panel-copy">{ensureSentenceEnding(selectedState.summary)}</p>
            </PanelAccordionSection>

            <PanelAccordionSection
              id="key-laws"
              title="Key Laws or Bills"
              activeSection={activePanelSection}
              setActiveSection={setActivePanelSection}
            >
              <ul className="detail-panel-copy list-disc space-y-1.5 pl-5">
                {(selectedState.keyLaws || []).map((law) => (
                  <li key={law}>{ensureSentenceEnding(law)}</li>
                ))}
              </ul>
            </PanelAccordionSection>

            <PanelAccordionSection
              id="regulator"
              title="Regulatory Body"
              activeSection={activePanelSection}
              setActiveSection={setActivePanelSection}
            >
              <p className="detail-panel-copy">{ensureSentenceEnding(selectedRegulatoryBody)}</p>
            </PanelAccordionSection>

            <PanelAccordionSection
              id="recent"
              title="Recent Developments"
              activeSection={activePanelSection}
              setActiveSection={setActivePanelSection}
            >
              <p className="detail-panel-copy">{ensureSentenceEnding(selectedState.recentDevelopments || "No recent developments listed.")}</p>
            </PanelAccordionSection>

            {selectedStateIssuedPrograms.length ? (
              <PanelAccordionSection
                id="state-issued"
                title="State-Issued Stablecoin"
                activeSection={activePanelSection}
                setActiveSection={setActivePanelSection}
              >
                <div className="space-y-2.5">
                  {selectedStateIssuedPrograms.map((item) => {
                    const style = trackerStatusStyle(item.status);
                    return (
                      <article className="rounded-lg border border-zinc-800/90 bg-zinc-950/35 px-3 py-3" key={`${item.state}-${item.program}`}>
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
                        <div className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-300">
                          {item.what ? <p>{ensureSentenceEnding(item.what)}</p> : null}
                          {item.latest ? <p>{ensureSentenceEnding(item.latest)}</p> : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </PanelAccordionSection>
            ) : null}

            {timelineEntries.length ? (
              <PanelAccordionSection
                id="timeline"
                title="Major Legislative Timeline"
                activeSection={activePanelSection}
                setActiveSection={setActivePanelSection}
              >
                <ul className="space-y-3">
                  {timelineEntries.map((item, index) => (
                    <li className="detail-panel-copy relative pl-6" key={`${selectedState.name}-${item.date}-${item.label}`}>
                      {index < timelineEntries.length - 1 ? (
                        <span aria-hidden="true" className="absolute left-[7px] top-3 h-[calc(100%+0.75rem)] w-px bg-zinc-700" />
                      ) : null}
                      <span aria-hidden="true" className="absolute left-[3px] top-1.5 h-2.5 w-2.5 rounded-full border border-zinc-900 bg-zinc-300" />
                      <p className="leading-6" title={item.detail || item.label}>
                        <span className="font-semibold text-zinc-100">{item.date}</span>
                        {" "}
                        <span className="text-zinc-200">{ensureSentenceEnding(item.label)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </PanelAccordionSection>
            ) : null}

            <PanelAccordionSection
              id="sources"
              title="Sources"
              activeSection={activePanelSection}
              setActiveSection={setActivePanelSection}
            >
              {selectedState.sources?.length ? <SourceDisclosure sources={selectedState.sources} /> : <p className="detail-panel-copy">No source links listed.</p>}
            </PanelAccordionSection>
          </div>
        </aside>

      </main>

      {majorStateDevelopments.length || pendingFederalBills.length || federalContext ? (
        <section className="mx-auto mb-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">Pending Legislation</h2>
          <div className="mt-2 h-px w-full bg-zinc-800" />
          <p className="mt-1 text-sm text-zinc-400">Major state and federal items with clear what-it-is and current status.</p>

          <div className="mt-4 space-y-4">
            {majorStateDevelopments.length ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
                <p className="text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">State Legislative / Policy Watch</p>
                <div className="mt-2 h-px w-full bg-zinc-800" />
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {majorStateDevelopments.map((item) => {
                    const stateName = ALL_STATES[item.state] || item.state;
                    const stateStatus = normalizeStatus(statesData[item.state]?.status);
                    const statusMeta = STATUS_META[stateStatus];
                    const cardKey = `state-${item.state}-${item.title}`;
                    const cardTitle = cleanCardTitle(item.title);
                    const summaryText = normalizeCardText(item.what || "State policy development affecting digital assets and stablecoins.");
                    const updateText = mergeNarrativeParts([item.status, item.latest]);
                    const canClampSummary = shouldClampText(summaryText);
                    const isExpanded = Boolean(expandedPolicyCards[cardKey]);
                    return (
                      <article
                        className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 transition-colors duration-150 hover:border-zinc-700 hover:bg-zinc-900/70"
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
                          <p className="text-sm font-medium text-zinc-400">{stateName}</p>
                          <span
                            className="rounded-full border px-2 py-0.5 text-xs font-semibold"
                            style={{
                              backgroundColor: statusMeta.chipBg,
                              color: statusMeta.chipText,
                              borderColor: statusMeta.chipBorder
                            }}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-semibold leading-7 text-zinc-100">{cardTitle}</h3>
                        <p className="mt-3 text-sm text-zinc-300">
                          <span className={canClampSummary && !isExpanded ? "text-clamp-3" : ""}>{summaryText}</span>
                        </p>
                        {canClampSummary ? (
                          <button
                            type="button"
                            className="mt-1 text-sm font-medium text-sky-300 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              toggleCardExpand(cardKey);
                            }}
                          >
                            {isExpanded ? "Read less" : "Read more"}
                          </button>
                        ) : null}
                        {updateText ? <p className="mt-3 text-sm leading-6 text-zinc-300">{updateText}</p> : null}
                        <SourceDisclosure sources={item.sources} stopPropagation className="mt-3" />
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {pendingFederalBills.length ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
                <p className="text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">Major Pending Federal Bills</p>
                <div className="mt-2 h-px w-full bg-zinc-800" />
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pendingFederalBills.map((bill) => {
                    const cardKey = `federal-${bill.id}`;
                    const cardTitle = cleanCardTitle(bill.title);
                    const summaryText = normalizeCardText(bill.what || "Pending federal digital asset/stablecoin legislation");
                    const updateText = mergeNarrativeParts([bill.status, bill.latest]);
                    const canClampSummary = shouldClampText(summaryText);
                    const isExpanded = Boolean(expandedPolicyCards[cardKey]);
                    return (
                      <article className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5" key={bill.id}>
                        <h3 className="text-lg font-semibold leading-7 text-zinc-100">{cardTitle}</h3>
                        <p className="mt-3 text-sm text-zinc-300">
                        <span className={canClampSummary && !isExpanded ? "text-clamp-3" : ""}>{summaryText}</span>
                      </p>
                        {canClampSummary ? (
                          <button
                            type="button"
                            className="mt-1 text-sm font-medium text-sky-300 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200"
                            onClick={() => toggleCardExpand(cardKey)}
                          >
                            {isExpanded ? "Read less" : "Read more"}
                          </button>
                        ) : null}
                      {updateText ? <p className="mt-3 text-sm leading-6 text-zinc-300"><span className="font-semibold text-zinc-100">Current: </span>{updateText}</p> : null}
                      <SourceDisclosure sources={bill.sources} className="mt-3" />
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {federalContext ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
                <p className="text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">Federal Context</p>
                <div className="mt-2 h-px w-full bg-zinc-800" />
                <h3 className="mt-3 text-lg font-semibold leading-7 text-zinc-100">{federalContext.law}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-300">{ensureSentenceEnding(federalContext.summary)}</p>
                <p className="mt-2 text-sm text-zinc-300">
                  <span className="font-semibold text-zinc-100">Signed: </span>
                  {formatDate(federalContext.signedDate)}
                </p>
                <SourceDisclosure sources={federalContext.sources} className="mt-3" />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className="bg-black/90">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-1 px-4 py-4 text-center text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left lg:px-8">
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

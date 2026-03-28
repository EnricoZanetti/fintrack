import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ftLogo from "./assets/ft-favicon.png";

// Canvas runtime makes NPM packages available; if it fails, we fall back to a tiny parser.
let PapaRef: any = null;
(async () => {
  try {
    // @ts-ignore
    const mod = await import("papaparse");
    PapaRef = mod.default || mod;
  } catch (e) {
    console.warn("PapaParse not available; using fallback parser.");
  }
})();

// ---- Small helpers ----
const siteNameDefault = "Revolut CSV Transformer";
const categorySet = [
  "Housing",
  "Rent",
  "Bills",
  "Health",
  "Fitness",
  "Groceries",
  "Transport",
  "Car/Bike",
  "Fuel",
  "Education",
  "Out",
  "Travel",
  "Shopping",
  "Subscriptions",
  "Leisure",
  "Gifts & Donations",
  "Electronics",
  "OtherExpenses",
  "Transfers",
  "Income",
  "Fees",
];

const categoryColorClasses: Record<string, string> = {
  Groceries: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Transport: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  Fuel: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Shopping: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  Income: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Transfers: "bg-slate-100 text-slate-800 dark:bg-slate-700/40 dark:text-slate-300",
  Bills: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  Health: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  Subscriptions: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  Leisure: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  Travel: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  Out: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  Housing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Rent: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Fees: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Gifts: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
  Education: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  OtherExpenses: "bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300",
};

function categoryBadgeClass(category: string): string {
  return categoryColorClasses[category] || "bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300";
}


function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function csvEscape(value: any): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toISODate(dateStr: string): string {
  // Accepts: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD"
  if (!dateStr) return "";
  const d = dateStr.trim().slice(0, 10);
  // naive validation
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = new Date(dateStr);
  if (!isNaN(dt as unknown as number)) return dt.toISOString().slice(0, 10);
  return "";
}

function heuristicCategory(name: string): string {
  const s = (name || "").toLowerCase();
  const has = (k: string | RegExp) =>
    typeof k === "string" ? s.includes(k) : !!s.match(k);
  if (
    has("salary") ||
    has("stipend") ||
    has("payroll") ||
    has("bonifico in entrata") ||
    has("payment from")
  )
    return "Income";
  if (
    has("farmacia") ||
    has("farm") ||
    has("pharma") ||
    has("clinic") ||
    has("ospedale") ||
    has("dental") ||
    has("servizi sanitari") ||
    has("barber") ||
    has("poliambulatori")
  )
    return "Health";
  if (has("atm") || has("cash withdrawal") || has("prelievo"))
    return "OtherExpenses";
  if (
    has("transfer") ||
    has("bonifico") ||
    has("internal transfer") ||
    has("worldpay")
  )
    return "Transfers";
  if (has("amazon") || has("zalando") || has("decathlon") || has("ikea"))
    return "Shopping";
  if (
    has("conad") ||
    has("coop") ||
    has("lidl") ||
    has("eurospin") ||
    has("supermerc") ||
    has("poli")
  )
    return "Groceries";
  if (
    has("eni") ||
    has("esso") ||
    has("shell") ||
    has("q8") ||
    has("total") ||
    has("tamoil") ||
    has(" api ") ||
    has(" ip ")
  )
    return "Fuel";
  if (
    has("giunti") ||
    has("libr")
  )
    return "Education";
  if (
    has("bar ") ||
    has("caffe") ||
    has("ristor") ||
    has("trattoria") ||
    has("locanda") ||
    has("osteria") ||
    has("pizz") ||
    has("sushi") ||
    has("mcd") ||
    has("burger") ||
    has("kebab") ||
    has("Urban Factory Lab") ||
    has("pasticceria") ||
    has("Grupppo Negozi") ||
    has("ramen") ||
    has("piadineria")
  )
    return "Out";
  if (
    has("trenitalia") ||
    has("italo") ||
    has("uber") ||
    has("taxi") ||
    has("flixbus") ||
    has("ryanair") ||
    has("wizz") ||
    has("autostrad") ||
    has("funivia")
  )
    return "Transport";
  if (
    has("spotify") ||
    has("netflix") ||
    has("steam") ||
    has("prime") ||
    has("disney") ||
    has("openai") ||
    has("google") ||
    has("claude")
  )
    return "Subscriptions";
  if (
    has("enel") ||
    has("acea") ||
    has("tim") ||
    has("vodafone") ||
    has("windtre") ||
    has("bolletta")
  )
    return "Bills";
  if (has("affitto") || has("mutuo") || has("mortgage") || has("rispa"))
    return "Housing";

  if (has("hotel") || has("booking") || has("airbnb") || has("hostel"))
    return "Travel";
  if (has("fee") || has("commission")) return "Fees";
  return "OtherExpenses";
}

async function classifyWithOpenAI(
  names: string[],
  apiKey: string,
  model: string = "gpt-4o-mini"
): Promise<Record<string, string>> {
  if (!apiKey) throw new Error("Missing API key");
  const chunks: string[][] = [];
  const CHUNK = 40; // keep prompts compact
  for (let i = 0; i < names.length; i += CHUNK)
    chunks.push(names.slice(i, i + CHUNK));

  const mapping: Record<string, string> = {};

  for (const group of chunks) {
    const content = `Classify each transaction/merchant name into one of these categories: ${categorySet.join(
      ", "
    )}.\nReturn a single valid JSON object with keys = original names EXACTLY and values = one category string.\nNames:\n${group
      .map((n, i) => `${i + 1}. ${n}`)
      .join("\n")}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are a meticulous financial transaction classifier. Only output strict JSON with no extra commentary.",
          },
          { role: "user", content },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${text}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "{}";
    try {
      const obj = JSON.parse(text);
      Object.assign(mapping, obj);
    } catch (e) {
      // Model output not strict JSON — attempt to salvage {...}
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        Object.assign(mapping, JSON.parse(m[0]));
      } else {
        // fallback: heuristics for this batch
        for (const n of group) mapping[n] = heuristicCategory(n);
      }
    }
  }
  return mapping;
}

function fallbackParse(csvText: string): { data: any[]; errors: string[] } {
  // Simple CSV parser for well-formed, comma-separated files without fancy quoting.
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { data: [], errors: ["Empty file"] };
  const headers = lines[0].split(",").map((s) => s.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",");
    const rec: any = {};
    headers.forEach((h, i) => (rec[h] = (cols[i] || "").trim()));
    return rec;
  });
  return { data: rows, errors: [] };
}

// --- Tiny dev self-tests to catch regressions (runs once in browser console) ---
function runSelfTests() {
  try {
    console.group("RCVT self-tests");
    console.assert(
      toISODate("2025-08-01 23:59:00") === "2025-08-01",
      "toISODate failed A"
    );
    console.assert(csvEscape("a,b") === '"a,b"', "csvEscape comma");
    console.assert(
      csvEscape('He said "Hi"') === '"He said ""Hi"""',
      "csvEscape quotes"
    );
    console.assert(
      heuristicCategory("Conad Superstore") === "Groceries",
      "heuristics groceries"
    );
    console.assert(
      heuristicCategory("Salary ACME") === "Income",
      "heuristics income"
    );
    console.assert(
      ["Expense", "Income"].includes(
        (() => {
          const amt = -12;
          return amt < 0 ? "Expense" : "Income";
        })()
      ),
      "type calc"
    );
    console.assert(
      parseAmount("-47.30") === -47.3,
      "parseAmount dot decimal negative"
    );
    console.assert(parseAmount("1.234,56") === 1234.56, "parseAmount EU style");
    console.assert(
      parseAmount("-1.234,56") === -1234.56,
      "parseAmount EU negative"
    );
    console.assert(
      parseAmount("4,730.00") === 4730.0,
      "parseAmount US thousands"
    );
    console.assert(
      parseAmount("-4.730,00") === -4730.0,
      "parseAmount EU thousands"
    );
    console.groupEnd();
  } catch (e) {
    console.warn("Self-tests encountered an issue:", e);
  }
}
if (typeof window !== "undefined" && !(window as any).__rcvt_tests_ran) {
  (window as any).__rcvt_tests_ran = true;
  runSelfTests();
}

function parseAmount(input: string): number {
  let s = (input ?? "").toString().trim();
  if (!s) return 0;
  s = s.replace(/[^0-9.,\-+]/g, "");
  if (!s) return 0;
  let sign = 1;
  if (s.includes("-")) sign = -1;
  s = s.replace(/-/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(/,/g, ".");
  } else {
    // only dot or no separator -> already fine
  }
  const num = parseFloat(s);
  return isNaN(num) ? 0 : sign * num;
}

// Format currency amounts nicely
function formatCurrency(amount: number, currency?: string): string {
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

type SortKey = "Date" | "Type" | "Amount" | "Currency" | "Category" | "Name" | "Account" | "Notes" | "Source";
type SortDir = "asc" | "desc";

export default function App() {
  const [tab, setTab] = useState<"transform" | "settings">("transform");

  // Dark mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("rcvt_darkMode");
    if (saved !== null) return saved === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("rcvt_darkMode", String(darkMode));
  }, [darkMode]);

  // Settings (persist to localStorage)
  const [apiKey, setApiKey] = useState<string>("");
  const [source, setSource] = useState<string>("Revolut");
  const [websiteName, setWebsiteName] = useState<string>(siteNameDefault);
  const [dateField, setDateField] = useState<"Completed Date" | "Started Date">(
    "Completed Date"
  );
  const [onlyCompleted, setOnlyCompleted] = useState<boolean>(true);
  const [model, setModel] = useState<string>("gpt-4o-mini");
  const [typeFilter, setTypeFilter] = useState<"Both" | "Expense" | "Income">(
    "Both"
  );
  const [includeHeader, setIncludeHeader] = useState<boolean>(false);

  // Add types + state
  type EditableField = "Date" | "Category" | "Notes" | "Amount";

  const [editing, setEditing] = useState<{
    id: string;
    field: EditableField;
  } | null>(null);
  const [draftEdits, setDraftEdits] = useState<
    Record<string, Partial<Record<EditableField, string>>>
  >({});
  const [edits, setEdits] = useState<
    Record<string, Partial<Record<EditableField, string>>>
  >({});

  // deleted rows (by _id)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // undo delete
  const [lastDeleted, setLastDeleted] = useState<{ id: string; name: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>(categorySet[0]);

  // Search
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Column sorting
  const [sortKey, setSortKey] = useState<SortKey>("Date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Drag & drop
  const [isDragging, setIsDragging] = useState(false);

  // LLM progress
  const [classifying, setClassifying] = useState(false);

  // helper: commit draft edits for a row (merges into saved edits)
  const commitEditsFor = (id: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...(draftEdits[id] || {}) },
    }));
    setDraftEdits((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
    setEditing(null);
  };

  const handleDeleteRow = (id: string, name: string) => {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Set up undo toast
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setLastDeleted({ id, name });
    undoTimerRef.current = setTimeout(() => setLastDeleted(null), 5000);
  };

  const handleUndoDelete = () => {
    if (!lastDeleted) return;
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.delete(lastDeleted.id);
      return next;
    });
    setLastDeleted(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

    const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkApplyCategory = () => {
    if (!selectedIds.size) return;
    setEdits((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        const existing = next[id] || {};
        next[id] = { ...existing, Category: bulkCategory };
      });
      return next;
    });
  };

  const handleColumnSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };


  useEffect(() => {
    const s = localStorage.getItem("rcvt_settings");
    if (s) {
      try {
        const obj = JSON.parse(s);
        setApiKey(obj.apiKey ?? "");
        setSource(obj.source ?? "Revolut");
        setWebsiteName(obj.websiteName ?? siteNameDefault);
        setDateField(obj.dateField ?? "Completed Date");
        setOnlyCompleted(
          typeof obj.onlyCompleted === "boolean" ? obj.onlyCompleted : true
        );
        setModel(obj.model ?? "gpt-4o-mini");
        setTypeFilter(obj.typeFilter ?? "Both");
        setIncludeHeader(obj.includeHeader ?? false);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const payload = {
      apiKey,
      source,
      websiteName,
      dateField,
      onlyCompleted,
      model,
      typeFilter,
      includeHeader,
    };
    localStorage.setItem("rcvt_settings", JSON.stringify(payload));
  }, [
    apiKey,
    source,
    websiteName,
    dateField,
    onlyCompleted,
    model,
    typeFilter,
    includeHeader,
  ]);

  // Upload & processing state
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  const expectedHeaders = [
    "Type",
    "Product",
    "Started Date",
    "Completed Date",
    "Description",
    "Amount",
    "Fee",
    "Currency",
    "State",
    "Balance",
  ];

  async function onFileSelected(file: File) {
    setStatus("Parsing CSV...");
    setErrors([]);
    setCategoryMap({});
    setEdits({});
    setDraftEdits({});
    setDeletedIds(new Set());
    setSelectedIds(new Set());
    setSearchQuery("");

    const text = await file.text();
    let data: any[] = [];
    let parseErrors: any[] = [];

    if (PapaRef) {
      const parsed = PapaRef.parse(text, {
        header: true,
        skipEmptyLines: true,
      });
      data = parsed.data as any[];
      parseErrors = parsed.errors || [];
    } else {
      const parsed = fallbackParse(text);
      data = parsed.data;
      parseErrors = parsed.errors;
    }

    if (parseErrors.length) {
      setErrors((e) => [
        ...e,
        `Parsing issues: ${parseErrors
          .slice(0, 3)
          .map((x: any) => x.message || x)
          .join(" | ")}`,
      ]);
    }

    // Basic header validation
    const headerLine = text.split(/\r?\n/)[0] || "";
    const headers = headerLine.split(",").map((s) => s.trim());
    const missing = expectedHeaders.filter((h) => !headers.includes(h));
    if (missing.length) {
      setErrors((e) => [
        ...e,
        `Missing expected columns: ${missing.join(", ")}. Got: ${headers.join(
          ", "
        )}`,
      ]);
    }

    setRawRows(data);
    setStatus(`Loaded ${data.length} rows.`);
  }

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith(".csv")) {
      onFileSelected(files[0]);
    } else {
      setErrors(["Please drop a .csv file"]);
    }
  }, []);

  const filteredRows = useMemo(() => {
    const rows = (rawRows || []).filter(
      (r) => !!r && Object.keys(r).length > 0
    );
    return onlyCompleted
      ? rows.filter((r) => (r["State"] || "").toUpperCase() === "COMPLETED")
      : rows;
  }, [rawRows, onlyCompleted]);

  const uniqueNames = useMemo(() => {
    const s = new Set<string>();
    for (const r of filteredRows) {
      const name = (r["Description"] || "").trim();
      if (name) s.add(name);
    }
    return Array.from(s);
  }, [filteredRows]);

  const transformedAll = useMemo(() => {
    return filteredRows.map((r, i) => {
      // Parse numeric amount: accept both comma and dot decimals; keep sign for type inference
      const amtNum = parseAmount((r["Amount"] ?? "0").toString());
      const type = amtNum < 0 ? "Expense" : "Income";
      const amountAbs = Math.abs(amtNum || 0).toFixed(2);
      const name = (r["Description"] || "").toString();
      const category = categoryMap[name] || heuristicCategory(name);
      const _id =
        [
          r["Started Date"],
          r["Completed Date"],
          r["Description"],
          r["Amount"],
          r["Currency"],
          r["State"],
          r["Balance"],
        ]
          .map((x) => (x ?? "").toString())
          .join("|") + `|${i}`; // i suffix ensures uniqueness among true duplicates

      const dateVal = toISODate(
        r[dateField] || r["Completed Date"] || r["Started Date"] || ""
      );
      return {
        _id,
        Date: dateVal,
        Type: type,
        Amount: amountAbs,
        Currency: (r["Currency"] || "").toString(),
        Category: category,
        Name: name,
        Account: source || "Revolut",
        Notes: "",
        Source: websiteName || siteNameDefault,
      };
    });
  }, [filteredRows, categoryMap, dateField, source, websiteName]);

  const transformedFiltered = useMemo(() => {
    if (typeFilter === "Both") return transformedAll;
    return transformedAll.filter((r) => r.Type === typeFilter);
  }, [transformedAll, typeFilter]);

  const visibleRows = useMemo(() => {
    return transformedFiltered
      .filter((row) => !deletedIds.has(row._id))
      .map((row: any) => {
        const e = edits[row._id] || {};
        return { ...row, ...e };
      });
  }, [transformedFiltered, edits, deletedIds]);

  // Apply search filter
  const searchedRows = useMemo(() => {
    if (!searchQuery.trim()) return visibleRows;
    const q = searchQuery.toLowerCase();
    return visibleRows.filter(
      (row: any) =>
        (row.Name || "").toLowerCase().includes(q) ||
        (row.Category || "").toLowerCase().includes(q) ||
        (row.Notes || "").toLowerCase().includes(q)
    );
  }, [visibleRows, searchQuery]);

  const sortedRows = useMemo(() => {
    return [...searchedRows].sort((a: any, b: any) => {
      let va = a[sortKey] || "";
      let vb = b[sortKey] || "";

      // Numeric sort for Amount
      if (sortKey === "Amount") {
        const na = parseFloat(va) || 0;
        const nb = parseFloat(vb) || 0;
        return sortDir === "asc" ? na - nb : nb - na;
      }

      // String sort for everything else
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return (a._id || "").localeCompare(b._id || "");
    });
  }, [searchedRows, sortKey, sortDir]);

  // Summary stats
  const stats = useMemo(() => {
    let totalExpense = 0;
    let totalIncome = 0;
    const currencies = new Set<string>();
    for (const row of visibleRows) {
      const amt = parseFloat((row as any).Amount) || 0;
      currencies.add((row as any).Currency);
      if ((row as any).Type === "Expense") totalExpense += amt;
      else totalIncome += amt;
    }
    return {
      totalExpense,
      totalIncome,
      net: totalIncome - totalExpense,
      primaryCurrency: currencies.size === 1 ? Array.from(currencies)[0] : undefined,
    };
  }, [visibleRows]);

  async function handleClassify() {
    try {
      if (!apiKey) throw new Error("Please add your LLM API key in Settings.");
      setClassifying(true);
      setStatus("Classifying with LLM...");
      const map = await classifyWithOpenAI(uniqueNames, apiKey, model);
      setCategoryMap(map);
      setStatus("Classification complete.");
    } catch (e: any) {
      setStatus("");
      setErrors((x) => [...x, e.message || String(e)]);
    } finally {
      setClassifying(false);
    }
  }

  function handleDownload() {
    const cols = [
      "Date",
      "Type",
      "Amount",
      "Currency",
      "Category",
      "Name",
      "Account",
      "Notes",
      "Source",
    ];

    const headerRow = includeHeader ? cols.join(",") + "\n" : "";
    const body = sortedRows
      .map((row) => cols.map((c) => csvEscape((row as any)[c])).join(","))
      .join("\n");

    const csv = headerRow + (body ? body + "\n" : "");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revolut_transformed_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setRawRows([]);
    setErrors([]);
    setCategoryMap({});
    setEdits({});
    setDraftEdits({});
    setDeletedIds(new Set());
    setSelectedIds(new Set());
    setSearchQuery("");
    setLastDeleted(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span className="opacity-0 group-hover:opacity-40 ml-1">&#8597;</span>;
    return <span className="ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
  };

  const hasData = filteredRows.length > 0;

  return (
    <div className={classNames("min-h-screen transition-colors duration-200", darkMode ? "dark" : "")}>
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={ftLogo}
                alt="FinTrack logo"
                className="h-10 w-10 rounded-lg"
              />
              <div>
                <h1 className="text-lg font-semibold">
                  {websiteName || siteNameDefault}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Upload &rarr; classify &rarr; download clean CSV
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <nav className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <button
                  onClick={() => setTab("transform")}
                  className={classNames(
                    "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                    tab === "transform"
                      ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  Transform
                </button>
                <button
                  onClick={() => setTab("settings")}
                  className={classNames(
                    "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                    tab === "settings"
                      ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  Settings
                </button>
              </nav>
              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode((d) => !d)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {darkMode ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          {tab === "settings" ? (
            <section className="grid gap-6 max-w-3xl">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-base font-semibold mb-4">General</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">Source name</span>
                    <input
                      className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                      value={websiteName}
                      onChange={(e) => setWebsiteName(e.target.value)}
                      placeholder={siteNameDefault}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">Source</span>
                    <select
                      className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                    >
                      <option>Revolut</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">Date field</span>
                    <select
                      className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                      value={dateField}
                      onChange={(e) => setDateField(e.target.value as any)}
                    >
                      <option>Completed Date</option>
                      <option>Started Date</option>
                    </select>
                  </label>
                  <div className="flex flex-col gap-3 pt-6">
                    <label className="flex items-center gap-3 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyCompleted}
                        onChange={(e) => setOnlyCompleted(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Only include rows with{" "}
                      <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">
                        State = COMPLETED
                      </code>
                    </label>
                    <label className="flex items-center gap-3 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeHeader}
                        onChange={(e) => setIncludeHeader(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Include header row in downloaded CSV
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-base font-semibold mb-4">LLM Classification</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">OpenAI API key</span>
                    <input
                      type="password"
                      className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      Stored locally in your browser. For prototypes only.
                    </span>
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">Model</span>
                    <select
                      className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                    </select>
                  </label>
                </div>
              </div>
            </section>
          ) : (
            <section className="grid gap-6">
              {/* Upload zone */}
              <div
                className={classNames(
                  "bg-white dark:bg-gray-900 rounded-2xl shadow-sm border-2 border-dashed p-8 transition-all duration-200",
                  isDragging
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                    : "border-gray-300 dark:border-gray-700",
                  !hasData && "min-h-[200px] flex flex-col items-center justify-center"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {!hasData ? (
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Upload your Revolut CSV
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Drag and drop your file here, or click to browse
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 cursor-pointer transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Choose file
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) =>
                          e.target.files && onFileSelected(e.target.files[0])
                        }
                      />
                    </label>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                      Expected: Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between -m-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{rawRows.length} rows loaded</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{filteredRows.length} after filters, {uniqueNames.length} unique merchants</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                        Upload new file
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(e) =>
                            e.target.files && onFileSelected(e.target.files[0])
                          }
                        />
                      </label>
                      <button
                        onClick={handleReset}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Status / Errors */}
              {status && (
                <div className="text-sm text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 flex items-center gap-2">
                  {classifying && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {status}
                </div>
              )}
              {errors.length > 0 && (
                <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-3">
                  {errors.map((e, i) => (
                    <div key={i}>&#x2022; {e}</div>
                  ))}
                </div>
              )}

              {/* Summary Cards */}
              {hasData && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Income</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                      +{formatCurrency(stats.totalIncome, stats.primaryCurrency)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                      -{formatCurrency(stats.totalExpense, stats.primaryCurrency)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Net Balance</p>
                    <p className={classNames(
                      "text-2xl font-bold mt-1",
                      stats.net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {stats.net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(stats.net), stats.primaryCurrency)}
                    </p>
                  </div>
                </div>
              )}

              {/* Controls bar */}
              {hasData && (
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search transactions..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Type filter */}
                    <select
                      className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as any)}
                    >
                      <option value="Both">All types</option>
                      <option value="Expense">Expenses only</option>
                      <option value="Income">Income only</option>
                    </select>

                    <div className="flex-1" />

                    <button
                      onClick={handleClassify}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors flex items-center gap-2"
                      disabled={!uniqueNames.length || !apiKey || classifying}
                      title={
                        !apiKey ? "Add your API key in Settings" : "Classify with LLM"
                      }
                    >
                      {classifying && (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      Classify with LLM
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download CSV
                    </button>
                  </div>

                  {/* Row count info */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Showing <b>{sortedRows.length}</b> of <b>{visibleRows.length}</b> rows
                    {searchQuery && ` matching "${searchQuery}"`}
                    {deletedIds.size > 0 && ` (${deletedIds.size} deleted)`}
                  </div>
                </div>
              )}

              {/* Data Table */}
              {hasData && (
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800/80 sticky top-0 z-10">
                        <tr>
                          {/* select all checkbox */}
                          <th className="px-3 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              checked={
                                sortedRows.length > 0 &&
                                sortedRows.every((row: any) => selectedIds.has(row._id))
                              }
                              onChange={() => {
                                const allSelected =
                                  sortedRows.length > 0 &&
                                  sortedRows.every((row: any) => selectedIds.has(row._id));
                                if (allSelected) {
                                  setSelectedIds(new Set());
                                } else {
                                  const next = new Set<string>();
                                  sortedRows.forEach((row: any) => next.add(row._id));
                                  setSelectedIds(next);
                                }
                              }}
                              aria-label="Select all visible rows"
                            />
                          </th>
                          {/* delete column header (blank) */}
                          <th className="px-2 py-3 w-8" />
                          {(
                            [
                              "Date",
                              "Type",
                              "Amount",
                              "Currency",
                              "Category",
                              "Name",
                              "Account",
                              "Notes",
                              "Source",
                            ] as SortKey[]
                          ).map((h) => (
                            <th
                              key={h}
                              className="text-left font-semibold px-3 py-3 whitespace-nowrap cursor-pointer select-none group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                              onClick={() => handleColumnSort(h)}
                            >
                              <span className="inline-flex items-center">
                                {h}
                                {sortArrow(h)}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {sortedRows.map((row: any) => {
                          const isSelected = selectedIds.has(row._id);
                          const baseColor =
                            row.Type === "Expense"
                              ? "bg-red-50/50 dark:bg-red-950/20"
                              : row.Type === "Income"
                              ? "bg-green-50/50 dark:bg-green-950/20"
                              : "";

                          return (
                            <tr
                              key={row._id}
                              className={classNames(
                                baseColor,
                                "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                                isSelected && "ring-2 ring-inset ring-indigo-300 dark:ring-indigo-600"
                              )}
                            >
                              {/* selection checkbox */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={isSelected}
                                  onChange={() => toggleSelectRow(row._id)}
                                />
                              </td>

                              {/* delete button */}
                              <td className="px-2 py-2.5 whitespace-nowrap">
                                <button
                                  onClick={() => handleDeleteRow(row._id, row.Name)}
                                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                                  title="Remove row"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </td>

                              {/* Date */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {editing?.id === row._id && editing?.field === "Date" ? (
                                  <input
                                    type="date"
                                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={
                                      (draftEdits[row._id]?.Date ??
                                        edits[row._id]?.Date ??
                                        row.Date) || ""
                                    }
                                    onChange={(e) =>
                                      setDraftEdits((d) => ({
                                        ...d,
                                        [row._id]: {
                                          ...(d[row._id] || {}),
                                          Date: e.target.value,
                                        },
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") commitEditsFor(row._id);
                                      if (e.key === "Escape") {
                                        setDraftEdits((d) => ({
                                          ...d,
                                          [row._id]: {
                                            ...(edits[row._id] || {}),
                                          },
                                        }));
                                        setEditing(null);
                                      }
                                    }}
                                    onBlur={() => commitEditsFor(row._id)}
                                    autoFocus
                                  />
                                ) : (
                                  <button
                                    className="text-left w-full hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    onClick={() => setEditing({ id: row._id, field: "Date" })}
                                    title="Click to edit"
                                  >
                                    {row.Date || <span className="text-gray-400">--</span>}
                                  </button>
                                )}
                              </td>

                              {/* Type */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className={classNames(
                                  "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
                                  row.Type === "Expense"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                    : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                )}>
                                  {row.Type}
                                </span>
                              </td>

                              {/* Amount */}
                              <td className="px-3 py-2.5 whitespace-nowrap font-mono text-right">
                                {editing?.id === row._id && editing?.field === "Amount" ? (
                                  <input
                                    type="text"
                                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded px-2 py-1 w-24 text-sm text-right focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={
                                      (draftEdits[row._id]?.Amount ??
                                        edits[row._id]?.Amount ??
                                        row.Amount) || ""
                                    }
                                    onChange={(e) =>
                                      setDraftEdits((d) => ({
                                        ...d,
                                        [row._id]: {
                                          ...(d[row._id] || {}),
                                          Amount: e.target.value,
                                        },
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") commitEditsFor(row._id);
                                      if (e.key === "Escape") {
                                        setDraftEdits((d) => ({
                                          ...d,
                                          [row._id]: {
                                            ...(edits[row._id] || {}),
                                          },
                                        }));
                                        setEditing(null);
                                      }
                                    }}
                                    onBlur={() => commitEditsFor(row._id)}
                                    autoFocus
                                  />
                                ) : (
                                  <button
                                    className="text-right w-full hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    onClick={() => setEditing({ id: row._id, field: "Amount" })}
                                    title="Click to edit"
                                  >
                                    {row.Amount}
                                  </button>
                                )}
                              </td>

                              {/* Currency */}
                              <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                {row.Currency}
                              </td>

                              {/* Category with colored badge */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {editing?.id === row._id && editing?.field === "Category" ? (
                                  (() => {
                                    const current =
                                      (draftEdits[row._id]?.Category ??
                                        edits[row._id]?.Category ??
                                        row.Category) || "";
                                    const safeValue = categorySet.includes(current)
                                      ? current
                                      : "OtherExpenses";
                                    return (
                                      <select
                                        className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={safeValue}
                                        onChange={(e) =>
                                          setDraftEdits((d) => ({
                                            ...d,
                                            [row._id]: {
                                              ...(d[row._id] || {}),
                                              Category: e.target.value,
                                            },
                                          }))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") commitEditsFor(row._id);
                                          if (e.key === "Escape") {
                                            setDraftEdits((d) => ({
                                              ...d,
                                              [row._id]: {
                                                ...(edits[row._id] || {}),
                                              },
                                            }));
                                            setEditing(null);
                                          }
                                        }}
                                        onBlur={() => commitEditsFor(row._id)}
                                        autoFocus
                                      >
                                        {categorySet.map((c) => (
                                          <option key={c} value={c}>
                                            {c}
                                          </option>
                                        ))}
                                      </select>
                                    );
                                  })()
                                ) : (
                                  <button
                                    className="text-left w-full"
                                    onClick={() =>
                                      setEditing({
                                        id: row._id,
                                        field: "Category",
                                      })
                                    }
                                    title="Click to edit"
                                  >
                                    {row.Category ? (
                                      <span
                                        className={classNames(
                                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                          categoryBadgeClass(row.Category)
                                        )}
                                      >
                                        {row.Category}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">--</span>
                                    )}
                                  </button>
                                )}
                              </td>

                              {/* Name */}
                              <td className="px-3 py-2.5 max-w-[200px] truncate" title={row.Name}>{row.Name}</td>

                              {/* Account */}
                              <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 dark:text-gray-400">{row.Account}</td>

                              {/* Notes */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {editing?.id === row._id && editing?.field === "Notes" ? (
                                  <input
                                    type="text"
                                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded px-2 py-1 w-48 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={
                                      (draftEdits[row._id]?.Notes ??
                                        edits[row._id]?.Notes ??
                                        row.Notes) || ""
                                    }
                                    onChange={(e) =>
                                      setDraftEdits((d) => ({
                                        ...d,
                                        [row._id]: {
                                          ...(d[row._id] || {}),
                                          Notes: e.target.value,
                                        },
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") commitEditsFor(row._id);
                                      if (e.key === "Escape") {
                                        setDraftEdits((d) => ({
                                          ...d,
                                          [row._id]: {
                                            ...(edits[row._id] || {}),
                                          },
                                        }));
                                        setEditing(null);
                                      }
                                    }}
                                    onBlur={() => commitEditsFor(row._id)}
                                    autoFocus
                                  />
                                ) : (
                                  <button
                                    className="text-left w-full hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    onClick={() => setEditing({ id: row._id, field: "Notes" })}
                                    title="Click to edit"
                                  >
                                    {row.Notes ? (
                                      row.Notes
                                    ) : (
                                      <span className="text-gray-400 text-xs italic">Add note</span>
                                    )}
                                  </button>
                                )}
                              </td>

                              {/* Source */}
                              <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 dark:text-gray-400">{row.Source}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {sortedRows.length === 0 && (
                      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                        {searchQuery ? (
                          <>No transactions matching &quot;{searchQuery}&quot;</>
                        ) : (
                          <>No transactions to display</>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* How it works (only show when no data) */}
              {!hasData && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                  <h3 className="font-semibold mb-3">How it works</h3>
                  <div className="grid sm:grid-cols-4 gap-4">
                    {[
                      { step: "1", title: "Configure", desc: "Add your OpenAI API key in Settings (optional)" },
                      { step: "2", title: "Upload", desc: "Drop your Revolut CSV file on this page" },
                      { step: "3", title: "Classify", desc: "Auto-categorize transactions with LLM or heuristics" },
                      { step: "4", title: "Download", desc: "Get your clean, normalized CSV file" },
                    ].map((item) => (
                      <div key={item.step} className="text-center">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold text-lg mb-2">
                          {item.step}
                        </div>
                        <h4 className="font-medium text-sm">{item.title}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </main>

        <footer className="max-w-7xl mx-auto px-4 pb-10 text-xs text-gray-400 dark:text-gray-600">
          FinTrack &mdash; Amounts are normalized as positive numbers,
          with <i>Type</i> carrying the sign.
        </footer>

        {/* Floating selection action bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-[slideUp_0.2s_ease-out]">
            <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 pl-5 pr-3 py-3 rounded-2xl shadow-2xl flex items-center gap-4 text-sm">
              <span className="font-semibold whitespace-nowrap">
                {selectedIds.size} row{selectedIds.size > 1 ? "s" : ""} selected
              </span>
              <div className="w-px h-5 bg-gray-700 dark:bg-gray-300" />
              <div className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">Set category:</span>
                <select
                  className="bg-gray-800 dark:bg-gray-200 border border-gray-700 dark:border-gray-300 text-white dark:text-gray-900 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                >
                  {categorySet.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    handleBulkApplyCategory();
                    setSelectedIds(new Set());
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-400 text-white transition-colors"
                >
                  Apply
                </button>
              </div>
              <div className="w-px h-5 bg-gray-700 dark:bg-gray-300" />
              <button
                onClick={() => {
                  setDeletedIds((prev) => {
                    const next = new Set(prev);
                    selectedIds.forEach((id) => next.add(id));
                    return next;
                  });
                  setSelectedIds(new Set());
                }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-300 transition-colors"
                title="Clear selection"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Undo delete toast */}
        {lastDeleted && !selectedIds.size && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-[slideUp_0.2s_ease-out]">
            <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm">
              <span>Deleted &quot;{lastDeleted.name.slice(0, 30)}{lastDeleted.name.length > 30 ? "..." : ""}&quot;</span>
              <button
                onClick={handleUndoDelete}
                className="font-semibold text-indigo-400 dark:text-indigo-600 hover:text-indigo-300 dark:hover:text-indigo-500 transition-colors"
              >
                Undo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

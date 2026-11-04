import { useEffect, useState } from "react";
import type { PropertyResponse } from "../types/property";
import Property from "./Property";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

type TestResult = {
  endpointId: string;
  name: string;
  method: HttpMethod;
  url: string;
  status: "idle" | "running" | "pass" | "fail";
  httpCode?: number;
  durationMs?: number;
  requestBody?: string;
  responseBody?: unknown;
  error?: string;
};

type EndpointConfig = {
  id: string;
  name: string;
  method: HttpMethod;
  pathTemplate: string;
  description: string;
  hasPayload?: boolean;
  needsId?: boolean;
};

const PROPERTY_ENDPOINTS: EndpointConfig[] = [
  {
    id: "prop-list",
    name: "List All Properties",
    method: "GET",
    pathTemplate: "/api/v1/properties",
    description: "Fetch all managed properties from the database",
  },
  {
    id: "prop-create",
    name: "Create Property (Insert/Hydrate)",
    method: "POST",
    pathTemplate: "/api/v1/properties",
    description: "Insert a property record into the database",
    hasPayload: true,
  },
  {
    id: "prop-get-by-id",
    name: "Get Property by ID",
    method: "GET",
    pathTemplate: "/api/v1/properties/{propertyId}",
    description: "Fetch a specific property record by its UUID",
    needsId: true,
  },
  {
    id: "prop-delete",
    name: "Delete Property by ID",
    method: "DELETE",
    pathTemplate: "/api/v1/properties/{propertyId}",
    description: "Delete a specific property record by its UUID",
    needsId: true,
  },
];

// Procedural random dictionary
const ADJECTIVES = [
  "Sunset", "Grand", "Highland", "Oakridge", "Beacon", "Pinnacle",
  "Metropolitan", "Pacific", "Riverfront", "Summit", "Emerald", "Harbor"
];
const NOUNS = [
  "Corporate Center", "Business Park", "Tower", "Plaza", "Logistics Hub",
  "Square", "Exchange", "Terraces", "Commons", "Heights", "Pavilion"
];
const STREETS = [
  "Ocean Blvd", "Market St", "Industrial Pkwy", "Highland Ave",
  "Commerce Way", "Broadway", "Tech Center Dr", "Riverside Dr", "Grand Ave"
];
const CITIES = [
  { city: "San Francisco", state: "CA", zip: "94105" },
  { city: "Austin", state: "TX", zip: "78701" },
  { city: "Denver", state: "CO", zip: "80202" },
  { city: "Seattle", state: "WA", zip: "98101" },
  { city: "Chicago", state: "IL", zip: "60601" },
  { city: "New York", state: "NY", zip: "10001" },
  { city: "Dallas", state: "TX", zip: "75201" },
];

function generateRandomProperty() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const streetNum = Math.floor(Math.random() * 8999 + 100);
  const street = STREETS[Math.floor(Math.random() * STREETS.length)];
  const loc = CITIES[Math.floor(Math.random() * CITIES.length)];
  const suffix = Math.floor(Math.random() * 900 + 100);

  return {
    name: `${adj} ${noun} #${suffix}`,
    streetAddress: `${streetNum} ${street}`,
    city: loc.city,
    state: loc.state,
    zipCode: loc.zip,
  };
}

const BASE_URL = "http://localhost:8080";

export default function ApiTest() {
  const [selectedEndpoints, setSelectedEndpoints] = useState<Record<string, boolean>>({
    "prop-list": true,
    "prop-create": true,
    "prop-get-by-id": true,
    "prop-delete": false,
  });

  // Current database properties for selector
  const [dbProperties, setDbProperties] = useState<PropertyResponse[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [tableRefreshKey, setTableRefreshKey] = useState<number>(0);

  // POST testing mode: "random" vs "custom"
  const [postMode, setPostMode] = useState<"random" | "custom">("random");

  // Editable custom payload string for POST
  const [editablePayload, setEditablePayload] = useState<string>(() =>
    JSON.stringify(generateRandomProperty(), null, 2)
  );

  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [hydrateCount, setHydrateCount] = useState(3);
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "info" | "error" } | null>(null);

  const showNotify = (msg: string, type: "success" | "info" | "error" = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Fetch live properties from backend
  const refreshPropertiesList = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/properties`);
      if (res.ok) {
        const data: PropertyResponse[] = await res.json();
        setDbProperties(data || []);
        if (data.length > 0) {
          setSelectedPropertyId((current) => {
            const exists = data.some((p) => p.propertyId === current);
            return exists ? current : data[0].propertyId;
          });
        } else {
          setSelectedPropertyId("");
        }
      }
    } catch {
      // Backend may be offline
    }
    setTableRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    refreshPropertiesList();
  }, []);

  // Toggle individual endpoint pill
  const toggleEndpoint = (id: string) => {
    setSelectedEndpoints((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Toggle all endpoints in Properties table
  const allPropertiesSelected = PROPERTY_ENDPOINTS.every((ep) => selectedEndpoints[ep.id]);
  const toggleAllProperties = () => {
    const nextVal = !allPropertiesSelected;
    const nextMap: Record<string, boolean> = { ...selectedEndpoints };
    PROPERTY_ENDPOINTS.forEach((ep) => {
      nextMap[ep.id] = nextVal;
    });
    setSelectedEndpoints(nextMap);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Core HTTP test execution
  const executeCall = async (
    endpoint: EndpointConfig,
    overrideUrl?: string,
    rawPayload?: string
  ): Promise<TestResult> => {
    const startTime = performance.now();
    const finalUrl = overrideUrl || `${BASE_URL}${endpoint.pathTemplate}`;

    let parsedBody: unknown = undefined;
    if (rawPayload) {
      try {
        parsedBody = JSON.parse(rawPayload);
      } catch {
        return {
          endpointId: endpoint.id,
          name: endpoint.name,
          method: endpoint.method,
          url: finalUrl,
          status: "fail",
          durationMs: 0,
          requestBody: rawPayload,
          error: "Invalid JSON format in Request Body",
        };
      }
    }

    const testRes: TestResult = {
      endpointId: endpoint.id,
      name: endpoint.name,
      method: endpoint.method,
      url: finalUrl,
      status: "running",
      requestBody: rawPayload,
    };

    try {
      const response = await fetch(finalUrl, {
        method: endpoint.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: parsedBody ? JSON.stringify(parsedBody) : undefined,
      });

      const endTime = performance.now();
      testRes.durationMs = Math.round(endTime - startTime);
      testRes.httpCode = response.status;

      const text = await response.text();
      try {
        testRes.responseBody = text ? JSON.parse(text) : undefined;
      } catch {
        testRes.responseBody = text;
      }

      if (response.ok) {
        testRes.status = "pass";
      } else {
        testRes.status = "fail";
        testRes.error = `HTTP ${response.status} ${response.statusText}`;
      }
    } catch (err) {
      const endTime = performance.now();
      testRes.durationMs = Math.round(endTime - startTime);
      testRes.status = "fail";
      testRes.error = err instanceof Error ? err.message : "Network/Connection error";
    }

    return testRes;
  };

  // Run a single endpoint test
  const runSingleTest = async (endpoint: EndpointConfig, forceMode?: "random" | "custom") => {
    setResults((prev) => ({
      ...prev,
      [endpoint.id]: {
        endpointId: endpoint.id,
        name: endpoint.name,
        method: endpoint.method,
        url: `${BASE_URL}${endpoint.pathTemplate}`,
        status: "running",
      },
    }));

    let url = `${BASE_URL}${endpoint.pathTemplate}`;
    let payloadToSend: string | undefined = undefined;

    if (endpoint.hasPayload) {
      const effectiveMode = forceMode || postMode;
      if (effectiveMode === "random") {
        const fresh = JSON.stringify(generateRandomProperty(), null, 2);
        payloadToSend = fresh;
      } else {
        payloadToSend = editablePayload;
      }
    }

    if (endpoint.needsId) {
      const targetId = selectedPropertyId || "00000000-0000-0000-0000-000000000000";
      url = `${BASE_URL}/api/v1/properties/${targetId}`;
    }

    const res = await executeCall(endpoint, url, payloadToSend);
    setResults((prev) => ({ ...prev, [endpoint.id]: res }));
    setExpanded((prev) => ({ ...prev, [endpoint.id]: true }));

    if (endpoint.method === "POST" || endpoint.method === "DELETE") {
      refreshPropertiesList();
    }
  };

  // Run all selected endpoints
  const runSelectedProperties = async () => {
    setIsExecuting(true);
    let lastCreatedId: string | undefined = undefined;

    for (const ep of PROPERTY_ENDPOINTS) {
      if (!selectedEndpoints[ep.id]) continue;

      setResults((prev) => ({
        ...prev,
        [ep.id]: {
          endpointId: ep.id,
          name: ep.name,
          method: ep.method,
          url: `${BASE_URL}${ep.pathTemplate}`,
          status: "running",
        },
      }));

      let targetUrl = `${BASE_URL}${ep.pathTemplate}`;
      let payloadToSend: string | undefined = undefined;

      if (ep.hasPayload) {
        if (postMode === "random") {
          payloadToSend = JSON.stringify(generateRandomProperty(), null, 2);
        } else {
          payloadToSend = editablePayload;
        }
      }

      if (ep.needsId) {
        const targetId = lastCreatedId || selectedPropertyId || "00000000-0000-0000-0000-000000000000";
        targetUrl = `${BASE_URL}/api/v1/properties/${targetId}`;
      }

      const res = await executeCall(ep, targetUrl, payloadToSend);
      if (ep.id === "prop-create" && res.status === "pass" && res.responseBody) {
        const body = res.responseBody as PropertyResponse;
        if (body?.propertyId) lastCreatedId = body.propertyId;
      }

      setResults((prev) => ({ ...prev, [ep.id]: res }));
    }

    setIsExecuting(false);
    refreshPropertiesList();
  };

  // Hydrate with randomized properties
  const handleHydrate = async () => {
    showNotify(`Hydrating ${hydrateCount} randomized property records...`, "info");
    let successCount = 0;

    for (let i = 0; i < hydrateCount; i++) {
      const randomProp = generateRandomProperty();
      try {
        const res = await fetch(`${BASE_URL}/api/v1/properties`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(randomProp),
        });
        if (res.ok) successCount++;
      } catch {
        // ignore
      }
    }

    showNotify(`✓ Successfully hydrated ${successCount} of ${hydrateCount} properties.`, "success");
    refreshPropertiesList();
  };

  // Empty table: iterate through and delete
  const handleEmptyTable = async () => {
    if (dbProperties.length === 0) {
      showNotify("Table is already empty (0 records).", "info");
      return;
    }

    const confirmClear = window.confirm(
      `Are you sure you want to delete all ${dbProperties.length} properties currently in the database?`
    );
    if (!confirmClear) return;

    showNotify(`Emptying table (${dbProperties.length} records)...`, "info");
    let deletedCount = 0;
    let failedCount = 0;

    for (const prop of dbProperties) {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/properties/${prop.propertyId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          deletedCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    if (failedCount > 0 && deletedCount === 0) {
      showNotify(
        `Backend DELETE returned ${failedCount} errors (DELETE endpoint may not be implemented on server yet).`,
        "error"
      );
    } else {
      showNotify(`✓ Deleted ${deletedCount} properties (${failedCount} failed).`, "success");
    }

    refreshPropertiesList();
  };

  const passCount = Object.values(results).filter((r) => r.status === "pass").length;
  const failCount = Object.values(results).filter((r) => r.status === "fail").length;
  const selectedPropertyObj = dbProperties.find((p) => p.propertyId === selectedPropertyId);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping"></span>
            <h1 className="text-2xl font-bold text-gray-900">API Test Console</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Automated Swagger alternative: toggle pills, endpoint testing, live database inspection, and hydration.
          </p>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center space-x-3 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
          <div className="text-center">
            <span className="text-xs font-semibold text-gray-400 block uppercase">Passed</span>
            <span className="text-lg font-bold text-emerald-600">{passCount}</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="text-center">
            <span className="text-xs font-semibold text-gray-400 block uppercase">Failed</span>
            <span className="text-lg font-bold text-red-600">{failCount}</span>
          </div>
        </div>
      </div>

      {/* Item 2: More space above and below "Run Selected" (py-3 & my-2) */}
      <div className="py-3 my-2 flex flex-wrap justify-between items-center gap-3 px-1">
        {/* Left: Prominent Run Selected Button aligned with toggle pills */}
        <div className="flex items-center space-x-3">
          <button
            onClick={runSelectedProperties}
            disabled={isExecuting}
            className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-md hover:shadow transition flex items-center space-x-2 cursor-pointer"
          >
            <span>{isExecuting ? "⏳" : "▶"}</span>
            <span>{isExecuting ? "Executing Selected..." : "Run Selected"}</span>
          </button>
          <span className="text-xs text-gray-500 hidden sm:inline">
            Executes all toggled endpoints sequentially
          </span>
        </div>

        {/* Right: Refresh database sync */}
        <button
          onClick={refreshPropertiesList}
          className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-md text-xs font-medium text-gray-700 shadow-sm transition flex items-center space-x-1"
          title="Refresh database records"
        >
          <span>🔄</span>
          <span>Refresh DB</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Table Category Bar */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            {/* Table-level toggle pill */}
            <button
              type="button"
              onClick={toggleAllProperties}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                allPropertiesSelected ? "bg-indigo-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  allPropertiesSelected ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>

            <span className="font-semibold text-gray-900 text-lg">Table: Properties</span>
            <span className="text-xs bg-indigo-100 text-indigo-800 font-medium px-2 py-0.5 rounded-full">
              {PROPERTY_ENDPOINTS.length} Endpoints
            </span>
          </div>

          {/* Right Action buttons on table level */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Hydrate Controls */}
            <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-md border border-gray-200 text-xs shadow-sm">
              <span className="text-gray-500 font-medium">Hydrate:</span>
              <select
                value={hydrateCount}
                onChange={(e) => setHydrateCount(Number(e.target.value))}
                className="text-xs border-gray-300 rounded focus:ring-indigo-500 py-0.5 px-1 font-medium text-gray-700"
              >
                <option value={1}>1 Record</option>
                <option value={3}>3 Records</option>
                <option value={5}>5 Records</option>
                <option value={10}>10 Records</option>
              </select>
              <button
                onClick={handleHydrate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded font-medium transition flex items-center space-x-1"
                title="Inserts randomized sample properties"
              >
                <span>⚡</span>
                <span>Hydrate</span>
              </button>
            </div>

            {/* Empty Table Button - matched to DELETE label styling */}
            <button
              onClick={handleEmptyTable}
              className="bg-rose-100 hover:bg-rose-200 active:bg-rose-300 text-rose-800 border border-rose-300 px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition flex items-center space-x-1 cursor-pointer"
              title="Deletes all properties currently in the table"
            >
              <span>🗑️</span>
              <span>Empty Table</span>
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`px-6 py-2 border-b text-xs font-medium flex items-center justify-between ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                : notification.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-100"
                : "bg-blue-50 text-blue-800 border-blue-100"
            }`}
          >
            <span>{notification.msg}</span>
            <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        )}

        {/* Endpoints List */}
        <div className="divide-y divide-gray-200">
          {PROPERTY_ENDPOINTS.map((endpoint) => {
            const isSelected = !!selectedEndpoints[endpoint.id];
            const result = results[endpoint.id];
            const isExpanded = !!expanded[endpoint.id];

            return (
              <div key={endpoint.id} className="p-4 sm:px-6 hover:bg-gray-50/70 transition">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Left Side: Toggle Pill + Method + Path Template + Inline ID Selector */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Toggle pill */}
                    <button
                      type="button"
                      onClick={() => toggleEndpoint(endpoint.id)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isSelected ? "bg-indigo-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isSelected ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>

                    {/* Method Badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        endpoint.method === "GET"
                          ? "bg-blue-100 text-blue-800"
                          : endpoint.method === "POST"
                          ? "bg-emerald-100 text-emerald-800"
                          : endpoint.method === "DELETE"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {endpoint.method}
                    </span>

                    {/* Path Template and Description */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {endpoint.pathTemplate}
                      </span>
                      <span className="text-xs text-gray-400 hidden xl:inline">
                        ({endpoint.name})
                      </span>
                    </div>

                    {/* Inline Property ID Dropdown for endpoints needing {propertyId} */}
                    {endpoint.needsId && (
                      <div className="inline-flex items-center space-x-1 bg-slate-100 py-0.5 px-2 rounded-md border border-slate-300">
                        <span className="text-[11px] font-semibold text-slate-600">ID:</span>
                        {dbProperties.length > 0 ? (
                          <select
                            value={selectedPropertyId}
                            onChange={(e) => setSelectedPropertyId(e.target.value)}
                            className="bg-white border border-slate-300 rounded text-xs font-mono py-0.5 px-1.5 text-slate-800 max-w-[220px] truncate focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            title="Choose target property ID for this call"
                          >
                            {dbProperties.map((p) => (
                              <option key={p.propertyId} value={p.propertyId}>
                                {p.name} [{p.propertyId.slice(0, 8)}...]
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">
                            (No IDs in DB)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Item 1, 3, 4: Right Side with Muted Test Buttons moved back to the right */}
                  <div className="flex items-center space-x-3 self-end lg:self-auto">
                    {/* Status Pill */}
                    {result?.status === "running" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 animate-pulse">
                        Running...
                      </span>
                    )}

                    {result?.status === "pass" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        ✓ PASS ({result.httpCode}) · {result.durationMs}ms
                      </span>
                    )}

                    {result?.status === "fail" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        ✕ FAIL {result.httpCode ? `(${result.httpCode})` : ""} · {result.durationMs}ms
                      </span>
                    )}

                    {!result && (
                      <span className="text-xs text-gray-400 font-mono">Not tested</span>
                    )}

                    {/* Muted test button(s) */}
                    {endpoint.id === "prop-create" ? (
                      /* Item 4: Space between Test Random and Test Modified, with muted slate/gray styling */
                      <div className="inline-flex items-center space-x-2">
                        <button
                          onClick={() => runSingleTest(endpoint, "random")}
                          className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-300 font-medium text-xs px-2.5 py-1 rounded-md transition flex items-center space-x-1 cursor-pointer"
                          title="Run with fresh random payload"
                        >
                          <span>🎲</span>
                          <span>Test Random</span>
                        </button>
                        <button
                          onClick={() => runSingleTest(endpoint, "custom")}
                          className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-300 font-medium text-xs px-2.5 py-1 rounded-md transition flex items-center space-x-1 cursor-pointer"
                          title="Run with user-modified payload below"
                        >
                          <span>✏️</span>
                          <span>Test Modified</span>
                        </button>
                      </div>
                    ) : (
                      /* Item 3: Single Muted Test Button on the right */
                      <button
                        onClick={() => runSingleTest(endpoint)}
                        className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-300 font-medium text-xs px-3 py-1 rounded-md transition flex items-center space-x-1 cursor-pointer"
                      >
                        <span>▶</span>
                        <span>Test</span>
                      </button>
                    )}

                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleExpand(endpoint.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center space-x-0.5 px-1.5 py-1"
                    >
                      <span>{isExpanded ? "Hide" : "Details"}</span>
                      <span>{isExpanded ? "▲" : "▼"}</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="mt-4 border border-gray-700 bg-gray-950 rounded-lg p-4 font-mono text-xs space-y-3">
                    {/* Drawer Status Bar */}
                    <div className="flex flex-wrap justify-between items-center text-gray-400 border-b border-gray-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-bold ${
                            endpoint.method === "GET"
                              ? "text-blue-400"
                              : endpoint.method === "POST"
                              ? "text-emerald-400"
                              : endpoint.method === "DELETE"
                              ? "text-rose-400"
                              : "text-amber-400"
                          }`}
                        >
                          {endpoint.method}
                        </span>
                        <span className="text-gray-200">
                          {result?.url ||
                            (endpoint.needsId && selectedPropertyId
                              ? `${BASE_URL}/api/v1/properties/${selectedPropertyId}`
                              : `${BASE_URL}${endpoint.pathTemplate}`)}
                        </span>
                      </div>
                      {result && (
                        <div>
                          Status:{" "}
                          <span className={result.status === "pass" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                            {result.httpCode || result.error}
                          </span>
                          {" · "}
                          <span>{result.durationMs}ms</span>
                        </div>
                      )}
                    </div>

                    {/* Split View: Left (Request) vs Right (Response) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: Request Side */}
                      <div className="bg-gray-900 p-3 rounded border border-gray-800 space-y-2">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-1.5">
                          <span className="text-indigo-300 font-semibold tracking-wider text-[11px] uppercase flex items-center space-x-1">
                            <span>📤 Request Payload</span>
                            {endpoint.hasPayload && (
                              <span className="text-[10px] text-gray-400 lowercase font-normal">(editable)</span>
                            )}
                          </span>

                          {/* POST Mode selector inside request drawer */}
                          {endpoint.id === "prop-create" && (
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] text-gray-400">Batch Mode:</span>
                              <div className="inline-flex rounded text-[10px] border border-gray-700 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => setPostMode("random")}
                                  className={`px-2 py-0.5 ${
                                    postMode === "random"
                                      ? "bg-emerald-600 text-white font-bold"
                                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                                  }`}
                                >
                                  Random
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPostMode("custom")}
                                  className={`px-2 py-0.5 ${
                                    postMode === "custom"
                                      ? "bg-indigo-600 text-white font-bold"
                                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                                  }`}
                                >
                                  User Modified
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditablePayload(JSON.stringify(generateRandomProperty(), null, 2))
                                }
                                className="text-[10px] text-emerald-400 hover:text-emerald-300 underline"
                                title="Regenerate random values into textarea"
                              >
                                🎲 Re-roll
                              </button>
                            </div>
                          )}
                        </div>

                        {endpoint.hasPayload ? (
                          <div className="space-y-1.5">
                            <textarea
                              value={editablePayload}
                              onChange={(e) => setEditablePayload(e.target.value)}
                              rows={8}
                              className="w-full bg-gray-950 p-2 text-emerald-300 font-mono text-xs rounded border border-gray-800 focus:outline-none focus:border-indigo-500 resize-y"
                              placeholder="Edit JSON request payload here..."
                            />
                            <div className="flex justify-between items-center text-[10px] text-gray-400">
                              <span>Edit keys or values above before testing.</span>
                              <button
                                onClick={() => runSingleTest(endpoint, "custom")}
                                className="text-indigo-400 hover:text-indigo-300 underline font-medium"
                              >
                                ▶ Test with this modified JSON
                              </button>
                            </div>
                          </div>
                        ) : endpoint.needsId ? (
                          <div className="p-3 bg-gray-950 rounded border border-gray-800 space-y-1 text-slate-300">
                            <p className="text-[11px] text-indigo-400 font-semibold uppercase">Resolved Path Parameter:</p>
                            <p className="font-mono text-emerald-300 text-xs">
                              &#123;propertyId&#125; = {selectedPropertyId || "(none selected)"}
                            </p>
                            {selectedPropertyObj && (
                              <p className="text-gray-400 text-[11px]">
                                Bound to: <span className="text-white">{selectedPropertyObj.name}</span> ({selectedPropertyObj.city}, {selectedPropertyObj.state})
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic p-4 text-center">
                            No body payload required for this endpoint.
                          </div>
                        )}
                      </div>

                      {/* Right: Response Side */}
                      <div className="bg-gray-900 p-3 rounded border border-gray-800 space-y-2">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-1.5">
                          <span className="text-sky-300 font-semibold tracking-wider text-[11px] uppercase">
                            📥 Response Body
                          </span>
                          {result?.httpCode && (
                            <span
                              className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${
                                result.status === "pass"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : "bg-rose-950 text-rose-300 border border-rose-800"
                              }`}
                            >
                              HTTP {result.httpCode}
                            </span>
                          )}
                        </div>

                        {result ? (
                          <pre className="bg-gray-950 p-2.5 rounded border border-gray-800 overflow-x-auto max-h-56 text-sky-300">
                            {result.responseBody !== undefined
                              ? JSON.stringify(result.responseBody, null, 2)
                              : result.error
                              ? `Error: ${result.error}`
                              : "(Empty response body)"}
                          </pre>
                        ) : (
                          <div className="text-gray-500 italic p-4 text-center">
                            Run a test to send request and inspect the response.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Embedded Live Property Table Component */}
      <div className="pt-4">
        <Property refreshTrigger={tableRefreshKey} />
      </div>
    </div>
  );
}

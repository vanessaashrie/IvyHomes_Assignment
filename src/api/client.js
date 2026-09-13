// Ivy Homes API client.
// Encodes everything we learned in recon that CONTRADICTS the docs:
//  - key goes in X-API-Key header, not ?api_key=
//  - login response field is access_token, not token; expires_in is 900s not 86400
//  - refresh_token + /auth/refresh exist and are required to keep sessions alive
//  - pagination is offset-based (not page-based) and the server caps limit at 50
//    regardless of what you request
//  - single listing lives at /v1/listings/{id} (plural), not /v1/listing/{id}
//  - favourites live at /v1/saved with body field "listing_id" (not /v1/favourites, not "id")
//  - /v1/analytics/summary does not exist

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://solve.ivy.homes";
const API_KEY = import.meta.env.VITE_API_KEY;

const TOKEN_KEY = "ivy_access_token";
const REFRESH_KEY = "ivy_refresh_token";
const USER_KEY = "ivy_user_email";

function getStoredAuth() {
  return {
    accessToken: localStorage.getItem(TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
    userEmail: localStorage.getItem(USER_KEY),
  };
}

function storeAuth({ accessToken, refreshToken, userEmail }) {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (userEmail) localStorage.setItem(USER_KEY, userEmail);
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function rawRequest(path, { method = "GET", params = {}, body, headers = {} } = {}) {
  const url = new URL(BASE_URL + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "X-API-Key": API_KEY,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const err = new Error(data?.detail ? JSON.stringify(data.detail) : `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function login(email, password) {
  const data = await rawRequest("/auth/login", { method: "POST", body: { email, password } });
  storeAuth({ accessToken: data.access_token, refreshToken: data.refresh_token, userEmail: data.user?.email || email });
  return data;
}

async function refreshAccessToken() {
  const { refreshToken } = getStoredAuth();
  if (!refreshToken) throw new Error("No refresh token available");
  const data = await rawRequest("/auth/refresh", { method: "POST", body: { refresh_token: refreshToken } });
  storeAuth({ accessToken: data.access_token, refreshToken: data.refresh_token });
  return data;
}

let authFailureHandler = null;
function setAuthFailureHandler(fn) {
  authFailureHandler = fn;
}

function logout() {
  clearAuth();
}

function isLoggedIn() {
  return Boolean(getStoredAuth().accessToken);
}

// Authenticated request that transparently retries once after a refresh.
// The access token only lives 900s, so this WILL happen in normal use --
// we don't try to guess from the error message whether it's expiry;
// any 401 is worth one refresh attempt. If the refresh itself fails
// (refresh token also expired/invalid), we clear auth and notify the
// app so it can redirect to login, instead of surfacing a raw error.
async function authRequest(path, options = {}) {
  const { accessToken } = getStoredAuth();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${accessToken}` };

  try {
    return await rawRequest(path, { ...options, headers });
  } catch (err) {
    if (err.status !== 401) throw err;

    try {
      await refreshAccessToken();
    } catch (refreshErr) {
      clearAuth();
      if (authFailureHandler) authFailureHandler();
      const sessionErr = new Error("Your session expired. Please log in again.");
      sessionErr.status = 401;
      throw sessionErr;
    }

    const { accessToken: newToken } = getStoredAuth();
    return rawRequest(path, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${newToken}` } });
  }
}

// ---- Collection endpoints ----
// IMPORTANT: server caps `limit` at 50 no matter what's requested, and paging
// is via `offset`, not `page`. Always step offset by the ACTUAL returned count.

async function fetchListings(params = {}) {
  return authRequest("/v1/listings", { params });
}
async function fetchListing(id) {
  return authRequest(`/v1/listings/${id}`); // plural path -- singular 404s
}
async function fetchRentals(params = {}) {
  return authRequest("/v1/rentals", { params });
}
async function fetchRental(id) {
  return authRequest(`/v1/rentals/${id}`);
}
async function fetchProjects(params = {}) {
  return authRequest("/v1/projects", { params });
}
async function fetchProject(id) {
  return authRequest(`/v1/projects/${id}`);
}

// ---- Saved listings (docs call this "favourites" at the wrong path/field) ----
async function fetchSaved() {
  return authRequest("/v1/saved");
}
async function saveListing(listingId) {
  return authRequest("/v1/saved", { method: "POST", body: { listing_id: listingId } });
}
async function unsaveListing(listingId) {
  return authRequest(`/v1/saved/${listingId}`, { method: "DELETE" });
}

// Walk an entire collection by offset until has_more is false.
// Used for insights (client-computed, since /v1/analytics/summary doesn't exist)
// and for any "must see the whole dataset" computation.
async function fetchAllPages(fetchFn, params = {}, onProgress, maxRecords = Infinity) {
  let offset = 0;
  let all = [];
  while (true) {
    const data = await fetchFn({ ...params, limit: 50, offset });
    const results = data.results || [];
    all = all.concat(results);
    if (onProgress) onProgress(all.length, data.total);
    if (!results.length || data.has_more === false || all.length >= maxRecords) break;
    offset += results.length;
  }
  return all;
}

// Cache distinct locality values per endpoint so we only sample once per
// session, not once per component mount. Sampling ~300 records is enough
// to see every distinct locality in a dataset this size (there are only
// a handful of localities per city) without walking all ~4700 records
// just to populate a dropdown.
const localityCache = {};
async function fetchDistinctLocalities(fetchFn, cacheKey) {
  if (localityCache[cacheKey]) return localityCache[cacheKey];
  const sample = await fetchAllPages(fetchFn, {}, null, 300);
  const localities = [...new Set(sample.map((r) => r.locality).filter(Boolean))].sort();
  localityCache[cacheKey] = localities;
  return localities;
}

export {
  login,
  logout,
  isLoggedIn,
  getStoredAuth,
  refreshAccessToken,
  setAuthFailureHandler,
  fetchListings,
  fetchListing,
  fetchRentals,
  fetchRental,
  fetchProjects,
  fetchProject,
  fetchSaved,
  saveListing,
  unsaveListing,
  fetchAllPages,
  fetchDistinctLocalities,
};
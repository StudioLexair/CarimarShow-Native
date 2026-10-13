import { trailerList } from "./core-model.mjs";
import { remember, getItem } from "./services-library.mjs";
import { api } from "./services-api.mjs";
export async function getDetail(type, id) {
  let d;
  try {
    d = await api(`${type}/${id}`, { append_to_response: "credits,videos" });
  } catch (e) {
    const m = getItem(`${type}:${id}`);
    if (!m) throw e;
    d = { ...m, _offline: true, _detailIncomplete: true };
  }
  d.media_type = type;
  if (d._detailIncomplete) d._videoQueryFailed = true;
  if (!trailerList(d).length && navigator.onLine) {
    try {
      const v = await api(`${type}/${id}/videos`, { language: "en-US" });
      if (v.results?.length) d.videos = v;
    } catch {
      d._videoQueryFailed = true;
    }
  }
  remember([d]);
  return d;
}

export async function getPerson(id) {
  const p = await api(`person/${id}`);
  p.media_type = "person";
  remember([p]);
  let credits;
  try {
    credits = await api(`person/${id}/combined_credits`);
  } catch (e) {
    credits = {
      cast: [],
      crew: [],
      _offline: true,
      _unavailable: true,
      _error: e.message,
    };
  }
  return { person: p, credits };
}

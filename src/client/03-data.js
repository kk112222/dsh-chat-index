// Data layer: question index over session history.
//
// The live ConversationSnapshot only covers the currently loaded window, so
// the full question list (and every branch session's list) is built from the
// durable host log via the same RPC the product uses when it opens a session
// window: api.sessions.history({ sessionId, beforeSeq, maxMessages }).
// Everything here is defensive: unknown shapes, dropped pages and aborted
// fetches degrade to whatever we already have instead of crashing the UI.

const DATA_PAGE = 150;          // history RPC maxMessages per page
const MAX_PAGES = 10;           // safety cap per session
const MAX_QUESTIONS = 400;      // safety cap on stored questions per session
const MAX_CHILDREN = 30;        // breadth cap for descendant walk

// A user question as we present it in the index.
// { seq, time, text }
function isUserQuestionEvent(event) {
	if (!event || typeof event !== 'object') return false;
	const src = event.data && event.data.source;
	return event.type === 'user/message' && (!src || src.kind === 'user');
}

function eventToQuestion(event) {
	return {
		seq: typeof event.seq === 'number' ? event.seq : 0,
		time: typeof event.time === 'number' ? event.time : 0,
		text: plainTextOf(event.data && event.data.content),
	};
}

function sortAsc(a, b) { return a.seq - b.seq; }

// Walk history pages newest-first, collect ascending user questions.
// Resolves { questions, truncated } — never throws.
async function historyQuestionsOf(api, sessionId, opts = {}) {
	const maxPages = opts.maxPages || MAX_PAGES;
	const cap = opts.cap || MAX_QUESTIONS;
	const out = [];
	let beforeSeq;
	let truncated = false;
	let hasMore = true;
	let warned = false;
	try {
		for (let page = 0; page < maxPages && hasMore && out.length < cap; page++) {
			const response = await api.sessions.history({
				sessionId,
				...(beforeSeq === undefined ? {} : { beforeSeq }),
				maxMessages: DATA_PAGE,
			});
			// Client API envelope: { rpcId, result: { ok, value } }.
			const result = response && response.result;
			if (!result || result.ok !== true) {
				if (!warned) {
					warned = true;
					console.warn('[dsh-chat-index] history error for', sessionId,
						result && result.error ? result.error.code : 'no-result');
				}
				break;
			}
			const value = result.value || {};
			const events = value.events;
			if (!Array.isArray(events) || events.length === 0) break;
			let oldestSeq = Infinity;
			let newestSeq = -Infinity;
			for (const entry of events) {
				const event = entry && entry.event ? entry.event : entry;
				if (!event || typeof event.seq !== 'number') continue;
				if (event.seq < oldestSeq) oldestSeq = event.seq;
				if (event.seq > newestSeq) newestSeq = event.seq;
				if (isUserQuestionEvent(event)) out.push(eventToQuestion(event));
			}
			hasMore = value.hasMore === true && events.length >= DATA_PAGE;
			if (beforeSeq !== undefined && newestSeq >= beforeSeq) {
				// Safety: the server ignored our beforeSeq (should not happen).
				truncated = true;
				break;
			}
			beforeSeq = oldestSeq - 1;
		}
		if (out.length >= cap) truncated = true;
	} catch (err) {
		// Aborted or unauthorized — caller keeps whatever it had.
		console.warn('[dsh-chat-index] history read failed for', sessionId, err);
	}
	const dedupe = new Map();
	for (const q of out) if (!dedupe.has(q.seq)) dedupe.set(q.seq, q);
	const questions = [...dedupe.values()].sort(sortAsc);
	return { questions, truncated };
}

// Walk descendant sessions (child -> grandchild …) from a SessionListState
// byId map (rows have parentSessionId / displayTitle / id).
function collectDescendants(byId, rootId) {
	const rows = [];
	const seen = new Set([rootId]);
	const walk = (parentId, depth) => {
		if (rows.length >= MAX_CHILDREN || depth > 6) return;
		const children = [];
		for (const id of Object.keys(byId)) {
			if (seen.has(id)) continue;
			const row = byId[id];
			// Client SessionSummary names the parent link parentId (older wire
			// variants parentSessionId); accept both.
			const link = row ? (row.parentId !== undefined ? row.parentId : row.parentSessionId) : undefined;
			if (row && link === parentId) children.push({ id, row });
		}
		children.sort((a, b) => (a.row.updatedAt || 0) - (b.row.updatedAt || 0));
		for (const { id, row } of children) {
			if (seen.has(id) || rows.length >= MAX_CHILDREN) continue;
			seen.add(id);
			rows.push({
				sessionId: id,
				parentId,
				depth,
				title: (row.title || row.displayTitle || '').trim() || shortId(id),
				updatedAt: row.updatedAt || 0,
			});
			walk(id, depth + 1);
		}
	};
	walk(rootId, 0);
	return rows;
}

function shortId(id) {
	const s = String(id || '');
	return s.length > 12 ? s.slice(0, 4) + '…' + s.slice(-4) : s;
}

// Full index payload for one root session: its own questions plus one entry
// per descendant with that session's questions. Never throws.
async function fetchIndex(api, sessionId, rowsById, signal) {
	const mainPromise = historyQuestionsOf(api, sessionId, { maxPages: optsMaxPages(), cap: MAX_QUESTIONS });
	const descendants = collectDescendants(rowsById || {}, sessionId);
	const childResults = await Promise.all(descendants.map(async (desc) => {
		if (signal && signal.aborted) return { desc, questions: [], truncated: false };
		const r = await historyQuestionsOf(api, desc.sessionId, { maxPages: 6, cap: 120 });
		return { desc, ...r };
	}));
	let main;
	try { main = await mainPromise; } catch (_e) { main = { questions: [], truncated: false }; }
	return {
		sessionId,
		main,
		descendants: childResults.map((c) => ({ ...c.desc, questions: c.questions, truncated: c.truncated })),
	};
}

function optsMaxPages() {
	// Keep this separate so tuning needs no knowledge of the caller.
	return MAX_PAGES;
}

// Merge live window questions (seq/time/text from ChatSnapshot nodes) into an
// existing ascending question list without duplicating seqs.
function mergeLive(questions, liveNodes) {
	if (!liveNodes || liveNodes.length === 0) return questions;
	const map = new Map(questions.map((q) => [q.seq, q]));
	let changed = false;
	for (const n of liveNodes) {
		if (!map.has(n.seq)) {
			map.set(n.seq, { seq: n.seq, time: n.time, text: plainTextOf(n.content) });
			changed = true;
		}
	}
	if (!changed) return questions;
	return [...map.values()].sort(sortAsc);
}

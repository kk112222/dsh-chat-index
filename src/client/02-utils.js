// Pure helpers shared by the rail/panel components (no ctx / no host deps).
function plainTextOf(blocks) {
	if (!Array.isArray(blocks)) return '';
	let text = '';
	for (const b of blocks) {
		if (b && b.type === 'text' && typeof b.text === 'string') text += b.text;
	}
	text = text.replace(/\s+/g, ' ').trim();
	if (!text) {
		const hasImage = Array.isArray(blocks) && blocks.some((b) => b && b.type === 'image');
		const hasTool = Array.isArray(blocks) && blocks.some((b) => b && (b.type === 'tool-result' || b.type === 'tool-call'));
		if (hasImage) return '[图片]';
		if (hasTool) return '[工具]';
		return '(空消息)';
	}
	return text.length > 200 ? text.slice(0, 200) + '…' : text;
}

function pad2(n) { return n < 10 ? '0' + n : String(n); }

function formatTime(ms) {
	if (!(ms > 0)) return '';
	const d = new Date(ms);
	const now = new Date();
	const sameDay = d.toDateString() === now.toDateString();
	const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
	if (sameDay) return hm;
	const md = pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
	if (d.getFullYear() === now.getFullYear()) return md + ' ' + hm;
	return d.getFullYear() + '-' + md + ' ' + hm;
}

function conversationColumn() {
	return document.querySelector('[data-slot="conversation"]');
}

// Geometry of the conversation column. The slot node itself can be a 0-size
// outlet, so prefer the larger of the node and its parent (better-sidebar
// measures `#root [data-slot="conversation"]` and takes .parentElement for the
// same reason). Falls back to the whole viewport so the rail always has
// somewhere to render.
function measureBox() {
	const col = conversationColumn();
	if (col) {
		let el = col;
		const own = col.getBoundingClientRect();
		const par = col.parentElement;
		if (par) {
			const pr = par.getBoundingClientRect();
			if ((pr.width || 0) * (pr.height || 0) >= (own.width || 0) * (own.height || 0)) el = par;
		}
		const r = el.getBoundingClientRect();
		if (r.width > 0 && r.height > 0 && r.bottom > r.top) {
			return {
				left: r.left, top: r.top, right: r.right, bottom: r.bottom,
				width: r.width, height: r.height,
			};
		}
	}
	return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight };
}

// Map message seq -> chat view node (kind 'user' / 'steering') from a live
// ChatSnapshot (useSession(s => s.chat)); returns array of view nodes sorted
// by seq.
function questionViewNodes(chat) {
	if (!chat || !chat.nodes) return [];
	const out = [];
	for (const node of chat.nodes.values()) {
		if (!node) continue;
		if (node.kind === 'user' || node.kind === 'steering') {
			const seq = node.data && typeof node.data.seq === 'number' ? node.data.seq : node.anchorSeq;
			if (typeof seq === 'number') out.push({ key: node.key, kind: node.kind, seq });
		}
	}
	out.sort((a, b) => a.seq - b.seq);
	return out;
}

function seqToAnchorKey(chat, seq) {
	for (const node of chat.nodes.values()) {
		if (!node) continue;
		const nseq = node.data && typeof node.data.seq === 'number' ? node.data.seq : node.anchorSeq;
		if (nseq === seq && (node.kind === 'user' || node.kind === 'steering')) return node.key;
	}
	return null;
}

function rowByAnchorKey(key) {
	if (!key) return null;
	const esc = (typeof CSS !== 'undefined' && CSS.escape)
		? CSS.escape
		: (s) => String(s).replace(/["\\]/g, '\\$&');
	return document.querySelector('[data-chat-anchor-key="' + esc(String(key)) + '"]');
}

function scrollportOf(row) {
	if (!row) return null;
	return row.closest('[data-conversation-scroll]') || row.closest('[data-slot="conversation"]') || null;
}

// Scroll the transcript so `row` sits at the top of the viewport-ish area.
function scrollRowIntoView(row, offsetTop = 90) {
	if (!row) return false;
	const port = scrollportOf(row);
	if (!port) { try { row.scrollIntoView({ block: 'start' }); } catch (_e) {} return true; }
	const rowTop = row.getBoundingClientRect().top;
	const portTop = port.getBoundingClientRect().top;
	const delta = rowTop - portTop - offsetTop;
	port.scrollTop += delta;
	return true;
}

const flashTimers = new Map();
function flashRow(row) {
	if (!row) return;
	const el = row;
	el.setAttribute('dsh-chat-index-flash', '');
	const t = flashTimers.get(el);
	if (t) clearTimeout(t);
	flashTimers.set(el, setTimeout(() => {
		el.removeAttribute('dsh-chat-index-flash');
		flashTimers.delete(el);
	}, 1600));
}

// Wait a bounded number of animation frames for a predicate, then resolve.
function waitFrames(predicate, maxFrames = 60) {
	return new Promise((resolve) => {
		let frames = 0;
		const tick = () => {
			if (predicate()) return resolve(true);
			if (++frames >= maxFrames) return resolve(false);
			requestAnimationFrame(tick);
		};
		tick();
	});
}

// React components: question index rail + chain panel (root overlay) plus a
// per-session header toggle.
//
// Overlay mounts from shell.overlay (list/root). Root scope gives no useSession,
// so the current real session and its live ConversationSnapshot come from the
// sessions service: useSessions (SessionListState) for the current id, and
// ctx.sessions.binding(id).session (SessionFace = ObservableSnapshot) consumed
// with useSyncExternalStore.

const RAIL_W = 28;          // rail width in px
const RAIL_GUTTER = 12;     // spacing from the conversation column edge
const PANEL_MAX_W = 420;

function ciLog(...args) {
	try { console.log('[dsh-chat-index]', ...args); } catch (_e) { /* noop */ }
}

class Boundary extends ReactLib.Component {
	constructor(props) {
		super(props);
		this.state = { error: null };
	}
	static getDerivedStateFromError(error) {
		return { error };
	}
	componentDidCatch(error, info) {
		console.error('[dsh-chat-index] render error:', error, info);
	}
	render() {
		if (this.state.error) return null;
		return this.props.children;
	}
}

// ---- shared open-state across the overlay (root) and the header toggle (session) ----
const openBySession = new Map();     // sessionId -> boolean
const openListeners = new Set();     // (sessionId, open) => void
function panelOpenFor(sessionId) {
	return sessionId ? openBySession.get(sessionId) === true : false;
}
function setPanelOpen(sessionId, open) {
	if (!sessionId) return;
	openBySession.set(sessionId, !!open);
	for (const fn of openListeners) {
		try { fn(sessionId, !!open); } catch (_e) { /* noop */ }
	}
}

// Module-level "jump request": survives re-renders and session switches.
let jumpRequest = null;     // { sessionId, seq, token }
let jumpToken = 0;

function useColumnBox() {
	const [box, setBox] = useState(null);
	useEffect(() => {
		let raf = 0;
		const measure = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				const next = measureBox();
				setBox((prev) => (prev
					&& prev.top === next.top && prev.right === next.right
					&& prev.bottom === next.bottom && prev.left === next.left
					? prev : next));
			});
		};
		measure();
		window.addEventListener('resize', measure);
		const col = conversationColumn();
		let ro;
		if (col && typeof ResizeObserver !== 'undefined') {
			try { ro = new ResizeObserver(measure); ro.observe(col); } catch (_e) { /* noop */ }
		}
		const iv = setInterval(measure, 1200);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', measure);
			if (ro) ro.disconnect();
			clearInterval(iv);
		};
	}, []);
	return box;
}

function QuestionIndexOverlay(props) {
	const { ctx, useSessions } = props;
	const box = useColumnBox();

	const listState = useSessions((s) => s);
	const current = useMemo(() => (
		listState && listState.current !== undefined
			&& listState.byId[listState.current] && !listState.byId[listState.current].blank
			? listState.current : undefined
	), [listState]);
	const sessionRef = useRef(current);
	sessionRef.current = current;

	// Live ConversationSnapshot of the current session.
	const faceRef = useRef(null);
	const [face, setFace] = useState(null);
	useEffect(() => {
		let mounted = true;
		let next = null;
		if (current) {
			try {
				const binding = ctx.sessions.binding(current);
				if (binding && binding.session) next = binding.session;
			} catch (err) {
				console.warn('[dsh-chat-index] binding failed', current, err);
			}
		}
		faceRef.current = next;
		if (mounted) setFace(next);
		return () => { mounted = false; };
	}, [current, ctx]);
	useEffect(() => { faceRef.current = face; }, [face]);

	const subscribe = useCallback((cb) => {
		const f = faceRef.current;
		return f && typeof f.subscribe === 'function' ? f.subscribe(cb) : () => {};
	}, []);
	const getSnapshot = useCallback(() => {
		const f = faceRef.current;
		if (!f || typeof f.getSnapshot !== 'function') return undefined;
		try { return f.getSnapshot(); } catch (_e) { return undefined; }
	}, []);
	const snapshot = useSyncExternalStore(subscribe, getSnapshot);
	const chat = snapshot && snapshot.openState === 'open' ? snapshot.chat : undefined;
	const liveNodes = snapshot && snapshot.openState === 'open'
		? snapshot.nodes.filter((n) => n.kind === 'user' || n.kind === 'steering')
		: undefined;

	const liveQuestions = useMemo(() => (liveNodes || []).map((n) => ({
		seq: n.seq,
		time: n.time,
		text: plainTextOf(n.content),
	})).sort((a, b) => a.seq - b.seq), [liveNodes]);

	const [fullMain, setFullMain] = useState(null);
	const [branchRows, setBranchRows] = useState([]);
	const [branchData, setBranchData] = useState(null);
	const [loadState, setLoadState] = useState('idle');
	const [expanded, setExpanded] = useState(false);
	const [jumpTick, setJumpTick] = useState(0);

	// Per-session reset + open-state sync from the shared map / header toggle.
	useEffect(() => {
		setFullMain(null);
		setBranchRows([]);
		setBranchData(null);
		setLoadState('idle');
		setExpanded(panelOpenFor(current));
	}, [current]);
	useEffect(() => {
		const fn = (sessionId, open) => { if (sessionId === sessionRef.current) setExpanded(open); };
		openListeners.add(fn);
		return () => { openListeners.delete(fn); };
	}, []);

	// Full-history load (main thread + descendants).
	useEffect(() => {
		if (!current) return;
		const ac = new AbortController();
		let cancelled = false;
		const run = async () => {
			const api = ctx && ctx.connection && ctx.connection.api ? ctx.connection.api : null;
			if (!api) { setLoadState('done'); return; }
			setLoadState('loading');
			try {
				const byId = (listState && listState.byId) || {};
				const payload = await fetchIndex(api, current, byId, ac.signal);
				if (cancelled || ac.signal.aborted) return;
				setFullMain(payload.main.questions);
				setBranchRows(payload.descendants.map((d) => ({
					sessionId: d.sessionId, parentId: d.parentId, depth: d.depth,
					title: d.title, updatedAt: d.updatedAt,
				})));
				const map = {};
				for (const d of payload.descendants) map[d.sessionId] = {
					questions: d.questions, truncated: d.truncated, depth: d.depth,
					title: d.title, parentId: d.parentId, updatedAt: d.updatedAt,
				};
				setBranchData(map);
				setLoadState('done');
			} catch (err) {
				if (!cancelled && !ac.signal.aborted) { setLoadState('error'); console.warn('[dsh-chat-index] index load failed', err); }
			}
		};
		run();
		return () => { cancelled = true; ac.abort(); };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [current]);

	const displayMain = useMemo(() => {
		if (fullMain) return mergeLive(fullMain, liveQuestions);
		return liveQuestions;
	}, [fullMain, liveQuestions]);

	const hasLiveOnly = !fullMain;

	const performJump = useCallback((targetSessionId, seq) => {
		if (typeof seq !== 'number') return;
		const target = targetSessionId || sessionRef.current;
		if (!target) return;
		jumpRequest = { sessionId: target, seq, token: ++jumpToken };
		setJumpTick((t) => t + 1);
		if (target !== sessionRef.current) {
			try {
				ctx.sessions.open(target);
			} catch (err) {
				console.warn('[dsh-chat-index] open failed', target, err);
				jumpRequest = null;
			}
		}
	}, [ctx]);

	// Consume a pending jump once the target window is open.
	useEffect(() => {
		const req = jumpRequest;
		if (!req || req.sessionId !== sessionRef.current) return;
		if (!chat) return;
		let stopped = false;
		let iterations = 0;
		let pagesLoaded = 0;
		const attempt = async () => {
			if (stopped) return;
			iterations++;
			const key = seqToAnchorKey(chat, req.seq);
			const row = key ? rowByAnchorKey(key) : null;
			if (row) {
				scrollRowIntoView(row, 72);
				flashRow(row);
				if (jumpRequest === req) jumpRequest = null;
				return;
			}
			if (iterations < 50 && pagesLoaded < 10) {
				try {
					const binding = ctx.sessions && ctx.sessions.binding ? ctx.sessions.binding(req.sessionId) : undefined;
					if (binding && binding.session && typeof binding.session.loadOlder === 'function') {
						pagesLoaded++;
						await binding.session.loadOlder();
					}
				} catch (_e) { /* loadOlder unavailable */ }
				setTimeout(() => attempt(), 110);
			} else {
				if (jumpRequest === req) jumpRequest = null;
			}
		};
		attempt();
		return () => { stopped = true; };
	}, [jumpTick, chat, current, ctx]);

	const geo = useMemo(() => {
		if (!box) return null;
		const right = Math.min(box.right, window.innerWidth);
		const left = Math.max(box.left, 0);
		const top = box.top + 56;
		const bottom = box.bottom - 180;
		if (bottom <= top + 40) return null;
		const railRight = right - RAIL_GUTTER;
		const railLeft = railRight - RAIL_W;
		const panelWidth = Math.min(PANEL_MAX_W, Math.max(260, box.width * 0.44));
		const panelRight = railLeft - 8;
		const panelLeft = Math.max(left + 8, panelRight - panelWidth);
		return {
			railLeft, railTop: top, railRight, railBottom: bottom,
			panelLeft, panelTop: top + 4, panelRight, panelBottom: bottom + 56,
			panelWidth: panelRight - panelLeft,
		};
	}, [box]);

	const hasQuestions = displayMain.length > 0;
	const expandedByRequest = expanded && geo;

	const root = useMemo(() => {
		if (!geo) return null;
		const children = [];
		if (expandedByRequest) {
			children.push(h(Panel, {
				key: 'panel',
				geo,
				mainQuestions: displayMain,
				hasLiveOnly,
				branchRows,
				branchData,
				loadState,
				onJump: performJump,
				onCollapse: () => setPanelOpen(sessionRef.current, false),
			}));
		} else if (hasQuestions) {
			children.push(h(Rail, {
				key: 'rail',
				geo,
				questions: displayMain,
				hasLiveOnly,
				currentSeq: latestSeq(liveQuestions),
				onJump: performJump,
				onExpand: () => setPanelOpen(sessionRef.current, true),
			}));
		}
		return children.length ? h(Fragment, null, children) : null;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [geo, expandedByRequest, hasQuestions, displayMain, hasLiveOnly, branchRows, branchData, loadState, liveQuestions, performJump]);

	const loggedRef = useRef(null);
	if (loggedRef.current !== (current || 'none')) {
		loggedRef.current = current || 'none';
		ciLog('overlay', { current, questions: displayMain.length, load: loadState, liveOnly: hasLiveOnly });
	}

	if (!root) return null;
	const content = h('div', {
		'dsh-chat-index-root': '',
		style: { pointerEvents: 'none', position: 'fixed', inset: 0, zIndex: 9000 },
	}, h(Boundary, { key: 'boundary' }, root));
	return ReactDOMLib && ReactDOMLib.createPortal
		? ReactDOMLib.createPortal(content, document.body)
		: content;
}

function latestSeq(questions) {
	let m = -1;
	for (const q of questions) if (q.seq > m) m = q.seq;
	return m < 0 ? undefined : m;
}

// ---- rail: time-proportional dots + scrub ----
function Rail(props) {
	const { geo, questions, hasLiveOnly, currentSeq, onJump, onExpand } = props;
	const [scrub, setScrub] = useState(null);
	const trackRef = useRef(null);

	const count = questions.length;
	const height = Math.max(10, geo.railBottom - geo.railTop);
	const usable = Math.max(4, height - 16);

	// Time extent of the whole question list.
	let minT = Infinity;
	let maxT = -Infinity;
	for (const q of questions) {
		const t = typeof q.time === 'number' && q.time > 0 ? q.time : q.seq;
		if (t < minT) minT = t;
		if (t > maxT) maxT = t;
	}
	const span = maxT - minT || 1;
	const yOfTime = (t) => 8 + ((t - minT) / span) * usable;
	const timeAtY = (y) => minT + ((y - 8) / usable) * span;

	// Sample at most ~70 markers; positions follow time, so visual gaps match
	// real time gaps between questions.
	const markers = [];
	if (count <= 70) {
		for (const q of questions) markers.push(q);
	} else {
		const slotCount = 70;
		const used = new Set();
		for (let i = 0; i < slotCount; i++) {
			const targetT = minT + (i * span) / (slotCount - 1);
			let best = -1;
			let bestD = Infinity;
			for (let j = 0; j < count; j++) {
				if (used.has(j)) continue;
				const t = typeof questions[j].time === 'number' && questions[j].time > 0 ? questions[j].time : questions[j].seq;
				const d = Math.abs(t - targetT);
				if (d < bestD) { bestD = d; best = j; }
			}
			if (best >= 0) { used.add(best); markers.push(questions[best]); }
		}
		const last = questions[count - 1];
		if (last && markers[markers.length - 1].seq !== last.seq) markers.push(last);
	}
	markers.sort((a, b) => a.seq - b.seq);

	const indexAt = (clientY) => {
		const r = trackRef.current ? trackRef.current.getBoundingClientRect() : null;
		if (!r || count === 0) return 0;
		const frac = Math.min(1, Math.max(0, (clientY - r.top - 8) / usable));
		const targetT = minT + frac * span;
		let best = 0;
		let bestD = Infinity;
		for (let i = 0; i < count; i++) {
			const t = typeof questions[i].time === 'number' && questions[i].time > 0 ? questions[i].time : questions[i].seq;
			const d = Math.abs(t - targetT);
			if (d < bestD) { bestD = d; best = i; }
		}
		return best;
	};

	const onPointerDown = (e) => {
		setScrub({ index: indexAt(e.clientY) });
		e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
	};
	const onPointerMove = (e) => {
		if (!scrub) return;
		setScrub({ index: indexAt(e.clientY) });
	};
	const endScrub = () => {
		if (scrub) {
			const q = questions[scrub.index];
			setScrub(null);
			if (q) onJump(null, q.seq);
		}
	};

	const flyout = scrub ? questions[scrub.index] : undefined;
	const flyTime = (q) => (typeof q.time === 'number' && q.time > 0 ? q.time : q.seq);

	const railChildren = [];
	railChildren.push(h('div', {
		key: 'head',
		'dsh-chat-index-rail-head': '',
		title: count + ' 个提问（悬停看摘要，点按跳转，拖动快速滑动）',
	}, String(count)));
	railChildren.push(h('div', {
		key: 'track',
		'dsh-chat-index-track': '',
		ref: trackRef,
		onPointerDown,
		onPointerMove,
		onPointerUp: endScrub,
		onPointerCancel: endScrub,
		style: { height: height + 'px' },
	}, markers.map((q) => h('div', {
			key: 'm' + q.seq,
			'dsh-chat-index-marker': '',
			...(q.seq === currentSeq ? { 'dsh-chat-index-current': '' } : {}),
			style: { top: yOfTime(flyTime(q)) + 'px' },
			title: formatTime(q.time) + '\n' + q.text,
			onClick: (e) => { e.stopPropagation(); onJump(null, q.seq); },
			onPointerDown: (e) => e.stopPropagation(),
		}))));
	railChildren.push(h('button', {
		key: 'toggle',
		type: 'button',
		'dsh-chat-index-toggle': '',
		title: '展开提问链',
		onClick: (e) => { e.stopPropagation(); onExpand(); },
	}, '⇱'));

	const railStyle = {
		position: 'fixed',
		left: geo.railLeft + 'px',
		top: geo.railTop + 'px',
		width: RAIL_W + 'px',
		height: height + 'px',
		pointerEvents: 'auto',
		zIndex: 9001,
	};
	return h(Fragment, null,
		h('div', { 'dsh-chat-index-rail': '', style: railStyle }, railChildren),
		flyout ? h('div', {
			'dsh-chat-index-flyout': '',
			style: { top: (geo.railTop + yOfTime(flyTime(flyout))) + 'px' },
		},
			h('div', null, formatTime(flyout.time)),
			h('div', null, flyout.text)) : null,
	);
}

// ---- expanded chain panel ----
function Panel(props) {
	const { geo, mainQuestions, branchRows, branchData, loadState, onJump, onCollapse } = props;
	const branches = branchRows.filter((b) => b.depth === 0);
	const nested = branchRows.filter((b) => b.depth > 0);

	const style = {
		position: 'fixed',
		left: geo.panelLeft + 'px',
		top: geo.panelTop + 'px',
		width: geo.panelWidth + 'px',
		height: Math.max(140, geo.panelBottom - geo.panelTop) + 'px',
		pointerEvents: 'auto',
		zIndex: 9002,
	};

	const total = mainQuestions.length + branchRows.reduce((n, b) => n + ((branchData && branchData[b.sessionId] && branchData[b.sessionId].questions) || []).length, 0);
	const head = h('div', { 'dsh-chat-index-panel-head': '' },
		h('span', null, '提问索引'),
		h('span', { style: { opacity: 0.6, fontWeight: 400, fontSize: 11 } }, ' · ' + total),
		loadState === 'loading' ? h('span', { style: { opacity: 0.6, fontWeight: 400, fontSize: 11 } }, '…') : null,
		h('span', { style: { flex: 1 } }),
		h('button', { type: 'button', title: '收起', 'dsh-chat-index-toggle': '', onClick: onCollapse }, '✕'),
	);

	let body;
	const isEmpty = mainQuestions.length === 0 && branchRows.length === 0;
	if (isEmpty) {
		body = h('div', { style: { padding: 14, opacity: 0.7 } }, loadState === 'loading' ? '加载中…' : '这个会话还没有提问。');
	} else {
		const list = [];
		for (const q of mainQuestions) {
			list.push(h(QuestionRow, { key: 'm' + q.seq, q, depth: 0, onJump: () => onJump(null, q.seq) }));
		}
		const renderBranch = (b, depth) => {
			const data = branchData && branchData[b.sessionId];
			const questions = (data && data.questions) || [];
			const kids = [];
			for (const c of branchRows) if (c.parentId === b.sessionId) kids.push(c);
			const titleExtra = b.updatedAt ? ' · ' + formatTime(b.updatedAt) : '';
			const row = h('div', { key: 'b' + b.sessionId, 'dsh-chat-index-node': '', style: { '--depth': String(depth) } },
				h('div', {
					'dsh-chat-index-node-row': '',
					title: '分支会话：' + b.title + titleExtra,
					onClick: () => (questions[0] ? onJump(b.sessionId, questions[0].seq) : undefined),
				},
					h('span', { 'dsh-chat-index-branch-tag': '' }, '分支'),
					h('span', { 'dsh-chat-index-node-text': '' },
						h('div', { 'dsh-chat-index-node-q': '' }, b.title),
						h('div', { 'dsh-chat-index-node-meta': '' }, questions.length ? questions.length + ' 个提问' : '无提问' + titleExtra)),
				),
				questions.map((q) => h(QuestionRow, {
					key: 'bq' + b.sessionId + q.seq,
					q,
					depth: depth + 1,
					onJump: () => onJump(b.sessionId, q.seq),
				})),
				kids.map((c) => renderBranch(c, depth + 1)),
			);
			return row;
		};
		for (const b of branches) list.push(renderBranch(b, 1));
		if (nested.length > 0 && branches.length === 0) {
			for (const b of nested) list.push(renderBranch(b, 1));
		}
		body = h('div', { 'dsh-chat-index-panel-body': '' }, list);
	}

	return h('div', { 'dsh-chat-index-panel': '', style }, head, body);
}

function QuestionRow(props) {
	const { q, depth, onJump } = props;
	return h('div', { 'dsh-chat-index-node': '', style: { '--depth': String(depth) } },
		h('div', {
			'dsh-chat-index-node-row': '',
			onClick: onJump,
			title: formatTime(q.time) + '\n' + q.text,
		},
			h('span', { 'dsh-chat-index-node-dot': '' }),
			h('span', { 'dsh-chat-index-node-text': '' },
				h('div', { 'dsh-chat-index-node-q': '' }, q.text),
				h('div', { 'dsh-chat-index-node-meta': '' }, formatTime(q.time)),
			),
		));
}

// ---- header toggle (session scope): always-visible entry point ----
function HeaderIndexToggle(props) {
	const { sessionId } = props;
	const open = panelOpenFor(sessionId);
	return h('button', {
		type: 'button',
		title: '提问索引' + (open ? '（收起）' : ''),
		'aria-label': '提问索引',
		style: {
			cursor: 'pointer',
			display: 'inline-flex',
			alignItems: 'center',
			justifyContent: 'center',
			width: 26,
			height: 26,
			borderRadius: 7,
			border: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
			background: open ? 'color-mix(in srgb, currentColor 14%, transparent)' : 'transparent',
			color: 'inherit',
			fontSize: 13,
			lineHeight: 1,
		},
		onClick: () => setPanelOpen(sessionId, !open),
	}, '≡');
}

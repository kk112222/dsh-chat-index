// CSS injection (self-contained; idempotent). Call ensureChatIndexStyle() as
// soon as the DOM head exists (fragment top level + again from apply()).
// Styling follows the DSH theme through its `--dsw-alias-*` variables, so the
// rail and panel match light/dark themes instead of guessing colors.
function ensureChatIndexStyle() {
	if (typeof document === "undefined" || !document.head) return false;
	if (document.getElementById("dsh-chat-index-style")) return true;
	const style = document.createElement("style");
	style.id = "dsh-chat-index-style";
	style.textContent = `
[dsh-chat-index-root] {
	--dshci-rail-w: 34px;
	--dshci-gap: 10px;
	--dshci-surface: var(--dsw-alias-bg-layer-2, color-mix(in srgb, currentColor 10%, transparent));
	--dshci-surface-strong: var(--dsw-alias-bg-layer-1, color-mix(in srgb, currentColor 6%, transparent));
	--dshci-border: var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 22%, transparent));
	--dshci-hover: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 12%, transparent));
	--dshci-dot: var(--dsw-alias-label-tertiary, color-mix(in srgb, currentColor 70%, transparent));
	--dshci-accent: var(--dsw-alias-accent, var(--dsw-alias-brand-primary, #4a7bd6));
	--dshci-accent-ink: var(--dsw-alias-accent-ink, #fff);
	--dshci-accent-soft: var(--dsw-alias-accent-soft, color-mix(in srgb, var(--dsw-alias-accent, #4a7bd6) 18%, transparent));
	--dshci-text: var(--dsw-alias-label-primary, inherit);
	--dshci-text-2: var(--dsw-alias-label-secondary, color-mix(in srgb, currentColor 75%, transparent));
	--dshci-text-3: var(--dsw-alias-label-tertiary, color-mix(in srgb, currentColor 55%, transparent));
	--dshci-shadow: var(--dsw-alias-bg-mask-drop, rgb(0 0 0 / 0.25));
	position: fixed;
	z-index: 9000;
	font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
	font-size: 13px;
	line-height: 1.45;
	color: var(--dshci-text);
}
[dsh-chat-index-root], [dsh-chat-index-root] * { box-sizing: border-box; }

/* ---------- rail (collapsed) ---------- */
[dsh-chat-index-rail] {
	position: absolute;
	top: 0; right: 0; bottom: 0;
	width: var(--dshci-rail-w);
	pointer-events: auto;
	display: flex;
	flex-direction: column;
	align-items: center;
	background: var(--dshci-surface);
	border: 1px solid var(--dshci-border);
	border-radius: 10px;
	box-shadow: 0 2px 12px var(--dshci-shadow);
	opacity: 0.82;
	transition: opacity 0.18s ease, background 0.18s ease;
	cursor: pointer;
	user-select: none;
	overflow: hidden;
}
[dsh-chat-index-rail]:hover {
	opacity: 1;
	background: var(--dsw-alias-bg-layer-3, var(--dshci-surface));
}

/* question-count badge */
[dsh-chat-index-rail-head] {
	flex: none;
	margin: 7px 0 3px;
	min-width: 22px;
	padding: 1px 6px;
	text-align: center;
	font-size: 10px;
	font-weight: 600;
	line-height: 16px;
	color: var(--dshci-text-2);
	background: var(--dshci-surface-strong);
	border-radius: 999px;
}

/* ---------- marker track (scrub area) ---------- */
[dsh-chat-index-track] {
	position: relative;
	flex: 1 1 auto;
	min-height: 0;
	width: 100%;
	touch-action: none;
}
/* thin time axis */
[dsh-chat-index-track]::before {
	content: '';
	position: absolute;
	left: 50%;
	top: 8px;
	bottom: 8px;
	width: 1px;
	transform: translateX(-50%);
	background: var(--dshci-border);
	border-radius: 1px;
}
/* marker = generous hit area; the visible circle is the inner dot */
[dsh-chat-index-marker] {
	position: absolute;
	left: 50%;
	transform: translateX(-50%);
	width: 30px;
	height: 16px;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
}
[dsh-chat-index-dot] {
	width: 9px;
	height: 9px;
	border-radius: 50%;
	background: var(--dshci-dot);
	box-shadow: 0 0 0 2px var(--dshci-surface);
	transition: width 0.12s ease, height 0.12s ease, background 0.12s ease;
}
[dsh-chat-index-marker]:hover [dsh-chat-index-dot] {
	width: 13px;
	height: 13px;
	background: var(--dshci-accent);
}
[dsh-chat-index-marker][dsh-chat-index-current] [dsh-chat-index-dot] {
	background: var(--dshci-accent);
	box-shadow: 0 0 0 2px var(--dshci-surface), 0 0 0 4px var(--dshci-accent-soft);
}

/* ---------- expand button ---------- */
[dsh-chat-index-toggle] {
	flex: none;
	position: relative;
	z-index: 2;
	width: 24px;
	height: 24px;
	margin: 3px 0 6px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border: 0;
	border-radius: 7px;
	background: none;
	color: var(--dshci-text-2);
	font-size: 13px;
	line-height: 1;
	cursor: pointer;
	transition: background 0.15s ease, color 0.15s ease;
}
[dsh-chat-index-toggle]:hover {
	background: var(--dshci-hover);
	color: var(--dshci-text);
}

/* ---------- drag scrub flyout ---------- */
[dsh-chat-index-flyout] {
	position: absolute;
	right: calc(var(--dshci-rail-w) + 12px);
	transform: translateY(-50%);
	max-width: 300px;
	padding: 7px 11px;
	border-radius: 10px;
	background: var(--dshci-surface-strong);
	border: 1px solid var(--dshci-border);
	box-shadow: 0 8px 28px var(--dshci-shadow);
	pointer-events: none;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: 12px;
	color: var(--dshci-text);
}
[dsh-chat-index-flyout] > div:first-child { color: var(--dshci-text-3); font-size: 11px; }

/* ---------- chain panel (expanded) ---------- */
[dsh-chat-index-panel] {
	position: absolute;
	top: 0;
	right: calc(var(--dshci-rail-w) + var(--dshci-gap));
	bottom: 0;
	width: min(420px, 46vw);
	display: flex;
	flex-direction: column;
	background: var(--dshci-surface-strong);
	border: 1px solid var(--dshci-border);
	border-radius: 12px;
	box-shadow: 0 12px 40px var(--dshci-shadow);
	backdrop-filter: blur(10px) saturate(1.1);
	overflow: hidden;
	color: var(--dshci-text);
}
[dsh-chat-index-panel-head] {
	display: flex;
	align-items: center;
	gap: 6px;
	flex: none;
	padding: 10px 12px;
	border-bottom: 1px solid var(--dshci-border);
	font-size: 13px;
	font-weight: 600;
}
[dsh-chat-index-panel-body] {
	flex: 1 1 auto;
	overflow-y: auto;
	padding: 8px 8px 16px;
	overscroll-behavior: contain;
}
[dsh-chat-index-node] {
	--depth: 0;
	margin-left: calc(var(--depth) * 16px);
}
[dsh-chat-index-node-row] {
	display: flex;
	gap: 8px;
	align-items: baseline;
	padding: 6px 8px;
	border-radius: 8px;
	cursor: pointer;
	transition: background 0.12s ease;
}
[dsh-chat-index-node-row]:hover { background: var(--dshci-hover); }
[dsh-chat-index-node-dot] {
	flex: none;
	width: 7px;
	height: 7px;
	margin-top: 6px;
	border-radius: 50%;
	background: var(--dshci-accent);
	opacity: 0.85;
}
[dsh-chat-index-node-text] {
	flex: 1 1 auto;
	min-width: 0;
}
[dsh-chat-index-node-q] {
	color: var(--dshci-text);
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}
[dsh-chat-index-node-meta] {
	font-size: 11px;
	color: var(--dshci-text-3);
	margin-top: 2px;
}
[dsh-chat-index-branch-tag] {
	font-size: 10px;
	line-height: 16px;
	padding: 0 6px;
	border-radius: 999px;
	background: var(--dshci-accent-soft);
	color: var(--dshci-accent);
	margin-right: 6px;
	white-space: nowrap;
}

/* ---------- jump highlight on the product message row ---------- */
[dsh-chat-index-flash] {
	animation: dshci-flash 1.4s ease-out;
}
@keyframes dshci-flash {
	0% { box-shadow: inset 0 0 0 9999px var(--dshci-accent-soft); }
	60% { box-shadow: inset 0 0 0 9999px var(--dshci-accent-soft); }
	100% { box-shadow: inset 0 0 0 0 transparent; }
}
`;
	document.head.appendChild(style);
	return true;
}
ensureChatIndexStyle();

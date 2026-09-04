// CSS injection (self-contained; idempotent). Call ensureChatIndexStyle() as
// soon as the DOM head exists (fragment top level + again from apply()).
// Every rule is scoped under the plugin's own root attribute so it never
// reaches product DOM. Colors adapt to the surrounding theme via CSS
// color-mix() so no product token vocabulary is imported.
function ensureChatIndexStyle() {
	if (typeof document === "undefined" || !document.head) return false;
	if (document.getElementById("dsh-chat-index-style")) return true;
	const style = document.createElement("style");
	style.id = "dsh-chat-index-style";
	style.textContent = `
[dsh-chat-index-root] {
	--dshci-accent: color-mix(in srgb, currentColor 55%, transparent);
	--dshci-rail-w: 26px;
	--dshci-gap: 10px;
	position: fixed;
	z-index: 9000;
	font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
	font-size: 13px;
	line-height: 1.45;
	color: inherit;
}
[dsh-chat-index-root], [dsh-chat-index-root] * { box-sizing: border-box; }

/* rail (collapsed) */
[dsh-chat-index-rail] {
	position: absolute;
	top: 0; right: 0; bottom: 0;
	width: var(--dshci-rail-w);
	pointer-events: auto;
	display: flex;
	flex-direction: column;
	align-items: center;
	background: color-mix(in srgb, currentColor 9%, transparent);
	border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
	border-radius: 8px;
	opacity: 0.9;
	transition: opacity 0.18s ease, background 0.18s ease;
	cursor: pointer;
	user-select: none;
	overflow: hidden;
}
[dsh-chat-index-rail]:hover { opacity: 1; background: color-mix(in srgb, currentColor 13%, transparent); }

[dsh-chat-index-rail-head] {
	width: 100%;
	text-align: center;
	padding: 6px 0 2px;
	font-size: 10px;
	letter-spacing: 0.5px;
	opacity: 0.9;
	writing-mode: vertical-rl;
	transform: rotate(180deg);
	text-transform: uppercase;
	white-space: nowrap;
}

/* marker track (scrub area) */
[dsh-chat-index-track] {
	position: relative;
	flex: 1 1 auto;
	width: 100%;
	touch-action: none;
}
[dsh-chat-index-marker] {
	position: absolute;
	left: 50%;
	transform: translateX(-50%);
	width: 9px;
	height: 9px;
	border-radius: 50%;
	background: currentColor;
	opacity: 0.55;
	box-shadow: 0 0 0 2px color-mix(in srgb, canvas 85%, transparent);
	transition: width 0.12s ease, height 0.12s ease, opacity 0.12s ease;
}
[dsh-chat-index-rail]:hover [dsh-chat-index-marker],
[dsh-chat-index-marker][dsh-chat-index-live] {
	opacity: 0.9;
}
[dsh-chat-index-marker]:hover {
	width: 12px;
	height: 12px;
	opacity: 1;
}
[dsh-chat-index-marker][dsh-chat-index-current] {
	opacity: 1;
	box-shadow: 0 0 0 2px color-mix(in srgb, canvas 85%, transparent), 0 0 6px currentColor;
}
[dsh-chat-index-thumb] {
	position: absolute;
	left: 2px;
	right: 2px;
	height: 30px;
	border-radius: 6px;
	background: color-mix(in srgb, currentColor 18%, transparent);
	pointer-events: none;
}

/* drag scrub flyout label */
[dsh-chat-index-flyout] {
	position: absolute;
	right: calc(var(--dshci-rail-w) + 10px);
	transform: translateY(-50%);
	max-width: 280px;
	padding: 6px 10px;
	border-radius: 8px;
	background: color-mix(in srgb, canvas 92%, currentColor 8%);
	border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
	box-shadow: 0 6px 24px rgb(0 0 0 / 0.25);
	pointer-events: none;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: 12px;
}

/* expansion button */
[dsh-chat-index-toggle] {
	width: 100%;
	border: 0;
	padding: 4px 0;
	background: none;
	cursor: pointer;
	font-size: 12px;
	line-height: 1;
	opacity: 0.85;
}
[dsh-chat-index-toggle]:hover { opacity: 1; }

/* chain panel (expanded) */
[dsh-chat-index-panel] {
	position: absolute;
	top: 0;
	right: calc(var(--dshci-rail-w) + var(--dshci-gap));
	bottom: 0;
	width: min(400px, 46vw);
	display: flex;
	flex-direction: column;
	background: color-mix(in srgb, canvas 96%, currentColor 4%);
	border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
	border-radius: 12px;
	box-shadow: 0 10px 40px rgb(0 0 0 / 0.28);
	overflow: hidden;
}
[dsh-chat-index-panel-head] {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 10px;
	border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
	font-weight: 600;
}
[dsh-chat-index-panel-body] {
	flex: 1 1 auto;
	overflow-y: auto;
	padding: 8px 6px 14px;
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
	padding: 5px 8px;
	border-radius: 8px;
	cursor: pointer;
}
[dsh-chat-index-node-row]:hover { background: color-mix(in srgb, currentColor 7%, transparent); }
[dsh-chat-index-node-dot] {
	flex: none;
	width: 7px; height: 7px;
	border-radius: 50%;
	background: var(--dshci-accent);
	margin-top: 5px;
	position: relative;
}
[dsh-chat-index-node-text] {
	flex: 1 1 auto;
	min-width: 0;
}
[dsh-chat-index-node-q] {
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}
[dsh-chat-index-node-meta] {
	font-size: 11px;
	opacity: 0.65;
	margin-top: 1px;
}
[dsh-chat-index-node-children] {
	margin-top: 2px;
}
[dsh-chat-index-branch-tag {
	font-size: 10px;
	padding: 0 5px;
	border-radius: 999px;
	background: color-mix(in srgb, currentColor 12%, transparent);
	margin-right: 6px;
	white-space: nowrap;
}

/* flash highlight for the target message (product message row we can't own —
   applied as a class by our locate code and removed after the animation) */
[dsh-chat-index-flash] {
	animation: dshci-flash 1.4s ease-out;
}
@keyframes dshci-flash {
	0% { box-shadow: inset 0 0 0 9999px color-mix(in srgb, currentColor 12%, transparent); }
	60% { box-shadow: inset 0 0 0 9999px color-mix(in srgb, currentColor 12%, transparent); }
	100% { box-shadow: inset 0 0 0 0 transparent; }
}
`;
	document.head.appendChild(style);
	return true;
}
ensureChatIndexStyle();

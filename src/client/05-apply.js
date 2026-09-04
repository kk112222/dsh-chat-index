// Plugin definition: registers the root overlay (rail + chain panel) and a
// per-session header toggle that opens the panel for that session.
let pluginCtx = null;

const name = 'dsh-chat-index';
const inject = ['slots', 'sessions', 'connection'];

function apply(ctx) {
	pluginCtx = ctx;
	try { ensureChatIndexStyle(); } catch (err) { console.warn('[dsh-chat-index] style install failed', err); }
	ciLog('apply');

	// Root overlay: the rail (when the session has questions) and the chain
	// panel, both portaled to document.body.
	ctx.slots.inject('shell.overlay', function* () {
		yield ctx.slots.register({
			name: 'shell.overlay',
			id: 'chat-index-overlay',
			order: 500,
		}, (props) => h(QuestionIndexOverlay, Object.assign({ ctx }, props)));
	});

	// Header toggle: an always-present "≡" in the right-aligned session
	// header utilities that opens/closes the panel for the current session.
	ctx.slots.inject('conversation.session.header.utilities', function* () {
		yield ctx.slots.register({
			name: 'conversation.session.header.utilities',
			id: 'chat-index-header-toggle',
			order: 10,
		}, (props) => h(HeaderIndexToggle, Object.assign({ ctx }, props)));
	});

	if (typeof window !== 'undefined') window.__dshChatIndexDebug = { applied: true, at: Date.now() };
}

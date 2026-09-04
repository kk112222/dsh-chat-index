// Shared libs, evaluated once in the factory closure. Later fragments may use
// these names directly.
const ReactLib = require('react');
// react-dom is resolved lazily/optionally: some embedding surfaces may not
// seed it, and materialization must not die on an unresolvable require.
let ReactDOMLib = null;
try {
	ReactDOMLib = require('react-dom');
} catch (err) {
	console.warn('[dsh-chat-index] react-dom not available, will render inline', err);
}
const {
	useState,
	useEffect,
	useRef,
	useMemo,
	useCallback,
	useSyncExternalStore,
	createElement: h,
	Fragment,
} = ReactLib;

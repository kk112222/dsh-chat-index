/**
 * dsh-chat-index — host half.
 *
 * The whole feature lives in the browser (client) half: a per-session right
 * edge "question index" that reads conversation snapshots, branch session
 * lists and projection data through the standard client session kit.
 *
 * This host entry exists only so the loader can mount the plugin row named
 * `dsh-chat-index`; without it the package would never be scanned as a
 * client-package (the web client module system scans *loader entries*).
 */

const name = 'dsh-chat-index';

function apply() {
  // intentionally empty: no host services are required by this version.
}

export { apply, name };

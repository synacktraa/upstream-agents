/**
 * @upstream/terminal
 *
 * WebSocket-based PTY terminal for Daytona sandboxes.
 *
 * This package provides:
 * - A WebSocket PTY server that runs inside the sandbox
 * - An xterm.js-based React component for the browser
 *
 * Usage:
 *
 * 1. Deploy the WebSocket server to the sandbox:
 *    - Upload websocket-server.js and package.json from src/server/
 *    - Run: npm install ws node-pty
 *    - Run: node websocket-server.js
 *
 * 2. Get the signed WebSocket URL:
 *    const signedUrl = await sandbox.getSignedPreviewUrl(3001, 3600);
 *    const wsUrl = signedUrl.url.replace('https://', 'wss://');
 *
 * 3. Use the React component:
 *    import { WebSocketTerminal } from '@upstream/terminal';
 *    <WebSocketTerminal websocketUrl={wsUrl} />
 */

// Re-export components
export { WebSocketTerminal } from './components/WebSocketTerminal';
export type { WebSocketTerminalProps } from './components/WebSocketTerminal';

// Constants
export const PTY_SERVER_PORT = 3001;
export const PTY_SERVER_FILENAME = 'websocket-pty-server.js';

/**
 * Get the WebSocket URL from an HTTPS preview URL
 */
export function httpsToWss(httpsUrl: string): string {
  return httpsUrl.replace(/^https:\/\//, 'wss://');
}

/**
 * Get the server files that need to be uploaded to the sandbox
 */
export function getServerFiles(): { filename: string; content: string }[] {
  // These will be bundled or read at runtime
  return [
    { filename: 'websocket-pty-server.js', content: '' },
    { filename: 'package.json', content: '' },
  ];
}

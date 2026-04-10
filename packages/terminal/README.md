# @upstream/terminal

WebSocket-based PTY terminal for Daytona sandboxes. Provides a full interactive terminal experience using xterm.js and node-pty.

## Features

- **Full PTY support**: Run interactive programs like vim, htop, ssh, etc.
- **Real-time streaming**: Instant I/O via WebSocket
- **Terminal emulation**: Full ANSI color support, cursor positioning, scrollback
- **Resize handling**: Terminal automatically resizes to fit container
- **Web links**: Clickable URLs in terminal output

## Architecture

This package has two parts:

1. **WebSocket PTY Server** (`src/server/websocket-server.js`)
   - Runs inside the Daytona sandbox
   - Uses `node-pty` to spawn a real PTY process
   - Streams I/O over WebSocket

2. **React Component** (`src/components/WebSocketTerminal.tsx`)
   - Uses `xterm.js` for terminal emulation
   - Connects to the WebSocket server
   - Handles resize, input, and output

## Usage

### 1. Deploy the PTY server to your sandbox

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

// Read server files
const serverCode = readFileSync(
  join(process.cwd(), 'node_modules/@upstream/terminal/src/server/websocket-server.js'),
  'utf-8'
);
const packageJson = readFileSync(
  join(process.cwd(), 'node_modules/@upstream/terminal/src/server/package.json'),
  'utf-8'
);

// Upload to sandbox
await sandbox.fs.uploadFile(Buffer.from(serverCode), 'websocket-pty-server.js');
await sandbox.fs.uploadFile(Buffer.from(packageJson), 'package.json');

// Install dependencies and start server
await sandbox.process.executeCommand('npm install ws node-pty');
await sandbox.process.executeCommand('nohup node websocket-pty-server.js > /tmp/pty-server.log 2>&1 &');

// Get WebSocket URL
const signedUrl = await sandbox.getSignedPreviewUrl(3001, 3600);
const wsUrl = signedUrl.url.replace('https://', 'wss://');
```

### 2. Use the React component

```tsx
import { WebSocketTerminal } from '@upstream/terminal';

function MyTerminal({ websocketUrl }: { websocketUrl: string }) {
  return (
    <WebSocketTerminal
      websocketUrl={websocketUrl}
      onConnect={(pid) => console.log('Connected, PID:', pid)}
      onDisconnect={() => console.log('Disconnected')}
      onError={(err) => console.error('Error:', err)}
      fontSize={14}
      theme={{
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
      }}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `websocketUrl` | `string` | required | WebSocket URL to connect to |
| `className` | `string` | `''` | CSS class for container |
| `onConnect` | `(pid: number) => void` | - | Called when connected |
| `onDisconnect` | `(code?, reason?) => void` | - | Called when disconnected |
| `onError` | `(error: Error) => void` | - | Called on error |
| `theme` | `object` | - | Terminal color theme |
| `fontSize` | `number` | `13` | Font size in pixels |
| `fontFamily` | `string` | `'Menlo, Monaco, ...'` | Font family |

## Protocol

Messages are JSON-encoded:

### Client -> Server

```typescript
// Send input to PTY
{ type: 'input', payload: 'ls -la\n' }

// Resize terminal
{ type: 'resize', cols: 80, rows: 24 }

// Health check
{ type: 'ping' }
```

### Server -> Client

```typescript
// PTY output
{ type: 'data', payload: '...' }

// Connection ready
{ type: 'ready', pid: 12345, shell: 'bash', cwd: '/home/daytona' }

// Process exited
{ type: 'exit', exitCode: 0, signal: null }

// Health check response
{ type: 'pong', timestamp: 1234567890 }
```

## Requirements

- Node.js >= 18
- React >= 18
- Sandbox with `node-pty` support (Linux with working PTY)

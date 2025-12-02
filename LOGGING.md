# BaseBall Game Logging System

A comprehensive logging system has been added to help debug issues with the game, particularly:
- Blank screens when joining games
- Missing notifications for hosts
- Game state transitions

## How to Access Logs

### Method 1: Browser Console
All logs are automatically available in the browser console. Open Developer Tools (F12) and check the Console tab.

You can also access logs programmatically:
```javascript
// Get all logs
window.baseballLogs

// Export logs as JSON
JSON.stringify(window.baseballLogs, null, 2)
```

### Method 2: Debug Panel (UI)
A debug panel is available in the bottom-right corner of the application:
1. Click the "DEBUG" button to open the panel
2. View logs filtered by component or level
3. Export logs as JSON file
4. Clear logs if needed

### Method 3: Server Logs
Check the server console (where `server/index.js` is running) for socket.io events and server-side logs.

## Enabling Debug Mode

Debug logging is automatically enabled in development mode. To enable in production:

1. Open browser console
2. Run: `localStorage.setItem('baseball_debug', 'true')`
3. Refresh the page

To disable:
```javascript
localStorage.removeItem('baseball_debug')
```

## What Gets Logged

### Game Component
- Game loading and state transitions
- Player identification (host vs player)
- Game initialization
- Rendering decisions (why certain screens are shown)
- Critical errors that could cause blank screens

### Lobby Component
- Game list loading
- Join game validation checks
- Transaction sending
- Socket event emissions

### Socket Events
- All socket.io events (sent and received)
- Player joined notifications
- Game state updates

### Page Component
- Navigation between views
- Host notification handling
- Socket event reception

## Key Log Messages to Look For

### When a player joins but sees blank screen:
Look for:
- `[Game] CRITICAL: Active game but not started - BLANK SCREEN RISK`
- `[Game] Game is Active - checking player participation`
- `[Game] Player is part of active game - initializing`

### When host doesn't get notification:
Look for:
- `[Page] Player joined game event received`
- `[Page] User is the host - showing notification`
- `[SERVER] Emitting player-joined-game event for host`

### When game state is wrong:
Look for:
- `[Game] Game state transition` (shows full game state)
- `[Lobby] All validation checks passed - joining game`

## Exporting Logs

### From Debug Panel:
Click the "EXPORT" button to download logs as JSON

### From Console:
```javascript
// Get logs
const logs = window.baseballLogs

// Export
const dataStr = JSON.stringify(logs, null, 2)
const dataBlob = new Blob([dataStr], { type: 'application/json' })
const url = URL.createObjectURL(dataBlob)
const link = document.createElement('a')
link.href = url
link.download = `baseball-logs-${Date.now()}.json`
link.click()
```

## Log Levels

- **INFO**: General information about game flow
- **WARN**: Potential issues that don't break functionality
- **ERROR**: Errors that need attention
- **DEBUG**: Detailed debugging information

## Components Being Logged

- `Game`: Game component state and rendering
- `Lobby`: Lobby component and join flow
- `Page`: Main page navigation and notifications
- `Socket`: Socket.io events
- `Transaction`: Blockchain transactions
- `GameState`: Game state transitions

## Troubleshooting

### If logs aren't appearing:
1. Check if debug mode is enabled: `localStorage.getItem('baseball_debug')`
2. Check browser console for any errors
3. Verify you're in development mode or debug is enabled

### If socket events aren't logged:
1. Check server console for socket events
2. Verify socket connection: Look for `[Socket] ← connection` events
3. Check network tab for WebSocket connections

### If game state logs are missing:
1. Verify provider is connected
2. Check for errors in console
3. Look for `[Game] Error loading game` messages


# Client Library Utilities

## Logger

A development-only logging utility that conditionally logs based on the environment.

### Usage

```typescript
import { logger } from '@/lib/logger';

// Basic logging
logger.info('Document uploaded successfully');
logger.error('Failed to parse PDF:', error);
logger.debug('API response:', response);




// Grouped logs
logger.group('User Session');
logger.log('Session ID:', sessionId);
logger.log('User:', user);
logger.groupEnd();
```

### Behavior

- **Development Mode** (`NODE_ENV=development`): All logs are shown
- **Production Mode**: All logs are suppressed

### Methods

- `logger.log()` - General logging
- `logger.info()` - Informational messages
- `logger.warn()` - Warning messages
- `logger.error()` - Error messages
- `logger.debug()` - Debug information
- `logger.table()` - Display data in table format
- `logger.group()` / `logger.groupEnd()` - Group related logs

### Benefits

✅ Cleaner production builds (no console noise)
✅ Easy debugging in development
✅ Consistent logging interface
✅ No need to manually remove console.log statements

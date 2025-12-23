# @inseme/core

**Inseme Core** is a suite of React components and hooks for direct and liquid democracy. It provides a real-time assembly room with AI-powered mediation, video conferencing integration, and advanced voting mechanisms.

## Features

- **InsemeRoom**: A full-featured assembly room component.
- **AI Mediation (Ophélia)**: Proactive, voice-enabled AI mediator (OpenAI GPT-4o & TTS).
- **Video Conferencing**: Native Jitsi Meet integration.
- **Liquid Democracy**: Dynamic vote delegation (`bye` command).
- **Real-time Synchronization**: Powered by Supabase.
- **Markdown Support**: Rich text for chat and propositions.

## Installation

```bash
npm install @inseme/core
```

*Note: This package requires `@supabase/supabase-js`, `react`, `lucide-react`, and `@jitsi/react-sdk` as peer dependencies.*

## Quick Start

```jsx
import { InsemeRoom } from '@inseme/core';
import { supabase } from './your-supabase-client';

function App() {
  const user = { id: '...', user_metadata: { full_name: '...' } };

  return (
    <InsemeRoom 
      roomName="Agora"
      user={user}
      supabase={supabase}
      config={{
        promptUrl: '/prompts/inseme.md',
        opheliaUrl: '/api/ophelia' // Your Netlify Edge Function
      }}
    />
  );
}
```

## Documentation

Detailed documentation is available in the `docs/` folder:
- [Packaging & Integration](./docs/packaging.md)
- [Ophélia Configuration](./docs/ophelia.md)

## License

MIT - See [LICENSE](./LICENSE) for details.

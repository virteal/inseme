// Main Entry Point for Ophelia Brique
export { InsemeRoom } from './components/InsemeRoom';
export { InsemeProvider, useInsemeContext } from './InsemeContext';
export { useInseme } from './hooks/useInseme';

// New AI Modular Components & Hooks
export { default as OpheliaChat } from './components/chat/OpheliaChat';
export { default as useOpheliaChat } from './hooks/useOpheliaChat';
export { default as useAIProviders } from './hooks/useAIProviders';
export { default as useAITools } from './hooks/useAITools';
export * from './lib/aiUtils';

// Export individual components for custom layouts
export { Chat } from './components/Chat';
export { Results } from './components/Results';
export { VoteButtons } from './components/VoteButtons';
export { ModernMediaLayer } from './components/ModernMediaLayer';

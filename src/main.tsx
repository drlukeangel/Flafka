import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { StreamCardPopout } from './components/StreamsPanel/StreamCardPopout'
import './index.css'

/**
 * Detect stream-card popout route BEFORE App mounts.
 * This prevents useRoute() from firing and overwriting the URL.
 * URL: /stream-popout/{topicName} (opened via window.open from ⋮ menu)
 */
function Root() {
  const path = window.location.pathname;
  const match = path.match(/^\/stream-popout\/(.+)$/);
  if (match) {
    const topicName = decodeURIComponent(match[1]);
    return <StreamCardPopout topicName={topicName} />;
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)

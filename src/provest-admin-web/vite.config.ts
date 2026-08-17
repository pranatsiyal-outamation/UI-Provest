import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ngrok hands out different TLDs depending on account and vintage, so allow the lot.
// A leading dot matches any subdomain.
const NGROK_HOSTS = [
  '.ngrok-free.dev',
  '.ngrok-free.app',
  '.ngrok.dev',
  '.ngrok.app',
  '.ngrok.io',
]

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `npm run dev:tunnel` passes --mode tunnel. Only the HMR override needs gating:
  // wss on :443 is correct behind the tunnel and wrong for plain local dev.
  // allowedHosts and host:true are harmless either way, so they always apply --
  // otherwise `ngrok http 5173` fails against a plain `npm run dev` with a
  // "Blocked request" page, which is a confusing way to find out.
  const throughTunnel = mode === 'tunnel'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      allowedHosts: NGROK_HOSTS,

      // Proxying /api means the browser only ever talks to one origin, so there is no
      // CORS configuration anywhere in the API and the session cookie stays
      // same-origin. It also means tunnelling this one port tunnels the whole app.
      proxy: {
        '/api': {
          target: 'https://localhost:7001',
          changeOrigin: true,
          // The API uses the ASP.NET Core development certificate.
          secure: false,
        },
      },

      // Hot reload through the tunnel: the browser connects over TLS on 443, not to
      // the local ws port. Without --mode tunnel, HMR keeps its local defaults; the
      // app still works through ngrok, it just will not live-reload.
      ...(throughTunnel ? { hmr: { protocol: 'wss' as const, clientPort: 443 } } : {}),
    },
  }
})

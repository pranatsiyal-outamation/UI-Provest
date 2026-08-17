import { useCallback, useEffect, useState } from 'react'
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { authApi, type Session } from './api/auth'
import { setUnauthenticatedHandler } from './api/http'
import { LoginPage } from './pages/LoginPage'
import { ClientsPage } from './pages/ClientsPage'
import { ClientLocationsPage } from './pages/ClientLocationsPage'
import { ColumnMappingsPage } from './pages/ColumnMappingsPage'
import { ImportFileHeadersPage } from './pages/ImportFileHeadersPage'
import { ImportUpdatesPage } from './pages/ImportUpdatesPage'

const TABLES = [
  { path: '/clients', label: 'ProVestClient' },
  { path: '/client-locations', label: 'ProVestClientLocation' },
  { path: '/column-mappings', label: 'ProVestColumnMapping' },
  { path: '/import-file-headers', label: 'ImportFileHeader' },
  { path: '/import-updates', label: 'Import_Update' },
]

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  // Ask the server who we are on load. The cookie is HttpOnly, so this is the only
  // way to know whether a session survived a refresh.
  useEffect(() => {
    authApi
      .me()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setChecking(false))
  }, [])

  const signOut = useCallback(() => {
    setSession(null)
    // Drop cached table data so the next user does not briefly see the last one's.
    queryClient.clear()
  }, [queryClient])

  // If any request 401s -- typically an expired cookie -- fall back to the login screen
  // rather than rendering empty grids.
  useEffect(() => {
    setUnauthenticatedHandler(signOut)
    return () => setUnauthenticatedHandler(null)
  }, [signOut])

  if (checking) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!session) {
    return <LoginPage onSignedIn={setSession} />
  }

  const active = TABLES.find((table) => location.pathname.startsWith(table.path))?.path ?? false

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
            ProVest FM Admin
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 2, flexGrow: 1 }}>
            Development database
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {session.displayName}
          </Typography>
          <Button
            size="small"
            startIcon={<LogoutIcon fontSize="small" />}
            onClick={async () => {
              await authApi.logout().catch(() => undefined)
              signOut()
            }}
          >
            Sign out
          </Button>
        </Toolbar>
        <Tabs
          value={active}
          onChange={(_, value) => navigate(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 1, borderTop: 1, borderColor: 'divider' }}
        >
          {TABLES.map((table) => (
            <Tab
              key={table.path}
              value={table.path}
              label={table.label}
              sx={{ textTransform: 'none', fontFamily: 'monospace', fontSize: 13 }}
            />
          ))}
        </Tabs>
      </AppBar>

      <Container maxWidth={false} sx={{ py: 3, flexGrow: 1 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/clients" replace />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/client-locations" element={<ClientLocationsPage />} />
          <Route path="/column-mappings" element={<ColumnMappingsPage />} />
          <Route path="/import-file-headers" element={<ImportFileHeadersPage />} />
          <Route path="/import-updates" element={<ImportUpdatesPage />} />
          <Route path="*" element={<Navigate to="/clients" replace />} />
        </Routes>
      </Container>
    </Box>
  )
}

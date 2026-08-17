import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // These rows drive live importer behaviour, so a stale grid is worse than a
      // slow one. Lookups are cached separately by the pages that use them.
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const theme = createTheme({
  palette: { mode: 'light' },
  typography: {
    fontFamily: ['"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    fontSize: 14,
  },
  components: {
    MuiTableCell: {
      styleOverrides: { root: { paddingTop: 6, paddingBottom: 6 } },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)

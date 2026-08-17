import { Alert, AlertTitle, Box, Typography } from '@mui/material'
import { ApiError } from '../api/http'

interface ErrorBannerProps {
  error: unknown
  onClose?: () => void
}

/**
 * Renders whatever went wrong: the ProblemDetails title and detail from the API,
 * plus any field-level messages it reported.
 */
export function ErrorBanner({ error, onClose }: ErrorBannerProps) {
  if (!error) return null

  if (error instanceof ApiError) {
    const { problem } = error
    const fieldErrors = Object.entries(problem.errors ?? {})

    return (
      <Alert severity={problem.status === 404 ? 'warning' : 'error'} onClose={onClose} sx={{ mb: 2 }}>
        <AlertTitle>{problem.title ?? 'Request failed'}</AlertTitle>
        {problem.detail && <Typography variant="body2">{problem.detail}</Typography>}

        {fieldErrors.length > 0 && (
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2.5 }}>
            {fieldErrors.map(([field, messages]) => (
              <li key={field}>
                <Typography variant="body2">
                  <strong>{field}</strong>: {messages.join(' ')}
                </Typography>
              </li>
            ))}
          </Box>
        )}

        {problem.traceId && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Reference: {problem.traceId}
          </Typography>
        )}
      </Alert>
    )
  }

  return (
    <Alert severity="error" onClose={onClose} sx={{ mb: 2 }}>
      <AlertTitle>Something went wrong</AlertTitle>
      <Typography variant="body2">
        {error instanceof Error ? error.message : String(error)}
      </Typography>
    </Alert>
  )
}

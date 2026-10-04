// Brand marks for the dock, inlined so the CSP needs no new image origins.

export const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
)

export const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="4" fill="#0A66C2" />
    <circle cx="6.6" cy="6.7" r="1.75" fill="#fff" />
    <rect x="5.1" y="9.5" width="3" height="9.5" fill="#fff" />
    <path fill="#fff" d="M10.4 9.5h2.9v1.3c.45-.85 1.6-1.6 3.2-1.6 3.05 0 3.6 1.95 3.6 4.5V19h-3v-4.75c0-1.15-.05-2.6-1.6-2.6-1.6 0-1.9 1.25-1.9 2.5V19h-3.2z" />
  </svg>
)

export const GmailIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M1.6 6.3v11.4c0 .8.6 1.4 1.4 1.4h3.3v-8.6L1.6 7z" />
    <path fill="#34A853" d="M17.7 19.1H21c.8 0 1.4-.6 1.4-1.4V6.3L17.7 10.5z" />
    <path fill="#EA4335" d="M6.3 10.5V5.1L12 9.4l5.7-4.3v5.4L12 14.8z" />
    <path fill="#FBBC04" d="M17.7 5.1v5.4l4.7-3.5V5.6c0-1.6-1.8-2.5-3.1-1.6z" />
    <path fill="#C5221F" d="M1.6 5.6V7l4.7 3.5V5.1L4.7 4c-1.3-1-3.1 0-3.1 1.6z" />
  </svg>
)

export const ChromeIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    {['#DB4437', '#F4B400', '#0F9D58'].map((color, index) => (
      <circle key={color} cx="24" cy="24" r="14.5" fill="none" stroke={color} strokeWidth="19" strokeDasharray="30.4 100" transform={`rotate(${-150 + index * 120} 24 24)`} />
    ))}
    <circle cx="24" cy="24" r="9.5" fill="#fff" />
    <circle cx="24" cy="24" r="7.5" fill="#4285F4" />
  </svg>
)

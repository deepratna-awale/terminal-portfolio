export type ThemeName = 'phosphor' | 'golden' | 'dracula' | 'solarized' | 'gruvbox' | 'nord' | 'paper'

export const themes: Record<ThemeName, { label: string; vars: Record<string, string> }> = {
  phosphor: {
    label: 'Phosphor Green',
    vars: { '--fg': '#c8f7c5', '--muted': '#5f8a63', '--accent': '#39ff88', '--accent-2': '#9dffb0', '--link': '#7fe0ff', '--error': '#ff7b72', '--success': '#39ff88', '--command': '#39ff88', '--code-bg': 'rgba(57,255,136,.08)', '--term-bg': 'rgba(3,10,6,.78)', '--chrome-bg': 'rgba(10,22,14,.85)', '--border': 'rgba(57,255,136,.28)', '--glow': '0 0 6px rgba(57,255,136,.35)' },
  },
  golden: {
    label: 'Golden Hour',
    vars: { '--fg': '#e1dfd6', '--muted': '#777a72', '--accent': '#f3b95e', '--accent-2': '#b5d39d', '--link': '#9dc9ed', '--error': '#ef8f82', '--success': '#8ec07c', '--command': '#f3b95e', '--code-bg': '#292b25', '--term-bg': 'rgba(12,14,22,.64)', '--chrome-bg': 'rgba(36,37,45,.7)', '--border': 'rgba(226,229,255,.22)', '--glow': 'none' },
  },
  dracula: {
    label: 'Dracula',
    vars: { '--fg': '#f8f8f2', '--muted': '#6272a4', '--accent': '#ff79c6', '--accent-2': '#50fa7b', '--link': '#8be9fd', '--error': '#ff5555', '--success': '#50fa7b', '--command': '#bd93f9', '--code-bg': '#44475a', '--term-bg': 'rgba(40,42,54,.86)', '--chrome-bg': 'rgba(33,34,44,.9)', '--border': 'rgba(189,147,249,.3)', '--glow': 'none' },
  },
  solarized: {
    label: 'Solarized Dark',
    vars: { '--fg': '#93a1a1', '--muted': '#586e75', '--accent': '#b58900', '--accent-2': '#2aa198', '--link': '#268bd2', '--error': '#dc322f', '--success': '#859900', '--command': '#cb4b16', '--code-bg': '#073642', '--term-bg': 'rgba(0,43,54,.9)', '--chrome-bg': 'rgba(7,54,66,.92)', '--border': 'rgba(147,161,161,.25)', '--glow': 'none' },
  },
  gruvbox: {
    label: 'Gruvbox',
    vars: { '--fg': '#ebdbb2', '--muted': '#928374', '--accent': '#fabd2f', '--accent-2': '#b8bb26', '--link': '#83a598', '--error': '#fb4934', '--success': '#b8bb26', '--command': '#fe8019', '--code-bg': '#3c3836', '--term-bg': 'rgba(40,40,40,.9)', '--chrome-bg': 'rgba(50,48,47,.92)', '--border': 'rgba(235,219,178,.22)', '--glow': 'none' },
  },
  nord: {
    label: 'Nord',
    vars: { '--fg': '#e5e9f0', '--muted': '#6b7894', '--accent': '#88c0d0', '--accent-2': '#a3be8c', '--link': '#81a1c1', '--error': '#bf616a', '--success': '#a3be8c', '--command': '#ebcb8b', '--code-bg': '#3b4252', '--term-bg': 'rgba(46,52,64,.86)', '--chrome-bg': 'rgba(59,66,82,.9)', '--border': 'rgba(136,192,208,.28)', '--glow': 'none' },
  },
  paper: {
    label: 'Paper (light)',
    vars: { '--fg': '#2d2a24', '--muted': '#8a8577', '--accent': '#b5541b', '--accent-2': '#2f7d32', '--link': '#1f5fa8', '--error': '#b3261e', '--success': '#2f7d32', '--command': '#b5541b', '--code-bg': '#ece6d6', '--term-bg': 'rgba(250,247,238,.94)', '--chrome-bg': 'rgba(236,231,218,.95)', '--border': 'rgba(60,50,30,.22)', '--glow': 'none' },
  },
}

export const themeNames = Object.keys(themes) as ThemeName[]
export const isThemeName = (value: string): value is ThemeName => value in themes

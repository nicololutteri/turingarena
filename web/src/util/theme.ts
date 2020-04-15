const bootstrap = {
  blue: '#0d6efd',
  indigo: '#6610f2',
  purple: '#6f42c1',
  pink: '#d63384',
  red: '#dc3545',
  orange: '#fd7e14',
  yellow: '#ffc107',
  green: '#28a745',
  teal: '#20c997',
  cyan: '#17a2b8',
  white: '#ffffff',
  gray100: '#f8f9fa',
  gray200: '#e9ecef',
  gray300: '#dee2e6',
  gray400: '#ced4da',
  gray500: '#adb5bd',
  gray600: '#6c757d',
  gray700: '#495057',
  gray800: '#343a40',
  gray900: '#212529',
  black: '#000000',
};

export const Theme = {
  colors: {
    ...bootstrap,
    primary: '#0275d8',
    secondary: bootstrap.gray600,
    success: bootstrap.green,
    info: bootstrap.cyan,
    warning: bootstrap.yellow,
    danger: bootstrap.red,
    dark: bootstrap.gray800,
    light: bootstrap.gray100,
    gray: bootstrap.gray600,
    grayDark: bootstrap.gray800,
  },
  fontSizes: {
    small: 14,
    medium: 16,
    big: 20,
  },
};
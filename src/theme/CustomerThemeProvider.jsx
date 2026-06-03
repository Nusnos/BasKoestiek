import React, { createContext, useContext, useMemo } from 'react';
import { defaultCustomerTheme } from '../data/customerThemes.js';

const CustomerThemeContext = createContext(defaultCustomerTheme);

export function useCustomerTheme() {
  return useContext(CustomerThemeContext);
}

function createThemeStyle(config) {
  return {
    '--primary-color': config.primaryColor,
    '--secondary-color': config.secondaryColor,
    '--accent-color': config.accentColor,
    '--background-color': config.backgroundColor,
    '--text-color': config.textColor,
    '--button-color': config.buttonColor,
    '--button-text-color': config.buttonTextColor,
    '--font-family': config.fontFamily,
    '--brand-blue': 'var(--primary-color)',
    '--brand-gray': 'var(--text-color)',
    '--muted-gray': 'var(--secondary-color)',
    '--surface': 'var(--background-color)',
  };
}

export default function CustomerThemeProvider({ config = defaultCustomerTheme, mode = 'app', children }) {
  const themeStyle = useMemo(() => createThemeStyle(config), [config]);

  return (
    <CustomerThemeContext.Provider value={config}>
      <div className={`tenantShell tenant-${mode}`} style={themeStyle}>
        {children}
      </div>
    </CustomerThemeContext.Provider>
  );
}

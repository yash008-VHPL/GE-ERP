import type { ThemeConfig } from 'antd';

export const geTheme: ThemeConfig = {
  token: {
    colorPrimary:    '#1B2A4A',   // GIIAVA navy
    colorLink:       '#B8860B',   // gold
    colorSuccess:    '#389e0d',
    colorWarning:    '#d48806',
    colorError:      '#cf1322',
    borderRadius:    4,
    fontFamily:      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    Layout: {
      siderBg:     '#1B2A4A',
      triggerBg:   '#132039',
    },
    Menu: {
      darkItemBg:           '#1B2A4A',
      darkSubMenuItemBg:    '#132039',
      darkItemSelectedBg:   '#B8860B',
    },
    Table: {
      headerBg:    '#1B2A4A',
      headerColor: '#FFFFFF',
    },
  },
};

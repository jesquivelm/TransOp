import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TabsContext = createContext(null);
const isRenderableIcon = (icon) => (
  typeof icon === 'function' ||
  Boolean(icon && typeof icon === 'object' && icon.$$typeof)
);
const sanitizeTab = (tab) => {
  if (!tab || typeof tab !== 'object') return null;
  return {
    ...tab,
    icon: isRenderableIcon(tab.icon) ? tab.icon : null,
  };
};
const serializeTab = (tab) => {
  if (!tab || typeof tab !== 'object') return null;
  const { icon: _ICON, ...rest } = tab;
  return rest;
};
const stableSerialize = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

export function TabsProvider({ children }) {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [tabsData, setTabsData] = useState({});

  // Cargar pestañas desde localStorage al iniciar
  useEffect(() => {
    try {
      const savedTabs = localStorage.getItem('tms_global_tabs');
      const savedData = localStorage.getItem('tms_global_tabs_data');
      const savedActiveTabId = localStorage.getItem('tms_global_active_tab');
      if (savedTabs) {
        const parsedTabs = JSON.parse(savedTabs)
          .map(sanitizeTab)
          .filter(Boolean);
        if (parsedTabs && parsedTabs.length > 0) {
          setTabs(parsedTabs);
          setTabsData(savedData ? JSON.parse(savedData) : {});
          const nextActiveId = parsedTabs.some(tab => tab.id === savedActiveTabId)
            ? savedActiveTabId
            : (parsedTabs[0]?.id || null);
          setActiveTabId(nextActiveId);
        }
      }
    } catch (e) {
      console.error('Error cargando pestañas:', e);
    }
  }, []);

  // Guardar pestañas en localStorage cuando cambian
  useEffect(() => {
    if (tabs.length > 0) {
      localStorage.setItem('tms_global_tabs', JSON.stringify(tabs.map(serializeTab).filter(Boolean)));
      localStorage.setItem('tms_global_tabs_data', JSON.stringify(tabsData));
      if (activeTabId) {
        localStorage.setItem('tms_global_active_tab', activeTabId);
      }
    } else {
      localStorage.removeItem('tms_global_tabs');
      localStorage.removeItem('tms_global_tabs_data');
      localStorage.removeItem('tms_global_active_tab');
    }
  }, [activeTabId, tabs, tabsData]);

  const openTab = useCallback((tabConfig) => {
    const normalizedTab = sanitizeTab(tabConfig);
    if (!normalizedTab) return;
    setTabs(prev => {
      const exists = prev.find(tab => tab.id === normalizedTab.id);
      if (exists) {
        // Si ya existe, actualizar y activar
        setActiveTabId(normalizedTab.id);
        return prev.map(tab => (tab.id === normalizedTab.id ? { ...tab, ...normalizedTab } : tab));
      }
      // Si no existe, agregar
      const newTabs = [...prev, normalizedTab];
      setActiveTabId(normalizedTab.id);
      return newTabs;
    });
  }, []);

  const closeTab = useCallback((tabId) => {
    setTabs(prev => {
      const filtered = prev.filter(tab => tab.id !== tabId);
      // Si cerramos la pestaña activa, activar la anterior o la siguiente
      if (activeTabId === tabId) {
        if (filtered.length > 0) {
          const index = prev.findIndex(tab => tab.id === tabId);
          const nextActive = filtered[index - 1]?.id || filtered[0]?.id || null;
          setActiveTabId(nextActive);
        } else {
          setActiveTabId(null);
        }
      }
      return filtered;
    });
    setTabsData(prev => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
  }, [activeTabId]);

  const activateTab = useCallback((tabId) => {
    setActiveTabId(tabId);
  }, []);

  const updateTabData = useCallback((tabId, data) => {
    setTabsData(prev => {
      const nextEntry = {
        ...(prev[tabId] || {}),
        ...(data || {}),
      };
      if (stableSerialize(prev[tabId]) === stableSerialize(nextEntry)) {
        return prev;
      }
      return {
        ...prev,
        [tabId]: nextEntry,
      };
    });
  }, []);

  const getTabData = useCallback((tabId) => {
    return tabsData[tabId];
  }, [tabsData]);

  const value = {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    activateTab,
    updateTabData,
    getTabData,
    tabsData
  };

  return (
    <TabsContext.Provider value={value}>
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('useTabs debe ser usado dentro de TabsProvider');
  }
  return context;
}

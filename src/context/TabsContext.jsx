import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

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
  const { user, isAuthenticated } = useAuth();
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [tabsData, setTabsData] = useState({});
  const [tabsReady, setTabsReady] = useState(false);
  const rememberTabs = Boolean(user?.recordar_tabs);
  const userScope = user?.id ? `user:${user.id}` : 'guest';
  const tabsKey = `tms_global_tabs:${userScope}`;
  const dataKey = `tms_global_tabs_data:${userScope}`;
  const activeKey = `tms_global_active_tab:${userScope}`;

  useEffect(() => {
    setTabs([]);
    setTabsData({});
    setActiveTabId(null);
    setTabsReady(false);
    if (!isAuthenticated) {
      setTabsReady(true);
      return;
    }
    if (!rememberTabs) {
      setTabsReady(true);
      return;
    }
    try {
      const savedTabs = localStorage.getItem(tabsKey);
      const savedData = localStorage.getItem(dataKey);
      const savedActiveTabId = localStorage.getItem(activeKey);
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
    } finally {
      setTabsReady(true);
    }
  }, [activeKey, dataKey, isAuthenticated, rememberTabs, tabsKey]);

  useEffect(() => {
    if (!isAuthenticated || !rememberTabs) {
      localStorage.removeItem(tabsKey);
      localStorage.removeItem(dataKey);
      localStorage.removeItem(activeKey);
      return;
    }
    if (tabs.length > 0) {
      localStorage.setItem(tabsKey, JSON.stringify(tabs.map(serializeTab).filter(Boolean)));
      localStorage.setItem(dataKey, JSON.stringify(tabsData));
      if (activeTabId) localStorage.setItem(activeKey, activeTabId);
    } else {
      localStorage.removeItem(tabsKey);
      localStorage.removeItem(dataKey);
      localStorage.removeItem(activeKey);
    }
  }, [activeKey, activeTabId, dataKey, isAuthenticated, rememberTabs, tabs, tabsData, tabsKey]);

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

  const resetTabs = useCallback(() => {
    setTabs([]);
    setTabsData({});
    setActiveTabId(null);
  }, []);

  const value = {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    activateTab,
    updateTabData,
    getTabData,
    tabsData,
    resetTabs,
    tabsReady,
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

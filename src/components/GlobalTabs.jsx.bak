import { createElement, useEffect, useMemo, useState } from 'react';
import { useTabs } from '../context/TabsContext';
import { T } from '../theme';

export default function GlobalTabs() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabs();
  const [maxVisible, setMaxVisible] = useState(6);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const updateLimit = () => {
      const width = window.innerWidth;
      if (width < 980) setMaxVisible(3);
      else if (width < 1220) setMaxVisible(4);
      else if (width < 1460) setMaxVisible(5);
      else if (width < 1680) setMaxVisible(6);
      else setMaxVisible(7);
    };
    updateLimit();
    window.addEventListener('resize', updateLimit);
    return () => window.removeEventListener('resize', updateLimit);
  }, []);

  const visibleTabs = useMemo(() => tabs.slice(0, maxVisible), [maxVisible, tabs]);
  const hiddenTabs = useMemo(() => tabs.slice(maxVisible), [maxVisible, tabs]);

  if (tabs.length === 0) return null;

  const renderTab = (tab) => {
    const isActive = tab.id === activeTabId;
    const canClose = tab.closable !== false;
    const canRenderIcon = typeof tab.icon === 'function' || Boolean(tab.icon && typeof tab.icon === 'object' && tab.icon.$$typeof);

    return (
      <div
        key={tab.id}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 12,
          border: `1px solid ${isActive ? `${T.AMB}55` : T.bdr}`,
          background: isActive ? T.ambDim : T.card,
          color: isActive ? T.AMB : T.sub,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: isActive ? 800 : 600,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        onClick={() => activateTab(tab.id)}
      >
        {canRenderIcon ? createElement(tab.icon, { size: 14, style: { flexShrink: 0 } }) : null}
        <span>{tab.label}</span>
        {canClose && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            style={{
              width: 18,
              height: 18,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              background: isActive ? `${T.AMB}22` : T.card2,
              color: isActive ? T.AMB : T.mute,
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ×
          </span>
        )}
      </div>
    );
  };

  return (
    <div 
      style={{ 
        display: 'flex',
        alignItems: 'center',
        flex: '1 1 auto',
        width: '100%',
        minHeight: '100%',
        padding: '0 28px',
        boxSizing: 'border-box',
        minWidth: 0,
        overflow: 'visible',
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: '1 1 auto',
          minWidth: 0,
          overflow: 'visible',
        }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: '1 1 auto',
            minWidth: 0,
            maxWidth: '100%',
            overflowX: 'auto',
            overflowY: 'visible',
          padding: '0 0 1px',
          boxSizing: 'border-box',
          position: 'relative',
        }}>
          {visibleTabs.map(renderTab)}
        </div>
        {hiddenTabs.length > 0 && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setMenuOpen(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 12,
                border: `1px solid ${T.bdr}`,
                background: T.card2,
                color: T.sub,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              <span>Más</span>
              <span style={{ padding: '1px 7px', borderRadius: 999, background: T.ambDim, color: T.AMB, fontSize: 11, fontWeight: 800 }}>
                {hiddenTabs.length}
              </span>
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 240, maxWidth: 320, background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, boxShadow: '0 18px 40px rgba(15,23,42,0.18)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 100 }}>
                {hiddenTabs.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      activateTab(tab.id);
                      setMenuOpen(false);
                    }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 12px', borderRadius:10, border:'none', background: tab.id === activeTabId ? T.ambDim : T.card2, color: tab.id === activeTabId ? T.AMB : T.sub, cursor:'pointer', fontSize:12, fontWeight:700, textAlign:'left' }}
                  >
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tab.label}</span>
                    <span style={{ color:T.mute, fontSize:11 }}>#{tabs.findIndex(item => item.id === tab.id) + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

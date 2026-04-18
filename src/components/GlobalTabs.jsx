import { createElement } from 'react';
import { useTabs } from '../context/TabsContext';
import { T } from '../theme';

export default function GlobalTabs() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabs();

  if (tabs.length === 0) return null;

  return (
    <div 
      style={{ 
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        padding: '8px 0 0',
        boxSizing: 'border-box',
        minWidth: 0,
        background: T.card,
        borderBottom: `1px solid ${T.bdr}`,
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
          maxWidth: '100%',
          overflowX: 'auto',
          padding: '0 28px 1px',
          boxSizing: 'border-box',
        }}>
        {tabs.map(tab => {
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
        })}
      </div>
      <div style={{ flex: '1 1 auto', minWidth: 0, background: T.card }} />
    </div>
  );
}

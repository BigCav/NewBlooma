/** Class for a phone page root: the normal phone page, or (on desktop) just its overlays as a right-hand drawer. */
export const rootCls = (drawer?: boolean) => (drawer ? 'm-cal cal-root m-drawer' : 'only-m m-cal cal-root');

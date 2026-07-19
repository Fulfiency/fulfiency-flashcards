const S = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const IconDecks = () => (
  <svg {...S}><rect x="3" y="5" width="14" height="16" rx="2"/><path d="M7 5V3.5A1.5 1.5 0 018.5 2h7A1.5 1.5 0 0117 3.5V5"/><path d="M21 8v10.5a1.5 1.5 0 01-1.5 1.5H17"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="14" x2="11" y2="14"/></svg>
);

export const IconCreate = () => (
  <svg {...S}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
);

export const IconBrowse = () => (
  <svg {...S}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
);

export const IconStats = () => (
  <svg {...S}><path d="M3 20h18"/><rect x="5" y="12" width="3" height="8" rx="1"/><rect x="10.5" y="6" width="3" height="14" rx="1"/><rect x="16" y="9" width="3" height="11" rx="1"/></svg>
);

export const IconBadges = () => (
  <svg {...S}><circle cx="12" cy="9" r="6"/><path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5"/><path d="M12 6v1"/><path d="M9.5 8.5L12 10l2.5-1.5"/></svg>
);

export const IconSettings = () => (
  <svg {...S}><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>
);

export const IconMember = () => (
  <svg {...S}><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7"/></svg>
);

export const IconQuiz = () => (
  <svg {...S}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2 2-2 3.5"/><path d="M12 16.5h.01"/></svg>
);

export const IconSearch = () => (
  <svg {...S}><circle cx="10" cy="10" r="7"/><path d="M17 17l4 4"/></svg>
);

export const IconFlashcard = () => (
  <svg {...S}><rect x="2" y="4" width="16" height="13" rx="2"/><path d="M6 4V2.5A1.5 1.5 0 017.5 1h9A1.5 1.5 0 0118 2.5V4"/><path d="M22 7v8.5a1.5 1.5 0 01-1.5 1.5H18"/><circle cx="10" cy="10.5" r="2.5"/><path d="M7 15h6"/></svg>
);

export const IconHome = () => (
  <svg {...S}><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V19a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1V9.5"/></svg>
);

export const IconTarget = () => (
  <svg {...S}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>
);

export const IconFlame = () => (
  <svg {...S}><path d="M12 22c4-2 7-6 7-10 0-5-3-8-5-10-1 3-2 4-4 4-2 0-3-2-3-2s-2 3-2 6c0 5 3 9 7 12z"/></svg>
);

export const IconTimer = () => (
  <svg {...S}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M10 2h4"/><path d="M12 2v2"/></svg>
);

export const IconCalendar = () => (
  <svg {...S}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4m8-4v4M3 9h18"/><path d="M7 13h2m4 0h2m-8 4h2m4 0h2"/></svg>
);

export const IconProfile = () => (
  <svg {...S}><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7"/></svg>
);

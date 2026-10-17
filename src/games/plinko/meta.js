// Plinko: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Plinko',       hint: 'Drop from an open slot. Race to the target' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const explainer = { name: 'Plinko', play: 'Drop the chip from an open slot. The bins are worth 5, 3, 3, 2, 2, 1 and 1 points, and the gold bonus peg adds 2 (a new one appears once it is hit). A slot used by either player stays locked until all seven are used.', win: 'First to the target score (12 unless the admin changed it).' };
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="3.5" r="2.2"/><circle cx="7" cy="9" r="1.5"/><circle cx="12" cy="9" r="1.5"/><circle cx="17" cy="9" r="1.5"/><circle cx="9.5" cy="14" r="1.5"/><circle cx="14.5" cy="14" r="1.5"/><path d="M3 18.5h18v3H3z"/><path d="M11 18.5h2v3h-2z" fill="var(--paper)"/></svg>';
export const PLINKO_DEFAULTS = { target: 12 };

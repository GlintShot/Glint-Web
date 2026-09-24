/**
 * Named background themes + curated palettes for ThemeSelector / brand mood.
 * Gradients use Fabric colorStops { offset, color }.
 */

export const BACKGROUND_THEMES = [
  { label: 'Charcoal', type: 'solid', value: '#1C1C1E' },
  { label: 'Midnight', type: 'solid', value: '#0B0D10' },
  { label: 'Slate', type: 'solid', value: '#2C2C2E' },
  { label: 'Ocean', type: 'solid', value: '#0F2744' },
  { label: 'Forest', type: 'solid', value: '#1A2F23' },
  { label: 'Snow', type: 'solid', value: '#F5F5F7' },
  { label: 'White', type: 'solid', value: '#FFFFFF' },
  { label: 'Sand', type: 'solid', value: '#F0EBE3' },
  { label: 'Lavender', type: 'solid', value: '#EDE7F6' },
  { label: 'Mint', type: 'solid', value: '#E0F2F1' },
  {
    label: 'Graphite',
    type: 'gradient',
    value: [
      { offset: 0, color: '#2A2D34' },
      { offset: 1, color: '#12151A' },
    ],
  },
  {
    label: 'Soft Blue',
    type: 'gradient',
    value: [
      { offset: 0, color: '#E8F1F8' },
      { offset: 1, color: '#D4E4F0' },
    ],
  },
  {
    label: 'Warm',
    type: 'gradient',
    value: [
      { offset: 0, color: '#FF8A5C' },
      { offset: 1, color: '#FFB347' },
    ],
  },
  {
    label: 'Amber',
    type: 'gradient',
    value: [
      { offset: 0, color: '#2A2118' },
      { offset: 1, color: '#1A1510' },
    ],
  },
  {
    label: 'Coral Bloom',
    type: 'gradient',
    value: [
      { offset: 0, color: '#FF6B6B' },
      { offset: 1, color: '#FF8E53' },
    ],
  },
  {
    label: 'Ocean Blue',
    type: 'gradient',
    value: [
      { offset: 0, color: '#1B4F72' },
      { offset: 1, color: '#5DADE2' },
    ],
  },
  {
    label: 'Fresh Mint',
    type: 'gradient',
    value: [
      { offset: 0, color: '#A8E6CF' },
      { offset: 1, color: '#DCEDC8' },
    ],
  },
  {
    label: 'Electric Violet',
    type: 'gradient',
    value: [
      { offset: 0, color: '#7C3AED' },
      { offset: 1, color: '#A78BFA' },
    ],
  },
  {
    label: 'Citrus',
    type: 'gradient',
    value: [
      { offset: 0, color: '#F7DC6F' },
      { offset: 1, color: '#F5B041' },
    ],
  },
  {
    label: 'Aurora',
    type: 'gradient',
    value: [
      { offset: 0, color: '#C4B5FD' },
      { offset: 0.5, color: '#A5F3FC' },
      { offset: 1, color: '#FBCFE8' },
    ],
  },
  {
    label: 'Meadow',
    type: 'gradient',
    value: [
      { offset: 0, color: '#86EFAC' },
      { offset: 1, color: '#BBF7D0' },
    ],
  },
  {
    label: 'Sorbet',
    type: 'gradient',
    value: [
      { offset: 0, color: '#FDA4AF' },
      { offset: 1, color: '#FDE68A' },
    ],
  },
  {
    label: 'Lavender Sky',
    type: 'gradient',
    value: [
      { offset: 0, color: '#DDD6FE' },
      { offset: 1, color: '#E0E7FF' },
    ],
  },
  {
    label: 'Royal Blue',
    type: 'gradient',
    value: [
      { offset: 0, color: '#1E3A8A' },
      { offset: 1, color: '#3B82F6' },
    ],
  },
  {
    label: 'Midnight Ink',
    type: 'gradient',
    value: [
      { offset: 0, color: '#0F172A' },
      { offset: 1, color: '#1E293B' },
    ],
  },
  {
    label: 'Golden Dawn',
    type: 'gradient',
    value: [
      { offset: 0, color: '#F59E0B' },
      { offset: 1, color: '#FEF3C7' },
    ],
  },
  {
    label: 'Arctic Ice',
    type: 'gradient',
    value: [
      { offset: 0, color: '#E0F2FE' },
      { offset: 1, color: '#F8FAFC' },
    ],
  },
  {
    label: 'Ember',
    type: 'gradient',
    value: [
      { offset: 0, color: '#7F1D1D' },
      { offset: 1, color: '#EA580C' },
    ],
  },
];

/** Curated palettes: apply as Primary / Secondary / Accent suggestions. */
export const COLOR_PALETTES = [
  { id: 'sky', label: 'Sky', colors: ['#0EA5E9', '#38BDF8', '#E0F2FE'] },
  { id: 'ocean', label: 'Ocean', colors: ['#0369A1', '#0EA5E9', '#67E8F9'] },
  { id: 'mint', label: 'Mint', colors: ['#059669', '#34D399', '#A7F3D0'] },
  { id: 'forest', label: 'Forest', colors: ['#166534', '#22C55E', '#BBF7D0'] },
  { id: 'lavender', label: 'Lavender', colors: ['#7C3AED', '#A78BFA', '#EDE9FE'] },
  { id: 'grape', label: 'Grape', colors: ['#6B21A8', '#C084FC', '#F3E8FF'] },
  { id: 'coral', label: 'Coral', colors: ['#E11D48', '#FB7185', '#FFE4E6'] },
  { id: 'sunset', label: 'Sunset', colors: ['#EA580C', '#FB923C', '#FED7AA'] },
  { id: 'gold', label: 'Gold', colors: ['#B45309', '#F5D06F', '#0B0D10'] },
  { id: 'noir', label: 'Noir', colors: ['#F8FAFC', '#94A3B8', '#0F172A'] },
  { id: 'aurora', label: 'Aurora', colors: ['#8B5CF6', '#22D3EE', '#F472B6'] },
  { id: 'berry', label: 'Berry', colors: ['#9D174D', '#EC4899', '#FBCFE8'] },
  { id: 'slate', label: 'Slate', colors: ['#334155', '#64748B', '#F1F5F9'] },
  { id: 'tropic', label: 'Tropic', colors: ['#0D9488', '#2DD4BF', '#CCFBF1'] },
  { id: 'ember', label: 'Ember', colors: ['#991B1B', '#F97316', '#FEF3C7'] },
  { id: 'ice', label: 'Ice', colors: ['#0284C7', '#7DD3FC', '#F0F9FF'] },
];

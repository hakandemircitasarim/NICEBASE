// Icon generation utility
// In production, replace these with actual PNG files
// For now, we'll use SVG data URLs

export function generateIcon(size: number): string {
  // This is a placeholder - replace with actual icon generation or use real PNG files
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#FF6B35"/>
      <path d="M${size * 0.25} ${size * 0.25}L${size * 0.35} ${size * 0.4}L${size * 0.25} ${size * 0.55}L${size * 0.4} ${size * 0.55}L${size * 0.5} ${size * 0.7}L${size * 0.6} ${size * 0.55}L${size * 0.75} ${size * 0.55}L${size * 0.65} ${size * 0.4}L${size * 0.75} ${size * 0.25}L${size * 0.6} ${size * 0.25}L${size * 0.5} ${size * 0.1}L${size * 0.4} ${size * 0.25}L${size * 0.25} ${size * 0.25}Z" fill="white"/>
    </svg>
  `.trim()
  
  return `data:image/svg+xml;base64,${btoa(svg)}`
}














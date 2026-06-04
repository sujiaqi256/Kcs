export function formatTime(ts: string): string {
  if (!ts) return ''
  const utc = ts.endsWith('Z') ? ts : ts + 'Z'
  const diff = (Date.now() - new Date(utc).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`
  const d = new Date(utc)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()} 周${'日一二三四五六'[d.getDay()]}`
}

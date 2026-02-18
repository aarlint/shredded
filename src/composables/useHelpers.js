export function today() {
  return new Date().toISOString().split('T')[0]
}

export function getInitials(name) {
  if (!name) return ''
  return name
    .split(/[\s._-]+/)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

export function formatDate(d) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateFull(d) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function timeAgo(iso) {
  const d = new Date(iso + 'Z')
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return Math.floor(diff / 86400) + 'd ago'
}

export function isVideoFile(filename) {
  return /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(filename)
}

export function mediaUrl(filename) {
  return '/api/uploads/' + encodeURIComponent(filename)
}

export function avatarUrl(filename) {
  return '/api/uploads/' + encodeURIComponent(filename)
}

export function avatarStyle(color) {
  if (!color) return ''
  return 'background:' + color
}

export function showLightbox(src, isVideo) {
  const overlay = document.createElement('div')
  overlay.className = 'media-lightbox'
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove()
  }
  if (isVideo) {
    const closeBtn = document.createElement('button')
    closeBtn.className = 'media-lightbox-close'
    closeBtn.textContent = '\u00D7'
    closeBtn.onclick = () => overlay.remove()
    const video = document.createElement('video')
    video.src = src
    video.controls = true
    video.autoplay = true
    video.style.cssText =
      'max-width:90vw;max-height:90vh;border-radius:var(--radius)'
    overlay.appendChild(closeBtn)
    overlay.appendChild(video)
  } else {
    const closeBtn = document.createElement('button')
    closeBtn.className = 'media-lightbox-close'
    closeBtn.textContent = '\u00D7'
    closeBtn.onclick = () => overlay.remove()
    const img = document.createElement('img')
    img.src = src
    img.alt = 'Lift media'
    overlay.appendChild(closeBtn)
    overlay.appendChild(img)
  }
  document.body.appendChild(overlay)
  const handler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove()
      document.removeEventListener('keydown', handler)
    }
  }
  document.addEventListener('keydown', handler)
}

export function confetti() {
  const colors = [
    '#c8a44e',
    '#4e8cff',
    '#3ec97a',
    '#e54545',
    '#e8d5a0',
    '#f0eff4',
  ]
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div')
    piece.className = 'confetti-piece'
    piece.style.left = Math.random() * 100 + 'vw'
    piece.style.top = '-10px'
    piece.style.background =
      colors[Math.floor(Math.random() * colors.length)]
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px'
    piece.style.animationDuration = 1 + Math.random() * 1.5 + 's'
    piece.style.animationDelay = Math.random() * 0.5 + 's'
    piece.style.width = 6 + Math.random() * 6 + 'px'
    piece.style.height = 6 + Math.random() * 6 + 'px'
    document.body.appendChild(piece)
    setTimeout(() => piece.remove(), 3000)
  }
  for (let i = 0; i < 20; i++) {
    const spark = document.createElement('div')
    spark.className = 'confetti-sparkle'
    spark.style.left = 20 + Math.random() * 60 + 'vw'
    spark.style.top = 10 + Math.random() * 40 + 'vh'
    spark.style.animationDelay = Math.random() * 0.6 + 's'
    document.body.appendChild(spark)
    setTimeout(() => spark.remove(), 1500)
  }
}

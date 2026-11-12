// Emoji palette for the online chat, plus the "emoji-only message"
// detector used to render 1-3 emoji messages big (sticker style).
// This file is duplicated in taojie-pc-overseas and taojie-overseas-admin
// (src/emojis.js in both) — keep the two copies identical.

// 笑脸类
const FACES = [
  '😀', '😄', '😁', '😂', '🤣', '😊', '😉', '😍', '😘', '🤩',
  '😎', '🤔', '😐', '😴', '😅', '😆', '😋', '😜', '😌', '🤤',
  '🥳', '😷', '🤒', '🤯'
]
// 手势类
const HANDS = ['👍', '👎', '👏', '🙏', '🤝', '👋', '👌', '✌️', '💪', '🙌', '🤞', '✋']
// 爱心 / 庆祝 / 商务常用
const MISC = [
  '❤️', '🧡', '💙', '💚', '💜', '🤍', '🎉', '🎊', '🎁', '🔥',
  '⭐', '✅', '🚗', '🎨', '📦', '💰', '📞', '✉️', '☎️'
]

export const EMOJIS = [...FACES, ...HANDS, ...MISC]

// True when the whole message is just 1-3 emoji (after trimming) — those
// render large with no bubble background, like a WeChat sticker emoji.
export function isEmojiOnlyMessage(body) {
  const text = String(body || '').trim()
  if (!text) return false
  // Keycap sequences (e.g. 1️⃣) count as one emoji: collapse each to a
  // single pictograph first so bare digits are not mistaken for emoji.
  const collapsed = text.replace(/[0-9#*]\uFE0F?\u20E3/g, '🔑')
  // Every remaining character must be emoji-related (pictographs, skin
  // tone modifiers, regional indicators, variation selectors, ZWJ,
  // whitespace).
  if (!/^[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\s]+$/u.test(collapsed)) return false
  const compact = collapsed.replace(/\s+/g, '')
  let count
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    count = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(compact)].length
  } else {
    count = [...compact.replace(/[\uFE0F\u200D]/g, '')].length
  }
  return count >= 1 && count <= 3
}

import type { PictureRef } from '../../domain/types.ts'

// Emoji stand-ins looked up by illustration key; real illustrations replace this one module (DESIGN.md, Deferred).
const ILLUSTRATIONS: Readonly<Record<string, string>> = {
  plassen: '🚽',
  aankleden: '👕',
  ontbijten: '🥣',
  tanden: '🪥',
  turnzak: '🤸',
  schoenen: '👟',
  jas: '🧥',
  'avatar-zoon': '👦',
  'avatar-dochter': '👧',
}

const COMPANIONS: Readonly<Record<string, string>> = {
  egel: '🦔',
  muis: '🐭',
  vos: '🦊',
  konijn: '🐰',
  uil: '🦉',
  schildpad: '🐢',
}

const FALLBACK_TASK = '⭐'
const FALLBACK_AVATAR = '🙂'

export const FLOWER = '🌼'
export const CAR = '🚗'
export const SLEEPING = '💤'
export const SPARKLES = '✨'
export const NUDGE_FLAG = '👟🧥'

// Photos live in the media table (AD-7) and are shown once the parent screens can add them.
function illustrationOf(picture: PictureRef | undefined, fallback: string): string {
  return picture?.kind === 'illustration' ? (ILLUSTRATIONS[picture.key] ?? fallback) : fallback
}

export const taskPicture = (picture: PictureRef | undefined): string => illustrationOf(picture, FALLBACK_TASK)

export const avatarPicture = (picture: PictureRef | undefined): string => illustrationOf(picture, FALLBACK_AVATAR)

export const companionPicture = (companionId: string): string => COMPANIONS[companionId] ?? COMPANIONS.egel

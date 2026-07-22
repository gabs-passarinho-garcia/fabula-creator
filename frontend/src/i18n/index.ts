import ptData from '../data/pt.json';
import enData from '../data/en.json';
import { en } from './en.ts';
import { pt } from './pt.ts';
import type { Locale, LocaleStrings } from './types.ts';
import type { CharacterCreationData } from '../types.ts';

const translations: Record<Locale, LocaleStrings> = { pt, en };

const gameData: Record<Locale, CharacterCreationData> = {
  pt: ptData as unknown as CharacterCreationData,
  en: enData as unknown as CharacterCreationData,
};

/**
 * Resolves and returns the UI locale strings based on the active language.
 * @param locale - Active language code
 */
export const getLocaleStrings = (locale: Locale): LocaleStrings => translations[locale];

/**
 * Resolves and returns the character creation game data based on the active language.
 * @param locale - Active language code
 */
export const getGameData = (locale: Locale): CharacterCreationData => gameData[locale];

export type { Locale, LocaleStrings };
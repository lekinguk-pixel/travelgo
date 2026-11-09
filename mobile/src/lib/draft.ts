import { DEFAULT_AVATAR, type Avatar } from './avatar';

/** The traveller being created during sign-up, kept between the onboarding screens. */
export const travellerDraft: { name: string; dateOfBirth: string; avatar: Avatar } = {
  name: '',
  dateOfBirth: '',
  avatar: { ...DEFAULT_AVATAR },
};

/** The email address the sign-in code was sent to. */
export const signInDraft = { email: '' };

/** Result of the last stamp claim, shown on the stamp-collected screen. */
export type StampReward = {
  stamp_id: number;
  status: 'verified' | 'pending_review';
  landmark: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  distance_m: number;
  message: string;
  photoUri?: string;
  rewards: null | {
    xp_total: number;
    km_travelled: number;
    skills: { skill: string; xp: number; level_before: number; level_after: number }[];
    city: { city_id: number; stamped: number; major_landmarks: number };
    new_city_tiers: string[];
    quests_completed: string[];
  };
};
export const lastStamp: { value: StampReward | null } = { value: null };

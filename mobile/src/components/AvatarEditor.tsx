import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Character } from '@/components/Character';
import { ART, CLOTH_COLORS, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, type Avatar, type BodyStyle, type Slot } from '@/lib/avatar';
import { supabase } from '@/lib/supabase';
import { colors, fonts, hardShadow, rarityColor, type Rarity } from '@/lib/theme';

export type WardrobeItem = {
  key: string; name: string; slot: Slot; rarity: Rarity; source: 'starter' | 'landmark' | 'journey';
  price_coins: number | null; colorable: boolean; description: string | null; owned: boolean;
  landmark_id: number | null; landmark_name: string | null; city_name: string | null;
};

const TABS = ['Body', 'Hair', 'Clothes', 'Extras'] as const;
const BODY: { key: BodyStyle; label: string }[] = [{ key: 'masc', label: 'Masculine' }, { key: 'neutral', label: 'Neutral' }, { key: 'fem', label: 'Feminine' }];
const HAIR_LABEL: Record<string, string> = { none: 'Bald', buzz: 'Buzz', short: 'Short', curly: 'Curly', long: 'Long', bob: 'Bob', bun: 'Bun', afro: 'Afro' };
const SLOT_LABEL: Record<Slot, string> = { top: 'Top', bottom: 'Bottoms', shoes: 'Shoes', hat: 'Hat', neck: 'Neck', pack: 'Bag' };

/** Pick body, skin, hair and clothing. Locked items show how to unlock them. */
export function AvatarEditor({ value, onChange, onLocked }: {
  value: Avatar; onChange: (a: Avatar) => void; onLocked?: (item: WardrobeItem) => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Body');
  const [sub, setSub] = useState<Slot>('top');
  const [items, setItems] = useState<WardrobeItem[]>([]);

  useEffect(() => {
    supabase.rpc('my_wardrobe').then(({ data }) => setItems(((data ?? []) as WardrobeItem[]).filter((i) => ART[i.key])));
  }, []);
  useEffect(() => { setSub(tab === 'Extras' ? 'hat' : 'top'); }, [tab]);

  const set = (patch: Partial<Avatar>) => onChange({ ...value, ...patch });
  const slotItems = useMemo(() => items.filter((i) => i.slot === sub), [items, sub]);
  const current = value[sub];
  const currentItem = items.find((i) => i.key === current);
  const colorKey = `${sub}Color` as keyof Avatar;
  const showColours = current !== 'none' && (currentItem ? currentItem.colorable : true);

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}
            style={[styles.tab, tab === t ? styles.tabOn : null]}>
            <Text style={[styles.tabText, tab === t ? { color: colors.paper } : null]}>{t.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'Body' ? (
        <>
          <Text style={styles.h}>Body style</Text>
          <View style={styles.grid}>
            {BODY.map((b) => (
              <Tile key={b.key} on={value.body === b.key} label={b.label} onPress={() => set({ body: b.key })}>
                <Character avatar={{ ...value, body: b.key }} size={4} />
              </Tile>
            ))}
          </View>
          <Text style={styles.note}>Any hair or clothes go with any body style.</Text>
          <Text style={styles.h}>Skin tone</Text>
          <Swatches colors={SKIN_TONES} value={value.skin} onPick={(c) => set({ skin: c })} label="Skin tone" />
        </>
      ) : null}

      {tab === 'Hair' ? (
        <>
          <Text style={styles.h}>Hairstyle</Text>
          <View style={styles.grid}>
            {HAIR_STYLES.map((h) => (
              <Tile key={h} on={value.hair === h} label={HAIR_LABEL[h] ?? h} onPress={() => set({ hair: h })}>
                <Character avatar={{ ...value, hair: h, hat: 'none' }} size={4} crop="portrait" />
              </Tile>
            ))}
          </View>
          <Text style={styles.h}>Hair colour</Text>
          <Swatches colors={HAIR_COLORS} value={value.hairColor} onPick={(c) => set({ hairColor: c })} label="Hair colour" />
        </>
      ) : null}

      {tab === 'Clothes' || tab === 'Extras' ? (
        <>
          <View style={styles.subTabs}>
            {(tab === 'Clothes' ? ['top', 'bottom', 'shoes'] : ['hat', 'neck', 'pack'] as Slot[]).map((s) => (
              <Pressable key={s} onPress={() => setSub(s as Slot)} style={[styles.subTab, sub === s ? styles.subTabOn : null]} accessibilityRole="tab" accessibilityState={{ selected: sub === s }}>
                <Text style={[styles.subText, sub === s ? { color: colors.ink } : null]}>{SLOT_LABEL[s as Slot]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.grid}>
            {['hat', 'neck', 'pack'].includes(sub) ? (
              <Tile on={current === 'none'} label="None" onPress={() => set({ [sub]: 'none' } as Partial<Avatar>)}>
                <Character avatar={{ ...value, [sub]: 'none' }} size={4} crop={sub === 'hat' ? 'portrait' : undefined} />
              </Tile>
            ) : null}
            {slotItems.map((it) => (
              <Tile key={it.key} on={current === it.key} label={it.name} rarity={it.source === 'starter' ? undefined : it.rarity}
                locked={!it.owned} lockText={!it.owned ? (it.source === 'landmark' ? `Stamp ${it.landmark_name}` : `${it.price_coins} coins`) : undefined}
                onPress={() => (it.owned ? set({ [sub]: it.key } as Partial<Avatar>) : onLocked?.(it))}>
                <Character avatar={{ ...value, [sub]: it.key }} size={4} crop={sub === 'hat' ? 'portrait' : undefined} />
              </Tile>
            ))}
          </View>
          {showColours ? (
            <>
              <Text style={styles.h}>{SLOT_LABEL[sub]} colour</Text>
              <Swatches colors={CLOTH_COLORS} value={value[colorKey] as string} onPick={(c) => set({ [colorKey]: c } as Partial<Avatar>)} label={`${SLOT_LABEL[sub]} colour`} />
            </>
          ) : currentItem && currentItem.source !== 'starter' ? (
            <Text style={styles.note}>{currentItem.description ?? 'A special item with its own colours.'}</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Tile({ on, label, onPress, children, locked, lockText, rarity }: {
  on: boolean; label: string; onPress: () => void; children: ReactNode; locked?: boolean; lockText?: string; rarity?: Rarity;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={locked ? `${label}, locked: ${lockText}` : label}
      style={[styles.tile, rarity ? { borderColor: rarityColor(rarity) } : null, on ? [styles.tileOn, hardShadow(3, 3)] : null]}>
      <View style={[styles.tileArt, locked ? { opacity: 0.35 } : null]}>{children}</View>
      <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
      {locked ? <Text style={styles.lock} numberOfLines={2}>🔒 {lockText}</Text> : null}
    </Pressable>
  );
}

function Swatches({ colors: list, value, onPick, label }: { colors: string[]; value: string; onPick: (c: string) => void; label: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingRight: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {list.map((c) => {
        const on = value.toLowerCase() === c.toLowerCase();
        return <Pressable key={c} onPress={() => onPick(c)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${label} ${c}`}
          style={[styles.swatch, { backgroundColor: c }, on ? [styles.swatchOn, hardShadow(3, 3)] : null]} />;
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderWidth: 3, borderColor: colors.ink },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.card },
  tabOn: { backgroundColor: colors.ink },
  tabText: { fontFamily: fonts.labelBold, fontSize: 11, color: colors.ink },
  subTabs: { flexDirection: 'row', gap: 8 },
  subTab: { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  subTabOn: { borderBottomColor: colors.stamp },
  subText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.muted },
  h: { fontFamily: fonts.labelBold, fontSize: 11, color: colors.ink, letterSpacing: 0.6 },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '30.5%', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  tileOn: { borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FFF8E6' },
  tileArt: { height: 100, justifyContent: 'center' },
  tileLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, textAlign: 'center' },
  lock: { fontFamily: fonts.body, fontSize: 10.5, color: colors.muted, textAlign: 'center' },
  swatch: { width: 38, height: 38, borderWidth: 2, borderColor: colors.line },
  swatchOn: { width: 42, height: 42, borderWidth: 3, borderColor: colors.ink },
});

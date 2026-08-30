import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleProp, Text, TextInput, TextStyle } from 'react-native';
import { colors } from '@/theme';

/**
 * Tap the text → single-line edit. It saves and exits on Enter, on keyboard
 * dismissal (incl. the Android back button), and when you leave the screen.
 * There is never a lingering cursor and never a Save button — after saving it's
 * just text again.
 */
export function InlineEdit({
  value,
  onSave,
  placeholder,
  textStyle,
  restColor = colors.ink,
  editColor = colors.ink,
  emptyColor = colors.ash,
}: {
  value: string | null;
  onSave: (v: string) => void;
  placeholder: string;
  textStyle?: StyleProp<TextStyle>;
  restColor?: string;
  editColor?: string;
  emptyColor?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  // keep the shown value fresh when it changes externally (e.g. AI fills a title)
  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  const state = useRef({ editing, draft, value });
  state.current = { editing, draft, value };

  const finish = () => {
    const { editing: wasEditing, draft: d, value: v } = state.current;
    if (!wasEditing) return;
    setEditing(false);
    const next = d.trim();
    if (next !== (v ?? '').trim()) onSave(next);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // keyboard dismissed (swipe-down or Android back) while editing → save + exit
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => finishRef.current());
    return () => sub.remove();
  }, []);

  // leaving the screen mid-edit → save
  useEffect(() => () => finishRef.current(), []);

  if (editing) {
    return (
      <TextInput
        autoFocus
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={finish}
        onBlur={finish}
        onEndEditing={finish}
        blurOnSubmit
        returnKeyType="done"
        placeholder={placeholder}
        placeholderTextColor={emptyColor}
        selectionColor={colors.ember}
        style={[textStyle, { color: editColor, padding: 0 }]}
      />
    );
  }

  return (
    <Pressable
      onPress={() => {
        setDraft(value ?? '');
        setEditing(true);
      }}
      hitSlop={8}
    >
      <Text style={[textStyle, { color: value ? restColor : emptyColor }]}>
        {value || placeholder}
      </Text>
    </Pressable>
  );
}

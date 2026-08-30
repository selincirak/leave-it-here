import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { TextAction } from '@/components/TextAction';
import { colors, space, text } from '@/theme';

/**
 * Optional detail, added later — "anything else to remember". Tap "add detail",
 * type freely (Enter = new line). It autosaves and closes when the keyboard is
 * dismissed or you leave the screen — no Save button, no lingering cursor. A
 * long detail collapses to a few lines with "more"; tap the text to reopen.
 */
export function NoteField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  const st = useRef({ editing, draft, value });
  st.current = { editing, draft, value };

  const finish = () => {
    const { editing: was, draft: d, value: v } = st.current;
    if (!was) return;
    setEditing(false);
    if ((d.trim() || '') !== (v ?? '')) onSave(d);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => finishRef.current());
    return () => sub.remove();
  }, []);
  useEffect(() => () => finishRef.current(), []);

  if (editing) {
    return (
      <TextInput
        autoFocus
        multiline
        value={draft}
        onChangeText={setDraft}
        onBlur={finish}
        onEndEditing={finish}
        placeholder="add detail"
        placeholderTextColor={colors.ash}
        selectionColor={colors.ember}
        style={[
          text.body,
          { color: colors.graphite, lineHeight: 24, padding: 0, marginTop: space(6), minHeight: 24 },
        ]}
      />
    );
  }

  if (!value) {
    return (
      <View style={{ marginTop: space(6), alignSelf: 'flex-start' }}>
        <TextAction
          tone="ghost"
          label="add detail"
          textStyle={text.meta}
          onPress={() => {
            setDraft('');
            setEditing(true);
          }}
        />
      </View>
    );
  }

  const long = value.length > 180 || value.split('\n').length > 5;
  return (
    <View style={{ marginTop: space(6) }}>
      <Pressable
        onPress={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        <Text
          style={[text.body, { color: colors.graphite, lineHeight: 24 }]}
          numberOfLines={long && !expanded ? 4 : undefined}
        >
          {value}
        </Text>
      </Pressable>
      {long && (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          hitSlop={8}
          style={{ marginTop: space(1), alignSelf: 'flex-start' }}
        >
          <Text style={[text.meta, { color: colors.slate }]}>{expanded ? 'less' : 'more'}</Text>
        </Pressable>
      )}
    </View>
  );
}

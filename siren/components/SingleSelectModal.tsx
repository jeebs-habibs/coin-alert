import { getTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

interface SingleSelectModalProps<T> {
  options: T[];
  selected: T;
  onSelect: (option: T) => void;
  title: string;
  getOptionLabel: (option: T) => string;
}

export default function SingleSelectModal<T>({
  options,
  selected,
  onSelect,
  title,
  getOptionLabel,
}: SingleSelectModalProps<T>) {
  const scheme = useColorScheme();
  const theme = getTheme(scheme);
  const styles = getStyles(theme) 
  const [visible, setVisible] = useState(false);

  const handleSelect = (option: T) => {
    onSelect(option);
    setVisible(false);
  };

  return (
    <>
<View style={{ alignItems: 'flex-end', marginRight: 12 }}>
  <TouchableOpacity
    style={styles.button}
    onPress={() => setVisible(true)}
    activeOpacity={0.7}
  >
    <Text style={[styles.buttonText, { color: "#888" }]}>
      {getOptionLabel(selected)}
    </Text>
    <Ionicons name="chevron-down" size={18} color="#888" />
  </TouchableOpacity>
</View>


      <Modal transparent visible={visible} animationType="none">
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setVisible(false)}
          />
          <SafeAreaView
            style={[
              styles.modalContainer,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {title}
              </Text>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color="#888" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={(_, index) => index.toString()}
              renderItem={({ item }) => {
                const label = getOptionLabel(item);
                const isSelected = label === getOptionLabel(selected);
                return (
                  <TouchableOpacity
                    onPress={() => handleSelect(item)}
                    style={[
                      styles.option,
                      isSelected && {
                        backgroundColor: theme.colors.primary + '22',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && {
                          color: theme.colors.primary,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {label}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const { height: windowHeight } = Dimensions.get('window');

const getStyles = (theme: ReturnType<typeof getTheme>) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 10,
    margin: 8,
    maxWidth: 110,
    backgroundColor: "#e4e4e4",
  },
  buttonText: {
    fontSize: 14,
  },
  fullscreenContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000077',
  },
  modalContainer: {
    maxHeight: windowHeight / 2,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
    margin: 8
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  optionText: {
    fontSize: 16,
    color: theme.colors.text
  },
});

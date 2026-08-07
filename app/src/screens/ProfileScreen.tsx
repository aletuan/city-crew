// Profile: the account surface. Signed out it carries the email-OTP
// sign-in flow; signed in it shows the account and a quiet sign-out.
//
// Same materials as everywhere else: translucent charcoal card, warm
// hairlines, champagne reserved for the primary action.

import React, { useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AmbientWarmth, Card, Screen, useTabBarClearance } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius, space, type } from '../theme';

function PrimaryButton({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={busy ? undefined : onPress} accessibilityRole="button">
      <LinearGradient {...gradAI} style={s.primaryBtn}>
        {busy
          ? <ActivityIndicator color="#141310" />
          : <Text style={s.primaryBtnText}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

function SignInCard() {
  const { t } = useI18n();
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      Keyboard.dismiss();
      await requestCode(email.trim());
      setStep('code');
    });

  const confirm = () =>
    run(async () => {
      Keyboard.dismiss();
      await verifyCode(email.trim(), code.trim());
    });

  return (
    <Card style={s.card}>
      <Text style={s.cardTitle}>{t('Sign in to cityCrew', 'Đăng nhập cityCrew')}</Text>
      <Text style={s.cardBody}>
        {step === 'email'
          ? t(
              "Enter your email and we'll send you a 6-digit code. No password needed.",
              'Nhập email của bạn, chúng tôi sẽ gửi mã 6 số. Không cần mật khẩu.',
            )
          : t(
              `We sent a code to ${email.trim()}. Enter it below.`,
              `Mã đã được gửi tới ${email.trim()}. Nhập mã bên dưới.`,
            )}
      </Text>

      {step === 'email' ? (
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t('you@email.com', 'ban@email.com')}
          placeholderTextColor={colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          onSubmitEditing={sendCode}
          returnKeyType="send"
        />
      ) : (
        <TextInput
          style={[s.input, s.codeInput]}
          value={code}
          onChangeText={setCode}
          placeholder="••••••"
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          maxLength={6}
          onSubmitEditing={confirm}
          returnKeyType="done"
        />
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}

      {step === 'email' ? (
        <PrimaryButton label={t('Send code', 'Gửi mã')} onPress={sendCode} busy={busy} />
      ) : (
        <>
          <PrimaryButton label={t('Verify & sign in', 'Xác nhận & đăng nhập')} onPress={confirm} busy={busy} />
          <Pressable onPress={() => { setStep('email'); setCode(''); setError(null); }}>
            <Text style={s.link}>{t('Use a different email', 'Dùng email khác')}</Text>
          </Pressable>
        </>
      )}
    </Card>
  );
}

function AccountCard() {
  const { t } = useI18n();
  const { email, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const initial = (email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <Card style={s.card}>
      <View style={s.accountRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.accountEmail} numberOfLines={1}>{email}</Text>
          <Text style={s.accountMeta}>{t('Signed in', 'Đã đăng nhập')}</Text>
        </View>
      </View>
      <Text style={s.cardBody}>
        {t(
          'Saved places and personal collections are coming to your account next.',
          'Lưu địa điểm và bộ sưu tập cá nhân sẽ sớm có trong tài khoản của bạn.',
        )}
      </Text>
      <Pressable
        style={s.quietBtn}
        onPress={async () => {
          setBusy(true);
          try { await signOut(); } finally { setBusy(false); }
        }}
      >
        {busy
          ? <ActivityIndicator color={colors.textSecondary} />
          : <Text style={s.quietBtnText}>{t('Sign out', 'Đăng xuất')}</Text>}
      </Pressable>
    </Card>
  );
}

export default function ProfileScreen() {
  const { t } = useI18n();
  const { ready, session } = useAuth();
  const tabClearance = useTabBarClearance();

  return (
    <Screen title={t('Profile', 'Cá nhân')}>
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ paddingBottom: tabClearance }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!ready
              ? <ActivityIndicator color={colors.champagne} style={{ marginTop: 48 }} />
              : session ? <AccountCard /> : <SignInCard />}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: space.page, padding: space.cardPadding, gap: 14 },
  cardTitle: { color: colors.text, ...type.cardTitle },
  cardBody: { color: colors.textSecondary, ...type.body, lineHeight: 23 },

  input: {
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 16,
  },
  codeInput: { letterSpacing: 8, fontSize: 22, fontWeight: font.semibold, textAlign: 'center' },
  error: { color: colors.bad, ...type.meta, lineHeight: 21 },

  primaryBtn: {
    borderRadius: radius.input, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: '#141310', fontSize: 16, fontWeight: font.semibold },
  link: { color: colors.champagne, ...type.meta, textAlign: 'center', paddingVertical: 2 },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlassStrong, borderWidth: 1, borderColor: colors.borderGlass,
  },
  avatarText: { color: colors.champagne, fontSize: 20, fontWeight: font.semibold },
  accountEmail: { color: colors.text, ...type.cardTitle },
  accountMeta: { color: colors.textTertiary, ...type.meta, marginTop: 2 },

  quietBtn: {
    borderRadius: radius.input, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderGlassSoft, backgroundColor: colors.surfaceGlass,
  },
  quietBtnText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },
});

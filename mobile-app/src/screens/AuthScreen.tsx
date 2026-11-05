import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native'
import type { TextInputProps } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { toAuthFailure, validateEmail, validatePassword } from '@/auth/errors'
import { setKeepSignedIn, supabase, webUrl } from '../supabase'
import { useTheme } from '../theme'
import { Button, Card, Chip, Text } from '../ui'

type Mode = 'sign_in' | 'sign_up' | 'forgot'

interface Notice {
  tone: 'error' | 'info'
  text: string
}

/** Supabase auth errors in plain language; React Native reports no connection as "Network request failed". */
function friendly(error: { message: string; code?: string; status?: number }): string {
  const failure = toAuthFailure(error, !/network request failed/i.test(error.message))
  if (failure.kind === 'invalid_credentials') return 'That email and password don’t match. Check for typos, or reset your password.'
  return failure.message
}

function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      <Text size="sm" tone="muted" weight="500">{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={theme.subtle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          color: theme.fg,
          fontSize: 16 * theme.textScale,
          backgroundColor: theme.sunken,
          borderWidth: 1,
          borderColor: focused ? theme.accent : theme.line,
          borderRadius: theme.radius(10),
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      />
    </View>
  )
}

export function AuthScreen() {
  const theme = useTheme()
  const [mode, setMode] = useState<Mode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Starts ticked on every sign-in, so one untick never sticks.
  const [keep, setKeep] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const switchMode = (next: Mode) => {
    setMode(next)
    setNotice(null)
  }

  const submit = async () => {
    if (busy) return
    const invalid = validateEmail(email) ?? (mode === 'forgot' ? null : validatePassword(password, mode))
    if (invalid) {
      setNotice({ tone: 'error', text: invalid })
      return
    }
    setBusy(true)
    setNotice(null)
    const address = email.trim()
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: webUrl })
        if (error) setNotice({ tone: 'error', text: friendly(error) })
        else setNotice({ tone: 'info', text: `If ${address} has an account, a reset link is on its way. Open it, choose a new password on the Daybook website, then sign in here.` })
        return
      }
      // Decides where the new session is stored, so it must be set before signing in.
      setKeepSignedIn(keep)
      if (mode === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password })
        if (error) setNotice({ tone: 'error', text: friendly(error) })
        return
      }
      const { data, error } = await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: webUrl } })
      if (error) setNotice({ tone: 'error', text: friendly(error) })
      else if (!data.session) setNotice({ tone: 'info', text: `Check ${address} for a confirmation link, then sign in here.` })
    } catch (error) {
      setNotice({ tone: 'error', text: friendly(error instanceof Error ? error : { message: String(error) }) })
    } finally {
      setBusy(false)
    }
  }

  const action = { sign_in: 'Sign in', sign_up: 'Create account', forgot: 'Send reset link' }[mode]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.canvas }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 24 }} keyboardShouldPersistTaps="handled">
          {/* Navy title block: the same frame color as the app's header once signed in. */}
          <View style={{ gap: 6, backgroundColor: theme.frame, borderRadius: theme.radius(16), padding: 20 }}>
            <Text size="xl" display accessibilityRole="header" style={{ color: theme.frameFg }}>Daybook</Text>
            <Text style={{ color: theme.frameFg, opacity: 0.8 }}>
              {mode === 'forgot' ? 'We’ll email you a link to choose a new password.' : 'Your tasks and calendar, the same on every device.'}
            </Text>
          </View>

          {mode !== 'forgot' && (
            <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="tablist">
              <Chip label="Sign in" on={mode === 'sign_in'} onPress={() => switchMode('sign_in')} />
              <Chip label="Create account" on={mode === 'sign_up'} onPress={() => switchMode('sign_up')} />
            </View>
          )}

          <Card>
            <View style={{ padding: 16, gap: 16 }}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                returnKeyType={mode === 'forgot' ? 'send' : 'next'}
                onSubmitEditing={mode === 'forgot' ? () => void submit() : undefined}
              />
              {mode !== 'forgot' && (
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'sign_up' ? 'At least 8 characters' : undefined}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
                  textContentType={mode === 'sign_up' ? 'newPassword' : 'password'}
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                />
              )}
              {mode !== 'forgot' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text>Keep me signed in</Text>
                    <Text size="xs" tone="subtle">Off: you’re signed out when Daybook is closed.</Text>
                  </View>
                  <Switch value={keep} onValueChange={setKeep} accessibilityLabel="Keep me signed in" trackColor={{ true: theme.accent }} />
                </View>
              )}
            </View>
          </Card>

          {notice && (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ padding: 14, borderRadius: theme.radius(10), backgroundColor: notice.tone === 'error' ? theme.overdueSoft : theme.accentSoft }}
            >
              <Text size="sm" tone={notice.tone === 'error' ? 'overdue' : 'fg'}>{notice.text}</Text>
            </View>
          )}

          <View style={{ gap: 12 }}>
            <Button label={busy ? 'One moment…' : action} variant="primary" onPress={() => void submit()} />
            <Pressable
              accessibilityRole="button"
              onPress={() => switchMode(mode === 'forgot' ? 'sign_in' : 'forgot')}
              hitSlop={8}
              style={({ pressed }) => ({ alignSelf: 'center', padding: 8, opacity: pressed ? 0.6 : 1 })}
            >
              <Text size="sm" tone="accent" weight="500">{mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

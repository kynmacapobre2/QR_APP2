import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    // ----------------------------------------------------------
    // Validation
    // ----------------------------------------------------------

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (cleanName.length < 2) {
      setError('Please enter your full name.');
      return;
    }

    if (cleanName.length > 80) {
      setError('Name must be 80 characters or fewer.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    // ----------------------------------------------------------
    // Create the account
    // New accounts are always students. Teacher and administrator
    // roles are assigned by an administrator, never self-selected.
    // ----------------------------------------------------------

    setLoading(true);

    try {
      const { error: authError } = await signUp(cleanEmail, password, {
        full_name: cleanName,
      });

      if (authError) {
        setError(friendlyAuthError(authError.message));
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerContainer}>
              <Header title="QR Attendance" />
            </View>

            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Register to start recording attendance
            </Text>

            {success ? (
              <View style={styles.successContainer}>
                <Text style={styles.successTitle}>Check your email!</Text>

                <Text style={styles.successText}>
                  We sent a confirmation link to {email.trim()}. Open the
                  link to verify your account, then come back and sign in.
                </Text>

                <Link href="/login" style={styles.link}>
                  Back to Sign In
                </Link>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full Name"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="words"
                  editable={!loading}
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@school.edu"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!loading}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  editable={!loading}
                />

                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  editable={!loading}
                />

                <Text style={styles.roleNote}>
                  New accounts are created as student accounts. A teacher or
                  administrator will upgrade your role if needed.
                </Text>

                {error && <Text style={styles.error}>{error}</Text>}

                {loading ? (
                  <ActivityIndicator
                    size="large"
                    color={COLORS.primary}
                    style={styles.loader}
                  />
                ) : (
                  <AppButton
                    theme="primary"
                    title="Sign Up"
                    icon="person-add-outline"
                    onPress={handleRegister}
                  />
                )}
              </View>
            )}

            {!success && (
              <Link href="/login" style={styles.link}>
                Already have an account? Sign In
              </Link>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

// ============================================================
// HELPERS
// ============================================================

function friendlyAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('already registered') || lower.includes('already exists')) {
    return 'An account with that email already exists. Try signing in instead.';
  }

  if (lower.includes('password')) {
    return 'That password was rejected. Use at least 6 characters.';
  }

  if (lower.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (lower.includes('email')) {
    return 'That email address was rejected. Please check it and try again.';
  }

  return message;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'left',
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'left',
    marginBottom: 32,
  },

  form: {
    marginBottom: 24,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },

  input: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },

  roleNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 16,
    padding: 12,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  error: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'left',
    marginTop: 12,
    marginBottom: 4,
  },

  loader: {
    marginVertical: 16,
  },

  link: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },

  successContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
});

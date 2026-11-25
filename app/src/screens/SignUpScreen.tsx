// Sign up — name, email, password and confirmation, per the reference.
// When Supabase requires email confirmation the flow falls back to a
// emailed code (links in the email can't open Expo Go). Its length is
// a project setting, so nothing here assumes one — see `lib/otp.ts`.

import React from 'react';
import { AuthScreen } from '../components/authUi';
import type { Nav } from '../nav';
import { FormStep } from './signUp/FormStep';
import { ConfirmStep, TasteStep, WelcomeStep } from './signUp/steps';
import { useSignUp } from './signUp/useSignUp';

export { HANDLE_CHECK_MS } from './signUp/useSignUp';

// One `AuthScreen` under all four steps, as it was when each step
// returned its own: the scroll view and the keyboard's lift are the same
// instance from the form to the welcome.
export default function SignUpScreen({ navigation }: { navigation: Nav }) {
  const f = useSignUp();
  return (
    <AuthScreen>
      {f.step === 'taste' ? <TasteStep f={f} />
        : f.step === 'confirm' ? <ConfirmStep f={f} />
          : f.step === 'welcome' ? <WelcomeStep f={f} navigation={navigation} />
            : <FormStep f={f} navigation={navigation} />}
    </AuthScreen>
  );
}

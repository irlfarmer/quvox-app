import { supabase, signInWithEmail, signUpWithEmail, signOut } from './supabase';

async function testAuth() {
  console.log('Starting authentication tests...\n');

  // Test 1: Check Supabase connection
  console.log('Test 1: Checking Supabase connection...');
  try {
    // Use a simple auth check instead of querying tables
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    console.log('✓ Supabase connection successful\n');
  } catch (error) {
    console.error('✗ Supabase connection failed:', error);
    return;
  }

  // Test 2: Sign up a new user
  console.log('Test 2: Testing sign up...');
  const testEmail = 'test.user@deskbin.test';
  const testPassword = 'TestPassword123!';
  const testDisplayName = 'Test User';

  try {
    // First try to sign out if there's an existing session
    await signOut().catch(() => {});
    
    // Check if user already exists by trying to sign in
    const existingUser = await signInWithEmail(testEmail, testPassword).catch((): null => null);
    if (existingUser) {
      console.log('✓ User already exists, skipping signup\n');
    } else {
      // Add a delay before signup to avoid rate limiting
      console.log('Waiting for rate limit cooldown...');
      await new Promise(resolve => setTimeout(resolve, 40000)); // 40 second delay
      
      const result = await signUpWithEmail(testEmail, testPassword, testDisplayName);
      console.log('✓ Sign up successful');
      console.log('User ID:', result.user?.id);
      console.log('User Email:', result.user?.email, '\n');
    }
  } catch (error) {
    if (error.code === 'over_email_send_rate_limit') {
      console.error('✗ Sign up failed: Rate limit exceeded. Please wait 40 seconds and try again.');
    } else {
      console.error('✗ Sign up failed:', error);
    }
    return;
  }

  // Test 3: Sign in with the created user
  console.log('Test 3: Testing sign in...');
  try {
    const result = await signInWithEmail(testEmail, testPassword);
    console.log('✓ Sign in successful');
    console.log('User ID:', result.user?.id);
    console.log('User Email:', result.user?.email, '\n');
  } catch (error) {
    console.error('✗ Sign in failed:', error);
    return;
  }

  // Test 4: Sign out
  console.log('Test 4: Testing sign out...');
  try {
    await signOut();
    console.log('✓ Sign out successful\n');
  } catch (error) {
    console.error('✗ Sign out failed:', error);
    return;
  }

  console.log('All authentication tests completed successfully!');
}

// Run the tests
testAuth().catch(console.error); 